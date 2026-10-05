import { emailSender, type EmailSender } from '../../modules/email/index.js';

export interface SendVerificationEmailParams {
  toEmail: string;
  toName: string;
  verificationLink: string;
  organizationName: string;
}

export class EmailService {
  constructor(private sender: EmailSender = emailSender) {}

  async sendVerificationEmail({
    toEmail,
    toName,
    verificationLink,
    organizationName,
  }: SendVerificationEmailParams): Promise<void> {
    await this.sender.send({
      to: [{ email: toEmail, name: toName }],
      subject: `Verify your email for ${organizationName} on Orvio Hub`,
      htmlContent: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
          <h2>Welcome to Orvio Hub!</h2>
          <p>Hello ${toName},</p>
          <p>Please click the link below to verify your email address and activate <strong>${organizationName}</strong>:</p>
          <p><a href="${verificationLink}" style="display:inline-block;padding:12px 24px;background:#4f46e5;color:#fff;text-decoration:none;border-radius:6px;">Verify Email</a></p>
          <p>This link expires in 24 hours.</p>
        </div>
      `,
    });
  }
}

export const emailService = new EmailService();
