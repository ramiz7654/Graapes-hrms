import { createPortal } from 'react-dom';
import { useEffect, useState } from 'react';
import {
  Megaphone,
  Plus,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Calendar,
  Users,
} from 'lucide-react';
import { api } from '../../services/api.js';
import { useAuth } from '../../app/AuthContext.jsx';

export default function AnnouncementsPage() {
  const { user } = useAuth();
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);

  const [form, setForm] = useState({
    title: '',
    body: '',
    audienceType: 'ALL',
  });

  const isAdmin = ['SUPER_ADMIN', 'HR_ADMIN'].includes(user?.role);

  async function loadData() {
    setLoading(true);
    setError('');
    try {
      const res = await api('/announcements');
      setAnnouncements(res.announcements || []);
    } catch (err) {
      setError(err.message || 'Unable to load company announcements.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function handlePublish(e) {
    e.preventDefault();
    setActionLoading(true);
    setError('');
    try {
      await api('/announcements', {
        method: 'POST',
        body: form,
      });
      setSuccess('Announcement published to organization.');
      setShowAddModal(false);
      setForm({ title: '', body: '', audienceType: 'ALL' });
      await loadData();
    } catch (err) {
      setError(err.message || 'Failed to publish announcement.');
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
            <Megaphone size={16} />
            <span>Internal Broadcasts</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Announcements</h1>
          <p className="mt-1 text-sm text-muted">Stay informed with updates, circulars, and policy announcements from HR.</p>
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
              Publish Announcement
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

      {/* Announcement List */}
      <section className="space-y-4">
        {announcements.map((a) => (
          <article
            key={a.id}
            className="rounded-2xl border border-border bg-surface p-5 shadow-card transition hover:border-accent/40 sm:p-6"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent">
                  <Megaphone size={19} />
                </span>
                <div>
                  <h3 className="text-lg font-bold text-text">{a.title}</h3>
                  <div className="mt-1 flex items-center gap-2 text-xs text-muted">
                    <span className="flex items-center gap-1">
                      <Calendar size={13} />
                      {new Date(a.createdAt).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </span>
                    <span>•</span>
                    <span className="rounded-md bg-surface-2 px-2 py-0.5 font-semibold text-text">
                      Audience: {a.audience}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-muted">
              {a.body}
            </div>
          </article>
        ))}
        {!loading && announcements.length === 0 && (
          <div className="rounded-2xl border border-border bg-surface p-8 text-center text-sm text-muted">
            No announcements published yet.
          </div>
        )}
      </section>

      {/* Publish Modal */}
      {showAddModal && (
        createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-border bg-surface p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-border pb-4">
              <h3 className="text-lg font-bold">Publish Announcement</h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="rounded-lg p-1 text-muted transition hover:bg-surface-2"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handlePublish} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted">Title</label>
                <input
                  required
                  type="text"
                  placeholder="e.g. Annual Company Offsite 2026"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="mt-1.5 w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm outline-none focus:border-accent"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted">Target Audience</label>
                <select
                  value={form.audienceType}
                  onChange={(e) => setForm({ ...form, audienceType: e.target.value })}
                  className="mt-1.5 w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm outline-none focus:border-accent"
                >
                  <option value="ALL">All Employees</option>
                  <option value="ROLE">Specific Roles</option>
                  <option value="DEPARTMENT">Specific Department</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted">Message Content</label>
                <textarea
                  required
                  rows={5}
                  placeholder="Write the detailed announcement message here…"
                  value={form.body}
                  onChange={(e) => setForm({ ...form, body: e.target.value })}
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
                  {actionLoading ? 'Publishing…' : 'Publish Broadcast'}
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

