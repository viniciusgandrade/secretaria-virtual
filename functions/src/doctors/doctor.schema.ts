import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import mongoosePaginate from 'mongoose-paginate-v2';

@Schema()
export class AgendaItem {
  @Prop({ required: true, min: 0, max: 6 }) // 0 = domingo, 6 = sábado
  diaSemana: number;

  @Prop({ type: [String], required: true }) // Ex: ["09:00", "14:30"]
  horarios: string[];

  @Prop({ required: true, enum: ['online', 'presencial'] })
  formato: 'online' | 'presencial';
}

export const AgendaItemSchema = SchemaFactory.createForClass(AgendaItem);

@Schema()
export class Doctor {
  @Prop({ required: true })
  nome: string;

  @Prop()
  crm?: string;

  @Prop({ type: [AgendaItemSchema], default: [] })
  agenda: AgendaItem[];

  @Prop([String])
  procedimentos: string[];

  @Prop()
  calendarId?: string;
}

export type DoctorDocument = HydratedDocument<Doctor>;
export const DoctorSchema = SchemaFactory.createForClass(Doctor);
DoctorSchema.plugin(mongoosePaginate);
