import { Injectable } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class WhatsappService {
  private readonly instanceId = process.env.WAPI_INSTANCE_ID;
  private readonly token = process.env.WAPI_TOKEN;

  async enviarMensagem(phone: string, message: string) {
    const url = `https://api.w-api.app/v1/message/send-text?instanceId=${this.instanceId}`;
    await axios.post(
      url,
      {
        phone,
        message
      },
      {
        headers: {
          Authorization: `Bearer ${this.token}`,
          'Content-Type': 'application/json'
        }
      }
    );
  }
}
