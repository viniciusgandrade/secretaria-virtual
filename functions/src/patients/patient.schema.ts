import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import mongoosePaginate from 'mongoose-paginate-v2';

@Schema({ timestamps: true })
export class Patient {
  @Prop({ required: false })
  nome: string;

  @Prop({ required: true })
  telefone: string;

  @Prop()
  documento?: string;

  @Prop()
  dataNascimento?: Date;

  @Prop()
  idadeGestacionalSemanas?: number;

  @Prop()
  dataUltimaMenstruacao?: Date;

  @Prop()
  dataProvavelParto?: Date;

  @Prop()
  historicoClinico?: string;
}

export type PatientDocument = HydratedDocument<Patient>;
export const PatientSchema = SchemaFactory.createForClass(Patient);
PatientSchema.plugin(mongoosePaginate);
