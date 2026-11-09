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
  Trash2,
} from 'lucide-react';
import { api } from '../../services/api.js';
import { useAuth } from '../../app/AuthContext.jsx';
import { useConfirm } from '../../components/ConfirmDialog.jsx';

const ALLOWED_EXTENSIONS = ['pdf', 'png', 'jpg', 'jpeg', 'doc', 'docx'];
const MAX_FILE_BYTES = 5 * 1024 * 1024;

export default function DocumentsPage() {
  const { user } = useAuth();
  const { confirm, confirmDialog } = useConfirm();
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);

  const [form, setForm] = useState({
    title: '',
    file: null,
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

  function pickFile(event) {
    const file = event.target.files?.[0] || null;
    setError('');
    if (file) {
      const ext = file.name.includes('.') ? file.name.split('.').pop().toLowerCase() : '';
      if (!ALLOWED_EXTENSIONS.includes(ext)) {
        setError('Only PDF, JPG, PNG, DOC and DOCX files are allowed.');
        event.target.value = '';
        return;
      }
      if (file.size > MAX_FILE_BYTES) {
        setError('The file is larger than 5 MB. Choose a smaller file.');
        event.target.value = '';
        return;
      }
    }
    setForm((current) => ({ ...current, file, title: current.title || (file ? file.name.replace(/\.[^.]+$/, '') : '') }));
  }

  function readAsBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
      reader.onerror = () => reject(new Error('Could not read the selected file.'));
      reader.readAsDataURL(file);
    });
  }

  async function downloadDocument(doc) {
    setError('');
    try {
      const res = await fetch(`/api/documents/${doc.id}/download`, { credentials: 'include' });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error?.message || 'Could not download the document.');
      }
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

  async function deleteDocument(doc) {
    const ok = await confirm({ title: 'Delete document', message: `Delete "${doc.title}"? The uploaded file will be removed permanently.`, confirmLabel: 'Yes, Delete', danger: true });
    if (!ok) return;
    setError('');
    setSuccess('');
    try {
      await api(`/documents/${doc.id}`, { method: 'DELETE' });
      setSuccess('Document deleted.');
      await loadData();
    } catch (err) {
      setError(err.message || 'Could not delete the document.');
    }
  }

  async function handleAddDocument(e) {
    e.preventDefault();
    if (!form.file) {
      setError('Choose a file to upload.');
      return;
    }
    setActionLoading(true);
    setError('');
    try {
      const dataBase64 = await readAsBase64(form.file);
      await api('/documents', {
        method: 'POST',
        body: { title: form.title, category: form.category, fileName: form.file.name, dataBase64 },
      });
      setSuccess('Document uploaded successfully.');
      setShowAddModal(false);
      setForm({ title: '', file: null, category: 'ID_PROOF' });
      await loadData();
    } catch (err) {
      setError(err.message || 'Failed to upload the document.');
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
                <th className="pb-3 text-right">Action</th>
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
                  <td className="py-3.5 font-mono text-xs">
                    <button type="button" onClick={() => downloadDocument(d)} title="Download" className="text-left text-accent underline-offset-2 hover:underline">{d.fileName}</button>
                  </td>
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
                  <td className="py-3.5 text-right">
                    {d.canDelete && (
                      <button type="button" onClick={() => deleteDocument(d)} title="Delete document" aria-label={`Delete ${d.title}`} className="inline-flex items-center gap-1.5 rounded-lg border border-danger/30 px-2.5 py-1.5 text-xs font-semibold text-danger transition hover:bg-danger-soft">
                        <Trash2 size={14} /> Delete
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {!loading && documents.length === 0 && (
                <tr>
                  <td colSpan="6" className="py-8 text-center text-muted">
                    No documents uploaded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {confirmDialog}

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
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted">File</label>
                <input
                  required
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
                  onChange={pickFile}
                  className="mt-1.5 w-full cursor-pointer rounded-xl border border-border bg-surface px-3.5 py-2 text-sm file:mr-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-accent-soft file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-accent"
                />
                <p className="mt-1.5 text-xs text-muted">
                  {form.file ? `${form.file.name} · ${(form.file.size / 1024).toFixed(0)} KB` : 'PDF, JPG, PNG, DOC or DOCX · up to 5 MB'}
                </p>
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
                  {actionLoading ? 'Uploading…' : 'Upload Document'}
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

