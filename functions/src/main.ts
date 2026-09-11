import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ExpressAdapter } from '@nestjs/platform-express';
import express from 'express';

import { fetch, Headers, Request, Response } from 'undici';

// @ts-ignore
Object.assign(globalThis, { fetch, Headers, Request, Response });

const server = express();

export const createNestServer = async (expressInstance) => {
  const app = await NestFactory.create(AppModule, new ExpressAdapter(expressInstance));
  await app.init();
};

createNestServer(server);

export const api = server;
