import { Global, Logger, Module } from '@nestjs/common';
import { AnthropicProvider } from './anthropic.provider';
import { OpenAiProvider } from './openai.provider';
import { LLM_PROVIDER, LlmProvider } from './llm.types';

/**
 * Escolhe o provedor por variável de ambiente (LLM_PROVIDER=anthropic|openai).
 * É o único lugar do sistema que sabe qual fornecedor está em uso.
 */
@Global()
@Module({
  providers: [
    AnthropicProvider,
    OpenAiProvider,
    {
      provide: LLM_PROVIDER,
      inject: [AnthropicProvider, OpenAiProvider],
      useFactory: (anthropic: AnthropicProvider, openai: OpenAiProvider): LlmProvider => {
        const escolhido = (process.env.LLM_PROVIDER ?? 'anthropic').toLowerCase();
        const provider = escolhido === 'openai' ? openai : anthropic;
        new Logger('LlmModule').log(`Provedor de LLM ativo: ${provider.providerName}`);
        return provider;
      },
    },
  ],
  exports: [LLM_PROVIDER],
})
export class LlmModule {}
