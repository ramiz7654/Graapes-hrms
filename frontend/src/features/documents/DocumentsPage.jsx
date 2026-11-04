import { createPortal } from 'react-dom';
import { useEffect, useState } from 'react';
import {
  FolderLock,
  Plus,
  FileText,
  Upload,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Calendar,
} from 'lucide-react';
import { api } from '../../services/api.js';
import { useAuth } from '../../app/AuthContext.jsx';

export default function DocumentsPage() {
  const { user } = useAuth();
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);

  const [form, setForm] = useState({
    title: '',
    fileName: '',
    category: 'ID_PROOF',
  });

  async function loadData() {
    setLoading(true);
    setError('');
    try {
      const res = await api('/documents');
      setDocuments(res.documents || []);
    } catch (err) {
      setError(err.message || 'Unable to load documents repository.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function handleAddDocument(e) {
    e.preventDefault();
    setActionLoading(true);
    setError('');
    try {
      await api('/documents', {
        method: 'POST',
        body: form,
      });
      setSuccess('Document record registered successfully.');
      setShowAddModal(false);
      setForm({ title: '', fileName: '', category: 'ID_PROOF' });
      await loadData();
    } catch (err) {
      setError(err.message || 'Failed to add document record.');
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
            <FolderLock size={16} />
            <span>Document Repository</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Employee Documents</h1>
          <p className="mt-1 text-sm text-muted">Securely manage identity verification, certificates, and compliance paperwork.</p>
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
          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-accent/90"
          >
            <Upload size={16} />
            Add Document Record
          </button>
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

      {/* Documents Grid / Table */}
      <section className="rounded-2xl border border-border bg-surface p-5 shadow-card sm:p-6">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs font-semibold text-muted">
                <th className="pb-3">Document Title</th>
                <th className="pb-3">Category</th>
                <th className="pb-3">File Reference</th>
                <th className="pb-3">Uploaded Date</th>
                <th className="pb-3">Access Level</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {documents.map((d) => (
                <tr key={d.id} className="hover:bg-surface-2/40">
                  <td className="py-3.5">
                    <div className="flex items-center gap-3">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent">
                        <FileText size={18} />
                      </span>
                      <div>
                        <div className="font-semibold text-text">{d.title}</div>
                        {d.employeeName && (
                          <div className="text-xs text-muted">
                            {d.employeeName} ({d.employeeCode})
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="py-3.5">
                    <span className="rounded-lg bg-surface-2 px-2.5 py-1 text-xs font-semibold text-text">
                      {d.category.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="py-3.5 font-mono text-xs text-muted">{d.fileName}</td>
                  <td className="py-3.5 text-xs text-muted">
                    {new Date(d.createdAt).toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </td>
                  <td className="py-3.5">
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-success">
                      <CheckCircle2 size={12} /> Confidential
                    </span>
                  </td>
                </tr>
              ))}
              {!loading && documents.length === 0 && (
                <tr>
                  <td colSpan="5" className="py-8 text-center text-muted">
                    No documents uploaded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Add Document Modal */}
      {showAddModal && (
        createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-border pb-4">
              <h3 className="text-lg font-bold">Add Document Record</h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="rounded-lg p-1 text-muted transition hover:bg-surface-2"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleAddDocument} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted">Document Title</label>
                <input
                  required
                  type="text"
                  placeholder="e.g. Aadhaar Card / ID Proof"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="mt-1.5 w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm outline-none focus:border-accent"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted">Category</label>
                <select
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className="mt-1.5 w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm outline-none focus:border-accent"
                >
                  <option value="ID_PROOF">ID Proof (Passport, Aadhaar)</option>
                  <option value="ADDRESS_PROOF">Address Proof</option>
                  <option value="RESUME">Resume / CV</option>
                  <option value="SIGNED_LETTER">Signed Letter / Agreement</option>
                  <option value="CERTIFICATE">Degree / Skill Certificate</option>
                  <option value="OTHER">Other Compliance Document</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted">File Name</label>
                <input
                  required
                  type="text"
                  placeholder="e.g. aadhaar_copy.pdf"
                  value={form.fileName}
                  onChange={(e) => setForm({ ...form, fileName: e.target.value })}
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
                  {actionLoading ? 'Saving…' : 'Record Document'}
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

