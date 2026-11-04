import { createPortal } from 'react-dom';
import { useEffect, useState } from 'react';
import {
  Plane,
  Plus,
  CheckCircle2,
  XCircle,
  Clock3,
  Calendar,
  AlertCircle,
  RefreshCw,
  Filter,
} from 'lucide-react';
import { api } from '../../services/api.js';
import { useAuth } from '../../app/AuthContext.jsx';

export default function LeaveManagement() {
  const { user } = useAuth();
  const [tab, setTab] = useState('my-leaves'); // 'my-leaves' | 'approvals'
  const [balances, setBalances] = useState([]);
  const [leaveTypes, setLeaveTypes] = useState([]);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showApplyModal, setShowApplyModal] = useState(false);

  // Form state
  const [form, setForm] = useState({
    leaveTypeId: '',
    startDate: '',
    endDate: '',
    isHalfDay: false,
    halfDayPart: 'FIRST_HALF',
    reason: '',
  });

  // Super Admin only oversees leave; they do not apply for leave themselves.
  const canApply = user?.role !== 'SUPER_ADMIN';
  const isApproverRole = ['SUPER_ADMIN', 'HR_ADMIN', 'MANAGER'].includes(user?.role);

  async function loadData() {
    setLoading(true);
    setError('');
    try {
      const [balRes, typesRes, reqRes] = await Promise.all([
        api('/leaves/balances').catch(() => ({ balances: [] })),
        api('/leaves/types').catch(() => ({ types: [] })),
        api('/leaves').catch(() => ({ requests: [] })),
      ]);

      setBalances(balRes.balances || []);
      setLeaveTypes(typesRes.types || []);
      setRequests(reqRes.requests || []);
      if (typesRes.types?.length && !form.leaveTypeId) {
        setForm((prev) => ({ ...prev, leaveTypeId: typesRes.types[0].id }));
      }
    } catch (err) {
      setError(err.message || 'Unable to load leave data.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function handleApply(e) {
    e.preventDefault();
    setActionLoading(true);
    setError('');
    setSuccess('');

    try {
      await api('/leaves', {
        method: 'POST',
        body: {
          ...form,
          reason: form.reason.trim(),
        },
      });

      setSuccess('Leave application submitted successfully.');
      setShowApplyModal(false);
      setForm({
        leaveTypeId: leaveTypes[0]?.id || '',
        startDate: '',
        endDate: '',
        isHalfDay: false,
        halfDayPart: 'FIRST_HALF',
        reason: '',
      });
      await loadData();
    } catch (err) {
      setError(err.message || 'Failed to submit leave request.');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleDecision(requestId, status) {
    const comment = prompt(`Enter optional comment for ${status.toLowerCase()}:`) || '';
    setActionLoading(true);
    setError('');
    setSuccess('');

    try {
      await api(`/leaves/${requestId}/decision`, {
        method: 'PATCH',
        body: { status, comment },
      });
      setSuccess(`Request ${status.toLowerCase()} successfully.`);
      await loadData();
    } catch (err) {
      setError(err.message || `Failed to ${status.toLowerCase()} request.`);
    } finally {
      setActionLoading(false);
    }
  }

  const myRequests = requests.filter((r) => r.employeeId === user?.employee?.id);
  const pendingApprovals = requests.filter((r) => r.canApprove);

  const getStatusBadge = (status) => {
    switch (status) {
      case 'APPROVED':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2.5 py-0.5 text-xs font-semibold text-success">
            <CheckCircle2 size={13} /> Approved
          </span>
        );
      case 'REJECTED':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-danger/15 px-2.5 py-0.5 text-xs font-semibold text-danger">
            <XCircle size={13} /> Rejected
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2.5 py-0.5 text-xs font-semibold text-amber-600">
            <Clock3 size={13} /> Pending
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="mb-1.5 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-accent">
            <Plane size={16} />
            <span>Leave Management & Approvals</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Leave Portal</h1>
          <p className="mt-1 text-sm text-muted">Track balances, apply for time off, and manage team approvals.</p>
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
          {canApply && (
            <button
              type="button"
              onClick={() => setShowApplyModal(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-accent/90"
            >
              <Plus size={16} />
              Apply for Leave
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

      {/* Leave Balance Cards */}
      <section aria-label="Leave Balances" className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {balances.map((bal) => (
          <article key={bal.code} className="rounded-2xl border border-border bg-surface p-5 shadow-card">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-muted">{bal.name}</span>
              <span className="rounded-lg bg-accent-soft px-2 py-0.5 text-xs font-semibold text-accent">{bal.isPaid ? 'Paid' : 'Unpaid'}</span>
            </div>
            <div className="mt-4 flex items-baseline gap-2">
              <span className="text-3xl font-extrabold">{bal.available}</span>
              <span className="text-xs text-muted">days remaining</span>
            </div>
            <div className="mt-3 flex items-center justify-between border-t border-border pt-3 text-xs text-muted">
              <span>Annual Quota: <b className="text-text">{bal.allowance}</b></span>
              <span>Used: <b className="text-text">{bal.used}</b></span>
            </div>
          </article>
        ))}
        {balances.length === 0 && !loading && (
          <div className="col-span-3 rounded-2xl border border-border bg-surface p-6 text-center text-sm text-muted">
            No active leave balance configured.
          </div>
        )}
      </section>

      {/* Tabs */}
      <div className="flex border-b border-border">
        <button
          type="button"
          onClick={() => setTab('my-leaves')}
          className={`border-b-2 px-5 py-3 text-sm font-semibold transition ${
            tab === 'my-leaves' ? 'border-accent text-accent' : 'border-transparent text-muted hover:text-text'
          }`}
        >
          My Requests ({myRequests.length})
        </button>
        {isApproverRole && (
          <button
            type="button"
            onClick={() => setTab('approvals')}
            className={`relative border-b-2 px-5 py-3 text-sm font-semibold transition ${
              tab === 'approvals' ? 'border-accent text-accent' : 'border-transparent text-muted hover:text-text'
            }`}
          >
            Team Approvals ({pendingApprovals.length})
            {pendingApprovals.length > 0 && (
              <span className="ml-2 rounded-full bg-accent px-1.5 py-0.5 text-[10px] text-white">
                {pendingApprovals.length}
              </span>
            )}
          </button>
        )}
      </div>

      {/* Tab 1: My Requests */}
      {tab === 'my-leaves' && (
        <section className="rounded-2xl border border-border bg-surface p-5 shadow-card sm:p-6">
          <h2 className="text-base font-bold">My Leave History</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs font-semibold text-muted">
                  <th className="pb-3">Leave Type</th>
                  <th className="pb-3">Period</th>
                  <th className="pb-3">Days</th>
                  <th className="pb-3">Reason</th>
                  <th className="pb-3">Approver</th>
                  <th className="pb-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {myRequests.map((r) => (
                  <tr key={r.id} className="hover:bg-surface-2/40">
                    <td className="py-3.5 font-medium">{r.leaveType}</td>
                    <td className="py-3.5 text-muted">
                      {r.startDate} to {r.endDate}
                      {r.isHalfDay && <span className="ml-2 text-xs text-accent">({r.halfDayPart})</span>}
                    </td>
                    <td className="py-3.5 font-bold">{r.days}</td>
                    <td className="max-w-xs truncate py-3.5 text-muted" title={r.reason || ''}>
                      {r.reason || '—'}
                    </td>
                    <td className="py-3.5 text-muted">{r.approverName || 'HR Admin'}</td>
                    <td className="py-3.5">{getStatusBadge(r.status)}</td>
                  </tr>
                ))}
                {!loading && myRequests.length === 0 && (
                  <tr>
                    <td colSpan="6" className="py-8 text-center text-muted">
                      No leave applications found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Tab 2: Approvals (for Managers & HR Admin) */}
      {tab === 'approvals' && isApproverRole && (
        <section className="rounded-2xl border border-border bg-surface p-5 shadow-card sm:p-6">
          <h2 className="text-base font-bold">Team Requests Needing Action</h2>
          <p className="mt-1 text-xs text-muted">Review leave requests submitted by your team or organization.</p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs font-semibold text-muted">
                  <th className="pb-3">Employee</th>
                  <th className="pb-3">Type</th>
                  <th className="pb-3">Dates</th>
                  <th className="pb-3">Days</th>
                  <th className="pb-3">Reason</th>
                  <th className="pb-3">Status</th>
                  <th className="pb-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {requests.map((r) => (
                  <tr key={r.id} className="hover:bg-surface-2/40">
                    <td className="py-3.5">
                      <div className="font-semibold">{r.employeeName || 'Unknown'}</div>
                      <div className="text-xs text-muted">{r.employeeCode} · {r.department || 'General'}</div>
                    </td>
                    <td className="py-3.5 font-medium">{r.leaveType}</td>
                    <td className="py-3.5 text-muted">
                      {r.startDate} to {r.endDate}
                    </td>
                    <td className="py-3.5 font-bold">{r.days}</td>
                    <td className="max-w-xs truncate py-3.5 text-muted" title={r.reason || ''}>
                      {r.reason || '—'}
                    </td>
                    <td className="py-3.5">{getStatusBadge(r.status)}</td>
                    <td className="py-3.5 text-right">
                      {r.canApprove ? (
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            disabled={actionLoading}
                            onClick={() => handleDecision(r.id, 'APPROVED')}
                            className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-green-700"
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            disabled={actionLoading}
                            onClick={() => handleDecision(r.id, 'REJECTED')}
                            className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-1.5 text-xs font-semibold text-danger transition hover:bg-danger/20"
                          >
                            Reject
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-muted">No action needed</span>
                      )}
                    </td>
                  </tr>
                ))}
                {!loading && requests.length === 0 && (
                  <tr>
                    <td colSpan="7" className="py-8 text-center text-muted">
                      No team leave requests found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Apply Leave Modal */}
      {showApplyModal && (
        createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-border bg-surface p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-border pb-4">
              <h3 className="text-lg font-bold">Apply for Leave</h3>
              <button
                type="button"
                onClick={() => setShowApplyModal(false)}
                className="rounded-lg p-1 text-muted transition hover:bg-surface-2"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleApply} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted">Leave Type</label>
                <select
                  required
                  value={form.leaveTypeId}
                  onChange={(e) => setForm({ ...form, leaveTypeId: e.target.value })}
                  className="mt-1.5 w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm outline-none focus:border-accent"
                >
                  {leaveTypes.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.isPaid ? 'Paid' : 'Unpaid'})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-muted">Start Date</label>
                  <input
                    required
                    type="date"
                    min={new Date().toISOString().slice(0, 10)}
                    value={form.startDate}
                    onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                    className="mt-1.5 w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm outline-none focus:border-accent"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-muted">End Date</label>
                  <input
                    required
                    type="date"
                    min={form.startDate || new Date().toISOString().slice(0, 10)}
                    value={form.endDate}
                    onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                    className="mt-1.5 w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm outline-none focus:border-accent"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="halfDayCheck"
                  checked={form.isHalfDay}
                  onChange={(e) => setForm({ ...form, isHalfDay: e.target.checked })}
                  className="h-4 w-4 rounded border-border text-accent"
                />
                <label htmlFor="halfDayCheck" className="text-sm font-medium">Half Day Application</label>
              </div>

              {form.isHalfDay && (
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-muted">Half Day Session</label>
                  <select
                    value={form.halfDayPart}
                    onChange={(e) => setForm({ ...form, halfDayPart: e.target.value })}
                    className="mt-1.5 w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm outline-none focus:border-accent"
                  >
                    <option value="FIRST_HALF">First Half (Morning)</option>
                    <option value="SECOND_HALF">Second Half (Afternoon)</option>
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted">Reason for Leave</label>
                <textarea
                  required
                  rows={3}
                  value={form.reason}
                  onChange={(e) => setForm({ ...form, reason: e.target.value })}
                  placeholder="Provide a brief explanation for this leave request"
                  className="mt-1.5 w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm outline-none focus:border-accent"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowApplyModal(false)}
                  className="rounded-xl border border-border px-4 py-2.5 text-sm font-semibold text-muted transition hover:bg-surface-2"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-accent/90 disabled:opacity-50"
                >
                  {actionLoading ? 'Submitting…' : 'Submit Leave Request'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body,
        )
      )}
    </div>
  );
}

