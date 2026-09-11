// doctor.controller.ts
import { Body, Controller, Get, Param, Post, Put, Query } from '@nestjs/common';
import { DoctorService } from './doctors.service';
import { UpdateAgendaDto } from './dto/update-agenda.dto';

@Controller('doctors')
export class DoctorController {
  constructor(private readonly doctorService: DoctorService) {}

  @Get()
  async listarTodas() {
    return this.doctorService.listarMedicas();
  }

  @Get(':id')
  async buscarPorId(@Param('id') id: string) {
    return this.doctorService.buscarMedicaPorId(id);
  }

  @Get(':id/agenda')
  async obterAgenda(@Param('id') id: string) {
    return this.doctorService.obterAgenda(id);
  }

  @Put(':id/agenda')
  async atualizarAgenda(@Param('id') id: string, @Body() dto: UpdateAgendaDto) {
    return this.doctorService.atualizarAgenda(id, dto);
  }

  @Get(':id/horarios-disponiveis')
  async horariosDisponiveis(
    @Param('id') id: string,
    @Query('formato') formato: 'online' | 'presencial'
  ) {
    return this.doctorService.listarHorariosDisponiveis(id, formato);
  }

  @Post()
  async criarMedica(@Body() body) {
    return this.doctorService.criarMedica(body);
  }
}
