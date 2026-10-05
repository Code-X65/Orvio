export interface VerifyEmailTemplateParams {
  toName: string;
  organizationName: string;
  verificationLink: string;
  orgUrl?: string;
}

export function createVerifyEmailTemplate({
  toName,
  organizationName,
  verificationLink,
  orgUrl,
}: VerifyEmailTemplateParams) {
  const subject = `Verify your email for ${organizationName} on Orvio Hub`;

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
                Orvio<span style="color:#6366f1;">Hub</span>
              </span>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding-top:28px;padding-bottom:16px;">
              <h1 style="margin:0 0 12px 0;font-size:22px;font-weight:700;color:#ffffff;line-height:28px;">
                Verify your email address
              </h1>
              <p style="margin:0 0 16px 0;font-size:15px;line-height:24px;color:#94a3b8;">
                Hello ${toName},
              </p>
              <p style="margin:0 0 24px 0;font-size:15px;line-height:24px;color:#94a3b8;">
                Thank you for creating <strong style="color:#ffffff;">${organizationName}</strong> on Orvio Hub.
                Please verify your email address to activate your workspace and start your 14-day free trial.
              </p>
              ${
                orgUrl
                  ? `<div style="background-color:#0f172a;border:1px solid #312e81;border-radius:10px;padding:12px 16px;margin-bottom:24px;">
                      <div style="font-size:11px;font-weight:700;text-transform:uppercase;color:#818cf8;margin-bottom:4px;">Workspace Address</div>
                      <div style="font-family:monospace;font-size:13px;color:#cbd5e1;font-weight:600;">${orgUrl}</div>
                    </div>`
                  : ''
              }
              <!-- CTA Button -->
              <table role="presentation" cellspacing="0" cellpadding="0" style="margin-bottom:28px;">
                <tr>
                  <td align="center" style="border-radius:8px;background:linear-gradient(135deg,#6366f1,#4f46e5);">
                    <a href="${verificationLink}" target="_blank" style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:8px;">
                      Verify Email & Activate Workspace
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 16px 0;font-size:13px;line-height:20px;color:#64748b;">
                This link will expire in 24 hours. If you did not create this account, no further action is required.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding-top:20px;border-top:1px solid #1f2937;font-size:12px;color:#64748b;line-height:18px;">
              Or copy and paste this link into your browser:<br />
              <a href="${verificationLink}" style="color:#818cf8;word-break:break-all;">${verificationLink}</a>
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

Thank you for creating ${organizationName} on Orvio Hub. Please verify your email to activate your workspace:

${verificationLink}

${orgUrl ? `Your workspace address: ${orgUrl}` : ''}

This link expires in 24 hours.
  `.trim();

  return { subject, html, text };
}
