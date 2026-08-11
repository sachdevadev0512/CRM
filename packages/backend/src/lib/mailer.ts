import nodemailer, { Transporter } from 'nodemailer';

// Lazily-built SMTP transporter for admin-invite emails. Sent directly via this SMTP account
// instead of relying on Supabase Auth's built-in mailer (a shared, low-volume/testing-only
// service with a strict default rate limit) -- Supabase still generates the actual invite
// token/link via generateLink(), we just deliver it through our own SMTP account instead.
let mailTransporter: Transporter | null = null;

function getMailTransporter(): Transporter {
  if (!mailTransporter) {
    const host = process.env.SMTP_HOST;
    const port = parseInt(process.env.SMTP_PORT || '465', 10);
    const secure = process.env.SMTP_SECURE !== 'false';
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;

    if (!host || !user || !pass) {
      throw new Error('SMTP is not configured. Set SMTP_HOST, SMTP_USER, and SMTP_PASS.');
    }

    mailTransporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass },
    });
  }
  return mailTransporter;
}

export async function sendResumeOtpEmail(toEmail: string, otp: string): Promise<void> {
  const transporter = getMailTransporter();
  const fromAddress = process.env.SMTP_FROM || process.env.SMTP_USER!;
  const fromName = process.env.SMTP_FROM_NAME || 'Middha Ventures';

  await transporter.sendMail({
    from: `"${fromName}" <${fromAddress}>`,
    to: toEmail,
    subject: `${otp} is your code to resume your application`,
    html: `
      <div style="font-family: -apple-system, Segoe UI, Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
        <h2 style="color: #111827; margin-bottom: 8px;">Resume your application</h2>
        <p style="color: #4b5563; line-height: 1.6;">
          Use the code below to pick up your Middha Ventures startup application where you left off.
        </p>
        <p style="margin: 28px 0; text-align: center;">
          <span style="display:inline-block; background:#111827; color:#ffffff; padding:14px 28px; border-radius:8px; font-weight:700; font-size:28px; letter-spacing:6px;">
            ${otp}
          </span>
        </p>
        <p style="color: #9ca3af; font-size: 12px; line-height: 1.6;">
          This code expires in 10 minutes. If you didn't request this, you can safely ignore this email.
        </p>
      </div>
    `,
  });
}

export async function sendInviteEmail(toEmail: string, actionLink: string): Promise<void> {
  const transporter = getMailTransporter();
  const fromAddress = process.env.SMTP_FROM || process.env.SMTP_USER!;
  const fromName = process.env.SMTP_FROM_NAME || 'Middha Ventures';

  await transporter.sendMail({
    from: `"${fromName}" <${fromAddress}>`,
    to: toEmail,
    subject: 'You have been invited to the Middha Ventures CRM',
    html: `
      <div style="font-family: -apple-system, Segoe UI, Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
        <h2 style="color: #111827; margin-bottom: 8px;">You've been invited</h2>
        <p style="color: #4b5563; line-height: 1.6;">
          An existing administrator has invited you to join the Middha Ventures Investment CRM.
          Click the button below to set your password and activate your account.
        </p>
        <p style="margin: 28px 0;">
          <a href="${actionLink}" style="background:#111827;color:#ffffff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">
            Activate Your Account
          </a>
        </p>
        <p style="color: #9ca3af; font-size: 12px; line-height: 1.6;">
          If the button doesn't work, copy and paste this link into your browser:<br />
          <a href="${actionLink}" style="color:#6b7280;">${actionLink}</a>
        </p>
        <p style="color: #9ca3af; font-size: 12px; margin-top: 24px;">
          If you weren't expecting this invitation, you can safely ignore this email.
        </p>
      </div>
    `,
  });
}
