import { createPortal } from 'react-dom';
import { useEffect, useState } from 'react';
import {
  Users,
  UserPlus,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  Building2,
  Briefcase,
  UserCheck,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { api } from '../../services/api.js';
import { useAuth } from '../../app/AuthContext.jsx';
import CredentialsDialog from '../../components/CredentialsDialog.jsx';

export default function EmployeeDirectory() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const isUserManagement = location.pathname === '/admin';
  const [employees, setEmployees] = useState([]);
  const [options, setOptions] = useState({ departments: [], designations: [], managers: [] });
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Filters
  const [search, setSearch] = useState('');
  const [selectedDept, setSelectedDept] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [newCredentials, setNewCredentials] = useState(null);

  // New Employee Form
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    mobile: '',
    role: 'EMPLOYEE',
    employmentType: 'FULL_TIME',
    departmentId: '',
    designationId: '',
    managerId: '',
    joiningDate: new Date().toISOString().slice(0, 10),
  });

  const isAdmin = ['SUPER_ADMIN', 'HR_ADMIN'].includes(user?.role);
  // Super Admin creates HR / Manager / Employee. HR Admin creates Manager / Employee.
  const ROLE_LABELS = { HR_ADMIN: 'HR', MANAGER: 'Manager', EMPLOYEE: 'Employee' };
  // Super Admin: only on the User Management & Roles page (not in the Employee Directory). HR Admin: Manager + Employee, never HR.
  const creatableRoles = user?.role === 'SUPER_ADMIN'
    ? (isUserManagement ? ['HR_ADMIN', 'MANAGER', 'EMPLOYEE'] : [])
    : user?.role === 'HR_ADMIN' ? ['MANAGER', 'EMPLOYEE'] : [];

  function openAddModal(role) {
    setForm((f) => ({ ...f, role }));
    setError('');
    setShowAddModal(true);
  }

  async function loadData() {
    setLoading(true);
    setError('');
    try {
      const [empRes, optRes] = await Promise.all([
        api('/employees').catch(() => ({ employees: [] })),
        api('/organization/options').catch(() => ({ departments: [], designations: [], managers: [] })),
      ]);

      setEmployees(empRes.employees || []);
      setOptions(optRes || { departments: [], designations: [], managers: [] });
    } catch (err) {
      setError(err.message || 'Failed to load employee directory.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function handleAddEmployee(e) {
    e.preventDefault();
    setActionLoading(true);
    setError('');
    setSuccess('');

    try {
      const res = await api('/employees', {
        method: 'POST',
        body: form,
      });

      setSuccess(`${ROLE_LABELS[form.role] || 'Employee'} account created successfully.`);
      setNewCredentials({ credentials: res.credentials, email: res.email, employeeId: res.employee?.id });
      setShowAddModal(false);
      setForm({
        fullName: '',
        email: '',
        mobile: '',
        role: form.role,
        employmentType: 'FULL_TIME',
        departmentId: '',
        designationId: '',
        managerId: '',
        joiningDate: new Date().toISOString().slice(0, 10),
      });
      await loadData();
    } catch (err) {
      setError(err.message || 'Could not create employee.');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleToggleStatus(employeeId, currentActive) {
    const action = currentActive ? 'deactivate' : 'activate';
    if (!window.confirm(`Are you sure you want to ${action} this employee's account?`)) return;

    setActionLoading(true);
    try {
      await api(`/employees/${employeeId}/deactivate`, { method: 'POST' });
      setSuccess(`Employee ${action}d successfully.`);
      await loadData();
    } catch (err) {
      setError(err.message || `Failed to ${action} employee.`);
    } finally {
      setActionLoading(false);
    }
  }

  const filteredEmployees = employees.filter((emp) => {
    const q = search.toLowerCase();
    const matchesSearch =
      !q ||
      emp.fullName?.toLowerCase().includes(q) ||
      emp.employeeCode?.toLowerCase().includes(q) ||
      emp.workEmail?.toLowerCase().includes(q);

    const matchesDept = !selectedDept || emp.departmentId === selectedDept;
    const matchesStatus = !selectedStatus || emp.status === selectedStatus;

    return matchesSearch && matchesDept && matchesStatus;
  });

  const availableDesignations = form.departmentId
    ? options.designations.filter((d) => !d.departmentId || d.departmentId === form.departmentId)
    : options.designations;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="mb-1.5 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-accent">
            <Users size={16} />
            <span>Workforce Management</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">{isUserManagement ? 'User Management' : 'Employee Directory'}</h1>
          <p className="mt-1 text-sm text-muted">
            {isUserManagement
              ? 'Create HR, Manager and Employee accounts. Each account gets a unique ID and a work email, and either one can be used to sign in.'
              : 'View organizational hierarchy, manage profiles, and provision employee accounts.'}
          </p>
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
          {creatableRoles.map((role) => (
            <button
              key={role}
              type="button"
              onClick={() => openAddModal(role)}
              className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-accent/90"
            >
              <UserPlus size={16} />
              Add {ROLE_LABELS[role]}
            </button>
          ))}
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

      {/* Search & Filters */}
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-surface p-4 shadow-card">
        <div className="relative min-w-[240px] flex-1">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
          <input
            type="text"
            placeholder="Search by name, employee code, or email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-border bg-surface-2/50 py-2 pl-9 pr-3.5 text-sm outline-none transition focus:border-accent"
          />
        </div>

        <select
          value={selectedDept}
          onChange={(e) => setSelectedDept(e.target.value)}
          className="rounded-xl border border-border bg-surface-2/50 px-3.5 py-2 text-sm outline-none transition focus:border-accent"
        >
          <option value="">All Departments</option>
          {options.departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>

        <select
          value={selectedStatus}
          onChange={(e) => setSelectedStatus(e.target.value)}
          className="rounded-xl border border-border bg-surface-2/50 px-3.5 py-2 text-sm outline-none transition focus:border-accent"
        >
          <option value="">All Statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="PROBATION">Probation</option>
          <option value="NOTICE_PERIOD">Notice Period</option>
          <option value="EXITED">Exited</option>
        </select>
      </div>

      {/* Employees Table */}
      <section className="rounded-2xl border border-border bg-surface p-5 shadow-card sm:p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-bold">Total Directory Records ({filteredEmployees.length})</h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs font-semibold text-muted">
                <th className="pb-3">Employee</th>
                <th className="pb-3">Department & Role</th>
                <th className="pb-3">Reporting Line</th>
                <th className="pb-3">Employment</th>
                <th className="pb-3">Status</th>
                {isAdmin && <th className="pb-3 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredEmployees.map((emp) => (
                <tr
                  key={emp.id}
                  className="cursor-pointer hover:bg-surface-2/40"
                  onClick={(e) => { if (!e.target.closest('a,button')) navigate(`/employees/${emp.id}`); }}
                >
                  <td className="py-3.5">
                    <Link to={`/employees/${emp.id}`} className="font-semibold text-text transition hover:text-accent hover:underline">
                      {emp.fullName}
                    </Link>
                    <div className="text-xs text-muted">
                      <b className="font-mono text-accent">{emp.employeeCode}</b> · {emp.workEmail}
                    </div>
                  </td>
                  <td className="py-3.5">
                    <div className="font-medium text-text">{emp.designation}</div>
                    <div className="text-xs text-muted">{emp.department}</div>
                  </td>
                  <td className="py-3.5 text-muted">
                    {emp.manager !== 'None' ? (
                      <span className="font-medium text-text">{emp.manager}</span>
                    ) : (
                      <span className="italic text-muted/60">Independent</span>
                    )}
                  </td>
                  <td className="py-3.5 text-xs text-muted">
                    <div>{emp.employmentType.replace('_', ' ')}</div>
                    <div>Joined: {emp.joiningDate || '—'}</div>
                  </td>
                  <td className="py-3.5">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        emp.accountActive && emp.status === 'ACTIVE'
                          ? 'bg-success/15 text-success'
                          : 'bg-danger/15 text-danger'
                      }`}
                    >
                      {emp.accountActive && emp.status === 'ACTIVE' ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                      {emp.status}
                    </span>
                  </td>
                  {isAdmin && (
                    <td className="py-3.5 text-right">
                      <button
                        type="button"
                        disabled={actionLoading}
                        onClick={() => handleToggleStatus(emp.id, emp.accountActive)}
                        className={`rounded-lg px-3 py-1 text-xs font-semibold transition ${
                          emp.accountActive
                            ? 'border border-danger/30 bg-danger/10 text-danger hover:bg-danger/20'
                            : 'border border-success/30 bg-success/10 text-success hover:bg-success/20'
                        }`}
                      >
                        {emp.accountActive ? 'Deactivate' : 'Reactivate'}
                      </button>
                    </td>
                  )}
                </tr>
              ))}
              {!loading && filteredEmployees.length === 0 && (
                <tr>
                  <td colSpan={isAdmin ? 6 : 5} className="py-8 text-center text-muted">
                    No employees matching the criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Add Employee Modal */}
      {showAddModal && (
        createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-2xl border border-border bg-surface p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-border pb-4">
              <h3 className="text-lg font-bold">Add New {ROLE_LABELS[form.role] || 'Employee'}</h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="rounded-lg p-1 text-muted transition hover:bg-surface-2"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddEmployee} className="mt-4 space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-muted">Full Name</label>
                  <input
                    required
                    type="text"
                    placeholder="e.g. Ramesh Kumar"
                    value={form.fullName}
                    onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                    className="mt-1.5 w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm outline-none focus:border-accent"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-muted">Work Email</label>
                  <input
                    required
                    type="email"
                    placeholder="ramesh@graapes.com"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="mt-1.5 w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm outline-none focus:border-accent"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-muted">Mobile Number</label>
                  <input
                    type="tel"
                    placeholder="+91 98765 00000"
                    value={form.mobile}
                    onChange={(e) => setForm({ ...form, mobile: e.target.value })}
                    className="mt-1.5 w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm outline-none focus:border-accent"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-muted">Account Type</label>
                  <div className="mt-1.5 w-full rounded-xl border border-border bg-surface-2/60 px-3.5 py-2.5 text-sm font-semibold">
                    {ROLE_LABELS[form.role] || 'Employee'}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-muted">Department</label>
                  <select
                    value={form.departmentId}
                    onChange={(e) => setForm({ ...form, departmentId: e.target.value })}
                    className="mt-1.5 w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm outline-none focus:border-accent"
                  >
                    <option value="">Select Department</option>
                    {options.departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-muted">Designation</label>
                  <select
                    value={form.designationId}
                    onChange={(e) => setForm({ ...form, designationId: e.target.value })}
                    className="mt-1.5 w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm outline-none focus:border-accent"
                  >
                    <option value="">Select Designation</option>
                    {availableDesignations.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.title}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-muted">Reporting Manager</label>
                  <select
                    value={form.managerId}
                    onChange={(e) => setForm({ ...form, managerId: e.target.value })}
                    className="mt-1.5 w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm outline-none focus:border-accent"
                  >
                    <option value="">None (Top Level / Independent)</option>
                    {options.managers.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.fullName} ({m.employeeCode})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-muted">Employment Type</label>
                  <select
                    value={form.employmentType}
                    onChange={(e) => setForm({ ...form, employmentType: e.target.value })}
                    className="mt-1.5 w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm outline-none focus:border-accent"
                  >
                    <option value="FULL_TIME">Full Time</option>
                    <option value="PART_TIME">Part Time</option>
                    <option value="CONTRACT">Contract</option>
                    <option value="INTERN">Intern</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted">Joining Date</label>
                <input
                  required
                  type="date"
                  value={form.joiningDate}
                  onChange={(e) => setForm({ ...form, joiningDate: e.target.value })}
                  className="mt-1.5 w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm outline-none focus:border-accent"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="rounded-xl border border-border px-4 py-2.5 text-sm font-semibold text-muted transition hover:bg-surface-2"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-accent/90 disabled:opacity-50"
                >
                  {actionLoading ? 'Creating Account…' : `Generate ${ROLE_LABELS[form.role] || 'Employee'} ID`}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body,
        )
      )}

      {/* Generated credentials + e-mail status (with Retry) */}
      {newCredentials && (
        <CredentialsDialog
          employeeId={newCredentials.employeeId}
          credentials={newCredentials.credentials}
          email={newCredentials.email}
          onClose={() => setNewCredentials(null)}
        />
      )}
    </div>
  );
}

