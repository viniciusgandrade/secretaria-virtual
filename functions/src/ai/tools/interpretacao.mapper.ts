import { Logger } from '@nestjs/common';
import { z } from 'zod';
import { RawToolCall } from '../llm/llm.types';
import { HorarioSugerido, InterpretacaoMensagem } from '../../common/interfaces';
import { SCHEMAS, TOOLS_ACAO, ToolName } from './interpretacao.tools';

const logger = new Logger('InterpretacaoMapper');

/** Interpretação vazia: nenhuma informação nova extraída da mensagem. */
export function interpretacaoVazia(): InterpretacaoMensagem {
  return {
    requerIntervencaoHumana: false,
    cancelarAgendamento: false,
    recusarRemarcacao: false,
    remarcarAgendamento: false,
    alternarFormato: false,
    preferenciaNegativaDeDias: false,
    preferenciaInicioDisponibilidade: null,
    diasPreferidos: null,
    periodoPreferido: null,
    horarioEscolhido: null,
    preferenciaMedica: null,
    tipoConsulta: null,
    formato: null,
    nomePaciente: null,
  };
}

export interface ResultadoInterpretacao {
  interpretacao: InterpretacaoMensagem;
  /** Ação escolhida pelo modelo, se houve. Útil para log e eval. */
  acao: ToolName | null;
  /** Motivo do escalonamento, quando a ação foi escalar_para_humano. */
  motivoEscalonamento: string | null;
  /** Ferramentas que o modelo tentou usar mas não passaram na validação. */
  descartadas: string[];
}

/**
 * Converte as tool calls do modelo na InterpretacaoMensagem que o BotService
 * já consome. Cada chamada é validada contra o schema Zod correspondente
 * ANTES de tocar no resultado — chamada inválida é descartada e registrada,
 * nunca aplicada pela metade.
 */
export function mapearToolCalls(
  toolCalls: RawToolCall[],
  sugestoesAnteriores: HorarioSugerido[]
): ResultadoInterpretacao {
  const interpretacao = interpretacaoVazia();
  const descartadas: string[] = [];
  let acao: ToolName | null = null;
  let motivoEscalonamento: string | null = null;

  for (const call of toolCalls) {
    const schema = SCHEMAS[call.name as ToolName] as z.ZodTypeAny | undefined;
    if (!schema) {
      logger.warn(`Ferramenta desconhecida ignorada: ${call.name}`);
      descartadas.push(call.name);
      continue;
    }

    const parsed = schema.safeParse(call.input);
    if (!parsed.success) {
      logger.warn(`Argumentos inválidos em ${call.name}: ${parsed.error.issues.map((i) => i.path.join('.') + ' ' + i.message).join('; ')}`);
      descartadas.push(call.name);
      continue;
    }

    const nome = call.name as ToolName;
    const ehAcao = (TOOLS_ACAO as readonly string[]).includes(nome);

    // Ações são mutuamente exclusivas: a primeira válida vence, o resto é ruído.
    if (ehAcao && acao !== null) {
      logger.warn(`Segunda ação ignorada (${nome}); ação já definida como ${acao}.`);
      descartadas.push(nome);
      continue;
    }
    if (ehAcao) acao = nome;

    switch (nome) {
      case 'informar_nome': {
        const d = parsed.data as z.infer<typeof SCHEMAS.informar_nome>;
        interpretacao.nomePaciente = d.nome;
        break;
      }

      case 'informar_preferencias': {
        const d = parsed.data as z.infer<typeof SCHEMAS.informar_preferencias>;
        interpretacao.tipoConsulta = d.tipoConsulta;
        interpretacao.preferenciaMedica = d.preferenciaMedica;
        interpretacao.formato = d.formato;
        // null = "não falou de dias" e preserva o que já havia no contexto.
        // [] viria a ser "nenhum dia serve", que não é o que queremos aqui.
        interpretacao.diasPreferidos = d.diasPreferidos;
        interpretacao.periodoPreferido = d.periodoPreferido;
        interpretacao.preferenciaInicioDisponibilidade = validarDataInicio(d.disponivelAPartirDe);
        interpretacao.preferenciaNegativaDeDias = d.semPreferenciaDeDias;
        interpretacao.alternarFormato = d.alternarFormato;
        break;
      }

      case 'escolher_horario': {
        const d = parsed.data as z.infer<typeof SCHEMAS.escolher_horario>;
        // O modelo devolve o ÍNDICE; quem resolve para data/hora somos nós,
        // usando a lista que nós mesmos enviamos. O modelo não inventa horário.
        const escolhido = sugestoesAnteriores[d.indiceSugestao - 1];
        if (!escolhido) {
          logger.warn(
            `Índice ${d.indiceSugestao} fora da lista de ${sugestoesAnteriores.length} sugestões.`
          );
          descartadas.push(nome);
          acao = null;
          break;
        }
        interpretacao.horarioEscolhido = { inicio: escolhido.inicio, fim: escolhido.fim };
        break;
      }

      case 'cancelar_agendamento':
        interpretacao.cancelarAgendamento = true;
        break;

      case 'remarcar_agendamento':
        interpretacao.remarcarAgendamento = true;
        break;

      case 'encerrar_conversa':
        interpretacao.recusarRemarcacao = true;
        break;

      case 'escalar_para_humano': {
        const d = parsed.data as z.infer<typeof SCHEMAS.escalar_para_humano>;
        interpretacao.requerIntervencaoHumana = true;
        motivoEscalonamento = d.motivo;
        logger.log(`Escalonamento (${d.motivo}): ${d.resumo}`);
        break;
      }
    }
  }

  return { interpretacao, acao, motivoEscalonamento, descartadas };
}


/**
 * A única data que o modelo ainda produz. Aceita apenas AAAA-MM-DD que exista
 * de verdade e não esteja no passado; qualquer outra coisa é descartada em vez
 * de virar `Invalid Date` lá na frente, dentro do motor de disponibilidade.
 */
function validarDataInicio(valor: string | null): string | null {
  if (!valor) return null;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) {
    logger.warn(`disponivelAPartirDe fora do formato AAAA-MM-DD: "${valor}" — descartado.`);
    return null;
  }

  const data = new Date(`${valor}T00:00:00`);
  if (Number.isNaN(data.getTime())) {
    logger.warn(`disponivelAPartirDe não é uma data válida: "${valor}" — descartado.`);
    return null;
  }

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  if (data < hoje) {
    logger.warn(`disponivelAPartirDe no passado: "${valor}" — descartado.`);
    return null;
  }

  return valor;
}
