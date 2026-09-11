// calendar.service.ts
import { Injectable } from '@nestjs/common';
import { google } from 'googleapis';
import { readFileSync } from 'fs';
import { JWT } from 'google-auth-library';

@Injectable()
export class CalendarService {
  private calendar;

  constructor() {
    const credentials = JSON.parse(
      readFileSync('./credentials/google-calendar-key.json', 'utf-8')
    );

    const auth = new JWT({
      email: credentials.client_email,
      key: credentials.private_key,
      scopes: ['https://www.googleapis.com/auth/calendar'],
    });

    this.calendar = google.calendar({ version: 'v3', auth });
  }

  async criarEvento(
    calendarId: string,
    titulo: string,
    descricao: string,
    inicio: Date,
    fim: Date
  ): Promise<string> {
    const res = await this.calendar.events.insert({
      calendarId,
      requestBody: {
        summary: titulo,
        description: descricao,
        start: {
          dateTime: inicio.toISOString(),
          timeZone: 'America/Sao_Paulo',
        },
        end: {
          dateTime: fim.toISOString(),
          timeZone: 'America/Sao_Paulo',
        },
      },
    });
    return res.data.id;
  }

  async cancelarEvento(calendarId: string, eventId: string): Promise<void> {
    await this.calendar.events.delete({
      calendarId,
      eventId
    });
  }

  async atualizarEvento(calendarId: string, eventId: string, dadosAtualizados: {
    summary?: string;
    description?: string;
    start: Date;
    end: Date;
  }): Promise<void> {
    await this.calendar.events.patch({
      calendarId,
      eventId,
      requestBody: {
        summary: dadosAtualizados.summary,
        description: dadosAtualizados.description,
        start: { dateTime: dadosAtualizados.start.toISOString(), timeZone: 'America/Sao_Paulo' },
        end: { dateTime: dadosAtualizados.end.toISOString(), timeZone: 'America/Sao_Paulo' },
      }
    });
  }
}
