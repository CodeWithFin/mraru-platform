import { env } from '../../env.js';
import { DevSmsProvider } from './dev.js';
import { TililSmsProvider } from './tilil.js';
import type { SmsProvider } from './provider.js';

export function createSmsProvider(): SmsProvider {
  if (env.SMS_PROVIDER === 'tilil') {
    return new TililSmsProvider(env.TILIL_BASE_URL, env.TILIL_API_KEY, env.TILIL_SENDER_ID);
  }
  return new DevSmsProvider();
}

export const smsProvider = createSmsProvider();
export type { SmsMessage, SmsProvider } from './provider.js';
