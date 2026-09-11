import { Injectable } from '@nestjs/common';
import { BaseService } from '../common/base.service';
import { Appointment, AppointmentDocument, AppointmentStatus } from './appointment.schema';
import { PaginateModel, Types } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';

@Injectable()
export class AppointmentsService extends BaseService<Appointment> {
  constructor(@InjectModel(Appointment.name) model: PaginateModel<Appointment>) {
    super(model);
  }

  async verificarDisponibilidade(
    medicaId: Types.ObjectId,
    formato: 'online' | 'presencial' | 'indiferente',
    inicio: Date,
    fim: Date,
    ignoreAppointmentId?: Types.ObjectId
  ): Promise<boolean> {
    const formatos = formato === 'indiferente' ? ['online', 'presencial'] : [formato];

    const filtro: any = {
      medicaId,
      formato: { $in: formatos },
      status: { $ne: AppointmentStatus.CANCELADO },
      dataHoraInicio: { $lt: fim },
      dataHoraFim: { $gt: inicio },
    };

    if (ignoreAppointmentId) {
      filtro._id = { $ne: ignoreAppointmentId };
    }

    return !(await this.model.findOne(filtro));
  }

  async criarAgendamento(data: {
    eventoId: string;
    pacienteId: Types.ObjectId;
    medicaId: Types.ObjectId;
    formato: 'online' | 'presencial';
    dataHoraInicio: Date;
    dataHoraFim: Date;
    tipoConsulta: string;
    status?: AppointmentStatus;
  }): Promise<AppointmentDocument> {
    if (data.dataHoraInicio < new Date()) {
      throw new Error('Não é possível agendar para um horário no passado.');
    }
    const conflito = await this.verificarDisponibilidade(
      data.medicaId,
      data.formato,
      data.dataHoraInicio,
      data.dataHoraFim
    );

    if (!conflito) {
      throw new Error('Esse horário acabou de ser preenchido.');
    }
    const agendamento = new this.model({
      ...data,
      status: data.status ?? AppointmentStatus.PENDENTE,
    });

    return agendamento.save();
  }

  async cancelarAgendamento(id: string): Promise<void> {
    await this.model.findByIdAndUpdate(id, { status: AppointmentStatus.CANCELADO });
  }

  async buscarAgendamentosFuturos(pacienteId: Types.ObjectId): Promise<Appointment[]> {
    return this.model.find({
      pacienteId,
      status: { $ne: AppointmentStatus.CANCELADO },
      dataHoraInicio: { $gte: new Date() },
    }).sort({ dataHoraInicio: 1 })
      .populate('medicaId')
      .populate('pacienteId')
      .exec();
  }
}
