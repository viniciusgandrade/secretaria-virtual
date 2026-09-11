import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AppointmentsService } from '../appointments/appointments.service';
import { Doctor } from '../doctors/doctor.schema';
import { ChatService } from '../ai/chat.service';
import { PromptsService } from '../prompts/prompts.service';
import { PatientsService } from '../patients/patients.service';
import { WhatsappService } from '../whatsapp/whatsapp.service';
import { ChatContext, ChatContextDocument } from './schemas/chat-context.schema';
import { AppointmentStatus } from '../appointments/appointment.schema';
import {
  ContextoPaciente,
  InterpretacaoMensagem,
  RespostaSugestaoHorarios
} from '../common/interfaces';
import { CalendarService } from '../calendar/calendar.service';
import { PatientDocument } from '../patients/patient.schema';

@Injectable()
export class BotService {
  private readonly logger = new Logger(BotService.name);

  constructor(
    private readonly chatService: ChatService,
    private readonly patients: PatientsService,
    private readonly prompts: PromptsService,
    private readonly whatsapp: WhatsappService,
    private readonly calendarService: CalendarService,
    private readonly appointmentsService: AppointmentsService,
    @InjectModel(Doctor.name) private readonly doctorModel: Model<Doctor>,
    @InjectModel(ChatContext.name) private chatContextModel: Model<ChatContextDocument>
  ) {}

  async processarWebhook(payload: any) {
    const phone = payload?.sender?.id;
    const message = payload?.msgContent?.conversation || payload?.msgContent?.extendedTextMessage?.text;

    if (!phone || !message) {
      this.logger.warn('Payload incompleto recebido no webhook:', JSON.stringify(payload));
      return;
    }

    let paciente = await this.patients.buscarPorTelefone(phone);
    if (!paciente) {
      paciente = await this.patients.criarPaciente({ telefone: phone });
    }

    await this.prompts.salvarMensagem(paciente._id, {
      origem: 'paciente',
      texto: message,
      dataHora: new Date()
    });

    if (!paciente.nome) {
      const extraido = await this.chatService.extrairNomePaciente(message);

      if (!extraido?.nomePaciente) {
        const respostaNome = await this.chatService.gerarRespostaNatural(
          `Antes de continuarmos, como você gostaria de ser chamada?`,
          undefined,
          true
        );
        await this.whatsapp.enviarMensagem(phone, respostaNome);
        return;
      } else {
        paciente.nome = extraido.nomePaciente;
        await this.patients.atualizarPaciente(paciente._id, { nome: paciente.nome });
        await this.chatContextModel.findOneAndUpdate(
          { pacienteId: paciente._id },
          {
            pacienteId: paciente._id,
            contexto: { nome: paciente.nome, nomeConfirmado: false }
          },
          { upsert: true }
        );
      }
    }
    const doctors = await this.doctorModel.find({});
    const contextoAtual = await this.chatContextModel.findOne({ pacienteId: paciente._id });
    const { interpretacao: intencaoParcial } = await this.chatService.interpretarMensagem(
      message,
      doctors,
      contextoAtual?.contexto?.sugestoesHorarios ?? [],
      contextoAtual?.contexto
    );
    const interpretado = mesclarIntencaoComContexto(intencaoParcial, contextoAtual?.contexto);
    const resposta = await this.processarMensagem(paciente, interpretado);
    await this.whatsapp.enviarMensagem(phone, resposta);
  }

