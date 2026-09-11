import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { BotService } from './bot.service';
import { Logger } from '@nestjs/common';

const logger = new Logger('Webhook');


@Controller('bot')
export class BotController {
  constructor(private readonly botService: BotService) {}

  @Post('webhook')
  async receberMensagem(@Body() body: any) {
    logger.log('📩 Mensagem recebida via WhatsApp:', JSON.stringify(body));
    return this.botService.processarWebhook(body);
  }

  @Get('webhook')
  getWebhookVerification(@Query() query: any) {
    logger.log('Verificação WhatsApp:');
    return query['hub.challenge'];
  }
}
