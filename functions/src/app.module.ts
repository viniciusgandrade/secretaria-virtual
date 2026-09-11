import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule } from '@nestjs/config';
import { BotModule } from './bot/bot.module';
import { AppointmentsModule } from './appointments/appointments.module';
import { PatientsModule } from './patients/patients.module';
import { DoctorsModule } from './doctors/doctors.module';
import { PromptsModule } from './prompts/prompts.module';
import { WhatsappModule } from './whatsapp/whatsapp.module';
import { LlmModule } from './ai/llm/llm.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    LlmModule,
    MongooseModule.forRoot(process.env.MONGO_URL!),
    PromptsModule,
    BotModule,
    AppointmentsModule,
    PatientsModule,
    DoctorsModule,
    WhatsappModule,
  ],
})
export class AppModule {}
