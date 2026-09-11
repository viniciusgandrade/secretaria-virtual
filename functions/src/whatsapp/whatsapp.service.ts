import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class WhatsappService {
  private readonly logger = new Logger(WhatsappService.name);
  private readonly instanceId = process.env.WAPI_INSTANCE_ID;
  private readonly token = process.env.WAPI_TOKEN;

  /**
   * Modo seco: com WHATSAPP_DRY_RUN=true a mensagem é apenas registrada no
   * log, sem sair para o gateway. É o que permite exercitar o webhook inteiro
   * localmente sem mandar WhatsApp para ninguém.
   */
  private readonly dryRun = process.env.WHATSAPP_DRY_RUN === 'true';

  async enviarMensagem(phone: string, message: string): Promise<void> {
    if (this.dryRun) {
      this.logger.log(`[DRY RUN] para ${phone}:\n${message}`);
      return;
    }

    const url = `https://api.w-api.app/v1/message/send-text?instanceId=${this.instanceId}`;
    try {
      await axios.post(
        url,
        { phone, message },
        {
          headers: {
            Authorization: `Bearer ${this.token}`,
            'Content-Type': 'application/json',
          },
          timeout: 15000,
        }
      );
    } catch (erro) {
      // Falha de envio não pode derrubar o processamento da conversa.
      const detalhe = axios.isAxiosError(erro)
        ? `${erro.response?.status ?? 'sem status'} ${JSON.stringify(erro.response?.data ?? {})}`
        : String(erro);
      this.logger.error(`Falha ao enviar mensagem para ${phone}: ${detalhe}`);
    }
  }
}
