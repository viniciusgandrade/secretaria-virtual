import { Module } from '@nestjs/common';
import { DoctorService } from './doctors.service';
import { DoctorController } from './doctors.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { Doctor, DoctorSchema } from './doctor.schema';
import { AppointmentsModule } from '../appointments/appointments.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Doctor.name, schema: DoctorSchema }]),
    AppointmentsModule,
  ],
  controllers: [DoctorController],
  providers: [DoctorService],
})
export class DoctorsModule {}
