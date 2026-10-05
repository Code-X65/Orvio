import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestApp, type TestAppContext } from '../helpers/app.js';

describe('Password Reset Flow (Integration)', () => {
  let ctx: TestAppContext;

  beforeEach(async () => {
    ctx = await createTestApp();
  });

  afterEach(async () => {
    await ctx.app.close();
  });

  it('completes forgot-password -> reset-password flow and prevents old password login', async () => {
    const timestamp = Date.now();
    const email = `reset_tester_${timestamp}@example.com`;
    const initialPassword = 'OldPassword123!';
    const newPassword = 'NewPassword456!';
    const subdomain = `resetorg${timestamp.toString().slice(-6)}`;

    // 1. Register & activate user
    const regRes = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        email,
        password: initialPassword,
        fullName: 'Reset Tester',
        organizationName: 'Reset Org',
        subdomain,
      },
    });
    expect(regRes.statusCode).toBe(201);

    const verifyEmailSent = ctx.emailSender.findVerificationEmail(email);
    expect(verifyEmailSent).toBeDefined();

    await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/auth/verify-email',
      payload: { token: verifyEmailSent!.token },
    });

    // 2. Request password reset
    const forgotRes = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/auth/forgot-password',
      payload: { email },
    });
    expect(forgotRes.statusCode).toBe(200);

    // 3. Extract reset token from sent email
    const resetEmailSent = ctx.emailSender.sentEmails.find((e) =>
      e.subject.includes('Reset your password') && e.to.some((rec) => rec.email === email)
    );
    expect(resetEmailSent).toBeDefined();

    const tokenMatch = resetEmailSent!.html.match(/token=([a-zA-Z0-9_-]+)/);
    expect(tokenMatch).toBeDefined();
    const resetToken = tokenMatch![1];

    // 4. Reset password
    const resetRes = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/auth/reset-password',
      payload: {
        token: resetToken,
        password: newPassword,
      },
    });
    expect(resetRes.statusCode).toBe(200);

    // 5. Old password login must fail
    const oldLoginRes = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email, password: initialPassword },
    });
    expect(oldLoginRes.statusCode).toBe(401);

    // 6. New password login must succeed
    const newLoginRes = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email, password: newPassword },
    });
    expect(newLoginRes.statusCode).toBe(200);
    expect(newLoginRes.json().data.accessToken).toBeDefined();
  }, 35000);
});
