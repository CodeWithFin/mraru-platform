import type { SmsMessage, SmsProvider } from './provider.js';

/** Dev fallback: log the message (OTP codes surface in the API console). */
export class DevSmsProvider implements SmsProvider {
  readonly name = 'dev';

  async send(message: SmsMessage): Promise<void> {
    console.log(`[SMS:dev] to=${message.to} :: ${message.text}`);
  }
}
