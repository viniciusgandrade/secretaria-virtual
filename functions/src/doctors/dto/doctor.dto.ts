import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsEnum, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class AgendaItemDto {
  @ApiProperty()
  @IsString()
  diaSemana: number;

  @ApiProperty({ type: [String] })
  @IsArray()
  horarios: string[];
}

export class CreateDoctorDto {
  @ApiProperty()
  @IsString()
  nome: string;

  @ApiProperty({ enum: ['Ginecologia', 'Obstetrícia', 'Ultrassonografia'] })
  @IsEnum(['Ginecologia', 'Obstetrícia', 'Ultrassonografia'])
  especialidade: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  crm?: string;

  @ApiProperty({ type: [AgendaItemDto] })
  @ValidateNested({ each: true })
  @Type(() => AgendaItemDto)
  agenda: AgendaItemDto[];

  @ApiProperty({ type: [String] })
  @IsArray()
  procedimentos: string[];
}

export class UpdateDoctorDto extends CreateDoctorDto {
  @ApiProperty()
  @IsString()
  _id: string;
}
