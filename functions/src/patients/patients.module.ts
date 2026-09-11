import { Module } from '@nestjs/common';
import { PatientsService } from './patients.service';
import { PatientController } from './patients.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { Patient, PatientSchema } from './patient.schema';

@Module({
  controllers: [PatientController],
  providers: [PatientsService],
  imports: [
    MongooseModule.forFeature([{ name: Patient.name, schema: PatientSchema }]),
  ],
  exports: [PatientsService],
})
export class PatientsModule {}
