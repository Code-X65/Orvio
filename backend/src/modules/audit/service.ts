import type { PrismaClient } from '@prisma/client';
import { prisma as defaultPrisma } from '../../infrastructure/database/client.js';

export type AuditEventType =
  | 'login_success'
  | 'login_failed'
  | 'logout'
  | 'token_refresh'
  | 'password_change'
  | 'password_reset_requested'
  | 'session_revoked'
  | 'profile_update'
  | 'email_change_requested'
  | 'email_change_completed'
  | 'phone_otp_requested'
  | 'phone_verified'
  | 'account_deleted';

export interface RecordAuditParams {
  userId?: string | null;
  orgId?: string | null;
  event: AuditEventType | string;
  status?: 'success' | 'failed';
  ipAddress?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, unknown> | null;
}

export async function recordAuditEvent(
  db: PrismaClient = defaultPrisma,
  params: RecordAuditParams
): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        user_id: params.userId ?? null,
        org_id: params.orgId ?? null,
        event: params.event,
        status: params.status ?? 'success',
        ip_address: params.ipAddress ?? null,
        user_agent: params.userAgent ? params.userAgent.slice(0, 512) : null,
        metadata: params.metadata ? (params.metadata as any) : undefined,
      },
    });
  } catch (err) {
    // Non-blocking: audit log insertion failure should never disrupt the primary user transaction
    console.error('Failed to write audit log entry:', err);
  }
}

export async function listUserAuditLogs(
  db: PrismaClient = defaultPrisma,
  userId: string,
  options?: { page?: number; limit?: number }
) {
  const page = Math.max(1, options?.page ?? 1);
  const limit = Math.min(100, Math.max(1, options?.limit ?? 20));
  const skip = (page - 1) * limit;

  const [logs, total] = await Promise.all([
    db.auditLog.findMany({
      where: { user_id: userId },
      orderBy: { created_at: 'desc' },
      skip,
      take: limit,
      select: {
        id: true,
        event: true,
        status: true,
        ip_address: true,
        user_agent: true,
        metadata: true,
        created_at: true,
      },
    }),
    db.auditLog.count({
      where: { user_id: userId },
    }),
  ]);

  return {
    logs,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}
