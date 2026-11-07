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
  MapPin,
  Pencil,
  Trash2,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';
import { api } from '../../services/api.js';
import { useAuth } from '../../app/AuthContext.jsx';
import { useConfirm } from '../../components/ConfirmDialog.jsx';

export default function OrganizationPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState('departments'); // 'departments' | 'designations' | 'locations'
  const [departments, setDepartments] = useState([]);
  const [designations, setDesignations] = useState([]);
  const [locations, setLocations] = useState([]);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [editingLocation, setEditingLocation] = useState(null);
  const [locationForm, setLocationForm] = useState({ name: '', city: '', state: '', isHeadquarters: false });
  const { confirm, confirmDialog } = useConfirm();
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
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';

  async function loadData() {
    setLoading(true);
    setError('');
    try {
      const [deptRes, desigRes, locRes] = await Promise.all([
        api('/organization/departments').catch(() => ({ departments: [] })),
        api('/organization/designations').catch(() => ({ designations: [] })),
        api('/organization/locations').catch(() => ({ locations: [] })),
      ]);
      setLocations(locRes.locations || []);

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
    const ok = await confirm({
      title: `${nextActive ? 'Activate' : 'Deactivate'} ${kind}`,
      message: `${nextActive ? 'Activate' : 'Deactivate'} ${kind} “${name}”?${nextActive ? '\n\nIt will be available in Add Employee / Add HR / Add Manager forms.' : '\n\nIt will no longer be available for new employee assignments. Existing records will be preserved.'}`,
      confirmLabel: nextActive ? 'Yes, Activate' : 'Yes, Deactivate',
      danger: !nextActive,
    });
    if (!ok) return;
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
    const ok = await confirm({
      title: `Remove ${kind}`,
      message: `Permanently delete ${kind} “${name}”?\n\nThis cannot be undone. This only works when no employees or other records depend on it.`,
      confirmLabel: 'Yes, Delete',
      danger: true,
    });
    if (!ok) return;
    setActionLoading(true); setError(''); setSuccess('');
    try {
      const result = await api(`/organization/${isDepartment ? 'departments' : 'designations'}/${item.id}`, { method: 'DELETE' });
      setSuccess(result.message || `${isDepartment ? 'Department' : 'Designation'} “${name}” permanently deleted.`);
      await loadData();
    } catch (err) { setError(err.message || `Could not permanently delete ${kind}; check its dependencies.`); }
    finally { setActionLoading(false); }
  }

  function openLocationModal(location) {
    setEditingLocation(location);
    setLocationForm(location
      ? { name: location.name, city: location.city || '', state: location.state || '', isHeadquarters: location.isHeadquarters }
      : { name: '', city: '', state: '', isHeadquarters: locations.length === 0 });
    setShowLocationModal(true);
  }

  async function handleSaveLocation(e) {
    e.preventDefault();
    setActionLoading(true); setError(''); setSuccess('');
    try {
      const result = await api(editingLocation ? `/organization/locations/${editingLocation.id}` : '/organization/locations', {
        method: editingLocation ? 'PATCH' : 'POST',
        body: locationForm,
      });
      setSuccess(result.message || 'Location saved.');
      setShowLocationModal(false);
      await loadData();
    } catch (err) { setError(err.message || 'Failed to save location.'); }
    finally { setActionLoading(false); }
  }

  async function handleLocationStatus(location) {
    const nextActive = !location.isActive;
    const ok = await confirm({
      title: `${nextActive ? 'Activate' : 'Deactivate'} location`,
      message: nextActive
        ? `Activate “${location.name}”? It will be available for employees and holidays again.`
        : `Deactivate “${location.name}”? It will no longer be offered for new employees or holidays. Existing records are kept.`,
      confirmLabel: nextActive ? 'Yes, Activate' : 'Yes, Deactivate',
      danger: !nextActive,
    });
    if (!ok) return;
    setActionLoading(true); setError(''); setSuccess('');
    try {
      const result = await api(`/organization/locations/${location.id}/status`, { method: 'PATCH', body: { isActive: nextActive } });
      setSuccess(result.message || 'Location updated.');
      await loadData();
    } catch (err) { setError(err.message || 'Could not change the location status.'); }
    finally { setActionLoading(false); }
  }

  async function handleLocationDelete(location) {
    const ok = await confirm({
      title: 'Remove location',
      message: `Permanently delete “${location.name}”?\n\nThis only works when no employees or holidays use it.`,
      confirmLabel: 'Yes, Delete',
      danger: true,
    });
    if (!ok) return;
    setActionLoading(true); setError(''); setSuccess('');
    try {
      const result = await api(`/organization/locations/${location.id}`, { method: 'DELETE' });
      setSuccess(result.message || 'Location deleted.');
      await loadData();
    } catch (err) { setError(err.message || 'Could not delete the location.'); }
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
      {confirmDialog}
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
          {(tab === 'locations' ? isSuperAdmin : isAdmin) && (
            <button
              type="button"
              onClick={() => (tab === 'locations' ? openLocationModal(null) : tab === 'departments' ? setShowDeptModal(true) : setShowDesigModal(true))}
              className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-accent/90"
            >
              <Plus size={16} />
              {tab === 'locations' ? 'Add Location' : tab === 'departments' ? 'Add Department' : 'Add Designation'}
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
        {isSuperAdmin && (
          <button
            type="button"
            onClick={() => setTab('locations')}
            className={`flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-semibold transition ${
              tab === 'locations' ? 'border-accent text-accent' : 'border-transparent text-muted hover:text-text'
            }`}
          >
            <MapPin size={16} />
            Company locations ({locations.length})
          </button>
        )}
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

      {/* Tab 3: Company locations (Super Admin) */}
      {tab === 'locations' && isSuperAdmin && (
        <section className="rounded-2xl border border-border bg-surface p-5 shadow-card sm:p-6">
          <p className="mb-4 text-sm text-muted">Where the company operates. These locations are used for employee work location and for location-specific holidays.</p>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs font-semibold text-muted">
                  <th className="pb-3">Location</th>
                  <th className="pb-3">City / State</th>
                  <th className="pb-3">Employees</th>
                  <th className="pb-3">Holidays</th>
                  <th className="pb-3">Status</th>
                  <th className="pb-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {locations.map((l) => (
                  <tr key={l.id} className="hover:bg-surface-2/40">
                    <td className="py-3.5 font-semibold text-text">
                      {l.name}
                      {l.isHeadquarters && <span className="ml-2 rounded-full bg-accent-soft px-2 py-0.5 text-[10px] font-bold uppercase text-accent">Headquarters</span>}
                    </td>
                    <td className="py-3.5 text-muted">{[l.city, l.state].filter(Boolean).join(', ') || '—'}</td>
                    <td className="py-3.5 text-muted">{l.usage?.employees ?? 0}</td>
                    <td className="py-3.5 text-muted">{l.usage?.holidays ?? 0}</td>
                    <td className="py-3.5">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${l.isActive ? 'bg-success/15 text-success' : 'bg-surface-2 text-muted'}`}>
                        {l.isActive ? <><CheckCircle2 size={12} /> Active</> : 'Inactive'}
                      </span>
                    </td>
                    <td className="py-3.5 text-right"><div className="inline-flex flex-wrap justify-end gap-2">
                      <button type="button" disabled={actionLoading} onClick={() => openLocationModal(l)} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold transition hover:bg-surface-2">
                        <Pencil size={14} /> Edit
                      </button>
                      {!l.isHeadquarters && (
                        <>
                          <button type="button" disabled={actionLoading} onClick={() => handleLocationStatus(l)} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold transition hover:bg-surface-2">
                            {l.isActive ? <ToggleRight size={14} /> : <ToggleLeft size={14} />} {l.isActive ? 'Deactivate' : 'Activate'}
                          </button>
                          <button type="button" disabled={actionLoading} onClick={() => handleLocationDelete(l)} aria-label={`Permanently delete location ${l.name}`} className="inline-flex items-center gap-1.5 rounded-lg border border-danger/20 px-2.5 py-1.5 text-xs font-semibold text-danger transition hover:bg-danger-soft">
                            <Trash2 size={14} /> Permanent Delete
                          </button>
                        </>
                      )}
                    </div></td>
                  </tr>
                ))}
                {!loading && locations.length === 0 && (
                  <tr><td colSpan={6} className="py-8 text-center text-muted">No locations added yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Add / Edit Location Modal */}
      {showLocationModal && (
        createPortal(
        <div
          className="fixed inset-0 z-[100] grid place-items-center bg-black/40 p-4 backdrop-blur-sm"
          style={{ position: 'fixed', inset: 0, display: 'grid', placeItems: 'center', zIndex: 10000 }}
          role="presentation"
          onMouseDown={(event) => { if (event.target === event.currentTarget) setShowLocationModal(false); }}
        >
          <section role="dialog" aria-modal="true" aria-labelledby="location-title" className="w-full max-w-md rounded-2xl border border-border bg-surface p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-border pb-4">
              <h3 id="location-title" className="text-lg font-bold">{editingLocation ? 'Edit Location' : 'Add Location'}</h3>
              <button type="button" onClick={() => setShowLocationModal(false)} className="rounded-lg p-1 text-muted transition hover:bg-surface-2">✕</button>
            </div>
            <form onSubmit={handleSaveLocation} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted">Location Name</label>
                <input
                  required
                  type="text"
                  maxLength={80}
                  placeholder="e.g. Mumbai Office"
                  value={locationForm.name}
                  onChange={(e) => setLocationForm({ ...locationForm, name: e.target.value })}
                  className="mt-1.5 w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm outline-none focus:border-accent"
                />
                {editingLocation && <p className="mt-1.5 text-xs text-muted">Renaming also updates the employees and holidays that use this location.</p>}
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-muted">City</label>
                  <input
                    type="text"
                    maxLength={80}
                    placeholder="e.g. Mumbai"
                    value={locationForm.city}
                    onChange={(e) => setLocationForm({ ...locationForm, city: e.target.value })}
                    className="mt-1.5 w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm outline-none focus:border-accent"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-muted">State</label>
                  <input
                    type="text"
                    maxLength={80}
                    placeholder="e.g. Maharashtra"
                    value={locationForm.state}
                    onChange={(e) => setLocationForm({ ...locationForm, state: e.target.value })}
                    className="mt-1.5 w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm outline-none focus:border-accent"
                  />
                </div>
              </div>
              <label className="flex items-center gap-2.5 text-sm">
                <input
                  type="checkbox"
                  checked={locationForm.isHeadquarters}
                  disabled={Boolean(editingLocation?.isHeadquarters)}
                  onChange={(e) => setLocationForm({ ...locationForm, isHeadquarters: e.target.checked })}
                />
                This is the company headquarters
              </label>
              <div className="flex items-center justify-end gap-3 pt-3">
                <button type="button" onClick={() => setShowLocationModal(false)} className="rounded-xl border border-border px-4 py-2.5 text-sm font-semibold text-muted transition hover:bg-surface-2">Cancel</button>
                <button type="submit" disabled={actionLoading} className="rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-accent/90 disabled:opacity-50">
                  {actionLoading ? 'Saving…' : 'Save Location'}
                </button>
              </div>
            </form>
          </section>
        </div>,
        document.body,
        )
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

