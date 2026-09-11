import { onRequest } from 'firebase-functions/v2/https';
import { api } from './main';

export const nestApp = onRequest({ region: 'southamerica-east1' }, api);
