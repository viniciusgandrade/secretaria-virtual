/**
 * Porta (interface) para provedores de LLM.
 *
 * O resto da aplicação conversa apenas com estes tipos. Anthropic e OpenAI têm
 * formatos diferentes de tool calling; a tradução acontece dentro de cada
 * adapter, nunca fora. Trocar de provedor é trocar a implementação registrada
 * no módulo — nenhum service precisa mudar.
 */

/** Ferramenta que o modelo pode escolher chamar. */
export interface ToolDefinition {
  name: string;
  description: string;
  /** JSON Schema dos parâmetros. Gerado a partir de um schema Zod. */
  inputSchema: Record<string, unknown>;
}

/** Uma chamada de ferramenta escolhida pelo modelo. Ainda NÃO validada. */
export interface RawToolCall {
  name: string;
  input: unknown;
}

export interface LlmUsage {
  inputTokens: number;
  outputTokens: number;
}

export interface LlmToolResponse {
  toolCalls: RawToolCall[];
  /** Texto que o modelo eventualmente produziu junto das tool calls. */
  text: string | null;
  usage: LlmUsage;
  model: string;
}

export interface CompleteWithToolsParams {
  system: string;
  userMessage: string;
  tools: ToolDefinition[];
  /** 'any' obriga o modelo a escolher alguma ferramenta; 'auto' deixa opcional. */
  toolChoice?: 'any' | 'auto';
  temperature?: number;
  maxTokens?: number;
}

export interface CompleteTextParams {
  system: string;
  userMessage: string;
  temperature?: number;
  maxTokens?: number;
}

export interface LlmProvider {
  /** Identificação para log e métrica. Ex.: 'anthropic'. */
  readonly providerName: string;

  /** Chamada com ferramentas: o modelo escolhe uma ação estruturada. */
  completeWithTools(params: CompleteWithToolsParams): Promise<LlmToolResponse>;

  /** Chamada de texto puro: usada para redigir a resposta à paciente. */
  completeText(params: CompleteTextParams): Promise<{ text: string; usage: LlmUsage; model: string }>;
}

/** Token de injeção — interface não existe em runtime, então precisa de um Symbol. */
export const LLM_PROVIDER = Symbol('LLM_PROVIDER');
