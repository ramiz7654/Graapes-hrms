import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { api, ApiError } from '../services/api.js';
import { dashboardForRole } from '../auth/AuthGuard.jsx';
import { useAuth } from '../app/AuthContext.jsx';
import {
  ArrowRight,
  Eye,
  EyeOff,
  Mail,
  LockKeyhole,
  ArrowLeft,
} from 'lucide-react';
import './Login.css';

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotBusy, setForgotBusy] = useState(false);
  const [forgotMessage, setForgotMessage] = useState('');
  const [forgotError, setForgotError] = useState('');
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleForgotSubmit = async (e) => {
    e.preventDefault();
    setForgotMessage('');
    setForgotError('');
    setForgotBusy(true);
    try {
      const result = await api('/auth/forgot-password', { method: 'POST', body: { email: forgotEmail.trim() } });
      setForgotMessage(result.message || 'If an active account exists for that email, a reset link will be sent shortly.');
    } catch (err) {
      setForgotError(err instanceof ApiError ? err.message : 'Could not request a reset link. Please try again.');
    } finally { setForgotBusy(false); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      // Goes through AuthContext so the whole app knows who is signed in right away (not only after a page reload).
      const user = await login(formData.email.trim(), formData.password);
      navigate(location.state?.from || dashboardForRole(user.role), { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Login failed. Please try again.');
    } finally { setBusy(false); }
  };

  return (
    <main className="login-page">
      <div className="login-decoration decoration-one" />
      <div className="login-decoration decoration-two" />
      <div className="login-decoration decoration-three" />

      <div className="login-layout">
        {/* LEFT WELCOME SECTION */}
        <section className="login-welcome">
          <div className="company-brand">
            <img
              src="/graapes-logo-transparent.png"
              alt="Graapes Private Limited"
              className="company-logo"
            />
          </div>

          <div className="welcome-content">
            <p className="welcome-eyebrow">
              A SPACE OF YOUR OWN
            </p>

            <h1>
              Good to
              <br />
              have you
              <br />
              <span>back.</span>
            </h1>

            <p className="welcome-description">
              Your people. Your workplace.
              <br />
              One platform.
            </p>
          </div>

          <div className="welcome-footer">
            <strong>Graapes Private Limited</strong>
            <span>Human Resource Management System</span>
          </div>
        </section>

        {/* RIGHT LOGIN FORM */}
        <section className="login-form-section">
          <div className="login-card">
            <div className="login-card-accent" />

            <div className="login-heading">
              <p className="login-label">ACCOUNT ACCESS</p>
              <h2>Welcome back</h2>
              <p className="login-subtitle">
                Sign in to continue to your account.
              </p>
            </div>

            <form onSubmit={handleSubmit}>
              {error && <p role="alert" className="mb-4 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
              <div className="form-group">
                <label htmlFor="email">
                  Email address / Employee ID
                </label>

                <div className="input-wrapper">
                  <Mail size={19} />

                  <input
                    id="email"
                    name="email"
                    type="text"
                    placeholder="Enter email or employee ID"
                    value={formData.email}
                    onChange={handleChange}
                    autoComplete="username"
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="password">Password</label>

                <div className="input-wrapper">
                  <LockKeyhole size={19} />

                  <input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter your password"
                    value={formData.password}
                    onChange={handleChange}
                    autoComplete="current-password"
                    required
                  />

                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={
                      showPassword ? 'Hide password' : 'Show password'
                    }
                  >
                    {showPassword ? (
                      <EyeOff size={19} />
                    ) : (
                      <Eye size={19} />
                    )}
                  </button>
                </div>
              </div>

              <div className="login-options">
                <label className="remember-option">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                  />
                  <span>Remember me</span>
                </label>

                <button
                  type="button"
                  className="forgot-password"
                  onClick={() => { setForgotEmail(formData.email.includes('@') ? formData.email : ''); setForgotMessage(''); setForgotError(''); setForgotOpen(true); }}
                >
                  Forgot password?
                </button>
              </div>

              <button type="submit" className="sign-in-button" disabled={busy}>
                <span>{busy ? 'Signing in…' : 'Sign in'}</span>
                {!busy && <ArrowRight size={19} />}
              </button>
            </form>

            <div className="login-bottom">
              <span className="bottom-line" />
              <p>Secure access to your workplace</p>
              <span className="bottom-line" />
            </div>
          </div>
        </section>
      </div>

      {forgotOpen && (
        <div className="forgot-modal-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget && !forgotBusy) setForgotOpen(false); }}>
          <section className="forgot-modal" role="dialog" aria-modal="true" aria-labelledby="forgot-title">
            <button type="button" className="forgot-back" onClick={() => setForgotOpen(false)} disabled={forgotBusy} aria-label="Back to sign in"><ArrowLeft size={18} /> Back to sign in</button>
            <div className="forgot-modal-icon"><LockKeyhole size={24} /></div>
            <p className="login-label">ACCOUNT RECOVERY</p>
            <h2 id="forgot-title">Forgot password?</h2>
            <p className="forgot-modal-description">Enter the email address linked to your Graapes HRMS account. If the account is active, we’ll send you a secure reset link.</p>
            <form onSubmit={handleForgotSubmit}>
              <div className="form-group">
                <label htmlFor="forgot-email">Work email address</label>
                <div className="input-wrapper"><Mail size={19} /><input id="forgot-email" type="email" autoComplete="email" placeholder="you@company.com" value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)} required maxLength={254} /></div>
              </div>
              {forgotError && <p role="alert" className="forgot-feedback error">{forgotError}</p>}
              {forgotMessage && <p role="status" className="forgot-feedback success">{forgotMessage}</p>}
              <button type="submit" className="sign-in-button" disabled={forgotBusy}><span>{forgotBusy ? 'Sending link…' : 'Send reset link'}</span>{!forgotBusy && <ArrowRight size={19} />}</button>
            </form>
            <p className="forgot-security-note">Reset links expire after 30 minutes and can only be used once.</p>
          </section>
        </div>
      )}
    </main>
  );
}