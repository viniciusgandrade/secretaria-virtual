import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BotService } from './bot.service';
import { ChatContext, ChatContextSchema } from './schemas/chat-context.schema';
import { ChatService } from '../ai/chat.service';
import { PatientsModule } from '../patients/patients.module';
import { PromptsModule } from '../prompts/prompts.module';
import { WhatsappModule } from '../whatsapp/whatsapp.module';
import { CalendarService } from '../calendar/calendar.service';
import { AppointmentsModule } from '../appointments/appointments.module';
import { Doctor, DoctorSchema } from '../doctors/doctor.schema';
import { BotController } from './bot.controller';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: ChatContext.name, schema: ChatContextSchema }]),
    MongooseModule.forFeature([{ name: Doctor.name, schema: DoctorSchema }]),
    PatientsModule,
    PromptsModule,
    WhatsappModule,
    AppointmentsModule,
  ],
  controllers: [BotController],
  providers: [BotService, ChatService, CalendarService],
  exports: [BotService],
})
export class BotModule {}
