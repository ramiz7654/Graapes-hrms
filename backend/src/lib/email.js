import { env } from '../config/env.js';

const SEND_TIMEOUT_MS = 12000;
const ROLE_LABELS = { HR_ADMIN: 'HR Admin', MANAGER: 'Manager', EMPLOYEE: 'Employee' };
const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);

export const isEmailConfigured = () => Boolean(env.RESEND_API_KEY && env.EMAIL_FROM);

/**
 * Sends the login credentials of a new (or re-issued) account through the Resend HTTP API.
 * Never throws: always resolves to { status: 'sent' | 'failed' | 'not_configured', message }.
 * The temporary password is only used to build the message; it is never logged.
 */
export async function sendCredentialEmail({ to, fullName, role, email, temporaryPassword, employeeCode }) {
  if (!isEmailConfigured()) {
    return { status: 'not_configured', message: 'Email service is not configured. Add RESEND_API_KEY and EMAIL_FROM to the .env file and restart the server.' };
  }
  if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    return { status: 'failed', message: 'The recipient e-mail address is not valid.' };
  }

  const roleLabel = ROLE_LABELS[role] || 'Employee';
  const loginUrl = env.WEB_APP_URL || env.WEB_ORIGIN;
  const subject = `Your Graapes HRMS ${roleLabel} login credentials`;
  const html = `<!doctype html><html><body style="font-family:Arial,sans-serif;color:#172033;line-height:1.6"><div style="max-width:560px;margin:auto;padding:24px;border:1px solid #e5e7eb;border-radius:14px"><h2 style="margin-top:0">Welcome to Graapes HRMS</h2><p>Hello ${escapeHtml(fullName)},</p><p>Your ${roleLabel} account is ready. Use the details below to sign in. You can use either the ID or the e-mail.</p><div style="background:#f8fafc;padding:16px;border-radius:10px"><p style="margin:4px 0"><b>Login ID:</b> ${escapeHtml(employeeCode)}</p><p style="margin:4px 0"><b>Login email:</b> ${escapeHtml(email)}</p><p style="margin:4px 0"><b>Temporary password:</b> <span style="font-family:Consolas,monospace;font-size:15px">${escapeHtml(temporaryPassword)}</span></p></div><p><a href="${escapeHtml(loginUrl)}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px">Open Graapes HRMS</a></p><p style="font-size:13px;color:#64748b">For your security, sign in and change your temporary password right away (My Profile, Change password). Do not share these details with anyone.</p><p>Regards,<br/>Graapes HRMS Team</p></div></body></html>`;
  const text = `Hello ${fullName},\n\nYour Graapes HRMS ${roleLabel} account is ready.\nLogin ID: ${employeeCode}\nLogin email: ${email}\nTemporary password: ${temporaryPassword}\nSign in: ${loginUrl}\n\nYou can sign in with either the ID or the e-mail. Please change your temporary password right away (My Profile, Change password).`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SEND_TIMEOUT_MS);
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: env.EMAIL_FROM, to: [to], subject, html, text }),
      signal: controller.signal,
    });
    if (!response.ok) {
      const details = await response.json().catch(() => ({}));
      const reason = details?.message || details?.error || `The email provider answered with status ${response.status}.`;
      return { status: 'failed', message: String(reason).slice(0, 240) };
    }
    return { status: 'sent', message: `Credentials emailed to ${to}.` };
  } catch (error) {
    const timedOut = error?.name === 'AbortError';
    return { status: 'failed', message: timedOut ? 'The email provider did not respond in time.' : 'Could not reach the email provider. Check the internet connection.' };
  } finally {
    clearTimeout(timer);
  }
}

/** Sends a short-lived password-reset link. The raw token is never logged or persisted. */
export async function sendPasswordResetEmail({ to, fullName, resetUrl }) {
  if (!isEmailConfigured()) {
    return { status: 'not_configured', message: 'Email service is not configured. Add RESEND_API_KEY and EMAIL_FROM to the .env file and restart the server.' };
  }
  if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    return { status: 'failed', message: 'The recipient e-mail address is not valid.' };
  }
  const subject = 'Reset your Graapes HRMS password';
  const safeName = escapeHtml(fullName || 'there');
  const safeUrl = escapeHtml(resetUrl);
  const html = `<!doctype html><html><body style="font-family:Arial,sans-serif;color:#172033;line-height:1.6"><div style="max-width:560px;margin:auto;padding:24px;border:1px solid #e5e7eb;border-radius:14px"><h2>Reset your password</h2><p>Hello ${safeName},</p><p>We received a request to reset your Graapes HRMS password. Use the button below within 30 minutes.</p><p><a href="${safeUrl}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px">Reset password</a></p><p>If you did not request this, you can ignore this email. Your current password will remain unchanged.</p><p style="font-size:13px;color:#64748b">For security, this link can only be used once and expires in 30 minutes.</p></div></body></html>`;
  const text = `Hello ${fullName || 'there'},\n\nWe received a request to reset your Graapes HRMS password. Open this link within 30 minutes:\n${resetUrl}\n\nIf you did not request this, ignore this email. Your current password will remain unchanged. This link can only be used once.`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SEND_TIMEOUT_MS);
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: env.EMAIL_FROM, to: [to], subject, html, text }),
      signal: controller.signal,
    });
    if (!response.ok) {
      const details = await response.json().catch(() => ({}));
      const reason = details?.message || details?.error || `The email provider answered with status ${response.status}.`;
      return { status: 'failed', message: String(reason).slice(0, 240) };
    }
    return { status: 'sent', message: 'Password reset email sent.' };
  } catch (error) {
    return { status: 'failed', message: error?.name === 'AbortError' ? 'The email provider did not respond in time.' : 'Could not reach the email provider. Check the internet connection.' };
  } finally {
    clearTimeout(timer);
  }
}
