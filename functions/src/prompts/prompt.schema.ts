import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

class Mensagem {
  @Prop({ enum: ['bot', 'paciente'], required: true })
  origem: string;

  @Prop({ required: true })
  texto: string;

  @Prop({ default: Date.now })
  dataHora: Date;
}

class Contexto {
  @Prop()
  tipoAgendamento?: string;

  @Prop()
  especialidadeDesejada?: string;

  @Prop()
  dataSugerida?: Date;
}

@Schema()
export class Prompt {
  @Prop({ type: Types.ObjectId, ref: 'Patient' })
  pacienteId: Types.ObjectId;

  @Prop({ type: [Mensagem] })
  mensagens: Mensagem[];

  @Prop({ type: Contexto })
  contexto: Contexto;
}

export type PromptDocument = HydratedDocument<Prompt>;
export const PromptSchema = SchemaFactory.createForClass(Prompt);
