import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsDateString, IsNumber, IsMongoId } from 'class-validator';

export class CreatePatientDto {
  @ApiProperty()
  @IsString()
  nome: string;

  @ApiProperty()
  @IsString()
  telefone: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  documento?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dataNascimento?: Date;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  idadeGestacionalSemanas?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dataUltimaMenstruacao?: Date;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dataProvavelParto?: Date;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  historicoClinico?: string;
}

export class UpdatePatientDto extends CreatePatientDto {
  @ApiProperty()
  @IsMongoId()
  _id: string;
}
