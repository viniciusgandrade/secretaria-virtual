import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsDateString, IsMongoId, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class MensagemDto {
  @ApiProperty({ enum: ['bot', 'paciente'] })
  @IsString()
  origem: string;

  @ApiProperty()
  @IsString()
  texto: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dataHora?: Date;
}

class ContextoDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  tipoAgendamento?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  especialidadeDesejada?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dataSugerida?: Date;
}

export class CreatePromptDto {
  @ApiProperty()
  @IsMongoId()
  pacienteId: string;

  @ApiProperty({ type: [MensagemDto] })
  @ValidateNested({ each: true })
  @Type(() => MensagemDto)
  mensagens: MensagemDto[];

  @ApiProperty({ type: ContextoDto })
  @ValidateNested()
  @Type(() => ContextoDto)
  contexto: ContextoDto;
}

export class UpdatePromptDto extends CreatePromptDto {
  @ApiProperty()
  @IsMongoId()
  _id: string;
}
