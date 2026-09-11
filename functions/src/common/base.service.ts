import { Document, PaginateModel, PaginateResult } from 'mongoose';
import { FiltroDto } from './dto/filtro.dto';
import { ResultadoDto } from './dto/resultado.dto';

export abstract class BaseService<T> {
  constructor(protected readonly model: PaginateModel<T>) {}

  async findAll(filtro: FiltroDto = {}, populate?: any): Promise<PaginateResult<T>> {
    const { page, count, sort, direction, ...query } = filtro;

    const options = {
      page,
      limit: count,
      populate,
      customLabels: ResultadoDto,
      sort: {
        // @ts-ignore
        [sort]: direction
      }
    };
    // @ts-ignore
    return this.model.paginate(query, options);
  }

  async save(data: Partial<T>): Promise<T> {
    const modelInstance = new this.model(data);
    return modelInstance.save() as any;
  }

  async delete(id: string): Promise<void> {
    await this.model.deleteOne({ _id: id }).exec();
  }

  async update(data: Record<string, any> & { _id: string }): Promise<T> {
    const existing = await this.getOne(data._id);
    Object.assign(existing as any, data);
    return (existing as T & Document).save(); // garante tipagem
  }

  async getOne(id: string, populate?: any): Promise<T> {
    const query = this.model.findById(id);
    // @ts-ignore
    return (populate ? query.populate(populate) : query).exec();
  }
}
