import pino from 'pino';
import type { EmailSender, EmailMessage } from './port.js';

const logger = pino({ name: 'email-sender:console' });

export class ConsoleEmailSender implements EmailSender {
  async send(message: EmailMessage): Promise<void> {
    const recipientStr = message.to.map((r) => (r.name ? `${r.name} <${r.email}>` : r.email)).join(', ');
    
    logger.info(
      {
        recipients: message.to,
        subject: message.subject,
        templateId: message.templateId,
        params: message.params,
      },
      `[Email Simulation] To: ${recipientStr} | Subject: "${message.subject}"`
    );

    if (process.env.NODE_ENV !== 'test') {
      console.log('──────────────────────────────────────────────────────────────────');
      console.log(`📧 [Console Email] To: ${recipientStr}`);
      console.log(`   Subject: ${message.subject}`);
      if (message.htmlContent) {
        // Extract links from HTML for easy developer clicking
        const linkMatches = message.htmlContent.match(/href="([^"]+)"/g);
        if (linkMatches) {
          console.log(`   Extracted Links:`);
          linkMatches.forEach((m) => console.log(`     🔗 ${m.replace(/href="|"/g, '')}`));
        }
      }
      console.log('──────────────────────────────────────────────────────────────────');
    }
  }
}

export const consoleEmailSender = new ConsoleEmailSender();
