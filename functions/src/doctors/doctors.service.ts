import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { UpdateAgendaDto } from './dto/update-agenda.dto';
import { Doctor, DoctorDocument } from './doctor.schema';
import { AppointmentsService } from '../appointments/appointments.service';

@Injectable()
export class DoctorService {
  constructor(
    @InjectModel(Doctor.name) private readonly doctorModel: Model<DoctorDocument>,
    private readonly appointmentsService: AppointmentsService,
  ) {}

  async listarMedicas() {
    return this.doctorModel.find().select('_id nome especialidade crm calendarId procedimentos');
  }

  async buscarMedicaPorId(id: string) {
    const medica = await this.doctorModel.findById(id);
    if (!medica) {
      throw new NotFoundException('Médica não encontrada.');
    }
    return medica;
  }

  async obterAgenda(id: string) {
    const medica = await this.doctorModel.findById(id).select('agenda nome');
    if (!medica) {
      throw new NotFoundException('Médica não encontrada.');
    }
    return medica.agenda;
  }

  async atualizarAgenda(id: string, dto: UpdateAgendaDto) {
    const medica = await this.doctorModel.findById(id);
    if (!medica) {
      throw new NotFoundException('Médica não encontrada.');
    }

    medica.agenda = dto.agenda;
    await medica.save();
    return { message: 'Agenda atualizada com sucesso.' };
  }

  async listarHorariosDisponiveis(id: string, formato: 'online' | 'presencial') {
    const doctor = await this.doctorModel.findById(id);
    if (!doctor) {
      throw new NotFoundException('Médica não encontrada.');
    }

    const agora = new Date();
    const sugestoes: { texto: string; inicio: string; fim: string }[] = [];
    const diasDaSemana = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

    for (const item of doctor.agenda) {
      if (item.formato !== formato) continue;

      for (let i = 0; i < 15; i++) {
        const dataCandidata = new Date();
        dataCandidata.setDate(agora.getDate() + i);

        if (dataCandidata.getDay() !== item.diaSemana) continue;

        for (const horario of item.horarios) {
          const [hora, minuto] = horario.split(':').map(Number);
          const inicio = new Date(dataCandidata);
          inicio.setHours(hora, minuto, 0, 0);
          const fim = new Date(inicio);
          fim.setHours(inicio.getHours() + 1);

          if (inicio < agora) continue;

          const disponivel = await this.appointmentsService.verificarDisponibilidade(
            doctor._id,
            formato,
            inicio,
            fim
          );

          if (disponivel) {
            sugestoes.push({
              texto: `${diasDaSemana[item.diaSemana]} às ${horario}`,
              inicio: inicio.toISOString(),
              fim: fim.toISOString(),
            });
            if (sugestoes.length >= 3) break;
          }
        }

        if (sugestoes.length >= 3) break;
      }

      if (sugestoes.length >= 3) break;
    }

    return sugestoes;
  }

  async criarMedica(body: Partial<Doctor>) {
    const nova = new this.doctorModel(body);
    await nova.save();
    return nova;
  }
}
