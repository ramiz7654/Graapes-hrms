import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, RefreshCw, XCircle } from 'lucide-react';
import { api, ApiError } from '../../services/api.js';
import { useLayout } from '../../app/LayoutProvider.jsx';

function Row({ label, value, ok }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border py-3 last:border-0">
      <span className="text-sm text-muted">{label}</span>
      <span className={`flex items-center gap-1.5 text-sm font-semibold ${ok === false ? 'text-danger' : ok ? 'text-success' : ''}`}>
        {ok === true && <CheckCircle2 size={16} aria-hidden="true" />}
        {ok === false && <XCircle size={16} aria-hidden="true" />}
        {value}
      </span>
    </div>
  );
}

export default function StatusPage() {
  const { layout, preference, isMobileDevice } = useLayout();
  const [state, setState] = useState({ loading: true, data: null, error: null });

  const load = useCallback(async () => {
    setState({ loading: true, data: null, error: null });
    try {
      setState({ loading: false, data: await api('/health'), error: null });
    } catch (e) {
      // A 503 body from /health still describes the situation (db down).
      if (e instanceof ApiError && e.details?.status) setState({ loading: false, data: e.details, error: null });
      else setState({ loading: false, data: null, error: e.message });
    }
  }, []);

  useEffect(() => {
    // Initial fetch on mount; load() sets state asynchronously.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const { loading, data, error } = state;
  return (
    <div className="mx-auto max-w-xl">
      <h1 className="text-2xl font-bold">System status</h1>
      <p className="mt-1 text-sm text-muted">Live check of the API and database, plus how this device is being detected.</p>

      <section className="mt-6 rounded-2xl border border-border bg-surface p-5 shadow-card" aria-live="polite">
        {loading && <p className="text-sm text-muted">Checking…</p>}
        {error && (
          <div role="alert" className="rounded-xl bg-danger-soft p-4 text-sm text-danger">
            {error}
          </div>
        )}
        {data && (
          <>
            <Row label="API" value={data.status === 'ok' ? 'Running' : 'Degraded'} ok={data.status === 'ok'} />
            <Row label="Database" value={data.db === 'up' ? 'Connected' : 'Unreachable'} ok={data.db === 'up'} />
            <Row label="Server time" value={new Date(data.time).toLocaleString()} />
          </>
        )}
        <button
          onClick={load}
          disabled={loading}
          className="mt-4 inline-flex h-11 items-center gap-2 rounded-xl bg-accent px-4 text-sm font-semibold text-accent-fg transition-colors hover:bg-accent-hover disabled:opacity-50"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} aria-hidden="true" />
          Re-check
        </button>
      </section>

      <section className="mt-4 rounded-2xl border border-border bg-surface p-5 shadow-card">
        <h2 className="text-sm font-semibold">This device</h2>
        <Row label="Layout in use" value={layout} />
        <Row label="Layout preference" value={preference} />
        <Row label="Detected as mobile device" value={isMobileDevice ? 'Yes' : 'No'} />
      </section>
    </div>
  );
}
