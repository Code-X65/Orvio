import { env } from '../../config/env.js';
import type { EmailSender } from './port.js';
import { ConsoleEmailSender, consoleEmailSender } from './console-sender.js';
import { BrevoEmailSender, brevoEmailSender } from './brevo-sender.js';

export * from './port.js';
export * from './console-sender.js';
export * from './brevo-sender.js';

export function createEmailSender(transport = env.EMAIL_TRANSPORT): EmailSender {
  const shouldUseBrevo = (transport === 'brevo' || !!env.BREVO_API_KEY) && transport !== 'console';
  if (shouldUseBrevo && env.BREVO_API_KEY) {
    return new BrevoEmailSender();
  }
  return new ConsoleEmailSender();
}

export const emailSender: EmailSender =
  ((env.EMAIL_TRANSPORT === 'brevo' || !!env.BREVO_API_KEY) && env.EMAIL_TRANSPORT !== 'console' && !!env.BREVO_API_KEY)
    ? brevoEmailSender
    : consoleEmailSender;
