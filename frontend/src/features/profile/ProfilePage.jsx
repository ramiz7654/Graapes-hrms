import { useEffect, useState } from 'react';
import { Save, UserRound, BriefcaseBusiness, ShieldCheck, RefreshCw } from 'lucide-react';
import { api } from '../../services/api.js';
import { useAuth } from '../../app/AuthContext.jsx';
import ChangePasswordCard from './ChangePasswordCard.jsx';
import PhoneInput, { sanitizeMobile } from '../../components/PhoneInput.jsx';

const emptyForm = {
  fullName: '', mobile: '', personalAddress: '', dateOfBirth: '', workLocation: '',
  emergencyName: '', emergencyRelation: '', emergencyPhone: '',
};
const asDate = (value) => value ? new Date(value).toISOString().slice(0, 10) : '';
const displayDate = (value) => value ? new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }) : 'Not added';
const roleLabel = (role) => String(role || '').replaceAll('_', ' ');

function Field({ label, name, value, onChange, type = 'text', placeholder = '', readOnly = false, wide = false }) {
  return <label className={`block ${wide ? 'sm:col-span-2' : ''}`}>
    <span className="mb-1.5 block text-sm font-medium">{label}</span>
    <input name={name} type={type} value={value ?? ''} onChange={onChange} placeholder={placeholder} readOnly={readOnly}
      className={`w-full rounded-xl border border-border px-3.5 py-2.5 text-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20 ${readOnly ? 'bg-surface-2 text-muted' : 'bg-surface text-text'}`} />
  </label>;
}

function Info({ label, value }) {
  return <div className="rounded-xl border border-border bg-surface-2/60 p-3.5">
    <p className="text-xs font-medium text-muted">{label}</p>
    <p className="mt-1.5 break-words text-sm font-semibold">{value || 'Not added'}</p>
  </div>;
}

