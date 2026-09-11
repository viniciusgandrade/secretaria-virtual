// backend/src/appointment/schemas/appointment.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { Patient } from '../patients/patient.schema';
import { Doctor } from '../doctors/doctor.schema';

export enum AppointmentStatus {
  CONFIRMADO = 'confirmado',
  PENDENTE = 'pendente',
  CANCELADO = 'cancelado'
}

@Schema({ timestamps: true })
export class Appointment {
  @Prop({ type: Types.ObjectId, ref: 'Patient', required: true })
  pacienteId: Types.ObjectId | Patient;

  @Prop({ type: Types.ObjectId, ref: 'Doctor', required: true })
  medicaId: Types.ObjectId | any;

  @Prop({ required: true })
  formato: 'online' | 'presencial';

  @Prop({ required: true })
  tipoConsulta: string;

  @Prop({ required: true })
  dataHoraInicio: Date;

  @Prop({ required: true })
  dataHoraFim: Date;

  @Prop({ enum: AppointmentStatus, default: AppointmentStatus.PENDENTE })
  status: AppointmentStatus;

  @Prop()
  eventoId: string;
}

export type AppointmentDocument = Appointment & Document;
export const AppointmentSchema = SchemaFactory.createForClass(Appointment);

AppointmentSchema.pre<AppointmentDocument>('save', function (next) {
  if (this.dataHoraFim <= this.dataHoraInicio) {
    return next(new Error('dataHoraFim deve ser posterior a dataHoraInicio'));
  }
  next();
});
