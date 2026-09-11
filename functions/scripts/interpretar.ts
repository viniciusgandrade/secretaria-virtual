/**
 * Testa APENAS a camada de interpretação — sem MongoDB, sem WhatsApp,
 * sem Google Calendar, sem subir a aplicação.
 *
 *   npm run interpretar -- "quero marcar pre natal na terça de manhã"
 *
 * Mostra quais ferramentas o modelo escolheu, com quais argumentos, o que
 * foi descartado na validação, e quanto custou. É o laboratório para mexer
 * em prompt e em schema, e a semente do runner de evals.
 */
import 'dotenv/config';
import { ChatService } from '../src/ai/chat.service';
import { AnthropicProvider } from '../src/ai/llm/anthropic.provider';
import { OpenAiProvider } from '../src/ai/llm/openai.provider';
import { LlmProvider } from '../src/ai/llm/llm.types';
import { Doctor } from '../src/doctors/doctor.schema';
import { HorarioSugerido } from '../src/common/interfaces';

// Clínica de mentira, só para o prompt ter o que citar.
const MEDICAS = [
  { nome: 'camila', procedimentos: ['pre natal', 'rotina', 'ginecologia'] },
  { nome: 'rayssa', procedimentos: ['pre natal', 'infertilidade', 'pre concepcional'] },
  { nome: 'karina', procedimentos: ['rotina', 'ginecologia', 'histeroscopia'] },
] as unknown as Doctor[];

// Lista que fingimos ter enviado antes — necessária para testar escolher_horario.
const SUGESTOES: HorarioSugerido[] = [
  { texto: 'Terça, 14/10, às 09:00 com a Dra. Camila', inicio: '2026-10-14T12:00:00.000Z', fim: '2026-10-14T13:00:00.000Z' },
  { texto: 'Terça, 14/10, às 14:30 com a Dra. Camila', inicio: '2026-10-14T17:30:00.000Z', fim: '2026-10-14T18:30:00.000Z' },
  { texto: 'Quinta, 16/10, às 10:00 com a Dra. Rayssa', inicio: '2026-10-16T13:00:00.000Z', fim: '2026-10-16T14:00:00.000Z' },
];

// Preço por milhão de tokens, para estimar custo da chamada.
const PRECO: Record<string, { entrada: number; saida: number }> = {
  anthropic: { entrada: 2, saida: 10 },
  openai: { entrada: 0.15, saida: 0.6 },
};

function criarProvider(): LlmProvider {
  const escolhido = (process.env.LLM_PROVIDER ?? 'anthropic').toLowerCase();
  return escolhido === 'openai' ? new OpenAiProvider() : new AnthropicProvider();
}

async function main() {
  const mensagem = process.argv.slice(2).join(' ').trim();
  if (!mensagem) {
    console.error('Uso: npm run interpretar -- "mensagem da paciente"');
    process.exit(1);
  }

  const provider = criarProvider();
  const chat = new ChatService(provider);

  console.log(`\n  provedor  ${provider.providerName}`);
  console.log(`  mensagem  "${mensagem}"\n`);

  const inicio = Date.now();
  const resultado = await chat.interpretarMensagem(mensagem, MEDICAS, SUGESTOES, {
    nome: 'Daniela',
    sugestoesHorarios: SUGESTOES,
  });
  const ms = Date.now() - inicio;

  console.log('  ─── AÇÃO ───────────────────────────────────');
  console.log(`  ${resultado.acao ?? '(nenhuma — só dados)'}`);
  if (resultado.motivoEscalonamento) {
    console.log(`  motivo do escalonamento: ${resultado.motivoEscalonamento}`);
  }

  console.log('\n  ─── INTERPRETAÇÃO ──────────────────────────');
  const i = resultado.interpretacao;
  const relevantes = Object.entries(i).filter(([, v]) => {
    if (v === null || v === false) return false;
    if (Array.isArray(v) && v.length === 0) return false;
    return true;
  });
  if (relevantes.length === 0) {
    console.log('  (nada extraído)');
  } else {
    for (const [campo, valor] of relevantes) {
      console.log(`  ${campo.padEnd(32)} ${JSON.stringify(valor)}`);
    }
  }

  if (resultado.descartadas.length) {
    console.log('\n  ─── DESCARTADAS NA VALIDAÇÃO ───────────────');
    console.log(`  ${resultado.descartadas.join(', ')}`);
  }

  console.log(`\n  latência: ${ms} ms\n`);
}

main().catch((e) => {
  console.error('\nFalhou:', e instanceof Error ? e.message : e, '\n');
  process.exit(1);
});
