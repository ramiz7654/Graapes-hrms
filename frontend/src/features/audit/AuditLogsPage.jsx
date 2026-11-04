import { useEffect, useState } from 'react';
import {
  ScrollText,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  XCircle,
  ShieldCheck,
  Search,
} from 'lucide-react';
import { api } from '../../services/api.js';

export default function AuditLogsPage() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  async function loadData() {
    setLoading(true);
    setError('');
    try {
      const res = await api('/audit');
      setLogs(res.logs || []);
    } catch (err) {
      setError(err.message || 'Unable to retrieve system audit logs.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const filteredLogs = logs.filter((l) => {
    const q = search.toLowerCase();
    return (
      !q ||
      l.action?.toLowerCase().includes(q) ||
      l.actorEmail?.toLowerCase().includes(q) ||
      l.entityType?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="mb-1.5 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-accent">
            <ScrollText size={16} />
            <span>Governance & Compliance</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Audit Trail</h1>
          <p className="mt-1 text-sm text-muted">Immutable log of security actions, administrative updates, and lifecycle approvals.</p>
        </div>

        <button
          type="button"
          onClick={loadData}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2 text-sm font-semibold transition hover:bg-surface-2"
        >
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {error && (
        <div role="alert" className="flex items-center gap-3 rounded-xl border border-danger/20 bg-danger-soft p-4 text-sm text-danger">
          <AlertCircle size={18} className="shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Search */}
      <div className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-4 shadow-card">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
          <input
            type="text"
            placeholder="Search audit events by action, email, or entity…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-border bg-surface-2/50 py-2 pl-9 pr-3.5 text-sm outline-none transition focus:border-accent"
          />
        </div>
      </div>

      {/* Table */}
      <section className="rounded-2xl border border-border bg-surface p-5 shadow-card sm:p-6">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs font-semibold text-muted">
                <th className="pb-3">Timestamp</th>
                <th className="pb-3">Actor</th>
                <th className="pb-3">Action</th>
                <th className="pb-3">Entity Type</th>
                <th className="pb-3">Outcome</th>
                <th className="pb-3">Details / IP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredLogs.map((log) => (
                <tr key={log.id} className="hover:bg-surface-2/40">
                  <td className="whitespace-nowrap py-3.5 text-xs text-muted">
                    {new Date(log.createdAt).toLocaleString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    })}
                  </td>
                  <td className="py-3.5 font-medium text-text">{log.actorEmail}</td>
                  <td className="py-3.5">
                    <span className="font-mono text-xs font-bold text-accent">{log.action}</span>
                  </td>
                  <td className="py-3.5 text-xs text-muted">{log.entityType}</td>
                  <td className="py-3.5">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
                        log.outcome === 'SUCCESS' ? 'bg-success/15 text-success' : 'bg-danger/15 text-danger'
                      }`}
                    >
                      {log.outcome === 'SUCCESS' ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                      {log.outcome}
                    </span>
                  </td>
                  <td className="max-w-xs truncate py-3.5 text-xs text-muted">
                    {log.comment ? <span>{log.comment} · </span> : null}
                    <span className="font-mono text-[11px]">{log.ip || 'Local'}</span>
                  </td>
                </tr>
              ))}
              {!loading && filteredLogs.length === 0 && (
                <tr>
                  <td colSpan="6" className="py-8 text-center text-muted">
                    No audit records match your query.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

