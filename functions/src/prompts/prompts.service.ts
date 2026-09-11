import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Prompt, PromptDocument } from './prompt.schema';
import { Model } from 'mongoose';

@Injectable()
export class PromptsService {
  constructor(@InjectModel(Prompt.name) private readonly model: Model<Prompt>) {}

  async create(data: Partial<Prompt>): Promise<PromptDocument> {
    const prompt = new this.model(data);
    return prompt.save();
  }

  async findByPacienteId(pacienteId: string): Promise<PromptDocument[]> {
    return this.model.find({ pacienteId }).exec();
  }

  async getById(id: string): Promise<PromptDocument | null> {
    return this.model.findById(id).exec();
  }

  async update(id: string, data: Partial<Prompt>): Promise<PromptDocument | null> {
    return this.model.findByIdAndUpdate(id, data, { new: true }).exec();
  }

  async delete(id: string): Promise<void> {
    await this.model.deleteOne({ _id: id }).exec();
  }

  async salvarMensagem(_id: any, param2: {texto: any; origem: string; dataHora: Date}) {

  }
}
