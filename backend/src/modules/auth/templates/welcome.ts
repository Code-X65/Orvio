export interface WelcomeEmailTemplateParams {
  toName: string;
  organizationName: string;
  orgUrl: string;
  planCode?: string;
}

export function createWelcomeEmailTemplate({
  toName,
  organizationName,
  orgUrl,
  planCode = 'bundle',
}: WelcomeEmailTemplateParams) {
  const planNames: Record<string, string> = {
    inventory: 'Inventory & POS',
    gym: 'Gym Management',
    bundle: 'Complete Business Suite Bundle',
  };

  const planTitle = planNames[planCode] ?? 'Orvio Hub Trial';
  const subject = `Welcome to Orvio Hub — ${organizationName} is now active!`;

  const dashboardUrl = `${orgUrl}/dashboard`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background-color:#0b0f17;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#e2e8f0;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#0b0f17;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width:560px;background-color:#111827;border:1px solid #1f2937;border-radius:16px;padding:32px;box-shadow:0 10px 25px -5px rgba(0,0,0,0.5);">
          <!-- Header -->
          <tr>
            <td style="padding-bottom:24px;border-bottom:1px solid #1f2937;">
              <span style="font-size:22px;font-weight:800;letter-spacing:-0.5px;color:#ffffff;">
                Orvio<span style="color:#10b981;">Hub</span>
              </span>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding-top:28px;padding-bottom:16px;">
              <h1 style="margin:0 0 12px 0;font-size:22px;font-weight:700;color:#ffffff;line-height:28px;">
                🎉 Your workspace is live!
              </h1>
              <p style="margin:0 0 16px 0;font-size:15px;line-height:24px;color:#94a3b8;">
                Hello ${toName},
              </p>
              <p style="margin:0 0 24px 0;font-size:15px;line-height:24px;color:#94a3b8;">
                Your email has been verified and your organization <strong style="color:#ffffff;">${organizationName}</strong> is fully activated on the <strong>${planTitle}</strong> plan.
              </p>

              <!-- Workspace Info Box -->
              <div style="background-color:#0f172a;border:1px solid #065f46;border-radius:10px;padding:16px;margin-bottom:28px;">
                <div style="font-size:11px;font-weight:700;text-transform:uppercase;color:#34d399;margin-bottom:6px;">Your Dedicated Workspace URL</div>
                <div style="font-family:monospace;font-size:14px;color:#ffffff;font-weight:700;margin-bottom:12px;">${orgUrl}</div>
                <div style="font-size:12px;color:#94a3b8;">Bookmark this URL to access your POS cashier desk, inventory, and staff dashboard anytime.</div>
              </div>

              <!-- CTA Button -->
              <table role="presentation" cellspacing="0" cellpadding="0" style="margin-bottom:28px;">
                <tr>
                  <td align="center" style="border-radius:8px;background:linear-gradient(135deg,#10b981,#059669);">
                    <a href="${dashboardUrl}" target="_blank" style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:8px;">
                      Launch Workspace Dashboard
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 8px 0;font-size:14px;font-weight:600;color:#ffffff;">Next Steps:</p>
              <ul style="margin:0 0 20px 0;padding-left:20px;font-size:13px;line-height:22px;color:#94a3b8;">
                <li>Set up your store branches and warehouse locations</li>
                <li>Add your inventory products, variants, and barcodes</li>
                <li>Invite your cashier staff and managers</li>
              </ul>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding-top:20px;border-top:1px solid #1f2937;font-size:12px;color:#64748b;line-height:18px;">
              Need help getting set up? Reply directly to this email or reach out at <a href="mailto:support@orvio.com" style="color:#34d399;">support@orvio.com</a>.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

  const text = `
Welcome to Orvio Hub!

Hello ${toName},

Your organization ${organizationName} is now active on the ${planTitle} plan.

Access your workspace anytime at:
${dashboardUrl}

If you need any assistance, contact us at support@orvio.com.
  `.trim();

  return { subject, html, text };
}
