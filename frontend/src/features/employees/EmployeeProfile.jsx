import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, AlertCircle, FileText, KeyRound, Pencil, RefreshCw, Trash2 } from 'lucide-react';
import { api } from '../../services/api.js';
import { useAuth } from '../../app/AuthContext.jsx';
import CredentialsDialog from '../../components/CredentialsDialog.jsx';
import { useConfirm } from '../../components/ConfirmDialog.jsx';

const ROLE_LABELS = { SUPER_ADMIN: 'Super Admin', HR_ADMIN: 'HR', MANAGER: 'Manager', EMPLOYEE: 'Employee' };
const EMPLOYMENT_LABELS = { FULL_TIME: 'Full time', PART_TIME: 'Part time', CONTRACT: 'Contract', INTERN: 'Intern' };

const formatDate = (value) => {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
};

function Field({ label, value }) {
  return (
    <div className="min-w-0">
      <div className="text-xs font-semibold uppercase tracking-wider text-muted">{label}</div>
      <div className="mt-1 text-sm font-medium text-text [overflow-wrap:anywhere]">{value || '—'}</div>
    </div>
  );
}

function Section({ title, action, children }) {
  return (
    <section className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
        <h2 className="text-sm font-bold">{title}</h2>
        {action}
      </div>
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
  const { confirm, confirmDialog } = useConfirm();

  // Employment editor (Super Admin: everyone, HR Admin: Employees and Managers).
  const [editing, setEditing] = useState(false);
  const [opts, setOpts] = useState({ departments: [], designations: [], locations: [], managers: [] });
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [documents, setDocuments] = useState([]);

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
    const ok = await confirm({
      title: 'Reset password',
      message: 'Generate a new temporary password? The old password will stop working.',
      confirmLabel: 'Yes, Reset Password',
      danger: true,
    });
    if (!ok) return;
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

  // Who is who in the reporting line, derived from the manager's own role.
  const managerRole = employee?.manager?.userAccount?.role;
  const reportingManager = managerRole === 'MANAGER' ? employee.manager : null;
  const reportingHr = managerRole === 'HR_ADMIN' ? employee.manager : managerRole === 'MANAGER' ? employee.manager?.manager || null : null;
  const personLabel = (p) => (p ? `${p.fullName} (${p.employeeCode})` : null);
  const canEdit = Boolean(employee) && (isSuperAdmin || (user?.role === 'HR_ADMIN' && ['EMPLOYEE', 'MANAGER'].includes(role)));
  const canEditLine = canEdit && ['EMPLOYEE', 'MANAGER'].includes(role);
  const canSeeDocuments = ['SUPER_ADMIN', 'HR_ADMIN'].includes(user?.role) && !(user?.role === 'HR_ADMIN' && ['HR_ADMIN', 'SUPER_ADMIN'].includes(role) && employee?.id !== user?.employeeId);
  const hrChoices = opts.managers.filter((m) => m.role === 'HR_ADMIN' && m.id !== employee?.id);
  const managerChoices = opts.managers.filter((m) => m.role === 'MANAGER' && m.id !== employee?.id);
  const pickedManager = managerChoices.find((m) => m.id === form.managerId) || null;
  const pickedManagerHr = pickedManager ? opts.managers.find((m) => m.id === pickedManager.managerId) || null : null;
  const departmentChoices = [...opts.departments, ...(employee?.department && !opts.departments.some((d) => d.id === employee.department.id) ? [employee.department] : [])];
  const designationChoices = opts.designations.filter((d) => !d.departmentId || d.departmentId === form.departmentId);
  const locationNames = [...new Set([...opts.locations.map((l) => l.name), ...(employee?.workLocation ? [employee.workLocation] : [])])];
  const dateValue = (value) => (value ? String(value).slice(0, 10) : '');

  useEffect(() => {
    if (!employee || !canSeeDocuments) { setDocuments([]); return; }
    api(`/documents?employeeId=${employee.id}`).then((res) => setDocuments(res.documents || [])).catch(() => setDocuments([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employee?.id, canSeeDocuments]);

  async function downloadDocument(doc) {
    setError('');
    try {
      const res = await fetch(`/api/documents/${doc.id}/download`, { credentials: 'include' });
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error?.message || 'Could not download the document.');
      const url = URL.createObjectURL(await res.blob());
      const link = document.createElement('a');
      link.href = url;
      link.download = doc.fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.message || 'Could not download the document.');
    }
  }

  async function removeDocument(doc) {
    const ok = await confirm({ title: 'Delete document', message: `Delete "${doc.title}"? The uploaded file will be removed permanently.`, confirmLabel: 'Yes, Delete', danger: true });
    if (!ok) return;
    try {
      await api(`/documents/${doc.id}`, { method: 'DELETE' });
      setDocuments((list) => list.filter((d) => d.id !== doc.id));
    } catch (err) {
      setError(err.message || 'Could not delete the document.');
    }
  }

  async function startEdit() {
    setError('');
    try {
      const loaded = await api('/organization/options');
      setOpts({ departments: loaded.departments || [], designations: loaded.designations || [], locations: loaded.locations || [], managers: loaded.managers || [] });
      setForm({
        departmentId: employee.departmentId || '',
        designationId: employee.designationId || '',
        employmentType: employee.employmentType || 'FULL_TIME',
        joiningDate: dateValue(employee.joiningDate),
        probationEndDate: dateValue(employee.probationEndDate),
        workLocation: employee.workLocation || '',
        managerId: reportingManager?.id || '',
        hrId: reportingManager ? '' : reportingHr?.id || '',
      });
      setEditing(true);
    } catch (err) {
      setError(err.message || 'Could not load the department, location and manager lists.');
    }
  }

  async function saveEdit(event) {
    event.preventDefault();
    if (!form.joiningDate) { setError('Joining date is required.'); return; }
    const body = {
      departmentId: form.departmentId,
      designationId: form.designationId,
      employmentType: form.employmentType,
      joiningDate: form.joiningDate,
      probationEndDate: form.probationEndDate,
      workLocation: form.workLocation,
    };
    if (canEditLine) {
      const managerId = role === 'MANAGER' ? form.hrId : form.managerId || form.hrId;
      if (!managerId) {
        setError(role === 'MANAGER' ? 'Select the HR this manager reports to.' : 'Select a reporting manager or HR.');
        return;
      }
      body.managerId = managerId;
    }
    setSaving(true);
    setError('');
    try {
      await api(`/employees/${id}`, { method: 'PATCH', body });
      setEditing(false);
      await load();
    } catch (err) {
      setError(err.message || 'Could not save the employment details.');
    } finally {
      setSaving(false);
    }
  }
  const canResetThis = canReset && employee?.userAccount && role !== 'SUPER_ADMIN' && !(user?.role === 'HR_ADMIN' && role === 'HR_ADMIN');
  const canDeleteThis = isSuperAdmin && employee && role !== 'SUPER_ADMIN' && employee.id !== user?.employeeId;

  return (
    <div className="space-y-6">
      {confirmDialog}
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
          <section className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-2xl border border-border bg-surface p-4 shadow-sm sm:p-5">
            <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-accent-soft text-xl font-bold text-accent">
              {employee.fullName?.trim()?.[0]?.toUpperCase() || '?'}
            </div>
            <div className="min-w-0 flex-1 basis-[11rem]">
              <h1 className="text-xl font-bold leading-snug tracking-tight [overflow-wrap:anywhere] sm:text-2xl">{employee.fullName}</h1>
              <p className="mt-0.5 text-sm text-muted [overflow-wrap:anywhere]">
                <b className="font-mono text-accent">{employee.employeeCode}</b> · {employee.workEmail}
              </p>
            </div>
            <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
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
            <Field label="Mobile" value={employee.mobile ? (/^\d{10}$/.test(employee.mobile) ? `+91 ${employee.mobile}` : employee.mobile) : null} />
            <Field label="Date of birth" value={formatDate(employee.dateOfBirth)} />
            <Field label="Personal address" value={employee.personalAddress} />
          </Section>

          <Section
            title="Employment"
            action={canEdit && !editing && (
              <button type="button" onClick={startEdit} className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-1.5 text-xs font-semibold transition hover:bg-surface-2">
                <Pencil size={13} /> Edit
              </button>
            )}
          >
            {!editing && (
              <>
                <Field label="Department" value={employee.department?.name} />
                <Field label="Designation" value={employee.designation?.title} />
                {role === 'HR_ADMIN' && <Field label="Reports to" value="Super Admin" />}
                {role === 'EMPLOYEE' && <Field label="Reporting manager" value={personLabel(reportingManager) || 'Not assigned'} />}
                {['EMPLOYEE', 'MANAGER'].includes(role) && <Field label="Reporting HR" value={personLabel(reportingHr) || 'Not assigned'} />}
                <Field label="Employment type" value={EMPLOYMENT_LABELS[employee.employmentType] || employee.employmentType} />
                <Field label="Joining date" value={formatDate(employee.joiningDate)} />
                <Field label="Probation ends" value={formatDate(employee.probationEndDate)} />
                <Field label="Work location" value={employee.workLocation} />
              </>
            )}
            {canEdit && editing && (
              <form onSubmit={saveEdit} className="space-y-4 sm:col-span-2 lg:col-span-3">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-muted">Department</label>
                    <select value={form.departmentId} onChange={(e) => setForm({ ...form, departmentId: e.target.value, designationId: opts.designations.find((d) => d.id === form.designationId)?.departmentId === e.target.value ? form.designationId : '' })} className="mt-1.5 w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm outline-none focus:border-accent">
                      <option value="">Not assigned</option>
                      {departmentChoices.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-muted">Designation</label>
                    <select value={form.designationId} onChange={(e) => setForm({ ...form, designationId: e.target.value })} className="mt-1.5 w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm outline-none focus:border-accent">
                      <option value="">Not assigned</option>
                      {designationChoices.map((d) => <option key={d.id} value={d.id}>{d.title}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-muted">Work location</label>
                    <select value={form.workLocation} onChange={(e) => setForm({ ...form, workLocation: e.target.value })} className="mt-1.5 w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm outline-none focus:border-accent">
                      {!form.workLocation && <option value="">Headquarters (default)</option>}
                      {locationNames.map((name) => <option key={name} value={name}>{name}</option>)}
                    </select>
                  </div>
                  {role === 'EMPLOYEE' && (
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-muted">Reporting manager</label>
                      <select
                        value={form.managerId}
                        onChange={(e) => {
                          const m = managerChoices.find((x) => x.id === e.target.value);
                          setForm({ ...form, managerId: e.target.value, hrId: m?.managerId || '' });
                        }}
                        className="mt-1.5 w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm outline-none focus:border-accent"
                      >
                        <option value="">None (report directly to HR)</option>
                        {managerChoices.map((m) => <option key={m.id} value={m.id}>{m.fullName} ({m.employeeCode})</option>)}
                      </select>
                    </div>
                  )}
                  {canEditLine && (
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-muted">Reporting HR</label>
                      {role === 'EMPLOYEE' && pickedManager ? (
                        <div className="mt-1.5 w-full rounded-xl border border-border bg-surface-2/60 px-3.5 py-2.5 text-sm font-semibold">
                          {pickedManagerHr ? personLabel(pickedManagerHr) : 'No HR linked to this manager'}
                        </div>
                      ) : (
                        <select required value={form.hrId} onChange={(e) => setForm({ ...form, hrId: e.target.value })} className="mt-1.5 w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm outline-none focus:border-accent">
                          <option value="">Select HR</option>
                          {hrChoices.map((m) => <option key={m.id} value={m.id}>{m.fullName} ({m.employeeCode})</option>)}
                        </select>
                      )}
                    </div>
                  )}
                  {role === 'HR_ADMIN' && (
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-muted">Reports to</label>
                      <div className="mt-1.5 w-full rounded-xl border border-border bg-surface-2/60 px-3.5 py-2.5 text-sm font-semibold">Super Admin</div>
                    </div>
                  )}
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-muted">Employment type</label>
                    <select value={form.employmentType} onChange={(e) => setForm({ ...form, employmentType: e.target.value })} className="mt-1.5 w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm outline-none focus:border-accent">
                      {Object.entries(EMPLOYMENT_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-muted">Joining date</label>
                    <input required type="date" value={form.joiningDate} onChange={(e) => setForm({ ...form, joiningDate: e.target.value })} className="mt-1.5 w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm outline-none focus:border-accent" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-muted">Probation ends</label>
                    <input type="date" value={form.probationEndDate} onChange={(e) => setForm({ ...form, probationEndDate: e.target.value })} className="mt-1.5 w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm outline-none focus:border-accent" />
                  </div>
                </div>
                {role === 'EMPLOYEE' && pickedManager && !pickedManagerHr && (
                  <p className="text-xs text-danger">This manager has no HR yet. Link the manager to an HR first, or choose "None" and pick an HR directly.</p>
                )}
                <div className="flex flex-wrap justify-end gap-3">
                  <button type="button" onClick={() => setEditing(false)} className="rounded-xl border border-border px-4 py-2 text-sm font-semibold text-muted transition hover:bg-surface-2">Cancel</button>
                  <button type="submit" disabled={saving || (role === 'EMPLOYEE' && pickedManager && !pickedManagerHr)} className="rounded-xl bg-accent px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-accent/90 disabled:opacity-50">
                    {saving ? 'Saving…' : 'Save changes'}
                  </button>
                </div>
              </form>
            )}
          </Section>

          <Section title="Emergency contact">
            <Field label="Name" value={employee.emergencyName} />
            <Field label="Relationship" value={employee.emergencyRelation} />
            <Field label="Phone" value={employee.emergencyPhone} />
          </Section>

          {canSeeDocuments && (
            <section className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
              <h2 className="border-b border-border pb-3 text-sm font-bold">Documents</h2>
              {documents.length === 0 ? (
                <p className="mt-4 text-sm text-muted">No documents uploaded by this person.</p>
              ) : (
                <ul className="mt-3 divide-y divide-border">
                  {documents.map((d) => (
                    <li key={d.id} className="flex flex-wrap items-center gap-3 py-3">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent"><FileText size={18} /></span>
                      <div className="min-w-0 flex-1 basis-[10rem]">
                        <p className="break-words text-sm font-semibold">{d.title}</p>
                        <button type="button" onClick={() => downloadDocument(d)} className="break-all text-left text-xs text-accent underline-offset-2 hover:underline">{d.fileName}</button>
                        <p className="text-xs text-muted">{d.category.replaceAll('_', ' ')} · {new Date(d.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                      </div>
                      {d.canDelete && (
                        <button type="button" onClick={() => removeDocument(d)} aria-label={`Delete ${d.title}`} className="inline-flex items-center gap-1.5 rounded-lg border border-danger/30 px-2.5 py-1.5 text-xs font-semibold text-danger transition hover:bg-danger-soft">
                          <Trash2 size={14} /> Delete
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

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
