import nodemailer from 'nodemailer';

const RESEND_API_URL = 'https://api.resend.com/emails';

const resendConfigured = Boolean(process.env.RESEND_API_KEY && process.env.MAIL_FROM);
const smtpConfigured = Boolean(
  process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS && process.env.MAIL_FROM
);

export const emailDeliveryConfigured = resendConfigured || smtpConfigured;

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;',
  })[character] || character);
}

export async function sendActionEmail(input: {
  to: string;
  username: string;
  subject: string;
  heading: string;
  message: string;
  actionLabel: string;
  actionUrl: string;
}) {
  if (!emailDeliveryConfigured) throw new Error('Email delivery is not configured.');

  const safeUsername = escapeHtml(input.username);
  const safeHeading = escapeHtml(input.heading);
  const safeMessage = escapeHtml(input.message);
  const safeLabel = escapeHtml(input.actionLabel);
  const safeUrl = escapeHtml(input.actionUrl);

  const html = `
        <div style="background:#07070b;padding:36px 16px;font-family:Arial,sans-serif;color:#e5e7eb">
          <div style="max-width:560px;margin:auto;background:#111827;border:1px solid #273244;border-radius:18px;padding:32px">
            <p style="margin:0 0 8px;color:#f59e0b;font-weight:800;letter-spacing:2px">CINE3D</p>
            <h1 style="margin:0 0 18px;font-size:24px;color:#fff">${safeHeading}</h1>
            <p style="line-height:1.7">Xin chào ${safeUsername},</p>
            <p style="line-height:1.7;color:#cbd5e1">${safeMessage}</p>
            <a href="${safeUrl}" style="display:inline-block;margin:18px 0;background:#eab308;color:#080808;padding:13px 22px;border-radius:999px;text-decoration:none;font-weight:800">${safeLabel}</a>
            <p style="font-size:12px;line-height:1.6;color:#64748b">Liên kết này có thời hạn 60 phút. Nếu bạn không thực hiện yêu cầu này, hãy bỏ qua email.</p>
          </div>
        </div>`;
  const text = `Xin chào ${input.username}. ${input.message}\n\n${input.actionLabel}: ${input.actionUrl}\n\nLiên kết có thời hạn 60 phút.`;

  if (resendConfigured && !smtpConfigured) {
    const response = await fetch(RESEND_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
        'User-Agent': 'CINE3D/1.0',
      },
      body: JSON.stringify({
        from: process.env.MAIL_FROM,
        to: [input.to],
        subject: input.subject,
        html,
        text,
      }),
    });

    if (!response.ok) {
      const details = await response.text();
      throw new Error(`Email provider rejected the request (${response.status}): ${details.slice(0, 300)}`);
    }
    return;
  }

  const port = Number(process.env.SMTP_PORT || 465);
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE === 'true' : port === 465,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
  await transporter.sendMail({
    from: process.env.MAIL_FROM,
    to: input.to,
    subject: input.subject,
    html,
    text,
  });
}
