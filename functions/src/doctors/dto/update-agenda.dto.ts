import { IsArray, IsIn, IsInt, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class AgendaItemDto {
  @IsInt()
  diaSemana: number; // 0 = domingo, 6 = sábado

  @IsIn(['online', 'presencial'])
  formato: 'online' | 'presencial';

  @IsArray()
  @IsString({ each: true })
  horarios: string[]; // ex: ["09:00", "14:30"]
}

export class UpdateAgendaDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AgendaItemDto)
  agenda: AgendaItemDto[];
}
