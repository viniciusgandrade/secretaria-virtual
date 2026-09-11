import { Inject, Injectable, Logger } from '@nestjs/common';
import { LLM_PROVIDER, LlmProvider, LlmUsage } from './llm/llm.types';
import { TOOL_DEFINITIONS } from './tools/interpretacao.tools';
import {
  ResultadoInterpretacao,
  interpretacaoVazia,
  mapearToolCalls,
} from './tools/interpretacao.mapper';
import { interpretadorSystemPrompt, redatorSystemPrompt } from './prompts/interpretador.prompt';
import { ContextoPaciente, HorarioSugerido } from '../common/interfaces';
import { Doctor } from '../doctors/doctor.schema';

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(@Inject(LLM_PROVIDER) private readonly llm: LlmProvider) {}

  /**
   * Interpreta a mensagem da paciente escolhendo ferramentas.
   *
   * O modelo é obrigado a escolher pelo menos uma ferramenta (tool_choice
   * 'any'), e cada escolha é validada contra o schema Zod antes de virar
   * estado da aplicação. Se nada sobreviver à validação, devolve interpretação
   * vazia e sinaliza — o chamador decide se tenta de novo ou escala.
   */
  async interpretarMensagem(
    mensagem: string,
    doctors: Doctor[],
    sugestoesAnteriores: HorarioSugerido[] = [],
    contexto?: Partial<ContextoPaciente>
  ): Promise<ResultadoInterpretacao> {
    const system = interpretadorSystemPrompt
      .replace('{{PROCEDIMENTOS}}', this.formatarProcedimentos(doctors))
      .replace('{{CONTEXTO}}', this.formatarContexto(contexto))
      .replace('{{SUGESTOES}}', this.formatarSugestoes(sugestoesAnteriores));

    let resposta;
    try {
      resposta = await this.llm.completeWithTools({
        system,
        userMessage: mensagem,
        tools: TOOL_DEFINITIONS,
        toolChoice: 'any',
        temperature: 0,
      });
    } catch (erro) {
      this.logger.error(`Falha na chamada ao provedor ${this.llm.providerName}`, erro as Error);
      return { interpretacao: interpretacaoVazia(), acao: null, motivoEscalonamento: null, descartadas: ['__erro_provedor__'] };
    }

    this.registrarUso('interpretar', resposta.model, resposta.usage);

    const resultado = mapearToolCalls(resposta.toolCalls, sugestoesAnteriores);

    if (resposta.toolCalls.length === 0) {
      this.logger.warn(`Modelo não escolheu nenhuma ferramenta. Texto: ${resposta.text ?? '(vazio)'}`);
    }
    this.logger.log(
      `Interpretação: acao=${resultado.acao ?? 'nenhuma'} ferramentas=[${resposta.toolCalls.map((t) => t.name).join(', ')}]` +
        (resultado.descartadas.length ? ` descartadas=[${resultado.descartadas.join(', ')}]` : '')
    );

    return resultado;
  }

  /** Reescreve uma instrução interna como mensagem para a paciente. */
  async gerarRespostaNatural(instrucao: string, nome?: string, deveSaudar = false): Promise<string> {
    const saudacao = deveSaudar
      ? `Comece a mensagem com "${this.saudacaoPorHorario(new Date())}"${nome ? `, ${nome}` : ''}.`
      : 'Não use saudação; a conversa já está em andamento.';

    const system = redatorSystemPrompt.replace('{{SAUDACAO}}', saudacao);
    const userMessage = nome
      ? `Nome da paciente: ${nome}\n\nInstrução: ${instrucao}`
      : `Instrução: ${instrucao}`;

    try {
      const { text, model, usage } = await this.llm.completeText({
        system,
        userMessage,
        temperature: 0.4,
      });
      this.registrarUso('redigir', model, usage);
      // Se o modelo devolver vazio, a instrução crua é melhor que silêncio.
      return text || instrucao;
    } catch (erro) {
      this.logger.error('Falha ao redigir resposta; usando a instrução original.', erro as Error);
      return instrucao;
    }
  }

  /**
   * Mantida por compatibilidade com o fluxo atual do BotService.
   * Hoje a extração de nome também acontece dentro de interpretarMensagem,
   * pela ferramenta informar_nome.
   */
  async extrairNomePaciente(mensagem: string): Promise<{ nomePaciente: string | null }> {
    const resultado = await this.interpretarMensagem(mensagem, [], []);
    return { nomePaciente: resultado.interpretacao.nomePaciente };
  }

  saudacaoPorHorario(data: Date): string {
    const hora = data.getHours();
    if (hora >= 5 && hora < 12) return 'Bom dia';
    if (hora >= 12 && hora < 18) return 'Boa tarde';
    return 'Boa noite';
  }

  // --------------------------------------------------------------- privados

  private formatarProcedimentos(doctors: Doctor[]): string {
    if (!doctors?.length) return '(nenhuma médica cadastrada)';
    return doctors.map((d) => `- ${d.nome}: ${d.procedimentos.join(', ')}`).join('\n');
  }

  private formatarContexto(contexto?: Partial<ContextoPaciente>): string {
    if (!contexto) return '(conversa nova, nada conhecido ainda)';
    const linhas = [
      contexto.nome ? `nome: ${contexto.nome}` : null,
      contexto.tipoConsulta ? `tipo de atendimento: ${contexto.tipoConsulta}` : null,
      contexto.preferenciaMedica ? `médica: ${contexto.preferenciaMedica}` : null,
      contexto.formato ? `formato: ${contexto.formato}` : null,
      contexto.diasPreferidos?.length ? `dias preferidos: ${contexto.diasPreferidos.join(', ')}` : null,
    ].filter(Boolean);
    return linhas.length ? linhas.join('\n') : '(nada definido ainda)';
  }

  private formatarSugestoes(sugestoes: HorarioSugerido[]): string {
    if (!sugestoes?.length) return '(nenhuma lista foi enviada ainda)';
    return sugestoes.map((s, i) => `${i + 1}. ${s.texto}`).join('\n');
  }

  private registrarUso(etapa: string, model: string, usage: LlmUsage) {
    this.logger.log(
      `[uso] etapa=${etapa} provider=${this.llm.providerName} model=${model} in=${usage.inputTokens} out=${usage.outputTokens}`
    );
  }
}
