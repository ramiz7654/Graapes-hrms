import { useEffect, useState } from 'react';
import {
  Settings,
  Building,
  Clock,
  Shield,
  Save,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Bell,
  Lock,
} from 'lucide-react';
import { api } from '../../services/api.js';
import { useAuth } from '../../app/AuthContext.jsx';

export default function SettingsPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState('organization'); // 'organization' | 'preferences'
  const [settings, setSettings] = useState({
    workplaceName: 'Graapes Private Limited',
    timezone: 'Asia/Kolkata',
    allowSelfApproval: false,
    workStart: '09:30',
    workEnd: '18:30',
    graceMinutes: 15,
    payrollEnabled: false,
  });
  const [userPrefs, setUserPrefs] = useState({
    inAppNotifications: true,
    emailAlerts: false,
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const isAdmin = ['SUPER_ADMIN', 'HR_ADMIN'].includes(user?.role);

  async function loadSettings() {
    setLoading(true);
    setError('');
    try {
      const res = await api('/settings');
      if (res.organization) setSettings(res.organization);
      if (res.userPreferences) setUserPrefs(res.userPreferences);
    } catch (err) {
      setError(err.message || 'Unable to load settings.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSettings();
  }, []);

  async function handleSaveOrgSettings(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      await api('/settings', {
        method: 'PATCH',
        body: settings,
      });
      setSuccess('Organization policies and business settings saved successfully.');
    } catch (err) {
      setError(err.message || 'Failed to save settings.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="mb-1.5 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-accent">
            <Settings size={16} />
            <span>Configuration & Policies</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">System Settings</h1>
          <p className="mt-1 text-sm text-muted">Manage company attendance rules, approval policies, and account preferences.</p>
        </div>

        <button
          type="button"
          onClick={loadSettings}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2 text-sm font-semibold transition hover:bg-surface-2"
        >
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Messages */}
      {error && (
        <div role="alert" className="flex items-center gap-3 rounded-xl border border-danger/20 bg-danger-soft p-4 text-sm text-danger">
          <AlertCircle size={18} className="shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div role="status" className="flex items-center gap-3 rounded-xl border border-success/20 bg-success/10 p-4 text-sm text-success">
          <CheckCircle2 size={18} className="shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-border">
        {isAdmin && (
          <button
            type="button"
            onClick={() => setTab('organization')}
            className={`flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-semibold transition ${
              tab === 'organization' ? 'border-accent text-accent' : 'border-transparent text-muted hover:text-text'
            }`}
          >
            <Building size={16} />
            Company & Policies
          </button>
        )}
        <button
          type="button"
          onClick={() => setTab('preferences')}
          className={`flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-semibold transition ${
            tab === 'preferences' ? 'border-accent text-accent' : 'border-transparent text-muted hover:text-text'
          }`}
        >
          <Bell size={16} />
          My Preferences
        </button>
      </div>

      {/* Tab 1: Organization Settings (Admins) */}
      {tab === 'organization' && isAdmin && (
        <form onSubmit={handleSaveOrgSettings} className="space-y-6">
          {/* General Company Settings */}
          <section className="rounded-2xl border border-border bg-surface p-5 shadow-card sm:p-6">
            <h2 className="text-base font-bold">General Company Identity</h2>
            <p className="mt-1 text-xs text-muted">Legal workplace naming and regional locale.</p>

            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted">Workplace Name</label>
                <input
                  type="text"
                  value={settings.workplaceName}
                  onChange={(e) => setSettings({ ...settings, workplaceName: e.target.value })}
                  className="mt-1.5 w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm outline-none focus:border-accent"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted">Official Timezone (BR-009)</label>
                <input
                  type="text"
                  value={settings.timezone}
                  onChange={(e) => setSettings({ ...settings, timezone: e.target.value })}
                  className="mt-1.5 w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm outline-none focus:border-accent"
                />
              </div>
            </div>
          </section>

          {/* Attendance Rules */}
          <section className="rounded-2xl border border-border bg-surface p-5 shadow-card sm:p-6">
            <h2 className="text-base font-bold">Work Hours & Attendance Rules (OQ-04)</h2>
            <p className="mt-1 text-xs text-muted">Define standard shift timings and grace period for late mark computation.</p>

            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted">Standard Work Start</label>
                <input
                  type="time"
                  value={settings.workStart}
                  onChange={(e) => setSettings({ ...settings, workStart: e.target.value })}
                  className="mt-1.5 w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm outline-none focus:border-accent"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted">Standard Work End</label>
                <input
                  type="time"
                  value={settings.workEnd}
                  onChange={(e) => setSettings({ ...settings, workEnd: e.target.value })}
                  className="mt-1.5 w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm outline-none focus:border-accent"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted">Grace Period (Minutes)</label>
                <input
                  type="number"
                  min="0"
                  max="60"
                  value={settings.graceMinutes}
                  onChange={(e) => setSettings({ ...settings, graceMinutes: Number(e.target.value) })}
                  className="mt-1.5 w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm outline-none focus:border-accent"
                />
              </div>
            </div>
          </section>

          {/* Approval Governance & Payroll status */}
          <section className="rounded-2xl border border-border bg-surface p-5 shadow-card sm:p-6">
            <h2 className="text-base font-bold">Approval Governance & Modules</h2>
            <p className="mt-1 text-xs text-muted">Compliance rules enforced across leave and correction workflows.</p>

            <div className="mt-4 space-y-4">
              <label className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={settings.allowSelfApproval}
                  onChange={(e) => setSettings({ ...settings, allowSelfApproval: e.target.checked })}
                  className="mt-1 h-4 w-4 rounded border-border text-accent"
                />
                <div>
                  <span className="text-sm font-semibold">Allow Self Approval for Approvers (BR-005)</span>
                  <p className="text-xs text-muted">
                    When disabled (recommended), managers and HR Admins cannot approve their own leave or correction requests.
                  </p>
                </div>
              </label>

              <div className="flex items-center justify-between border-t border-border pt-4">
                <div>
                  <span className="text-sm font-semibold">Payroll Module (Phase 1 Status - AC-12)</span>
                  <p className="text-xs text-muted">Salary disbursement and statutory tax modules are disabled in Phase 1 per BRD scope.</p>
                </div>
                <span className="rounded-full bg-surface-2 px-3 py-1 text-xs font-bold text-muted">
                  DISABLED (Out of Phase 1)
                </span>
              </div>
            </div>
          </section>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-accent/90 disabled:opacity-50"
            >
              <Save size={16} />
              {saving ? 'Saving Changes…' : 'Save Organization Settings'}
            </button>
          </div>
        </form>
      )}

      {/* Tab 2: User Preferences */}
      {(tab === 'preferences' || !isAdmin) && (
        <section className="rounded-2xl border border-border bg-surface p-5 shadow-card sm:p-6">
          <h2 className="text-base font-bold">Notification & Session Preferences</h2>
          <p className="mt-1 text-xs text-muted">Customize how you receive workplace updates and view security session details.</p>

          <div className="mt-5 space-y-4">
            <label className="flex items-center justify-between rounded-xl border border-border bg-surface-2/40 p-4">
              <div>
                <span className="text-sm font-semibold">In-App Notifications</span>
                <p className="text-xs text-muted">Receive live alerts when leave decisions, punches, or announcements are posted.</p>
              </div>
              <input
                type="checkbox"
                checked={userPrefs.inAppNotifications}
                onChange={(e) => setUserPrefs({ ...userPrefs, inAppNotifications: e.target.checked })}
                className="h-4 w-4 rounded border-border text-accent"
              />
            </label>

            <label className="flex items-center justify-between rounded-xl border border-border bg-surface-2/40 p-4">
              <div>
                <span className="text-sm font-semibold">Email Alerts (OQ-09)</span>
                <p className="text-xs text-muted">Deliver notifications to your registered email when SMTP is active.</p>
              </div>
              <input
                type="checkbox"
                checked={userPrefs.emailAlerts}
                onChange={(e) => setUserPrefs({ ...userPrefs, emailAlerts: e.target.checked })}
                className="h-4 w-4 rounded border-border text-accent"
              />
            </label>

            <div className="rounded-xl border border-border bg-surface-2/40 p-4">
              <span className="text-sm font-semibold">Session Lifetime</span>
              <p className="mt-1 text-xs text-muted">
                Your current session cookie expires automatically after 8 hours of inactivity.
              </p>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