  async processarMensagem(
    paciente: PatientDocument,
    interpretado: InterpretacaoMensagem
  ): Promise<string> {
    this.logger.log(interpretado);
    if (interpretado.recusarRemarcacao) {
      await this.chatContextModel.findOneAndUpdate(
        { pacienteId: paciente._id },
        {
          pacienteId: paciente._id,
          contexto: {
            nome: paciente.nome,
            nomeConfirmado: true,
            recusarRemarcacao: false,
            tipoConsulta: null,
            formato: null,
            preferenciaMedica: null,
            sugestoesHorarios: []
          }
        },
        { upsert: true }
      );

      return await this.chatService.gerarRespostaNatural(
        `Tudo bem, ${paciente.nome}! Quando quiser, é só me chamar que estarei por aqui. 💕`,
        paciente.nome
      );
    }
    if (interpretado.cancelarAgendamento || interpretado.remarcarAgendamento) {
      // Busca o agendamento futuro mais próximo
      const agendamentos = await this.appointmentsService.buscarAgendamentosFuturos(paciente._id);

      if (agendamentos.length === 0) {
        return await this.chatService.gerarRespostaNatural(
          `Não encontrei nenhuma consulta agendada no momento. Se precisar de ajuda com outro assunto, estou por aqui 😊`,
          paciente.nome
        );
      }

      const proxima = agendamentos[0];
      await this.appointmentsService.cancelarAgendamento((proxima as any)._id);
      const doctor = await this.doctorModel.findById(proxima.medicaId);
      await this.calendarService.cancelarEvento(doctor!.calendarId!, proxima.eventoId);

      const contexto: ContextoPaciente = {
        recusarRemarcacao: false,
        alternarFormato: false,
        cancelarAgendamento: false,
        preferenciaInicioDisponibilidade: null,
        periodoPreferido: null,
        preferenciaNegativaDeDias: false,
        remarcarAgendamento: false,
        requerIntervencaoHumana: false,
        nome: paciente.nome ?? null,
        nomeConfirmado: !!paciente.nome,
        tipoConsulta: proxima.tipoConsulta ?? null,
        preferenciaMedica: proxima.medicaId.nome ?? null,
        formato: proxima.formato ?? null,
        diasPreferidos: [],
        sugestoesHorarios: []
      };

      if (interpretado.cancelarAgendamento) {
        return await this.chatService.gerarRespostaNatural(
          `Poxa, {{NOME}}, sua consulta foi cancelada...  
Mas se quiser, posso te ajudar a **remarcar** para outro dia. Que tal vermos novas opções de horário? 💕`,
          paciente.nome
        );
      }

      await this.chatContextModel.findOneAndUpdate(
        { pacienteId: paciente._id },
        { pacienteId: paciente._id, contexto },
        { upsert: true }
      );

      return await this.chatService.gerarRespostaNatural(
        `Entendido! Vamos remarcar sua consulta. Vou te mostrar novas opções de horário. 💬`,
        paciente.nome
      );
    }
    if (interpretado.requerIntervencaoHumana) {
      await this.chatContextModel.findOneAndUpdate(
        { pacienteId: paciente._id },
        { pacienteId: paciente._id, contexto: { ...interpretado }, status: 'esperando_humano' },
        { upsert: true }
      );

      return await this.chatService.gerarRespostaNatural(
        `Entendi que você precisa de uma atenção especial agora. 😌\nVou chamar alguém da nossa equipe para continuar te ajudando com todo carinho, tudo bem?\n\nAguarde um pouquinho por aqui. 💕`,
        paciente.nome,
        false
      );
    }
    const respostaInicial = await this.avaliarInicioDeConversaComIntencao(paciente, interpretado);
    if (respostaInicial) {
      return respostaInicial;
    }
    const conversa = await this.chatContextModel.findOne({ pacienteId: paciente._id });
    const estadoAnteriorRaw = conversa?.contexto ?? {};
    const estadoAnterior = JSON.parse(JSON.stringify(estadoAnteriorRaw));
    const agora = new Date();
    const ultimaInteracao = conversa?.updatedAt;
    const tempoInativo = ultimaInteracao ? agora.getTime() - new Date(ultimaInteracao).getTime() : 0;
    const saudacao = tempoInativo > 1000 * 60 * 60 * 2 ? this.saudacaoPorHorario(agora) : undefined;

    const contextoAtualizado: ContextoPaciente = {
      ...estadoAnterior,
      ...interpretado, // primeiro: o que foi mesclado mais recentemente
      sugestoesHorarios: estadoAnterior?.sugestoesHorarios ?? [],
      nome: paciente.nome ?? estadoAnterior?.nome ?? null,
      nomeConfirmado: !!paciente.nome
    };
    this.logger.log('update');
    this.logger.log(contextoAtualizado);
    await this.chatContextModel.findOneAndUpdate(
      { pacienteId: paciente._id },
      {
        pacienteId: paciente._id,
        contexto: contextoAtualizado
      },
      { upsert: true }
    );

    // Se a paciente responder que quer tentar outro formato (sem especificar qual), alternar entre online/presencial
    if (
      interpretado.alternarFormato &&
      contextoAtualizado.formato &&
      contextoAtualizado.formato !== 'indiferente'
    ) {
      contextoAtualizado.formato =
        contextoAtualizado.formato === 'presencial' ? 'online' : 'presencial';
    } else if (
      interpretado.formato &&
      interpretado.formato !== 'indiferente' &&
      interpretado.formato !== contextoAtualizado.formato
    ) {
      contextoAtualizado.formato = interpretado.formato;
    }

    await this.chatContextModel.findOneAndUpdate(
      { pacienteId: paciente._id },
      { pacienteId: paciente._id, contexto: contextoAtualizado },
      { upsert: true }
    );

    // Detecta resposta negativa à sugestão de dias de atendimento (antes de sugerir horários)
    if (
      interpretado.preferenciaNegativaDeDias &&
      (!contextoAtualizado.diasPreferidos || contextoAtualizado.diasPreferidos.length === 0)
    ) {
      const candidatas = await this.doctorModel.find({ procedimentos: { $in: [contextoAtualizado.tipoConsulta] } });
      const podeTrocarMedica = candidatas.length > 1;
      const podeTrocarFormato = contextoAtualizado.formato !== null && contextoAtualizado.formato !== undefined;

      const alternativas: string[] = [];
      if (podeTrocarMedica) alternativas.push('trocar de médica');
      if (podeTrocarFormato) alternativas.push('tentar outro formato');
      alternativas.push('escolher uma data a partir de outro dia');

      const sugestao = alternativas.length > 1
        ? `Podemos ${alternativas.slice(0, -1).join(', ')} ou ${alternativas[alternativas.length - 1]}.`
        : `Podemos ${alternativas[0]}.`;

      return await this.chatService.gerarRespostaNatural(
        `Sem problemas! Entendi que os dias informados não funcionam para você. ${sugestao}`,
        paciente.nome
      );
    }

    // Validação cruzada médica + procedimento
    if (contextoAtualizado.preferenciaMedica && contextoAtualizado.tipoConsulta) {
      const doctorSelecionada = await this.doctorModel.findOne({ nome: new RegExp(contextoAtualizado.preferenciaMedica, 'i') });

      const tipo = contextoAtualizado.tipoConsulta;

      if (!doctorSelecionada || !doctorSelecionada.procedimentos.includes(tipo)) {
        const candidatas = await this.doctorModel.find({ procedimentos: tipo });

        if (candidatas.length === 0) {
          return await this.chatService.gerarRespostaNatural(
            `Nenhuma médica cadastrada realiza atendimentos para ${tipo}.`,
            paciente.nome,
            !!saudacao
          );
        }

        if (candidatas.length === 1) {
          const oldDoctor = contextoAtualizado.preferenciaMedica;
          contextoAtualizado.preferenciaMedica = candidatas[0].nome;
          await this.chatContextModel.findOneAndUpdate(
            { pacienteId: paciente._id },
            { pacienteId: paciente._id, contexto: contextoAtualizado },
            { upsert: true }
          );

          return await this.chatService.gerarRespostaNatural(
            `A Dra. ${oldDoctor} não realiza atendimentos para ${tipo}. Mas temos a Dra. ${candidatas[0].nome} que realiza este tipo de atendimento. Podemos seguir com ela?`,
            paciente.nome,
            !!saudacao
          );
        }

        const nomes = candidatas.map(m => m.nome);
        const listaFormatada = nomes.length > 1
          ? `${nomes.slice(0, -1).join(', ')} e ${nomes[nomes.length - 1]}`
          : nomes[0];

        return await this.chatService.gerarRespostaNatural(
          `A Dra. ${contextoAtualizado.preferenciaMedica} não realiza atendimentos para ${tipo}. Mas temos outras médicas que atendem esse procedimento: ${listaFormatada}. Alguma delas é de sua preferência?`,
          paciente.nome,
          !!saudacao
        );
      }
    }

    if (contextoAtualizado.horarioEscolhido) {
      const inicio = new Date(contextoAtualizado.horarioEscolhido.inicio);
      const fim = new Date(contextoAtualizado.horarioEscolhido.fim);

      if (inicio < new Date()) {
        return await this.chatService.gerarRespostaNatural(
          `Esse horário já passou 😔 Poderia escolher outro, por gentileza?`,
          paciente.nome
        );
      }

      const doctor = await this.doctorModel.findOne({ nome: new RegExp(contextoAtualizado.preferenciaMedica!, 'i') });
      const disponivel = await this.appointmentsService.verificarDisponibilidade(
        doctor!._id,
        contextoAtualizado.formato!,
        inicio,
        fim
      );

      if (!disponivel) {
        return await this.chatService.gerarRespostaNatural(
          `Poxa, esse horário acabou de ser preenchido 😢 Posso sugerir outras opções pra você?`,
          paciente.nome,
          !!saudacao
        );
      }

      const eventoId = await this.calendarService.criarEvento(
        doctor!.calendarId!,
        'Consulta Manjedoura',
        `Consulta com paciente ${paciente.nome}`,
        inicio,
        fim
      );

      await this.appointmentsService.criarAgendamento({
        eventoId: eventoId,
        pacienteId: paciente._id,
        medicaId: doctor!._id,
        formato: contextoAtualizado.formato! as any,
        dataHoraInicio: inicio,
        tipoConsulta: contextoAtualizado.tipoConsulta! as any,
        dataHoraFim: fim,
        status: AppointmentStatus.CONFIRMADO
      });

      return await this.chatService.gerarRespostaNatural(
        `Prontinho! Sua consulta com a Dra. ${doctor!.nome} está marcada para ${this.formatarHorario(inicio)}. Até lá! 😊`,
        paciente.nome
      );
    }

    // await this.chatContextModel.findOneAndUpdate(
    //   { pacienteId: paciente._id },
    //   { pacienteId: paciente._id, contexto: contextoAtualizado },
    //   { upsert: true }
    // );

    if (!contextoAtualizado.tipoConsulta) {
      return await this.chatService.gerarRespostaNatural(
        `Oi ${paciente.nome}! 😊 Poderia me contar qual o tipo de atendimento que você gostaria de agendar?`,
        paciente.nome,
        !!saudacao
      );
    }

    if (!contextoAtualizado.preferenciaMedica) {
      const candidatas = await this.doctorModel.find({ procedimentos: { $in: [contextoAtualizado.tipoConsulta] } });

      if (candidatas.length === 1) {
        contextoAtualizado.preferenciaMedica = candidatas[0].nome;
        await this.chatContextModel.findOneAndUpdate(
          { pacienteId: paciente._id },
          { pacienteId: paciente._id, contexto: contextoAtualizado },
          { upsert: true }
        );
        return await this.chatService.gerarRespostaNatural(
          `A Dra. ${candidatas[0].nome} realiza atendimentos para ${contextoAtualizado.tipoConsulta}. Podemos seguir com ela?`,
          paciente.nome,
          !!saudacao
        );
      } else if (candidatas.length > 1) {
        const nomes = candidatas.map(m => m.nome);
        const nomesFormatados = nomes.length > 1
          ? `${nomes.slice(0, -1).join(', ')} e ${nomes[nomes.length - 1]}`
          : nomes[0];
        return await this.chatService.gerarRespostaNatural(
          `Temos ${candidatas.length} médicas que atendem ${contextoAtualizado.tipoConsulta}: ${nomesFormatados}. Alguma delas é sua preferência?`,
          paciente.nome,
          !!saudacao
        );
      } else {
        return await this.chatService.gerarRespostaNatural(
          `Nenhuma médica cadastrada atende o procedimento "${contextoAtualizado.tipoConsulta}".`,
          paciente.nome,
          !!saudacao
        );
      }
    }

    const doctor = await this.doctorModel.findOne({ nome: new RegExp(contextoAtualizado.preferenciaMedica, 'i') });

    if (doctor && !doctor.procedimentos.includes(contextoAtualizado.tipoConsulta)) {
      return await this.chatService.gerarRespostaNatural(
        `A Dra. ${doctor.nome} não atende "${contextoAtualizado.tipoConsulta}". Quer que eu te mostre outras médicas que realizam esse tipo de atendimento? 💁‍♀️`,
        paciente.nome,
        !!saudacao
      );
    }

    if (!contextoAtualizado.formato) {
      return await this.chatService.gerarRespostaNatural(
        `Você prefere ser atendida online ou presencialmente? 😊`,
        paciente.nome,
        !!saudacao
      );
    }

    const resposta = await this.sugerirHorariosDisponiveis(
      contextoAtualizado.preferenciaMedica,
      contextoAtualizado.formato,
      contextoAtualizado.diasPreferidos || [],
      contextoAtualizado.tipoConsulta || 'indiferente',
      contextoAtualizado.preferenciaInicioDisponibilidade ? new Date(contextoAtualizado.preferenciaInicioDisponibilidade) : null,
      0,
      contextoAtualizado.nome ?? '',
      saudacao
    );
    contextoAtualizado.sugestoesHorarios = resposta.listaHorarios;

    await this.chatContextModel.findOneAndUpdate(
      { pacienteId: paciente._id },
      { pacienteId: paciente._id, contexto: contextoAtualizado },
      { upsert: true }
    );

    return resposta.mensagem;
  }

