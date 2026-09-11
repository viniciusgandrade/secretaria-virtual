import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { ToolDefinition } from '../llm/llm.types';

/**
 * A assinatura genérica do zodToJsonSchema faz o TypeScript tentar instanciar
 * o tipo recursivamente e estourar o limite (TS2589) quando recebe um
 * ZodTypeAny. Como só precisamos do objeto de saída, tratamos a função pela
 * assinatura estreita abaixo — a validação de verdade é do Zod em runtime,
 * não dessa inferência.
 */
const gerarJsonSchema = zodToJsonSchema as unknown as (
  schema: unknown,
  options?: Record<string, unknown>
) => Record<string, unknown>;

/**
 * Converte um schema Zod na definição de ferramenta que as APIs esperam.
 *
 * O Zod é a fonte única da verdade: dele saem o JSON Schema enviado ao modelo
 * E a validação da resposta que volta. Não existe chance dos dois saírem de
 * sincronia, que é o erro clássico de quem escreve o JSON Schema na mão.
 */
export function buildTool(
  name: string,
  description: string,
  schema: z.ZodTypeAny
): ToolDefinition {
  const jsonSchema = gerarJsonSchema(schema, { $refStrategy: 'none' });

  // Metadados do draft não são aceitos no input_schema das ferramentas.
  delete jsonSchema.$schema;
  delete jsonSchema.definitions;

  return { name, description, inputSchema: jsonSchema };
}
