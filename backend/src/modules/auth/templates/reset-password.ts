export interface ResetPasswordTemplateParams {
  toName: string;
  resetLink: string;
}

export function createResetPasswordTemplate(params: ResetPasswordTemplateParams): {
  subject: string;
  html: string;
  text: string;
} {
  const subject = 'Reset your password on Orvio Hub';
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #020617; color: #f8fafc; margin: 0; padding: 0; }
    .wrapper { max-width: 600px; margin: 40px auto; background-color: #0f172a; border-radius: 16px; border: 1px solid #1e293b; overflow: hidden; }
    .header { padding: 32px; background: linear-gradient(135deg, #4f46e5 0%, #0284c7 100%); text-align: center; }
    .header h1 { margin: 0; color: #ffffff; font-size: 24px; font-weight: 800; letter-spacing: -0.5px; }
    .content { padding: 32px; }
    .greeting { font-size: 18px; font-weight: 600; color: #ffffff; margin-bottom: 16px; }
    .message { font-size: 14px; line-height: 1.6; color: #94a3b8; margin-bottom: 24px; }
    .button-container { text-align: center; margin: 32px 0; }
    .button { display: inline-block; padding: 14px 32px; background-color: #4f46e5; color: #ffffff !important; text-decoration: none; border-radius: 10px; font-weight: 700; font-size: 14px; box-shadow: 0 4px 14px 0 rgba(79, 70, 229, 0.4); }
    .footer { padding: 24px 32px; background-color: #090d16; border-top: 1px solid #1e293b; text-align: center; font-size: 12px; color: #64748b; }
    .link-fallback { word-break: break-all; color: #818cf8; font-family: monospace; font-size: 11px; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <h1>Orvio Hub</h1>
    </div>
    <div class="content">
      <div class="greeting">Hello ${params.toName},</div>
      <p class="message">
        We received a request to reset your password for your Orvio Hub account. Click the button below to choose a new password. This link is valid for 2 hours.
      </p>
      <div class="button-container">
        <a href="${params.resetLink}" class="button" target="_blank">Reset My Password</a>
      </div>
      <p class="message" style="font-size: 12px;">
        If you did not request a password reset, you can safely ignore this email. Your password will not change.
      </p>
      <p class="message" style="font-size: 12px; margin-top: 24px;">
        If the button doesn't work, copy and paste this link into your browser:<br>
        <span class="link-fallback">${params.resetLink}</span>
      </p>
    </div>
    <div class="footer">
      &copy; ${new Date().getFullYear()} Orvio Inc. All rights reserved.
    </div>
  </div>
</body>
</html>
  `.trim();

  const text = `
Hello ${params.toName},

We received a request to reset your password for your Orvio Hub account.
Visit this link to choose a new password:
${params.resetLink}

This link is valid for 2 hours. If you did not request this, you can safely ignore this message.
  `.trim();

  return { subject, html, text };
}
