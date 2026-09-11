import { Module } from '@nestjs/common';
import { PromptsService } from './prompts.service';
import { PromptController } from './prompts.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { Prompt, PromptSchema } from './prompt.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Prompt.name, schema: PromptSchema }])
  ],
  controllers: [PromptController],
  providers: [PromptsService],
  exports: [PromptsService],
})
export class PromptsModule {}
