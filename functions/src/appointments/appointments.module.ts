// backend/src/appointment/appointment.module.ts
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Appointment, AppointmentSchema } from './appointment.schema';
import { AppointmentsService } from './appointments.service';
import { CalendarService } from '../calendar/calendar.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Appointment.name, schema: AppointmentSchema }])
  ],
  providers: [AppointmentsService, CalendarService],
  exports: [AppointmentsService]
})
export class AppointmentsModule {}
