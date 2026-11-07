import { createPortal } from 'react-dom';
import { useEffect, useState } from 'react';
import {
  CalendarDays,
  Plus,
  Trash2,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  MapPin,
  Calendar,
} from 'lucide-react';
import { api } from '../../services/api.js';
import { useAuth } from '../../app/AuthContext.jsx';
import { useConfirm } from '../../components/ConfirmDialog.jsx';

export default function HolidaysPage() {
  const { user } = useAuth();
  const [holidays, setHolidays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [locations, setLocations] = useState([]);
  const { confirm, confirmDialog } = useConfirm();

  const [form, setForm] = useState({
    name: '',
    date: '',
    location: 'All Locations',
  });

  const isAdmin = ['SUPER_ADMIN', 'HR_ADMIN'].includes(user?.role);

  async function loadData() {
    setLoading(true);
    setError('');
    try {
      const res = await api('/holidays');
      setHolidays(res.holidays || []);
      if (isAdmin) {
        const opts = await api('/organization/options').catch(() => ({ locations: [] }));
        setLocations(opts.locations || []);
      }
    } catch (err) {
      setError(err.message || 'Unable to load company holidays.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function handleAddHoliday(e) {
    e.preventDefault();
    setActionLoading(true);
    setError('');
    try {
      await api('/holidays', {
        method: 'POST',
        body: form,
      });
      setSuccess('Holiday published successfully.');
      setShowAddModal(false);
      setForm({ name: '', date: '', location: 'All Locations' });
      await loadData();
    } catch (err) {
      setError(err.message || 'Failed to create holiday.');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleDelete(id) {
    const ok = await confirm({ title: 'Delete holiday', message: 'Are you sure you want to delete this holiday? It will disappear from every employee\'s calendar.', confirmLabel: 'Yes, Delete', danger: true });
    if (!ok) return;
    setActionLoading(true);
    try {
      await api(`/holidays/${id}`, { method: 'DELETE' });
      setSuccess('Holiday removed.');
      await loadData();
    } catch (err) {
      setError(err.message || 'Failed to delete holiday.');
    } finally {
      setActionLoading(false);
    }
  }

  const todayStr = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-6">
      {confirmDialog}
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="mb-1.5 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-accent">
            <CalendarDays size={16} />
            <span>Company Calendar</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Holiday Calendar</h1>
          <p className="mt-1 text-sm text-muted">Official list of recognized holidays and company non-working days.</p>
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
              onClick={() => setShowAddModal(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-accent/90"
            >
              <Plus size={16} />
              Add Holiday
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

      {/* Holiday Cards */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {holidays.map((h) => {
          const isUpcoming = h.date >= todayStr;
          const dateObj = new Date(h.date + 'T00:00:00Z');

          return (
            <article
              key={h.id}
              className={`relative rounded-2xl border bg-surface p-5 shadow-card transition ${
                isUpcoming ? 'border-accent/40 shadow-sm' : 'border-border opacity-75'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="rounded-xl bg-accent-soft p-2.5 text-accent">
                  <Calendar size={20} />
                </div>
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => handleDelete(h.id)}
                    className="rounded-lg p-1 text-muted transition hover:bg-danger-soft hover:text-danger"
                    title="Delete holiday"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>

              <h3 className="mt-3 text-lg font-bold">{h.name}</h3>

              <div className="mt-2 text-sm font-semibold text-text">
                {dateObj.toLocaleDateString('en-IN', {
                  weekday: 'short',
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                  timeZone: 'UTC',
                })}
              </div>

              <div className="mt-3 flex items-center justify-between border-t border-border pt-3 text-xs text-muted">
                <span className="flex items-center gap-1">
                  <MapPin size={13} />
                  {h.location || 'All Locations'}
                </span>
                <span className={`font-semibold ${isUpcoming ? 'text-accent' : 'text-muted'}`}>
                  {isUpcoming ? 'Upcoming' : 'Past'}
                </span>
              </div>
            </article>
          );
        })}
        {!loading && holidays.length === 0 && (
          <div className="col-span-full rounded-2xl border border-border bg-surface p-8 text-center text-sm text-muted">
            No holidays published yet.
          </div>
        )}
      </section>

      {/* Add Holiday Modal */}
      {showAddModal && (
        createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-border pb-4">
              <h3 className="text-lg font-bold">Add Company Holiday</h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="rounded-lg p-1 text-muted transition hover:bg-surface-2"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleAddHoliday} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted">Holiday Name</label>
                <input
                  required
                  type="text"
                  placeholder="e.g. Republic Day"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="mt-1.5 w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm outline-none focus:border-accent"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted">Date</label>
                <input
                  required
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                  className="mt-1.5 w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm outline-none focus:border-accent"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted">Location / Branch</label>
                <select
                  value={form.location}
                  onChange={(e) => setForm({ ...form, location: e.target.value })}
                  className="mt-1.5 w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm outline-none focus:border-accent"
                >
                  <option value="All Locations">All Locations</option>
                  {locations.map((l) => (
                    <option key={l.id} value={l.name}>
                      {l.name}{l.city || l.state ? ` (${[l.city, l.state].filter(Boolean).join(', ')})` : ''}
                    </option>
                  ))}
                </select>
                <p className="mt-1.5 text-xs text-muted">Pick one location to make this a holiday only for employees working there.</p>
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
                  {actionLoading ? 'Saving…' : 'Publish Holiday'}
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

