import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ _id: false })
class HorarioSugerido {
  @Prop({ required: true })
  texto: string;

  @Prop({ required: true })
  inicio: string;

  @Prop({ required: true })
  fim: string;
}

@Schema({ _id: false })
class ContextoPaciente {
  @Prop({ default: null })
  preferenciaMedica: string;

  @Prop({ default: null })
  tipoConsulta: string;

  @Prop({ enum: ['online', 'presencial'], default: null })
  formato: 'online' | 'presencial';

  @Prop({ type: [HorarioSugerido], default: [] })
  sugestoesHorarios: HorarioSugerido[];

  @Prop({ default: false })
  nomeConfirmado: boolean;

  @Prop({ default: null })
  nome: string;

  @Prop({ default: [] })
  diasPreferidos: string[];

  @Prop({ default: null })
  horarioEscolhido: HorarioSugerido;

  @Prop({ default: null })
  preferenciaInicioDisponibilidade: string;

  @Prop({ enum: ['manha', 'tarde', 'noite'], default: null })
  periodoPreferido: 'manha' | 'tarde' | 'noite';

  @Prop({ default: false })
  preferenciaNegativaDeDias: boolean;

  @Prop({ default: false })
  alternarFormato: boolean;

  @Prop({ default: false })
  requerIntervencaoHumana: boolean;

  @Prop({ default: false })
  cancelarAgendamento: boolean;

  @Prop({ default: false })
  remarcarAgendamento: boolean;
}

@Schema({ timestamps: true })
export class ChatContext {
  @Prop({ type: Types.ObjectId, ref: 'Patient', required: true, unique: true })
  pacienteId: Types.ObjectId;

  @Prop({ type: ContextoPaciente, default: {} })
  contexto: ContextoPaciente;

  @Prop({ default: 'ativo' })
  status: string;
}

export type ChatContextDocument = ChatContext & Document & {
  createdAt: Date;
  updatedAt: Date;
};
export const ChatContextSchema = SchemaFactory.createForClass(ChatContext);
