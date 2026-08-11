export interface SmsMessage {
  to: string;
  text: string;
}

export interface SmsProvider {
  readonly name: string;
  send(message: SmsMessage): Promise<void>;
}
