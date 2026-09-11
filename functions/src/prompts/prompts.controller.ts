import { Controller, Get, Post, Body, Param, Delete, Put, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { PromptsService } from './prompts.service';
import { CreatePromptDto, UpdatePromptDto } from './dto/prompt.dto';

@ApiTags('Prompts')
@Controller('prompts')
export class PromptController {
  constructor(private readonly service: PromptsService) {}

  @Get(':id')
  @ApiOperation({ summary: 'Obter prompt por ID' })
  findOne(@Param('id') id: string) {
    return this.service.getById(id);
  }

  @Get()
  @ApiOperation({ summary: 'Buscar prompts por pacienteId (opcional)' })
  findByPaciente(@Query('pacienteId') pacienteId: string) {
    return pacienteId ? this.service.findByPacienteId(pacienteId) : [];
  }

  @Post()
  @ApiOperation({ summary: 'Criar prompt' })
  create(@Body() body: CreatePromptDto) {
    return this.service.create(body as any);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Atualizar prompt' })
  update(@Param('id') id: string, @Body() body: UpdatePromptDto) {
    return this.service.update(id, body as any);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remover prompt' })
  remove(@Param('id') id: string) {
    return this.service.delete(id);
  }
}