  async avaliarInicioDeConversaComIntencao(paciente: PatientDocument, intencao: InterpretacaoMensagem): Promise<string | null> {
    const agora = new Date();
    const conversa = await this.chatContextModel.findOne({ pacienteId: paciente._id });

    let tempoInativo = Infinity;
    if (conversa?.updatedAt) {
      tempoInativo = agora.getTime() - new Date(conversa.updatedAt).getTime();
    }

    const mensagemTemContexto = !!(
      intencao.tipoConsulta ||
      intencao.preferenciaMedica ||
      intencao.formato ||
      (intencao.diasPreferidos && intencao.diasPreferidos.length > 0) ||
      intencao.horarioEscolhido ||
      intencao.preferenciaInicioDisponibilidade
    );

    if ((!conversa || tempoInativo > 1000 * 60 * 60 * 2) && !mensagemTemContexto) {
      const nome = conversa?.contexto?.nome ?? paciente.nome;

      await this.chatContextModel.findOneAndUpdate(
        { pacienteId: paciente._id },
        {
          pacienteId: paciente._id,
          contexto: {
            nome,
            nomeConfirmado: !!nome
          }
        },
        { upsert: true }
      );

      const saudacao = this.saudacaoPorHorario(new Date()) || "Olá";
      return await this.chatService.gerarRespostaNatural(
        `${saudacao}! Sou a assistente virtual da clínica Manjedoura 😊

Vamos agendar sua consulta. Qual o tipo de atendimento desejado? (Ex: pré-natal, rotina...)`,
        paciente.nome,
        true
      );
    }

    return null;
  }

