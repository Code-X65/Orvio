import type { AppEnv } from '../../config/env.js';
import { AppError } from '../../lib/app-error.js';

export interface PhoneMessageSender {
  sendVerificationCode(phone: string, code: string): Promise<void>;
}

export function createTermiiSender(env: AppEnv): PhoneMessageSender {
  return {
    async sendVerificationCode(phone, code) {
      if (env.NODE_ENV !== 'production') {
        console.info(`\n========================================\n[AUTH OTP] Phone: ${phone} | Code: ${code}\n========================================\n`);
      }

      if (!env.TERMII_API_KEY || !env.TERMII_SENDER_ID) {
        // Fallback gracefully in dev/staging when Termii credentials are not provided
        return;
      }

      try {
        const response = await fetch(new URL('/api/sms/send', env.TERMII_BASE_URL), {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            api_key: env.TERMII_API_KEY,
            to: phone.replace(/^\+/, ''),
            from: env.TERMII_SENDER_ID,
            sms: `Your Orvio verification code is ${code}. It expires in 10 minutes.`,
            type: 'plain',
            channel: 'generic',
          }),
        });
        if (!response.ok) {
          console.warn(`[SMS Delivery Warning] Termii returned status ${response.status}`);
          if (env.NODE_ENV === 'production') {
            throw new AppError(503, 'PHONE_DELIVERY_FAILED', 'We could not send a verification code. Please try again.');
          }
        }
      } catch (err) {
        if (err instanceof AppError) throw err;
        console.warn(`[SMS Delivery Error] Failed to reach Termii: ${(err as Error).message}`);
        if (env.NODE_ENV === 'production') {
          throw new AppError(503, 'PHONE_DELIVERY_FAILED', 'We could not send a verification code. Please try again.');
        }
      }
    },
  };
}
