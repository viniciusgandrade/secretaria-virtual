import { z } from 'zod';
import { buildTool } from './zod-to-tool.util';

/**
 * As ferramentas que o modelo pode escolher ao ler uma mensagem da paciente.
 *
 * Divididas em duas famílias:
 *
 *  - DADOS  (informar_nome, informar_preferencias): podem vir juntas e em
 *    qualquer combinação. Só acrescentam informação ao contexto.
 *
 *  - AÇÕES  (escolher_horario, cancelar, remarcar, encerrar, escalar): são
 *    mutuamente exclusivas. Uma mensagem representa no máximo uma ação.
 *
 * Essa separação é o que elimina os estados impossíveis que os doze booleanos
 * do formato antigo permitiam (cancelar e remarcar verdadeiros ao mesmo tempo,
 * por exemplo).
 */

export const DIAS = ['segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado', 'domingo'] as const;

// ----------------------------------------------------------------- DADOS

export const informarNomeSchema = z.object({
  nome: z
    .string()
    .min(2)
    .describe('Como a paciente quer ser chamada. Apenas o nome, sem saudação nem sobrenome completo.'),
});

export const informarPreferenciasSchema = z.object({
  tipoConsulta: z
    .string()
    .nullable()
    .describe(
      'Tipo de atendimento, em minúsculas e sem acento (ex.: "pre natal", "rotina", "infertilidade", "pre concepcional"). null se a paciente não especificou.'
    ),
  preferenciaMedica: z
    .string()
    .nullable()
    .describe('Primeiro nome da médica mencionada, em minúsculas. null se não mencionou.'),
  formato: z
    .enum(['online', 'presencial', 'indiferente'])
    .nullable()
    .describe('Formato do atendimento. "indiferente" quando ela diz que tanto faz. null se não mencionou.'),
  diasPreferidos: z
    .array(z.enum(DIAS))
    .default([])
    .describe('Dias da semana que ela mencionou preferir. Lista vazia se não mencionou nenhum.'),
  periodoPreferido: z
    .enum(['manha', 'tarde', 'noite'])
    .nullable()
    .describe('Período do dia preferido, se mencionado.'),
  semPreferenciaDeDias: z
    .boolean()
    .default(false)
    .describe('true quando ela diz explicitamente que qualquer dia serve.'),
  alternarFormato: z
    .boolean()
    .default(false)
    .describe('true quando ela pede para tentar o outro formato (ex.: "tem online então?").'),
});

// ----------------------------------------------------------------- AÇÕES

export const escolherHorarioSchema = z.object({
  indiceSugestao: z
    .number()
    .int()
    .min(1)
    .describe(
      'Número do horário escolhido na lista de sugestões que foi enviada na mensagem anterior. A lista é numerada a partir de 1. Use apenas se a paciente estiver confirmando uma das opções já oferecidas.'
    ),
});

export const cancelarAgendamentoSchema = z.object({
  confirmacaoExplicita: z
    .boolean()
    .describe('true quando ela pede claramente para cancelar, sem ambiguidade.'),
});

export const remarcarAgendamentoSchema = z.object({
  confirmacaoExplicita: z
    .boolean()
    .describe('true quando ela pede claramente para remarcar ou mudar a consulta já agendada.'),
});

export const encerrarConversaSchema = z.object({
  motivo: z
    .enum(['desistiu', 'vai_pensar', 'agradecimento', 'outro'])
    .default('outro')
    .describe('Por que a conversa está terminando sem agendamento.'),
});

export const escalarParaHumanoSchema = z.object({
  motivo: z
    .enum(['duvida_clinica', 'emergencia', 'reclamacao', 'assunto_financeiro', 'fora_do_escopo'])
    .describe(
      'Motivo do encaminhamento. Use "duvida_clinica" para qualquer pergunta sobre saúde, sintoma, medicação ou exame, e "emergencia" quando houver sinal de urgência.'
    ),
  resumo: z
    .string()
    .max(200)
    .describe('Uma frase objetiva para a pessoa que vai assumir a conversa saber do que se trata.'),
});

// ----------------------------------------------------------------- registro

export const TOOLS_DADOS = ['informar_nome', 'informar_preferencias'] as const;
export const TOOLS_ACAO = [
  'escolher_horario',
  'cancelar_agendamento',
  'remarcar_agendamento',
  'encerrar_conversa',
  'escalar_para_humano',
] as const;

export const SCHEMAS = {
  informar_nome: informarNomeSchema,
  informar_preferencias: informarPreferenciasSchema,
  escolher_horario: escolherHorarioSchema,
  cancelar_agendamento: cancelarAgendamentoSchema,
  remarcar_agendamento: remarcarAgendamentoSchema,
  encerrar_conversa: encerrarConversaSchema,
  escalar_para_humano: escalarParaHumanoSchema,
} as const;

export type ToolName = keyof typeof SCHEMAS;

export const TOOL_DEFINITIONS = [
  buildTool(
    'informar_nome',
    'A paciente disse o nome dela ou como quer ser chamada. Pode ser usada junto com informar_preferencias.',
    informarNomeSchema
  ),
  buildTool(
    'informar_preferencias',
    'A paciente forneceu ou alterou alguma preferência de agendamento: tipo de atendimento, médica, formato, dias ou período. Use sempre que houver qualquer informação nova desse tipo, mesmo que parcial.',
    informarPreferenciasSchema
  ),
  buildTool(
    'escolher_horario',
    'A paciente está confirmando um dos horários que foram sugeridos na mensagem anterior.',
    escolherHorarioSchema
  ),
  buildTool(
    'cancelar_agendamento',
    'A paciente quer cancelar uma consulta já marcada.',
    cancelarAgendamentoSchema
  ),
  buildTool(
    'remarcar_agendamento',
    'A paciente quer mudar a data ou horário de uma consulta já marcada.',
    remarcarAgendamentoSchema
  ),
  buildTool(
    'encerrar_conversa',
    'A paciente está encerrando sem agendar — desistiu, vai pensar, ou apenas agradeceu e se despediu.',
    encerrarConversaSchema
  ),
  buildTool(
    'escalar_para_humano',
    'A mensagem sai do escopo administrativo e precisa de uma pessoa. Use SEMPRE que houver pergunta sobre saúde, sintoma, medicação, resultado de exame, urgência, reclamação ou cobrança. Nunca responda esse tipo de pergunta.',
    escalarParaHumanoSchema
  ),
];