  saudacaoPorHorario(data: Date): string | undefined {
    const hora = data.getHours();
    if (hora >= 5 && hora < 12) return 'Bom dia';
    if (hora >= 12 && hora < 18) return 'Boa tarde';
    if (hora >= 18 || hora < 5) return 'Boa noite';
    return undefined;
  }


  async sugerirHorariosDisponiveis(
    medicaNome: string | 'indiferente',
    formato: 'online' | 'presencial' | 'indiferente',
    diasPreferidos: string[],
    tipoConsulta: string,
    preferenciaInicioDisponibilidade: Date | null = null,
    profundidadeBusca = 0,
    nome = '',
    saudacao
  ): Promise<RespostaSugestaoHorarios> {
    const agora = new Date();
    const inicioBusca = preferenciaInicioDisponibilidade ?? agora;
    const diasDaSemana = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'];
    const sugestoes: { texto: string; inicio: string; fim: string }[] = [];

    const nomeTurno = (turno: string) => {
      switch (turno) {
        case 'manhã': return 'pela manhã';
        case 'tarde': return 'à tarde';
        case 'noite': return 'à noite';
        default: return turno;
      }
    };

    let medicas: Doctor[];
    if (medicaNome === 'indiferente') {
      medicas = await this.doctorModel.find({});
    } else {
      const doctor = await this.doctorModel.findOne({ nome: new RegExp(medicaNome, 'i') });
      if (!doctor) {
        return {
          mensagem: `Não encontramos a médica ${medicaNome}.`,
          listaHorarios: []
        };
      }
      medicas = [doctor];
    }

    for (const doctor of medicas) {
      const formatosValidos = formato === 'indiferente' ? ['online', 'presencial'] : [formato];

      const agendaPorDia = new Map<number, string[]>();
      for (const item of doctor.agenda) {
        if (!formatosValidos.includes(item.formato)) continue;
        const dia = item.diaSemana;
        const turnos = item.horarios.map(h => parseInt(h.split(':')[0], 10) < 13 ? 'manhã' : 'tarde');
        const turnosNormais = Array.from(new Set(turnos));
        agendaPorDia.set(dia, turnosNormais);
      }

      if (sugestoes.length === 0 && diasPreferidos.length === 0) {
        const diasFormatados = Array.from(agendaPorDia.entries())
          .map(([dia, turnos]) => {
            const nomeDia = diasDaSemana[dia];
            const turnosFormatados = turnos.map(t => nomeTurno(t)).join(' e ');
            return `às ${nomeDia}s-feiras (${turnosFormatados})`;
          })
          .join(', ');

        const formatoFrase = formatosValidos.includes('presencial') && formatosValidos.length === 1
          ? 'no consultório'
          : formatosValidos.includes('online') && formatosValidos.length === 1
            ? 'online'
            : '';

        const fraseInicial = `A Dra. ${doctor.nome} atende ${formatoFrase} ${diasFormatados}.`;

        const candidatas = await this.doctorModel.find({ procedimentos: { $in: [tipoConsulta] } });
        const podeTrocarMedica = candidatas.length > 1;
        const podeTrocarFormato = formato !== 'indiferente';

        const alternativas: string[] = [];
        if (podeTrocarMedica) alternativas.push('trocar de médica');
        if (podeTrocarFormato) alternativas.push('tentar outro formato');

        const pergunta =
          alternativas.length > 0
            ? `Em qual desses dias você gostaria de ser atendida? Se não puder nesses dias, podemos ${alternativas.join(' ou ')}.`
            : `Você gostaria de ser atendida nesse(s) dia(s)?`;

        return {
          mensagem: await this.chatService.gerarRespostaNatural(
            `${fraseInicial} ${pergunta}`,
            nome,
            saudacao
          ),
          listaHorarios: []
        };
      }

      for (const item of doctor.agenda) {
        if (!formatosValidos.includes(item.formato)) continue;

        for (let i = 0; i < 30; i++) {
          const dataCandidata = new Date(inicioBusca);
          dataCandidata.setDate(dataCandidata.getDate() + i);
          const diaSemana = dataCandidata.getDay();
          const nomeDia = diasDaSemana[diaSemana];

          if ((diasPreferidos.length === 0 && sugestoes.length === 0) || diasPreferidos.includes(nomeDia)) {
            if (diaSemana !== item.diaSemana) continue;

            for (const horario of item.horarios) {
              const [hora, minuto] = horario.split(':').map(Number);
              const inicio = new Date(dataCandidata);
              inicio.setHours(hora, minuto, 0, 0);
              const fim = new Date(inicio);
              fim.setHours(inicio.getHours() + 1);

              if (inicio < agora) continue;

              const disponivel = await this.appointmentsService.verificarDisponibilidade(
                (doctor as any)._id,
                item.formato,
                inicio,
                fim
              );

              if (disponivel) {
                const texto = `${diasDaSemana[item.diaSemana]} às ${horario} com Dra. ${doctor.nome}`;
                sugestoes.push({ texto, inicio: inicio.toISOString(), fim: fim.toISOString() });
              }
            }
          }
        }
      }
    }

    if (sugestoes.length === 0 && profundidadeBusca < 2) {
      const proximaSemana = new Date(inicioBusca);
      proximaSemana.setDate(proximaSemana.getDate() + 7);
      return this.sugerirHorariosDisponiveis(medicaNome, formato, diasPreferidos, tipoConsulta, proximaSemana, profundidadeBusca + 1, nome, saudacao);
    }

    if (sugestoes.length === 0) {
      const candidatas = await this.doctorModel.find({ procedimentos: { $in: [tipoConsulta] } });
      const podeTrocarMedica = candidatas.length > 1;

      const alternativas: string[] = [];
      if (podeTrocarMedica) alternativas.push('trocar de médica');
      if (formato !== 'indiferente') alternativas.push('tentar outro formato');

      const fraseAlternativas = alternativas.length > 0
        ? ` Deseja ${alternativas.join(' ou ')}?`
        : '';

      return {
        mensagem: await this.chatService.gerarRespostaNatural(
          `Infelizmente não encontrei horários disponíveis com as opções informadas para os próximos dias.${fraseAlternativas}`,
          nome,
          saudacao
        ),
        listaHorarios: []
      };
    }

    const agrupadoPorData: Record<string, string[]> = {};

    for (const s of sugestoes) {
      const dataObj = new Date(s.inicio);
      const nomeDia = diasDaSemana[dataObj.getDay()];
      const dia = String(dataObj.getDate()).padStart(2, '0');
      const mes = String(dataObj.getMonth() + 1).padStart(2, '0');
      const dataLabel = `*${nomeDia}, ${dia}/${mes}:*`;

      const hora = dataObj.toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit'
      });

