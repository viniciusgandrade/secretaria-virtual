import { Injectable } from '@nestjs/common';
import OpenAI from 'openai';
import {
  interpretadorPrompt,
  interpretadorPromptNatural,
  interpretadorPromptNome
} from './prompts/interpretador.prompt';
import { InterpretacaoMensagem } from '../common/interfaces';
import { Doctor } from '../doctors/doctor.schema';

@Injectable()
export class ChatService {
  private readonly openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  async interpretarMensagem(mensagem: string, doctors: Doctor[]): Promise<InterpretacaoMensagem> {
    const procedimentosPorMedica = doctors.map(doc => {
      return `- ${doc.nome}: ${doc.procedimentos.join(', ')}`;
    }).join('\n');
    const prompt = interpretadorPrompt.replace('{{MENSAGEM}}', mensagem)
      .replace('{{PROCEDIMENTOS}}', procedimentosPorMedica)
      .replace('{{DATA_ATUAL}}', new Date().toISOString())

    const response = await this.openai.chat.completions.create({
      model: process.env.OPENAI_MODEL ?? 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: prompt,
        },
      ],
      temperature: 0.2,
    });

    try {
      const resposta = response.choices[0].message?.content;
      return JSON.parse(resposta || '{}');
    } catch (error) {
      console.log(error);
      return {
        recusarRemarcacao: false,
        cancelarAgendamento: false, remarcarAgendamento: false,
        requerIntervencaoHumana: false,
        alternarFormato: false,
        preferenciaNegativaDeDias: false,
        preferenciaInicioDisponibilidade: null,
        diasPreferidos: null,
        horarioEscolhido: null,
        preferenciaMedica: null,
        tipoConsulta: null,
        formato: null,
        nomePaciente: null
      };
    }
  }

  saudacaoPorHorario(data: Date): string | null {
    const hora = data.getHours();
    if (hora >= 5 && hora < 12) return 'Bom dia';
    if (hora >= 12 && hora < 18) return 'Boa tarde';
    if (hora >= 18 || hora < 5) return 'Boa noite';
    return null;
  }

  async gerarRespostaNatural(instrucao: string, nome?: string, deveSaudar = false): Promise<string> {
    const periodoDia = this.saudacaoPorHorario(new Date()) || '';
    const prompt = interpretadorPromptNatural
      .replace(/{{NOME}}/g, nome ?? '')
      .replace(/{{DEVE_SAUDAR}}/g, String(deveSaudar))
      .replace(/{{PERIODO_DIA}}/g, periodoDia)
      .replace(/{{INSTRUCAO}}/g, instrucao);

    const response = await this.openai.chat.completions.create({
      model: process.env.OPENAI_MODEL ?? 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: prompt }
      ],
      temperature: 0.4,
    });

    return response.choices[0].message?.content?.trim() ?? '';
  }

  async extrairNomePaciente(mensagem: string): Promise<{ nomePaciente: string | null }> {
    const prompt = interpretadorPromptNome.replace('{{MENSAGEM}}', mensagem);

    const response = await this.openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'system', content: prompt }],
      temperature: 0.2,
    });

    try {
      console.log(response.choices[0].message);
      const resposta = response.choices[0].message?.content;
      return JSON.parse(resposta || '{}');
    } catch (e) {
      console.log(e);
      return { nomePaciente: null };
    }
  }
}
