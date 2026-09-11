import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsMongoId, IsOptional, IsString } from 'class-validator';

export class CreateAppointmentDto {
  @ApiProperty()
  @IsMongoId()
  pacienteId: string;

  @ApiProperty()
  @IsMongoId()
  medicaId: string;

  @ApiProperty()
  @IsDateString()
  dataHora: Date;

  @ApiProperty({ enum: ['Consulta', 'Retorno', 'Parto', 'Exame'] })
  @IsEnum(['Consulta', 'Retorno', 'Parto', 'Exame'])
  tipo: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  motivo?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  observacoes?: string;
}

export class UpdateAppointmentDto extends CreateAppointmentDto {
  @ApiProperty()
  @IsMongoId()
  _id: string;
}
