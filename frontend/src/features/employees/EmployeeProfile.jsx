import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, AlertCircle, KeyRound, RefreshCw, Trash2 } from 'lucide-react';
import { api } from '../../services/api.js';
import { useAuth } from '../../app/AuthContext.jsx';
import CredentialsDialog from '../../components/CredentialsDialog.jsx';

const ROLE_LABELS = { SUPER_ADMIN: 'Super Admin', HR_ADMIN: 'HR', MANAGER: 'Manager', EMPLOYEE: 'Employee' };
const EMPLOYMENT_LABELS = { FULL_TIME: 'Full time', PART_TIME: 'Part time', CONTRACT: 'Contract', INTERN: 'Intern' };

const formatDate = (value) => {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
};

function Field({ label, value }) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-wider text-muted">{label}</div>
      <div className="mt-1 break-words text-sm font-medium text-text">{value || '—'}</div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <section className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
      <h2 className="border-b border-border pb-3 text-sm font-bold">{title}</h2>
      <div className="mt-4 grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
    </section>
  );
}

export default function EmployeeProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [employee, setEmployee] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [credentials, setCredentials] = useState(null);

  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const canReset = ['SUPER_ADMIN', 'HR_ADMIN'].includes(user?.role);
  const backPath = isSuperAdmin ? '/admin' : '/employees';

  async function load() {
    setLoading(true);
    setError('');
    try {
      const res = await api(`/employees/${id}`);
      setEmployee(res.employee);
    } catch (err) {
      setError(err.message || 'Could not load this profile.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function handleDelete() {
    setBusy(true);
    setError('');
    try {
      await api(`/employees/${id}`, { method: 'DELETE' });
      navigate(backPath, { replace: true });
    } catch (err) {
      setConfirmDelete(false);
      setError(err.message || 'Could not delete this employee.');
    } finally {
      setBusy(false);
    }
  }

  async function handleReset() {
    if (!window.confirm('Generate a new temporary password? The old password will stop working.')) return;
    setBusy(true);
    setError('');
    try {
      const res = await api(`/employees/${id}/reset-password`, { method: 'POST' });
      setCredentials({ credentials: res.credentials, email: res.email });
    } catch (err) {
      setError(err.message || 'Could not reset the password.');
    } finally {
      setBusy(false);
    }
  }

  const role = employee?.userAccount?.role;
  const canResetThis = canReset && employee?.userAccount && role !== 'SUPER_ADMIN' && !(user?.role === 'HR_ADMIN' && role === 'HR_ADMIN');
  const canDeleteThis = isSuperAdmin && employee && role !== 'SUPER_ADMIN' && employee.id !== user?.employeeId;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link to={backPath} className="inline-flex items-center gap-2 text-sm font-semibold text-muted transition hover:text-text">
          <ArrowLeft size={16} />
          Back to {isSuperAdmin ? 'User Management' : 'Employee Directory'}
        </Link>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2 text-sm font-semibold transition hover:bg-surface-2"
        >
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {error && (
        <div role="alert" className="flex items-center gap-3 rounded-xl border border-danger/20 bg-danger-soft p-4 text-sm text-danger">
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {loading && !employee && <p className="text-sm text-muted">Loading profile…</p>}

      {employee && (
        <>
          <section className="flex flex-wrap items-center gap-4 rounded-2xl border border-border bg-surface p-5 shadow-sm">
            <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-accent-soft text-xl font-bold text-accent">
              {employee.fullName?.trim()?.[0]?.toUpperCase() || '?'}
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-2xl font-bold tracking-tight">{employee.fullName}</h1>
              <p className="mt-0.5 text-sm text-muted">
                <b className="font-mono text-accent">{employee.employeeCode}</b> · {employee.workEmail}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-accent-soft px-3 py-1 text-xs font-bold text-accent">{ROLE_LABELS[role] || 'Employee'}</span>
              <span
                className={`rounded-full px-3 py-1 text-xs font-bold ${
                  employee.isActive && employee.status === 'ACTIVE' ? 'bg-success/15 text-success' : 'bg-danger/15 text-danger'
                }`}
              >
                {employee.isActive ? employee.status : 'DEACTIVATED'}
              </span>
            </div>
          </section>

          <Section title="Account">
            <Field label="Login ID" value={employee.employeeCode} />
            <Field label="Login email" value={employee.workEmail} />
            <Field label="Account type" value={ROLE_LABELS[role] || 'Employee'} />
            <Field label="Last login" value={employee.userAccount?.lastLoginAt ? new Date(employee.userAccount.lastLoginAt).toLocaleString('en-IN') : 'Never signed in'} />
          </Section>

          <Section title="Personal details (filled by the employee)">
            <Field label="Mobile" value={employee.mobile} />
            <Field label="Date of birth" value={formatDate(employee.dateOfBirth)} />
            <Field label="Personal address" value={employee.personalAddress} />
          </Section>

          <Section title="Employment">
            <Field label="Department" value={employee.department?.name} />
            <Field label="Designation" value={employee.designation?.title} />
            <Field label="Reporting manager" value={employee.manager ? `${employee.manager.fullName} (${employee.manager.employeeCode})` : 'Independent'} />
            <Field label="Employment type" value={EMPLOYMENT_LABELS[employee.employmentType] || employee.employmentType} />
            <Field label="Joining date" value={formatDate(employee.joiningDate)} />
            <Field label="Probation ends" value={formatDate(employee.probationEndDate)} />
            <Field label="Work location" value={employee.workLocation} />
          </Section>

          <Section title="Emergency contact">
            <Field label="Name" value={employee.emergencyName} />
            <Field label="Relationship" value={employee.emergencyRelation} />
            <Field label="Phone" value={employee.emergencyPhone} />
          </Section>

          {employee.history?.length > 0 && (
            <section className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
              <h2 className="border-b border-border pb-3 text-sm font-bold">Recent changes</h2>
              <ul className="mt-3 space-y-2 text-sm">
                {employee.history.map((h) => (
                  <li key={h.id} className="flex flex-wrap gap-x-2 text-muted">
                    <span className="font-semibold text-text">{h.field}</span>
                    <span>{h.oldValue || '—'} → {h.newValue || '—'}</span>
                    <span className="ml-auto text-xs">{new Date(h.changedAt).toLocaleDateString('en-IN')}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {(canResetThis || canDeleteThis) && (
            <section className="rounded-2xl border border-danger/30 bg-surface p-5 shadow-sm">
              <h2 className="text-sm font-bold text-danger">Account actions</h2>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                {canResetThis && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={handleReset}
                    className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-semibold transition hover:bg-surface-2 disabled:opacity-50"
                  >
                    <KeyRound size={16} />
                    Reset password
                  </button>
                )}
                {canDeleteThis && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => setConfirmDelete(true)}
                    className="inline-flex items-center gap-2 rounded-xl bg-danger px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-danger/90 disabled:opacity-50"
                  >
                    <Trash2 size={16} />
                    Delete employee
                  </button>
                )}
              </div>
            </section>
          )}
        </>
      )}

      {confirmDelete &&
        createPortal(
          <div
            className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4"
            role="presentation"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget && !busy) setConfirmDelete(false);
            }}
          >
            <section role="alertdialog" aria-modal="true" aria-labelledby="delete-confirm-title" className="w-full max-w-md rounded-2xl border border-border bg-surface p-6 shadow-2xl">
              <h2 id="delete-confirm-title" className="text-lg font-bold">Delete {employee?.fullName}?</h2>
              <p className="mt-2 text-sm text-muted">
                This permanently removes the account and all attendance, leave, document and history records of this person. This cannot be undone.
                If this person already has attendance, leave or document history, deletion is blocked to keep HR records (BR-007) and you should use Deactivate in the directory instead.
              </p>
              <div className="mt-5 flex justify-end gap-3">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setConfirmDelete(false)}
                  className="rounded-xl border border-border px-4 py-2.5 text-sm font-semibold hover:bg-surface-2"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={handleDelete}
                  className="rounded-xl bg-danger px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {busy ? 'Deleting…' : 'Yes, Delete'}
                </button>
              </div>
            </section>
          </div>,
          document.body,
        )}

      {credentials && (
        <CredentialsDialog
          employeeId={id}
          credentials={credentials.credentials}
          email={credentials.email}
          title="New password generated"
          onClose={() => setCredentials(null)}
        />
      )}
    </div>
  );
}
