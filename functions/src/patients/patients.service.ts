import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Patient, PatientDocument } from './patient.schema';
import { PaginateModel, Types } from 'mongoose';
import { BaseService } from '../common/base.service';

@Injectable()
export class PatientsService extends BaseService<Patient> {
  constructor(
    @InjectModel(Patient.name)
    private readonly patientModel: PaginateModel<Patient>
  ) {
    super(patientModel);
  }

  async buscarOuCriarPorTelefone(telefone: string, nome: string): Promise<PatientDocument> {
    let paciente = await this.patientModel.findOne({ telefone }).exec();
    if (!paciente) {
      paciente = new this.patientModel({ nome, telefone });
      await paciente.save();
    }
    return paciente;
  }

  async buscarPorTelefone(telefone: string) {
    return  await this.patientModel.findOne({ telefone }).exec();
  }

  async criarPaciente(param: { telefone: string; nome?: string }) {
    const paciente = new this.patientModel({ nome: param.nome, telefone: param.telefone });
    await paciente.save();
    return paciente;
  }

  async atualizarPaciente(_id: Types.ObjectId, param: { nome: string }) {
    let paciente = await this.patientModel.findById(_id).exec();
    if (paciente) {
      paciente.nome = param.nome;
      await paciente.save();
    }
    return paciente;
  }
}
