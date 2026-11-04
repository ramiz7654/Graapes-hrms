import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, LockKeyhole, Eye, EyeOff, CheckCircle2 } from 'lucide-react';
import { api, ApiError } from '../services/api.js';
import './Login.css';

export default function ResetPassword() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get('token') || '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const submit = async (e) => {
    e.preventDefault(); setError(''); setSuccess('');
    if (password !== confirm) { setError('Passwords do not match.'); return; }
    setBusy(true);
    try {
      const result = await api('/auth/reset-password', { method: 'POST', body: { token, newPassword: password } });
      setSuccess(result.message || 'Password reset successfully.');
      window.setTimeout(() => navigate('/login', { replace: true }), 1600);
    } catch (err) { setError(err instanceof ApiError ? err.message : 'Could not reset password. Request a new link and try again.'); }
    finally { setBusy(false); }
  };
  return <main className="login-page reset-password-page"><div className="login-decoration decoration-one" /><div className="login-decoration decoration-two" /><div className="login-decoration decoration-three" />
    <section className="forgot-modal reset-password-card">
      <Link className="forgot-back" to="/login"><ArrowLeft size={18} /> Back to sign in</Link>
      <div className="forgot-modal-icon"><LockKeyhole size={24} /></div>
      <p className="login-label">ACCOUNT RECOVERY</p><h2>Set a new password</h2>
      <p className="forgot-modal-description">Choose a strong password for your Graapes HRMS account.</p>
      {!token ? <p className="forgot-feedback error">This reset link is missing or invalid. Please request a new one from the sign-in page.</p> : <form onSubmit={submit}>
        <div className="form-group"><label htmlFor="new-password">New password</label><div className="input-wrapper"><LockKeyhole size={19}/><input id="new-password" type={showPassword ? 'text' : 'password'} autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} minLength={10} maxLength={200} required placeholder="Create a strong password"/><button type="button" className="password-toggle" onClick={() => setShowPassword(v => !v)} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff size={19}/> : <Eye size={19}/>}</button></div></div>
        <div className="form-group"><label htmlFor="confirm-password">Confirm new password</label><div className="input-wrapper"><LockKeyhole size={19}/><input id="confirm-password" type={showPassword ? 'text' : 'password'} autoComplete="new-password" value={confirm} onChange={e => setConfirm(e.target.value)} maxLength={200} required placeholder="Enter the password again"/></div></div>
        <p className="forgot-password-hint">Use at least 10 characters, including uppercase, lowercase and a number.</p>
        {error && <p role="alert" className="forgot-feedback error">{error}</p>}{success && <p role="status" className="forgot-feedback success"><CheckCircle2 size={17}/>{success}</p>}
        <button type="submit" className="sign-in-button" disabled={busy || Boolean(success)}><span>{busy ? 'Updating password…' : 'Reset password'}</span>{!busy && <ArrowLeft size={19}/>}</button>
      </form>}
    </section>
  </main>;
}
