import type { FastifyRequest } from 'fastify';
import type { DatabaseClient } from '../../infrastructure/database/prisma.js';
import type { NotificationEmailType } from './email-links.js';
import { writeAuditEvent } from './audit.js';

export async function deliverNotificationEmail(options: { database: DatabaseClient; request?: FastifyRequest; userId: string; type: NotificationEmailType; send: () => Promise<void> }) {
  try {
    await options.send();
    if (options.request) await writeAuditEvent(options.database, 'email.sent', options.userId, options.request, { type: options.type, status: 'sent' });
    return true;
  } catch (error) {
    if (options.request) await writeAuditEvent(options.database, 'email.sent', options.userId, options.request, { type: options.type, status: 'failed' }).catch(() => undefined);
    options.request?.log.warn({ err: error, userId: options.userId, type: options.type }, 'Email delivery failed');
    return false;
  }
}
