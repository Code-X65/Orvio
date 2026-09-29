import type { FastifyInstance } from 'fastify';

import type { AppEnv } from '../config/env.js';
import { AppError } from '../lib/app-error.js';
import type { AuthMailSender } from '../modules/auth/mail.js';
import type { PhoneMessageSender } from '../modules/auth/sms.js';

type CapturedDelivery = { kind: 'verification' | 'password_reset' | 'phone_otp'; email?: string; phone?: string; token?: string; code?: string; link?: string; createdAt: string };
const deliveries: CapturedDelivery[] = [];

function capture(delivery: CapturedDelivery) { deliveries.push(delivery); }

export function createCapturedMailSender(env: AppEnv): AuthMailSender {
  return {
    async sendVerification(email, token) {
      const link = new URL('/verify-email', env.FRONTEND_APP_URL);
      link.hash = new URLSearchParams({ token }).toString();
      capture({ kind: 'verification', email, token, link: link.toString(), createdAt: new Date().toISOString() });
    },
    async sendPasswordReset(email, token) {
      const link = new URL('/reset-password/confirm', env.FRONTEND_APP_URL);
      link.searchParams.set('token', token);
      capture({ kind: 'password_reset', email, token, link: link.toString(), createdAt: new Date().toISOString() });
    },
    async sendPasswordChangedNotification() {},
    async sendWelcome() {},
    async sendOnboardingTips() {},
    async sendNewDeviceLoginNotification() {},
  };
}

export function createCapturedSmsSender(): PhoneMessageSender {
  return { async sendVerificationCode(phone, code) { capture({ kind: 'phone_otp', phone, code, createdAt: new Date().toISOString() }); } };
}

export async function registerDeliveryCaptureRoutes(app: FastifyInstance, env: AppEnv): Promise<void> {
  if (!env.E2E_TEST_MODE) return;
  const authorize = (secret: unknown) => {
    if (secret !== env.E2E_CAPTURE_SECRET) throw new AppError(404, 'RESOURCE_NOT_FOUND', 'The requested resource was not found.');
  };
  app.delete('/api/v1/test/delivery', async (request) => {
    authorize(request.headers['x-e2e-capture-secret']);
    deliveries.length = 0;
    return { data: { cleared: true }, meta: { requestId: request.id } };
  });
  app.get('/api/v1/test/delivery', async (request) => {
    authorize(request.headers['x-e2e-capture-secret']);
    const query = request.query as { kind?: CapturedDelivery['kind']; email?: string; phone?: string };
    const delivery = [...deliveries].reverse().find((item) =>
      (!query.kind || item.kind === query.kind)
      && (!query.email || item.email === query.email)
      && (!query.phone || item.phone === query.phone),
    );
    if (!delivery) throw new AppError(404, 'DELIVERY_NOT_FOUND', 'No captured delivery was found.');
    return { data: delivery, meta: { requestId: request.id } };
  });
}
