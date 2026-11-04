import { useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertCircle, Check, CheckCircle2, Copy, KeyRound, Loader2, Mail, RefreshCw } from 'lucide-react';
import { api } from '../services/api.js';

/**
 * Shows the login credentials of a new / re-issued account and whether they were e-mailed.
 * "Retry email" asks the server for a NEW temporary password and mails it (the old one is not stored), so the
 * dialog updates to the new password.
 */
export default function CredentialsDialog({ employeeId, credentials: initialCredentials, email: initialEmail, title = 'Account credentials created', onClose }) {
  const [credentials, setCredentials] = useState(initialCredentials);
  const [mail, setMail] = useState(initialEmail || null);
  const [retrying, setRetrying] = useState(false);
  const [retryError, setRetryError] = useState('');
  const [copied, setCopied] = useState(false);

  async function retry() {
    setRetrying(true);
    setRetryError('');
    try {
      const res = await api(`/employees/${employeeId}/resend-credentials`, { method: 'POST' });
      setCredentials(res.credentials);
      setMail(res.email);
    } catch (err) {
      setRetryError(err.message || 'Could not retry. Please try again.');
    } finally {
      setRetrying(false);
    }
  }

  const sent = mail?.status === 'sent';
  const failed = mail && !sent;

  return createPortal(
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-6 shadow-2xl" role="dialog" aria-modal="true">
        <div className="flex items-center gap-3 text-success">
          <KeyRound size={24} />
          <h3 className="text-lg font-bold text-text">{title}</h3>
        </div>

        {sent && (
          <div role="status" className="mt-3 flex items-start gap-2 rounded-xl border border-success/30 bg-success/10 p-3 text-xs text-success">
            <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
            <span>{mail.message || `Credentials emailed to ${mail.to}.`}</span>
          </div>
        )}

        {failed && (
          <div role="alert" className="mt-3 rounded-xl border border-danger/30 bg-danger-soft p-3 text-xs text-danger">
            <div className="flex items-start gap-2">
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              <div>
                <p className="font-bold">Email could not be sent{mail.to ? ` to ${mail.to}` : ''}.</p>
                <p className="mt-0.5">{mail.message}</p>
                <p className="mt-1 text-muted">The account is created. Share the details below manually, or retry (a retry creates a new temporary password and emails that one).</p>
              </div>
            </div>
            <button
              type="button"
              disabled={retrying}
              onClick={retry}
              className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-danger px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
            >
              {retrying ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
              {retrying ? 'Retrying…' : 'Retry email'}
            </button>
          </div>
        )}

        {retryError && <p role="alert" className="mt-2 text-xs text-danger">{retryError}</p>}

        {!mail && (
          <p className="mt-2 flex items-center gap-2 text-xs text-muted"><Mail size={14} /> Share these credentials securely.</p>
        )}

        <div className="mt-4 space-y-2 rounded-xl border border-border bg-surface-2/60 p-4 font-mono text-xs">
          <div>
            <span className="text-muted">Login ID: </span>
            <span className="font-bold text-text">{credentials.loginId}</span>
          </div>
          <div>
            <span className="text-muted">Login Email: </span>
            <span className="font-bold text-text">{credentials.email}</span>
          </div>
          <div>
            <span className="text-muted">Temporary Password: </span>
            <span className="select-all text-sm font-bold tracking-wide text-accent">{credentials.temporaryPassword}</span>
          </div>
        </div>
        <p className="mt-2 text-[11px] text-muted">Either the ID or the email works for sign-in. The person should change this password after the first login.</p>

        <div className="mt-5 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={() => {
              navigator.clipboard.writeText(`ID: ${credentials.loginId}\nEmail: ${credentials.email}\nPassword: ${credentials.temporaryPassword}`);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}
            className="inline-flex items-center gap-1.5 rounded-xl border border-border px-4 py-2 text-xs font-semibold transition hover:bg-surface-2"
          >
            {copied ? <Check size={14} className="text-success" /> : <Copy size={14} />}
            {copied ? 'Copied' : 'Copy credentials'}
          </button>
          <button type="button" onClick={onClose} className="rounded-xl bg-accent px-4 py-2 text-xs font-semibold text-white">
            Done
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
