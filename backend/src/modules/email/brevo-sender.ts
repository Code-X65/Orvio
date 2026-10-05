import { env } from '../../config/env.js';
import { AppError } from '../../lib/errors.js';
import type { EmailSender, EmailMessage } from './port.js';

export class BrevoEmailSender implements EmailSender {
  private apiKey: string;
  private senderEmail: string;
  private senderName: string;

  constructor(apiKey?: string, senderEmail?: string, senderName?: string) {
    this.apiKey = apiKey ?? env.BREVO_API_KEY ?? '';
    this.senderEmail = senderEmail ?? env.BREVO_SENDER_EMAIL;
    this.senderName = senderName ?? env.BREVO_SENDER_NAME;

    if (!this.apiKey && env.NODE_ENV === 'production') {
      throw new AppError('EMAIL_DELIVERY_FAILED', 'BREVO_API_KEY is missing in production environment', 500);
    }
  }

  async send(message: EmailMessage): Promise<void> {
    if (!this.apiKey) {
      console.warn('[BrevoEmailSender] No BREVO_API_KEY configured. Fallback to console simulation.');
      return;
    }

    const payload: {
      sender: { name: string; email: string };
      to: { email: string; name?: string }[];
      subject: string;
      htmlContent?: string;
      templateId?: number;
      params?: Record<string, unknown>;
    } = {
      sender: {
        name: this.senderName,
        email: this.senderEmail,
      },
      to: message.to,
      subject: message.subject,
    };

    if (message.templateId || env.BREVO_TEMPLATE_ID) {
      payload.templateId = message.templateId ?? env.BREVO_TEMPLATE_ID;
      if (message.params) {
        payload.params = message.params;
      }
    } else if (message.htmlContent) {
      payload.htmlContent = message.htmlContent;
    }

    try {
      const response = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'accept': 'application/json',
          'api-key': this.apiKey,
          'content-type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[BrevoEmailSender] HTTP Error response:', errorText);
        throw new AppError(
          'EMAIL_DELIVERY_FAILED',
          `Brevo email delivery failed with status ${response.status}: ${response.statusText}`,
          502,
          { response: errorText }
        );
      }

      const resData = (await response.json().catch(() => ({}))) as { messageId?: string };
      console.info(
        `[BrevoEmailSender] ✅ Email "${message.subject}" delivered to ${message.to.map((t) => t.email).join(', ')} (messageId: ${resData.messageId || 'ok'})`
      );
    } catch (err) {
      if (err instanceof AppError) {
        throw err;
      }
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      throw new AppError(
        'EMAIL_DELIVERY_FAILED',
        `Brevo email delivery failed: ${errorMsg}`,
        502
      );
    }
  }
}

export const brevoEmailSender = new BrevoEmailSender();
