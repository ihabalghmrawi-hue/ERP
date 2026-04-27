export interface WhatsAppMessagePayload {
  to: string;
  body: string;
  customerId: string;
}

export interface WhatsAppSendResult {
  providerMessageId: string;
  status: "queued" | "sent";
}

export interface WhatsAppProvider {
  sendMessage(payload: WhatsAppMessagePayload): Promise<WhatsAppSendResult>;
}

export class MockWhatsAppProvider implements WhatsAppProvider {
  async sendMessage(_: WhatsAppMessagePayload): Promise<WhatsAppSendResult> {
    return {
      providerMessageId: `mock-${Date.now()}`,
      status: "queued",
    };
  }
}

export class WhatsAppService {
  constructor(private provider: WhatsAppProvider) {}

  async sendAndLog(payload: WhatsAppMessagePayload) {
    const result = await this.provider.sendMessage(payload);
    return {
      interaction: {
        customerId: payload.customerId,
        kind: "whatsapp",
        note: payload.body,
        providerMessageId: result.providerMessageId,
        createdAt: new Date().toISOString(),
      },
      result,
    };
  }
}
