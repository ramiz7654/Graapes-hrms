import { createPortal } from 'react-dom';
import { useEffect, useState } from 'react';
import {
  Network,
  Building2,
  Briefcase,
  Plus,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Users,
  Trash2,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';
import { api } from '../../services/api.js';
import { useAuth } from '../../app/AuthContext.jsx';

export default function OrganizationPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState('departments'); // 'departments' | 'designations'
  const [departments, setDepartments] = useState([]);
  const [designations, setDesignations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Modals
  const [showDeptModal, setShowDeptModal] = useState(false);
  const [showDesigModal, setShowDesigModal] = useState(false);

  // Forms
  const [deptForm, setDeptForm] = useState({ name: '', code: '' });
  const [desigForm, setDesigForm] = useState({ title: '', departmentId: '' });

  const isAdmin = ['SUPER_ADMIN', 'HR_ADMIN'].includes(user?.role);

  async function loadData() {
    setLoading(true);
    setError('');
    try {
      const [deptRes, desigRes] = await Promise.all([
        api('/organization/departments').catch(() => ({ departments: [] })),
        api('/organization/designations').catch(() => ({ designations: [] })),
      ]);

      setDepartments(deptRes.departments || []);
      setDesignations(desigRes.designations || []);
    } catch (err) {
      setError(err.message || 'Failed to load organization data.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function handleStatusChange(kind, item) {
    const isDepartment = kind === 'department';
    const name = isDepartment ? item.name : item.title;
    const nextActive = !item.isActive;
    if (!window.confirm(`${nextActive ? 'Activate' : 'Deactivate'} ${kind} “${name}”?${nextActive ? '\n\nIt will be available in Add Employee / Add HR / Add Manager forms.' : '\n\nIt will no longer be available for new employee assignments. Existing records will be preserved.'}`)) return;
    setActionLoading(true); setError(''); setSuccess('');
    try {
      await api(`/organization/${isDepartment ? 'departments' : 'designations'}/${item.id}/status`, { method: 'PATCH', body: { isActive: nextActive } });
      setSuccess(`${isDepartment ? 'Department' : 'Designation'} “${name}” ${nextActive ? 'activated' : 'deactivated'} successfully.`);
      await loadData();
    } catch (err) { setError(err.message || `Failed to ${nextActive ? 'activate' : 'deactivate'} ${kind}.`); }
    finally { setActionLoading(false); }
  }

  async function handlePermanentDelete(kind, item) {
    const isDepartment = kind === 'department';
    const name = isDepartment ? item.name : item.title;
    if (!window.confirm(`Permanently delete ${kind} “${name}”?\n\nThis cannot be undone. This only works when no employees or other records depend on it.`)) return;
    setActionLoading(true); setError(''); setSuccess('');
    try {
      const result = await api(`/organization/${isDepartment ? 'departments' : 'designations'}/${item.id}`, { method: 'DELETE' });
      setSuccess(result.message || `${isDepartment ? 'Department' : 'Designation'} “${name}” permanently deleted.`);
      await loadData();
    } catch (err) { setError(err.message || `Could not permanently delete ${kind}; check its dependencies.`); }
    finally { setActionLoading(false); }
  }

  async function handleAddDept(e) {
    e.preventDefault();
    setActionLoading(true);
    setError('');
    try {
      await api('/organization/departments', {
        method: 'POST',
        body: deptForm,
      });
      setSuccess('Department added successfully.');
      setShowDeptModal(false);
      setDeptForm({ name: '', code: '' });
      await loadData();
    } catch (err) {
      setError(err.message || 'Failed to create department.');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleAddDesig(e) {
    e.preventDefault();
    setActionLoading(true);
    setError('');
    try {
      await api('/organization/designations', {
        method: 'POST',
        body: desigForm,
      });
      setSuccess('Designation added successfully.');
      setShowDesigModal(false);
      setDesigForm({ title: '', departmentId: '' });
      await loadData();
    } catch (err) {
      setError(err.message || 'Failed to create designation.');
    } finally {
      setActionLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="mb-1.5 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-accent">
            <Network size={16} />
            <span>Company Architecture</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Organization Setup</h1>
          <p className="mt-1 text-sm text-muted">Manage functional business departments, roles, and job designations.</p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2 text-sm font-semibold transition hover:bg-surface-2"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
          {isAdmin && (
            <button
              type="button"
              onClick={() => (tab === 'departments' ? setShowDeptModal(true) : setShowDesigModal(true))}
              className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-accent/90"
            >
              <Plus size={16} />
              {tab === 'departments' ? 'Add Department' : 'Add Designation'}
            </button>
          )}
        </div>
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
        <button
          type="button"
          onClick={() => setTab('departments')}
          className={`flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-semibold transition ${
            tab === 'departments' ? 'border-accent text-accent' : 'border-transparent text-muted hover:text-text'
          }`}
        >
          <Building2 size={16} />
          Departments ({departments.length})
        </button>
        <button
          type="button"
          onClick={() => setTab('designations')}
          className={`flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-semibold transition ${
            tab === 'designations' ? 'border-accent text-accent' : 'border-transparent text-muted hover:text-text'
          }`}
        >
          <Briefcase size={16} />
          Designations ({designations.length})
        </button>
      </div>

      {/* Tab 1: Departments */}
      {tab === 'departments' && (
        <section className="rounded-2xl border border-border bg-surface p-5 shadow-card sm:p-6">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs font-semibold text-muted">
                  <th className="pb-3">Department</th>
                  <th className="pb-3">Code</th>
                  <th className="pb-3">Headcount</th>
                  <th className="pb-3">Designations</th>
                  <th className="pb-3">Status</th>
                  {isAdmin && <th className="pb-3 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {departments.map((d) => (
                  <tr key={d.id} className="hover:bg-surface-2/40">
                    <td className="py-3.5 font-semibold text-text">{d.name}</td>
                    <td className="py-3.5 font-mono text-xs font-bold text-accent">{d.code}</td>
                    <td className="py-3.5 text-muted">
                      <span className="inline-flex items-center gap-1.5 font-semibold text-text">
                        <Users size={14} className="text-muted" />
                        {d.employeeCount} {d.employeeCount === 1 ? 'employee' : 'employees'}
                      </span>
                    </td>
                    <td className="py-3.5 text-muted">{d.designationCount} roles</td>
                    <td className="py-3.5">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${d.isActive ? 'bg-success/15 text-success' : 'bg-surface-2 text-muted'}`}>
                        {d.isActive ? <><CheckCircle2 size={12} /> Active</> : 'Inactive'}
                      </span>
                    </td>
                    {isAdmin && <td className="py-3.5 text-right"><div className="inline-flex flex-wrap justify-end gap-2">
                      <button type="button" disabled={actionLoading} onClick={() => handleStatusChange('department', d)} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold transition hover:bg-surface-2">
                        {d.isActive ? <ToggleRight size={14} /> : <ToggleLeft size={14} />} {d.isActive ? 'Deactivate' : 'Activate'}
                      </button>
                      <button type="button" disabled={actionLoading} onClick={() => handlePermanentDelete('department', d)} title="Permanently delete (only if no dependencies)" aria-label={`Permanently delete department ${d.name}`} className="inline-flex items-center gap-1.5 rounded-lg border border-danger/20 px-2.5 py-1.5 text-xs font-semibold text-danger transition hover:bg-danger-soft">
                        <Trash2 size={14} /> Permanent Delete
                      </button>
                    </div></td>}
                  </tr>
                ))}
                {!loading && departments.length === 0 && (
                  <tr>
                    <td colSpan={isAdmin ? 6 : 5} className="py-8 text-center text-muted">
                      No departments added yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Tab 2: Designations */}
      {tab === 'designations' && (
        <section className="rounded-2xl border border-border bg-surface p-5 shadow-card sm:p-6">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs font-semibold text-muted">
                  <th className="pb-3">Designation Title</th>
                  <th className="pb-3">Associated Department</th>
                  <th className="pb-3">Assigned Employees</th>
                  <th className="pb-3">Status</th>
                  {isAdmin && <th className="pb-3 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {designations.map((d) => (
                  <tr key={d.id} className="hover:bg-surface-2/40">
                    <td className="py-3.5 font-semibold text-text">{d.title}</td>
                    <td className="py-3.5 text-muted">{d.departmentName}</td>
                    <td className="py-3.5 font-semibold text-text">{d.employeeCount}</td>
                    <td className="py-3.5">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${d.isActive ? 'bg-success/15 text-success' : 'bg-surface-2 text-muted'}`}>
                        {d.isActive ? <><CheckCircle2 size={12} /> Active</> : 'Inactive'}
                      </span>
                    </td>
                    {isAdmin && <td className="py-3.5 text-right"><div className="inline-flex flex-wrap justify-end gap-2">
                      <button type="button" disabled={actionLoading} onClick={() => handleStatusChange('designation', d)} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold transition hover:bg-surface-2">
                        {d.isActive ? <ToggleRight size={14} /> : <ToggleLeft size={14} />} {d.isActive ? 'Deactivate' : 'Activate'}
                      </button>
                      <button type="button" disabled={actionLoading} onClick={() => handlePermanentDelete('designation', d)} title="Permanently delete (only if no dependencies)" aria-label={`Permanently delete designation ${d.title}`} className="inline-flex items-center gap-1.5 rounded-lg border border-danger/20 px-2.5 py-1.5 text-xs font-semibold text-danger transition hover:bg-danger-soft">
                        <Trash2 size={14} /> Permanent Delete
                      </button>
                    </div></td>}
                  </tr>
                ))}
                {!loading && designations.length === 0 && (
                  <tr>
                    <td colSpan={isAdmin ? 5 : 4} className="py-8 text-center text-muted">
                      No designations configured yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Add Department Modal */}
      {showDeptModal && (
        createPortal(
        <div
          className="fixed inset-0 z-[100] grid place-items-center bg-black/40 p-4 backdrop-blur-sm"
          style={{ position: 'fixed', inset: 0, display: 'grid', placeItems: 'center', zIndex: 10000 }}
          role="presentation"
          onMouseDown={(event) => { if (event.target === event.currentTarget) { setShowDeptModal(false); setShowDesigModal(false); } }}
        >
          <section role="dialog" aria-modal="true" aria-labelledby="add-department-title" className="w-full max-w-md rounded-2xl border border-border bg-surface p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-border pb-4">
              <h3 id="add-department-title" className="text-lg font-bold">Add Department</h3>
              <button
                type="button"
                onClick={() => setShowDeptModal(false)}
                className="rounded-lg p-1 text-muted transition hover:bg-surface-2"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleAddDept} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted">Department Name</label>
                <input
                  required
                  type="text"
                  placeholder="e.g. Finance & Accounting"
                  value={deptForm.name}
                  onChange={(e) => setDeptForm({ ...deptForm, name: e.target.value })}
                  className="mt-1.5 w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm outline-none focus:border-accent"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted">Department Code</label>
                <input
                  required
                  type="text"
                  placeholder="e.g. FIN"
                  value={deptForm.code}
                  onChange={(e) => setDeptForm({ ...deptForm, code: e.target.value.toUpperCase() })}
                  className="mt-1.5 w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm uppercase outline-none focus:border-accent"
                />
              </div>
              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowDeptModal(false)}
                  className="rounded-xl border border-border px-4 py-2.5 text-sm font-semibold text-muted transition hover:bg-surface-2"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-accent/90 disabled:opacity-50"
                >
                  {actionLoading ? 'Creating…' : 'Save Department'}
                </button>
              </div>
            </form>
          </section>
        </div>,
        document.body,
        )
      )}

      {/* Add Designation Modal */}
      {showDesigModal && (
        createPortal(
        <div
          className="fixed inset-0 z-[100] grid place-items-center bg-black/40 p-4 backdrop-blur-sm"
          style={{ position: 'fixed', inset: 0, display: 'grid', placeItems: 'center', zIndex: 10000 }}
          role="presentation"
          onMouseDown={(event) => { if (event.target === event.currentTarget) { setShowDeptModal(false); setShowDesigModal(false); } }}
        >
          <section role="dialog" aria-modal="true" aria-labelledby="add-designation-title" className="w-full max-w-md rounded-2xl border border-border bg-surface p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-border pb-4">
              <h3 id="add-designation-title" className="text-lg font-bold">Add Designation</h3>
              <button
                type="button"
                onClick={() => setShowDesigModal(false)}
                className="rounded-lg p-1 text-muted transition hover:bg-surface-2"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleAddDesig} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted">Designation Title</label>
                <input
                  required
                  type="text"
                  placeholder="e.g. Financial Analyst"
                  value={desigForm.title}
                  onChange={(e) => setDesigForm({ ...desigForm, title: e.target.value })}
                  className="mt-1.5 w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm outline-none focus:border-accent"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted">Department</label>
                <select
                  value={desigForm.departmentId}
                  onChange={(e) => setDesigForm({ ...desigForm, departmentId: e.target.value })}
                  className="mt-1.5 w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm outline-none focus:border-accent"
                >
                  <option value="">General / All Departments</option>
                  {departments.filter((d) => d.isActive).map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowDesigModal(false)}
                  className="rounded-xl border border-border px-4 py-2.5 text-sm font-semibold text-muted transition hover:bg-surface-2"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-accent/90 disabled:opacity-50"
                >
                  {actionLoading ? 'Creating…' : 'Save Designation'}
                </button>
              </div>
            </form>
          </section>
        </div>,
        document.body,
        )
      )}
    </div>
  );
}

