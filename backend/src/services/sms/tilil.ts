import type { SmsMessage, SmsProvider } from './provider.js';

/**
 * Tilil (tilil.co.ke) SMS gateway client.
 *
 * Implements the commonly documented v3 REST format:
 *   POST {baseUrl}/sms/send
 *   Authorization: Bearer <apiKey>
 *   { username, apikey, senderid, recipient, msg }
 *
 * NOTE: Tilil's developer docs live behind their customer portal and were not
 * publicly accessible at build time. Verify the exact base path, header names
 * and body field names against your Tilil dashboard before enabling
 * `SMS_PROVIDER=tilil` in production — the interface makes a swap trivial.
 */
export class TililSmsProvider implements SmsProvider {
  readonly name = 'tilil';

  constructor(
    private readonly baseUrl: string,
    private readonly apiKey: string,
    private readonly senderId: string,
  ) {}

  async send(message: SmsMessage): Promise<void> {
    const res = await fetch(`${this.baseUrl.replace(/\/$/, '')}/sms/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        apikey: this.apiKey,
        senderid: this.senderId,
        recipient: message.to,
        msg: message.text,
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Tilil SMS failed (${res.status}): ${body.slice(0, 300)}`);
    }
  }
}
