import { useState } from 'react';
import { KeyRound } from 'lucide-react';
import { api } from '../../services/api.js';

const inputClass = 'w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20';

export default function ChangePasswordCard() {
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const onChange = (event) => {
    setForm((f) => ({ ...f, [event.target.name]: event.target.value }));
    setError('');
    setSuccess('');
  };

  async function onSubmit(event) {
    event.preventDefault();
    setError('');
    setSuccess('');
    if (form.newPassword !== form.confirmPassword) {
      setError('New password and confirm password do not match.');
      return;
    }
    setBusy(true);
    try {
      const res = await api('/auth/change-password', {
        method: 'POST',
        body: { currentPassword: form.currentPassword, newPassword: form.newPassword },
      });
      setSuccess(res.message || 'Password changed successfully.');
      setForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      setError(err.message || 'Could not change the password.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5 rounded-2xl border border-border bg-surface p-5 sm:p-7">
      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-accent-soft p-2 text-accent"><KeyRound size={20} /></div>
        <div>
          <h3 className="text-base font-bold">Change password</h3>
          <p className="mt-1 text-sm text-muted">Use this after signing in with a temporary password. At least 10 characters with upper case, lower case and a number.</p>
        </div>
      </div>
      {error && <p role="alert" className="rounded-xl bg-danger-soft p-3 text-sm text-danger">{error}</p>}
      {success && <p role="status" className="rounded-xl border border-green-500/30 bg-green-500/10 p-3 text-sm text-green-700">{success}</p>}
      <div className="grid gap-4 sm:grid-cols-3">
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">Current password</span>
          <input name="currentPassword" type="password" autoComplete="current-password" required value={form.currentPassword} onChange={onChange} className={inputClass} />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">New password</span>
          <input name="newPassword" type="password" autoComplete="new-password" required value={form.newPassword} onChange={onChange} className={inputClass} />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">Confirm new password</span>
          <input name="confirmPassword" type="password" autoComplete="new-password" required value={form.confirmPassword} onChange={onChange} className={inputClass} />
        </label>
      </div>
      <div className="flex justify-end border-t border-border pt-5">
        <button type="submit" disabled={busy} className="rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60">
          {busy ? 'Updating…' : 'Update password'}
        </button>
      </div>
    </form>
  );
}