export default function ProfilePage() {
  const { refreshUser } = useAuth();
  const [profile, setProfile] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [locations, setLocations] = useState([]);

  async function loadProfile() {
    setLoading(true); setError('');
    try {
      api('/organization/options').then((res) => setLocations(res.locations || [])).catch(() => setLocations([]));
      const { profile: data } = await api('/auth/profile');
      setProfile(data);
      setForm({
        fullName: data.employee?.fullName || data.fullName || '',
        mobile: sanitizeMobile(data.employee?.mobile),
        personalAddress: data.employee?.personalAddress || '',
        dateOfBirth: asDate(data.employee?.dateOfBirth),
        workLocation: data.employee?.workLocation || '',
        emergencyName: data.employee?.emergencyName || '',
        emergencyRelation: data.employee?.emergencyRelation || '',
        emergencyPhone: data.employee?.emergencyPhone || '',
      });
    } catch (e) { setError(e?.message || 'Profile load nahi ho paya.'); }
    finally { setLoading(false); }
  }

  useEffect(() => { loadProfile(); }, []);
  const onChange = (event) => { setForm((current) => ({ ...current, [event.target.name]: event.target.value })); setSuccess(''); };

  async function onSubmit(event) {
    event.preventDefault(); setSaving(true); setError(''); setSuccess('');
    try {
      const payload = Object.fromEntries(Object.entries(form).map(([key, value]) => [key, value.trim() || null]));
      const result = await api('/auth/profile', { method: 'PUT', body: payload });
      setProfile(result.profile);
      // Re-read the signed-in user from the server so the greeting card shows the saved name immediately.
      await refreshUser();
      setSuccess(result.message || 'Profile updated successfully.');
    } catch (e) { setError(e?.message || 'Profile save nahi ho paya.'); }
    finally { setSaving(false); }
  }

  if (loading) return <div className="rounded-2xl border border-border bg-surface p-8 text-sm text-muted">Loading your profile…</div>;
  if (!profile) return <section className="rounded-2xl border border-border bg-surface p-6"><p role="alert" className="text-sm text-danger">{error || 'Profile unavailable.'}</p><button type="button" onClick={loadProfile} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white"><RefreshCw size={16}/> Try again</button></section>;

  const employee = profile.employee;
  const isSuperAdmin = String(profile.role || '').toUpperCase() === 'SUPER_ADMIN';
  return <div className="w-full min-w-0 space-y-6">
    <form onSubmit={onSubmit} className="space-y-6 rounded-2xl border border-border bg-surface p-5 sm:p-7">
      <div className="flex min-w-0 flex-wrap items-center gap-4 border-b border-border pb-5"><div className="grid h-14 w-14 place-items-center rounded-2xl bg-accent-soft text-accent"><UserRound size={26}/></div><div className="min-w-0 flex-1"><p className="text-xs font-bold uppercase tracking-wider text-accent">Account settings · {roleLabel(profile.role)}</p><h2 className="mt-1 text-xl font-bold">My Profile</h2><p className="profile-email mt-1 text-sm text-muted">{profile.email}</p></div>{!isSuperAdmin && <div className="grid gap-2 text-xs text-muted sm:text-right"><span>Employee ID: <b className="text-text">{employee?.employeeCode || 'Not assigned'}</b></span><span>Department: <b className="text-text">{employee?.department || 'Not assigned'}</b></span><span>Designation: <b className="text-text">{employee?.designation || 'Not assigned'}</b></span></div>}</div><div><h3 className="text-lg font-bold">Personal details</h3><p className="mt-1 text-sm text-muted">Update your personal information below.{!isSuperAdmin && ' Work email and Employee ID are managed by HR.'}</p></div>
      {error && <p role="alert" className="rounded-xl bg-danger-soft p-3 text-sm text-danger">{error}</p>}
      {success && <p role="status" className="rounded-xl border border-green-500/30 bg-green-500/10 p-3 text-sm text-green-700">{success}</p>}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Full name" name="fullName" value={form.fullName} onChange={onChange} placeholder="Enter full name" />
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">Mobile number</span>
          <PhoneInput className="" value={form.mobile} onChange={(mobile) => { setForm((current) => ({ ...current, mobile })); setSuccess(''); }} />
        </label>
        <Field label="Date of birth" name="dateOfBirth" type="date" value={form.dateOfBirth} onChange={onChange} />
        {employee?.id && (
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">Work location</span>
            <select name="workLocation" value={form.workLocation} onChange={onChange}
              className="w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm text-text outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20">
              {!locations.some((l) => l.name === form.workLocation) && <option value={form.workLocation}>{form.workLocation || 'Select location'}</option>}
              {locations.map((l) => <option key={l.id} value={l.name}>{l.name}{l.city || l.state ? ` (${[l.city, l.state].filter(Boolean).join(', ')})` : ''}</option>)}
            </select>
          </label>
        )}
        <Field label="Personal address" name="personalAddress" value={form.personalAddress} onChange={onChange} placeholder="Enter your address" wide />
      </div>
      {employee?.id && <div className="border-t border-border pt-5">
        <div className="mb-4 flex items-center gap-3"><div className="rounded-xl bg-accent-soft p-2 text-accent"><ShieldCheck size={20}/></div><div><h3 className="text-base font-bold">Emergency contact</h3><p className="mt-1 text-sm text-muted">Keep these details current for emergencies.</p></div></div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Contact name" name="emergencyName" value={form.emergencyName} onChange={onChange} placeholder="Full name" />
          <Field label="Relationship" name="emergencyRelation" value={form.emergencyRelation} onChange={onChange} placeholder="e.g. Parent" />
          <Field label="Contact phone" name="emergencyPhone" value={form.emergencyPhone} onChange={onChange} placeholder="Phone number" />
        </div>
      </div>}
      <div className="flex flex-wrap justify-end gap-3 border-t border-border pt-5">
        <button type="button" onClick={() => loadProfile()} className="rounded-xl border border-border px-4 py-2.5 text-sm font-semibold hover:bg-surface-2">Discard changes</button>
        <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"><Save size={17}/>{saving ? 'Saving…' : 'Save profile'}</button>
      </div>
    </form>
    <ChangePasswordCard />
  </div>;
}
