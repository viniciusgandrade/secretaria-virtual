import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';
import {
  CompleteTextParams,
  CompleteWithToolsParams,
  LlmProvider,
  LlmToolResponse,
  RawToolCall,
} from './llm.types';

/**
 * Mantido para comparação lado a lado com o Claude nos evals.
 * A conversão de formato acontece toda aqui dentro.
 */
@Injectable()
export class OpenAiProvider implements LlmProvider {
  readonly providerName = 'openai';
  private readonly logger = new Logger(OpenAiProvider.name);
  private readonly client: OpenAI;
  private readonly model: string;

  constructor() {
    this.client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    this.model = process.env.OPENAI_MODEL ?? 'gpt-4o-mini';
  }

  async completeWithTools(params: CompleteWithToolsParams): Promise<LlmToolResponse> {
    const response = await this.client.chat.completions.create({
      model: this.model,
      temperature: params.temperature ?? 0,
      max_tokens: params.maxTokens ?? 1024,
      messages: [
        { role: 'system', content: params.system },
        { role: 'user', content: params.userMessage },
      ],
      tools: params.tools.map((t) => ({
        type: 'function' as const,
        function: {
          name: t.name,
          description: t.description,
          parameters: t.inputSchema as Record<string, unknown>,
        },
      })),
      tool_choice: params.toolChoice === 'auto' ? 'auto' : 'required',
    });

    const message = response.choices[0]?.message;
    const toolCalls: RawToolCall[] = [];

    for (const call of message?.tool_calls ?? []) {
      if (call.type !== 'function') continue;
      try {
        toolCalls.push({ name: call.function.name, input: JSON.parse(call.function.arguments) });
      } catch {
        // Argumentos malformados: descarta a chamada. O Zod pegaria depois,
        // mas aqui a mensagem de log é mais precisa.
        this.logger.warn(`Argumentos inválidos na tool ${call.function.name}`);
      }
    }

    return {
      toolCalls,
      text: message?.content?.trim() || null,
      usage: {
        inputTokens: response.usage?.prompt_tokens ?? 0,
        outputTokens: response.usage?.completion_tokens ?? 0,
      },
      model: this.model,
    };
  }

  async completeText(params: CompleteTextParams) {
    const response = await this.client.chat.completions.create({
      model: this.model,
      temperature: params.temperature ?? 0.4,
      max_tokens: params.maxTokens ?? 512,
      messages: [
        { role: 'system', content: params.system },
        { role: 'user', content: params.userMessage },
      ],
    });

    return {
      text: response.choices[0]?.message?.content?.trim() ?? '',
      usage: {
        inputTokens: response.usage?.prompt_tokens ?? 0,
        outputTokens: response.usage?.completion_tokens ?? 0,
      },
      model: this.model,
    };
  }
}
