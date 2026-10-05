import type { EmailSender, EmailMessage, EmailRecipient } from '../../src/modules/email/port.js';

export interface RecordedEmail {
  to: EmailRecipient[];
  subject: string;
  html: string;
}

export class RecordingEmailSender implements EmailSender {
  public sentEmails: RecordedEmail[] = [];

  async send(message: EmailMessage): Promise<void> {
    this.sentEmails.push({
      to: message.to,
      subject: message.subject,
      html: message.htmlContent ?? '',
    });
  }

  // Backwards compatibility alias
  async sendEmail(payload: { to: EmailRecipient[]; subject: string; html: string }): Promise<{ messageId: string }> {
    this.sentEmails.push(payload);
    return { messageId: `rec-msg-${this.sentEmails.length}` };
  }

  clear(): void {
    this.sentEmails = [];
  }

  getLastEmail(): RecordedEmail | undefined {
    return this.sentEmails[this.sentEmails.length - 1];
  }

  findVerificationEmail(email: string): { email: RecordedEmail; token: string } | undefined {
    const found = this.sentEmails.find(
      (e) => e.to.some((rec) => rec.email.toLowerCase() === email.toLowerCase()) && (e.html.includes('token=') || e.subject.includes('Verify'))
    );
    if (!found) return undefined;
    const match = found.html.match(/token=([a-zA-Z0-9_-]+)/);
    return match ? { email: found, token: match[1] } : undefined;
  }
}