      if (!agrupadoPorData[dataLabel]) {
        agrupadoPorData[dataLabel] = [];
      }
      agrupadoPorData[dataLabel].push(`- ${hora}`);
    }

// Gerar mensagem final agrupada
    const partes: string[] = [];

    for (const data in agrupadoPorData) {
      const horarios = agrupadoPorData[data].join('\n');
      partes.push(`${data}\n${horarios}`);
    }

    const mensagemFinal = `Esses são os horários disponíveis:\n\n${partes.join('\n\n')}\n\nQual dessas opções você gostaria de agendar? 💕`;

    return {
      mensagem: await this.chatService.gerarRespostaNatural(
        mensagemFinal,
        nome,
        false
      ),
      listaHorarios: sugestoes
    };
  }

  private formatarHorario(data: Date): string {
    const opcoes: Intl.DateTimeFormatOptions = {
      weekday: 'long',
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'America/Sao_Paulo'
    };
    return new Intl.DateTimeFormat('pt-BR', opcoes).format(data);
  }
}

function normalizarTexto(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[^\p{L}\p{N} ]+/gu, ' ')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function mesclarIntencaoComContexto(intencaoAtual: any, contextoAnterior: any): any {
  return {
    tipoConsulta: normalizarTexto(intencaoAtual.tipoConsulta ?? contextoAnterior?.tipoConsulta ?? '') || null,
    preferenciaMedica: normalizarTexto(intencaoAtual.preferenciaMedica ?? contextoAnterior?.preferenciaMedica ?? '') || null,
    formato: normalizarTexto(intencaoAtual.formato ?? contextoAnterior?.formato ?? '') || null,
    diasPreferidos: intencaoAtual.diasPreferidos ?? contextoAnterior?.diasPreferidos ?? [],
    confirmacaoHorario: intencaoAtual.confirmacaoHorario ?? contextoAnterior?.confirmacaoHorario ?? null,
    horarioEscolhido: intencaoAtual.horarioEscolhido ?? contextoAnterior?.horarioEscolhido ?? null,
    preferenciaInicioDisponibilidade: intencaoAtual.preferenciaInicioDisponibilidade ?? contextoAnterior?.preferenciaInicioDisponibilidade ?? null,
    periodoPreferido: intencaoAtual.periodoPreferido ?? contextoAnterior?.periodoPreferido ?? null,
    preferenciaNegativaDeDias: intencaoAtual.preferenciaNegativaDeDias ?? false,
    alternarFormato: intencaoAtual.alternarFormato ?? false,
    requerIntervencaoHumana: intencaoAtual.requerIntervencaoHumana ?? contextoAnterior?.requerIntervencaoHumana ?? false,
    cancelarAgendamento: intencaoAtual.cancelarAgendamento ?? contextoAnterior?.cancelarAgendamento ?? false,
    remarcarAgendamento: intencaoAtual.remarcarAgendamento ?? contextoAnterior?.remarcarAgendamento ?? false,
    recusarRemarcacao: intencaoAtual.recusarRemarcacao ?? contextoAnterior?.recusarRemarcacao ?? false,
  };
}
