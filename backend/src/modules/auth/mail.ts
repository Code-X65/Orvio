import type { AppEnv } from '../../config/env.js';
import { trackedEmailLink, type NotificationEmailType } from './email-links.js';

export interface AuthMailSender {
  sendVerification(email: string, token: string, userId?: string): Promise<void>;
  sendPasswordReset(email: string, token: string, userId?: string): Promise<void>;
  sendPasswordChangedNotification(email: string, userId?: string): Promise<void>;
  sendWelcome(email: string, firstName?: string | null, userId?: string): Promise<void>;
  sendOnboardingTips?(email: string, details: { firstName?: string | null; useCase: string; businessType: string }, userId?: string): Promise<void>;
  sendNewDeviceLoginNotification(
    email: string,
    details: { ip?: string; userAgent?: string; time: string; firstName?: string | null }, userId?: string,
  ): Promise<void>;
}

export function createBrevoMailSender(env: AppEnv): AuthMailSender {
  const branded = (content: string) => `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;max-width:560px;margin:0 auto;background:#fff;color:#334155"><div style="background:#714B67;color:#fff;padding:20px 28px;font-weight:800;font-size:22px;letter-spacing:.4px">Orvio</div><div style="padding:28px">${content}</div><div style="border-top:3px solid #FDB02F;padding:18px 28px;color:#64748b;font-size:12px">Orvio · Helping businesses run smoothly</div></div>`;
  const actionUrl = (url: URL, userId: string | undefined, type: NotificationEmailType) => userId ? trackedEmailLink(env, userId, type, url.toString()) : url.toString();
  async function send(email: string, subject: string, path: string, token?: string, customHtml?: string, userId?: string, type: NotificationEmailType = 'welcome'): Promise<void> {
    const url = new URL(path, env.FRONTEND_APP_URL);
    if (token) {
      if (path === '/reset-password/confirm') url.searchParams.set('token', token);
      else url.hash = new URLSearchParams({ token }).toString();
    }
    const htmlContent = customHtml ?? branded(`
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px; color: #1e293b; background: #ffffff;">
        <div style="margin-bottom: 24px;">
          <h2 style="font-size: 20px; font-weight: 600; color: #0f172a; margin: 0 0 12px 0;">${subject}</h2>
          <p style="font-size: 14px; line-height: 22px; color: #475569; margin: 0 0 24px 0;">Click the button below to continue:</p>
          <a href="${actionUrl(url, userId, type)}" style="display: inline-block; background-color: #714B67; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 500; font-size: 14px;">Continue</a>
        </div>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
        <p style="font-size: 12px; color: #94a3b8; line-height: 18px; margin: 0;">If you did not request this email, you can safely ignore it.</p>
      </div>
    `);
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': env.BREVO_API_KEY, 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ sender: { email: env.BREVO_SENDER_EMAIL, name: env.BREVO_SENDER_NAME }, to: [{ email }], subject, htmlContent }),
    });
    if (!response.ok) throw new Error(`Brevo email delivery failed with ${response.status}`);
  }
  return {
    sendVerification: (email, token, userId) => send(email, 'Verify your Orvio email', '/verify-email', token, undefined, userId, 'verification'),
    sendPasswordReset: async (email, token, userId) => {
      const resetUrl = new URL('/reset-password/confirm', env.FRONTEND_APP_URL);
      resetUrl.searchParams.set('token', token);
      const resetHtml = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px; color: #1e293b; background: #ffffff;">
          <div style="margin-bottom: 24px;">
            <h2 style="font-size: 20px; font-weight: 700; color: #0f172a; margin: 0 0 16px 0;">Reset your Orvio password</h2>
            <p style="font-size: 14px; line-height: 22px; color: #334155; margin: 0 0 16px 0;">
              We received a request to reset the password for your Orvio account.
            </p>
            <p style="font-size: 14px; line-height: 22px; color: #475569; margin: 0 0 24px 0;">
              Click the button below to choose a new password. This link will expire in <strong>1 hour</strong>.
            </p>
            <a href="${actionUrl(resetUrl, userId, 'password_reset')}" style="display: inline-block; background-color: #714B67; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; font-size: 14px;">Reset Password</a>
          </div>
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
          <p style="font-size: 12px; color: #94a3b8; line-height: 18px; margin: 0;">
            If you did not request a password reset, you can safely ignore this email. Your password will remain unchanged.
          </p>
        </div>
      `;
      await send(email, 'Reset your Orvio password', '/reset-password/confirm', token, branded(resetHtml), userId, 'password_reset');
    },
    sendPasswordChangedNotification: async (email, userId) => {
      const loginUrl = new URL('/login', env.FRONTEND_APP_URL).toString();
      const resetUrl = new URL('/reset-password', env.FRONTEND_APP_URL).toString();
      const changedHtml = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px; color: #1e293b; background: #ffffff;">
          <div style="margin-bottom: 24px;">
            <h2 style="font-size: 20px; font-weight: 700; color: #0f172a; margin: 0 0 16px 0;">Your password was updated</h2>
            <p style="font-size: 14px; line-height: 22px; color: #334155; margin: 0 0 16px 0;">
              The password for your Orvio account has been successfully changed. All existing active sessions have been signed out for your security.
            </p>
            <p style="font-size: 14px; line-height: 22px; color: #475569; margin: 0 0 24px 0;">
              If you made this change, you can now sign in with your new password:
            </p>
            <a href="${actionUrl(new URL(loginUrl), userId, 'password_changed')}" style="display: inline-block; background-color: #714B67; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; font-size: 14px; margin-bottom: 16px;">Sign In to Orvio</a>
            <p style="font-size: 13px; line-height: 20px; color: #dc2626; margin: 12px 0 0 0;">
              If you did not make this change, please <a href="${actionUrl(new URL(resetUrl), userId, 'password_changed')}" style="color: #dc2626; font-weight: 600;">reset your password immediately</a> or contact support.
            </p>
          </div>
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
          <p style="font-size: 12px; color: #94a3b8; line-height: 18px; margin: 0;">
            Orvio Security Team · Automated Notification
          </p>
        </div>
      `;
      await send(email, 'Your Orvio password was reset successfully', '/login', undefined, branded(changedHtml), userId, 'password_changed');
    },
    sendWelcome: async (email, firstName, userId) => {
      const greeting = firstName ? `Hi ${firstName},` : 'Welcome to Orvio,';
      const dashboardUrl = new URL('/login', env.FRONTEND_APP_URL).toString();
      const welcomeHtml = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px; color: #1e293b; background: #ffffff;">
          <div style="margin-bottom: 24px;">
            <h2 style="font-size: 22px; font-weight: 700; color: #0f172a; margin: 0 0 16px 0;">${greeting}</h2>
            <p style="font-size: 15px; line-height: 24px; color: #334155; margin: 0 0 16px 0;">
              Your email has been successfully verified, and your Orvio account is now active!
            </p>
            <p style="font-size: 14px; line-height: 22px; color: #475569; margin: 0 0 24px 0;">
              You can now continue setting up your Orvio account and manage your operations securely.
            </p>
            <a href="${actionUrl(new URL(dashboardUrl), userId, 'welcome')}" style="display: inline-block; background-color: #714B67; color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-weight: 600; font-size: 14px;">Go to Dashboard</a>
          </div>
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 28px 0;" />
          <p style="font-size: 12px; color: #94a3b8; line-height: 18px; margin: 0;">
            Orvio, Inc. · If you did not create this account, please contact our support team.
          </p>
        </div>
      `;
      await send(email, 'Welcome to Orvio!', '/dashboard', undefined, branded(welcomeHtml), userId, 'welcome');
    },
    sendOnboardingTips: async (email, details, userId) => {
      const greeting = details.firstName ? `Hi ${details.firstName},` : 'Welcome to Orvio,';
      const useCaseTip: Record<string, string> = {
        inventory_management: 'Start by adding your best-selling products and setting stock alerts.',
        pos: 'Set up your first checkout workflow and invite the staff who will use it.',
        whatsapp_orders: 'Connect your order workflow so customer requests become trackable sales.',
        all_of_the_above: 'Begin with your products, then configure checkout and order workflows.',
      };
      const businessTip: Record<string, string> = {
        retail: 'For retail, keep product variants and reorder levels up to date.',
        wholesale: 'For wholesale, organize products around your common order quantities.',
        pharmacy: 'For pharmacies, capture the product information your team needs for reliable stock control.',
        restaurant: 'For restaurants, start with the ingredients and items that drive daily service.',
      };
      const dashboardUrl = new URL('/dashboard', env.FRONTEND_APP_URL).toString();
      const html = `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;color:#334155"><h2>${greeting}</h2><p>Here are a few tailored ways to get started with Orvio:</p><ul><li>${useCaseTip[details.useCase] ?? 'Start by setting up the workflow that matters most to your business.'}</li><li>${businessTip[details.businessType] ?? 'Keep your products and daily operations organized in one place.'}</li></ul><a href="${actionUrl(new URL(dashboardUrl), userId, 'onboarding_tips')}" style="display:inline-block;background:#714B67;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px">Open Orvio</a></div>`;
      await send(email, 'Welcome to Orvio — your next steps', '/dashboard', undefined, branded(html), userId, 'onboarding_tips');
    },
    sendNewDeviceLoginNotification: async (email, details, userId) => {
      const greeting = details.firstName ? `Hi ${details.firstName},` : 'Hello,';
      const resetUrl = new URL('/reset-password', env.FRONTEND_APP_URL).toString();
      const newDeviceHtml = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px; color: #1e293b; background: #ffffff;">
          <div style="margin-bottom: 24px;">
            <h2 style="font-size: 20px; font-weight: 700; color: #0f172a; margin: 0 0 16px 0;">${greeting}</h2>
            <p style="font-size: 14px; line-height: 22px; color: #334155; margin: 0 0 16px 0;">
              A new sign-in was detected on your Orvio account:
            </p>
            <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin-bottom: 20px; font-size: 13px; line-height: 20px; color: #475569;">
              <div><strong>Time:</strong> ${details.time}</div>
              <div><strong>IP Address:</strong> ${details.ip ?? 'Unknown'}</div>
              <div><strong>Device / Browser:</strong> ${details.userAgent ?? 'Unknown client'}</div>
            </div>
            <p style="font-size: 13px; line-height: 20px; color: #64748b; margin: 0 0 20px 0;">
              If this was you, you can safely ignore this email. If you did not perform this login, please reset your password immediately to protect your account.
            </p>
            <a href="${actionUrl(new URL(resetUrl), userId, 'new_device_login')}" style="display: inline-block; background-color: #714B67; color: #ffffff; text-decoration: none; padding: 10px 20px; border-radius: 6px; font-weight: 600; font-size: 13px;">Secure Your Account</a>
          </div>
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
          <p style="font-size: 12px; color: #94a3b8; line-height: 18px; margin: 0;">
            Orvio Security Team · Automated Notification
          </p>
        </div>
      `;
      await send(email, 'New login to your Orvio account', '/account', undefined, branded(newDeviceHtml), userId, 'new_device_login');
    },
  };
}
