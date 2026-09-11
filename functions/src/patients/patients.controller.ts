import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { PatientsService } from './patients.service';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { FiltroDto } from '../common/dto/filtro.dto';
import { CreatePatientDto, UpdatePatientDto } from './dto/patient.dto';
import { ApiKeyGuard } from '../auth/api-key.guard';

@ApiTags('Pacientes')
@UseGuards(ApiKeyGuard)
@Controller('pacientes')
export class PatientController {
  constructor(private readonly service: PatientsService) {}

  @Get()
  @ApiOperation({ summary: 'Listar pacientes com paginação' })
  findAll(@Query() filtro: FiltroDto) {
    return this.service.findAll(filtro);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obter paciente por ID' })
  findOne(@Param('id') id: string) {
    return this.service.getOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Criar paciente' })
  create(@Body() body: CreatePatientDto) {
    return this.service.save(body);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Atualizar paciente' })
  update(@Param('id') id: string, @Body() body: UpdatePatientDto) {
    return this.service.update({ ...body, _id: id });
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remover paciente' })
  remove(@Param('id') id: string) {
    return this.service.delete(id);
  }
}
