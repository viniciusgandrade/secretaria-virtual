import { Injectable, Logger } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import {
  CompleteTextParams,
  CompleteWithToolsParams,
  LlmProvider,
  LlmToolResponse,
  RawToolCall,
} from './llm.types';

@Injectable()
export class AnthropicProvider implements LlmProvider {
  readonly providerName = 'anthropic';
  private readonly logger = new Logger(AnthropicProvider.name);
  private readonly client: Anthropic;
  private readonly model: string;

  constructor() {
    this.client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    this.model = process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-5';
  }

  async completeWithTools(params: CompleteWithToolsParams): Promise<LlmToolResponse> {
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: params.maxTokens ?? 1024,
      temperature: params.temperature ?? 0,
      system: params.system,
      messages: [{ role: 'user', content: params.userMessage }],
      tools: params.tools.map((t) => ({
        name: t.name,
        description: t.description,
        input_schema: t.inputSchema as Anthropic.Tool.InputSchema,
      })),
      // 'any' obriga o modelo a escolher uma ferramenta em vez de responder texto.
      tool_choice: { type: params.toolChoice ?? 'any' },
    });

    const toolCalls: RawToolCall[] = [];
    const textos: string[] = [];

    for (const bloco of response.content) {
      if (bloco.type === 'tool_use') {
        toolCalls.push({ name: bloco.name, input: bloco.input });
      } else if (bloco.type === 'text') {
        textos.push(bloco.text);
      }
    }

    if (response.stop_reason === 'max_tokens') {
      this.logger.warn('Resposta truncada por max_tokens — tool call pode estar incompleta.');
    }

    return {
      toolCalls,
      text: textos.length ? textos.join('\n').trim() : null,
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
      },
      model: this.model,
    };
  }

  async completeText(params: CompleteTextParams) {
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: params.maxTokens ?? 512,
      temperature: params.temperature ?? 0.4,
      system: params.system,
      messages: [{ role: 'user', content: params.userMessage }],
    });

    const texto = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('\n')
      .trim();

    return {
      text: texto,
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
      },
      model: this.model,
    };
  }
}
