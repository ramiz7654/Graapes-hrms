import { createPortal } from 'react-dom';
import { useEffect, useMemo, useState } from 'react';
import {
  CalendarDays, ChevronLeft, ChevronRight, Clock3,
  CheckCircle2, LogIn, LogOut, CalendarCheck,
  AlertCircle, RefreshCw, Plus, X, Clock, Check, FileEdit, MessageSquare
} from 'lucide-react';
import './MyAttendance.css';
import { api } from '../../services/api.js';
import { useAuth } from '../../app/AuthContext.jsx';

const API = '/api/attendance';

function formatDate(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

function formatTime(value) {
  if (!value) return '—';

  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? String(value)
    : date.toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
      });
}

function minutesBetween(start, end) {
  if (!start || !end) return 0;
  return Math.max(0, Math.floor(
    (new Date(end).getTime() - new Date(start).getTime()) / 60000
  ));
}

function durationLabel(minutes) {
  if (!minutes) return '—';
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

function statusLabel(record) {
  if (!record) return 'No record';
  const raw = String(record.status || '').toUpperCase();
  if (raw === 'PRESENT') return record.checkIn && !record.checkOut ? 'In Progress' : 'Present';
  if (raw === 'LATE') return record.checkIn && !record.checkOut ? 'In Progress' : 'Late';
  if (raw === 'ABSENT') return 'Absent';
  if (raw === 'HOLIDAY') return 'Holiday';
  if (raw === 'LEAVE' || raw === 'ON_LEAVE') return 'Leave';
  if (raw === 'MISSING_PUNCH') return 'Missing Punch';
  if (record.checkOut) return 'Present';
  if (record.checkIn) return 'In Progress';
  return 'No record';
}

function normalizeRecord(record) {
  return {
    ...record,
    date: record.date
      ? String(record.date).slice(0, 10)
      : record.checkIn
        ? formatDate(new Date(record.checkIn))
        : '',
    checkIn: record.checkIn ?? record.checkInAt ?? record.firstIn ?? null,
    checkOut: record.checkOut ?? record.checkOutAt ?? record.lastOut ?? null,
    status: ({
      PRESENT: 'Present',
      LATE: 'Late',
      ABSENT: 'Absent',
      HOLIDAY: 'Holiday',
      LEAVE: 'Leave',
      ON_LEAVE: 'Leave',
      MISSING_PUNCH: 'Missing Punch',
    })[String(record.status || '').toUpperCase()] || record.status || (record.lastOut ? 'Present' : record.firstIn ? 'In Progress' : 'No record'),
  };
}

export default function MyAttendance() {
  const { user } = useAuth();
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const [records, setRecords] = useState([]);
  const [selectedDate, setSelectedDate] = useState(() => formatDate(new Date()));
  const [teamDateRecords, setTeamDateRecords] = useState([]);
  const [teamDateLoading, setTeamDateLoading] = useState(false);
  const [todayRecord, setTodayRecord] = useState(null);
  const [corrections, setCorrections] = useState([]);
  const [holidays, setHolidays] = useState([]);
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [clockNow, setClockNow] = useState(() => Date.now());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [filter, setFilter] = useState('All');
  const [activeHistoryTab, setActiveHistoryTab] = useState('history'); // 'history' | 'corrections'

  // Correction Modal & State
  const [showCorrectionModal, setShowCorrectionModal] = useState(false);
  const [correctionError, setCorrectionError] = useState('');
  const [correctionForm, setCorrectionForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    requestedIn: '09:30',
    requestedOut: '18:30',
    reason: '',
  });

  // Decision Modal
  const [decisionModal, setDecisionModal] = useState({
    open: false,
    correctionId: null,
    action: 'APPROVED',
    comment: '',
  });

  const today = formatDate(new Date());
  const monthName = month.toLocaleDateString('en-IN', {
    month: 'long',
    year: 'numeric',
  });

  const isManagerOrAdmin = ['SUPER_ADMIN', 'HR_ADMIN', 'MANAGER'].includes(user?.role);
  const isSuperAdmin = String(user?.role || '').toUpperCase() === 'SUPER_ADMIN';
  const isHrAdmin = String(user?.role || '').toUpperCase() === 'HR_ADMIN';

  async function loadAttendance() {
    setLoading(true);
    setError('');

    try {
      const params = new URLSearchParams({
        month: String(month.getMonth() + 1),
        year: String(month.getFullYear()),
      });
      // The My Attendance calendar and punch cards always represent the signed-in
      // person's own record, including HR and Manager accounts.
      if (user?.employeeId) params.set('employeeId', user.employeeId);
      const response = await fetch(`${API}?${params.toString()}`, { credentials: 'include' });

      if (!response.ok) {
        throw new Error(
          response.status === 401
            ? 'Session expired. Please log in again.'
            : `Attendance could not be loaded (${response.status}).`
        );
      }

      const result = await response.json();
      const data = Array.isArray(result)
        ? result
        : result.records ?? result.data ?? [];

      const normalized = data.map(normalizeRecord);
      setRecords(normalized);

      const todayResponse = normalized.find((item) => item.date === today);
      setTodayRecord(todayResponse ?? null);
    } catch (err) {
      setRecords([]);
      setTodayRecord(null);
      setError(err.message || 'Unable to load attendance.');
    } finally {
      setLoading(false);
    }
  }

  async function loadCorrections() {
    try {
      const res = await api('/attendance/corrections');
      setCorrections(res.corrections || []);
    } catch {
      setCorrections([]);
    }
  }

  useEffect(() => {
    if (!isSuperAdmin && !isHrAdmin) return undefined;

    // Clear the previous date immediately so records from two dates never mix.
    setTeamDateRecords([]);
    setTeamDateLoading(true);
    let cancelled = false;

    api(`/attendance/team-date?date=${encodeURIComponent(selectedDate)}`)
      .then((data) => {
        if (cancelled) return;
        // Keep only rows returned for the currently selected date.
        const rows = Array.isArray(data.records) ? data.records : [];
        setTeamDateRecords(rows.filter((record) => String(record.date || '').slice(0, 10) === selectedDate));
      })
      .catch(() => {
        if (!cancelled) setTeamDateRecords([]);
      })
      .finally(() => {
        if (!cancelled) setTeamDateLoading(false);
      });

    return () => { cancelled = true; };
  }, [selectedDate, isSuperAdmin, isHrAdmin]);

  useEffect(() => {
    loadAttendance();
    loadCorrections();
    Promise.all([
      api('/holidays').then((result) => setHolidays((result.holidays || []).filter((holiday) => holiday.isPublished))).catch(() => setHolidays([])),
      api('/leaves?scope=own').then((result) => setLeaveRequests(result.requests || [])).catch(() => setLeaveRequests([])),
    ]);
    // Reload when the displayed month or signed-in account changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month, user?.employeeId]);

  useEffect(() => {
    const timer = window.setInterval(() => setClockNow(Date.now()), 30000);
    return () => window.clearInterval(timer);
  }, []);

  const summary = useMemo(() => {
    const currentMonthRecords = records.filter(
      (record) => record.date?.startsWith(
        `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}`
      )
    );

    const present = currentMonthRecords.filter((record) =>
      ['present', 'late', 'in progress', 'checked in'].includes(
        statusLabel(record).toLowerCase()
      )
    ).length;

    const absent = currentMonthRecords.filter(
      (record) => statusLabel(record).toLowerCase() === 'absent'
    ).length;

    const late = currentMonthRecords.filter(
      (record) => statusLabel(record).toLowerCase() === 'late'
    ).length;

    const minutes = currentMonthRecords.reduce((total, record) => {
      const recordedMinutes = Number(record.workingMinutes);
      return total + (
        Number.isFinite(recordedMinutes) && recordedMinutes > 0
          ? recordedMinutes
          : minutesBetween(record.checkIn, record.checkOut)
      );
    }, 0);

    return { present, absent, late, minutes };
  }, [records, month]);

  async function punch(action) {
    setActionLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch(`${API}/${action}`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body?.error?.message || body.message || `Unable to ${action.replace('-', ' ')}.`);
      }

      setSuccess(`Successfully ${action === 'check-in' ? 'checked in' : 'checked out'}.`);
      await loadAttendance();
    } catch (err) {
      setError(
        `${err.message} Check that the backend supports POST ${API}/${action}.`
      );
    } finally {
      setActionLoading(false);
    }
  }

  async function handleRequestCorrection(e) {
    e.preventDefault();
    setActionLoading(true);
    setCorrectionError('');
    setError('');

    try {
      await api('/attendance/corrections', {
        method: 'POST',
        body: {
          date: correctionForm.date,
          requestedIn: correctionForm.requestedIn,
          requestedOut: correctionForm.requestedOut,
          reason: correctionForm.reason.trim(),
        },
      });

      setShowCorrectionModal(false);
      setSuccess('Attendance correction request submitted for approval.');
      setCorrectionForm({
        date: new Date().toISOString().slice(0, 10),
        requestedIn: '09:30',
        requestedOut: '18:30',
        reason: '',
      });
      await Promise.all([loadAttendance(), loadCorrections()]);
      setActiveHistoryTab('corrections');
    } catch (err) {
      setCorrectionError(err.message || 'Unable to submit correction request.');
    } finally {
      setActionLoading(false);
    }
  }

  async function submitDecision(id, status, decisionComment) {
    setActionLoading(true);
    setError('');
    setSuccess('');

    try {
      await api(`/attendance/corrections/${id}/decision`, {
        method: 'PATCH',
        body: { status, decisionComment },
      });

      setDecisionModal({ open: false, correctionId: null, action: 'APPROVED', comment: '' });
      setSuccess(`Correction request ${status.toLowerCase()} successfully.`);
      await Promise.all([loadAttendance(), loadCorrections()]);
    } catch (err) {
      setError(err.message || 'Failed to update correction decision.');
    } finally {
      setActionLoading(false);
    }
  }

  const firstWeekday = new Date(
    month.getFullYear(), month.getMonth(), 1
  ).getDay();

  const daysInMonth = new Date(
    month.getFullYear(), month.getMonth() + 1, 0
  ).getDate();

  const calendarCells = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const recordByDate = Object.fromEntries(
    records.map((record) => [record.date, record])
  );

  const filteredRecords = records.filter((record) => {
    if (filter === 'All') return true;
    return statusLabel(record).toLowerCase() === filter.toLowerCase();
  });

  const checkedIn = Boolean(todayRecord?.checkIn);
  const checkedOut = Boolean(todayRecord?.checkOut);
  const canCheckIn = !checkedIn;
  const canCheckOut = checkedIn && !checkedOut;

  const pendingCorrectionsCount = corrections.filter((c) => c.status === 'PENDING').length;

  function moveMonth(offset) {
    setMonth((current) => new Date(
      current.getFullYear(), current.getMonth() + offset, 1
    ));
  }

  return (
    <main className="my-attendance">
      <header className="attendance-heading">
        <div>
          <h1><CalendarCheck size={25} /> {isSuperAdmin ? 'Organization Attendance' : 'My Attendance'}</h1>
          <p>{isSuperAdmin ? 'Select a date to review organization-wide attendance' : 'Track your attendance, check-in records and correction requests'}</p>
        </div>

        <div className={`month-picker ${isSuperAdmin ? 'hidden' : ''}`}>
          <CalendarDays size={18} />
          <span>{monthName}</span>
          <button aria-label="Previous month" onClick={() => moveMonth(-1)}>
            <ChevronLeft size={18} />
          </button>
          <button aria-label="Next month" onClick={() => moveMonth(1)}>
            <ChevronRight size={18} />
          </button>
        </div>
      </header>

      {error && (
        <div className="attendance-error" role="alert">
          <AlertCircle size={19} />
          <span>{error}</span>
          <button onClick={() => { loadAttendance(); loadCorrections(); }}>
            <RefreshCw size={16} /> Retry
          </button>
        </div>
      )}

      {success && (
        <div className="mb-4 flex items-center justify-between rounded-xl border border-green-500/30 bg-green-500/10 p-4 text-xs font-medium text-green-700 dark:text-green-300">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} />
            <span>{success}</span>
          </div>
          <button type="button" onClick={() => setSuccess('')} className="p-1 hover:opacity-75">
            ✕
          </button>
        </div>
      )}

      {!isSuperAdmin && <section className="attendance-summary">
        <article className="summary-card present">
          <span className="summary-icon"><CheckCircle2 /></span>
          <div>
            <p>Present Days</p>
            <strong>{loading ? '—' : summary.present}</strong>
            <small>From loaded records</small>
          </div>
        </article>

        <article className="summary-card absent">
          <span className="summary-icon"><AlertCircle /></span>
          <div>
            <p>Absent Days</p>
            <strong>{loading ? '—' : summary.absent}</strong>
            <small>From loaded records</small>
          </div>
        </article>

        <article className="summary-card late">
          <span className="summary-icon"><Clock3 /></span>
          <div>
            <p>Late Arrivals</p>
            <strong>{loading ? '—' : summary.late}</strong>
            <small>From loaded records</small>
          </div>
        </article>

        <article className="summary-card hours">
          <span className="summary-icon"><Clock3 /></span>
          <div>
            <p>Total Working Hours</p>
            <strong>{loading ? '—' : durationLabel(summary.minutes)}</strong>
            <small>From loaded records</small>
          </div>
        </article>
      </section>}

      {!isSuperAdmin && <section className="today-attendance">
        <div className="today-title">
          <div>
            <span className={`live-dot ${checkedIn && !checkedOut ? 'active' : ''}`} />
            <div>
              <h2>Today's Status</h2>
              <strong className={checkedOut ? 'status-done' : checkedIn ? 'status-live' : ''}>
                {checkedOut
                  ? 'Checked Out'
                  : checkedIn
                    ? 'Checked In'
                    : 'Not Checked In'}
              </strong>
            </div>
          </div>
          <span>{new Date().toLocaleDateString('en-IN', {
            weekday: 'short', day: '2-digit', month: 'short', year: 'numeric'
          })}</span>
        </div>

        <div className="today-details">
          <div>
            <Clock3 />
            <span>Check In</span>
            <strong>{formatTime(todayRecord?.checkIn)}</strong>
          </div>
          <div>
            <Clock3 />
            <span>Check Out</span>
            <strong>{formatTime(todayRecord?.checkOut)}</strong>
          </div>
          <div>
            <Clock3 />
            <span>Working Hours</span>
            <strong>{checkedIn && !checkedOut
              ? durationLabel(minutesBetween(todayRecord?.checkIn, new Date(clockNow)))
              : durationLabel(minutesBetween(todayRecord?.checkIn, todayRecord?.checkOut))}</strong>
          </div>
        </div>

        <div className="attendance-actions">
          {String(user?.role || '').toUpperCase() !== 'SUPER_ADMIN' && <button
            className="punch-button check-in"
            disabled={!canCheckIn || actionLoading}
            onClick={() => punch('check-in')}
          >
            <LogIn size={17} />
            {actionLoading ? 'Please wait…' : 'Check In'}
          </button>}

          {String(user?.role || '').toUpperCase() !== 'SUPER_ADMIN' && <button
            className="punch-button check-out"
            disabled={!canCheckOut || actionLoading}
            onClick={() => punch('check-out')}
          >
            <LogOut size={17} /> Check Out
          </button>}

          {String(user?.role || '').toUpperCase() !== 'SUPER_ADMIN' && <button
            type="button"
            onClick={() => setShowCorrectionModal(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-2 text-xs font-semibold text-foreground transition hover:bg-surface-2"
          >
            <FileEdit size={14} /> Request Correction
          </button>}
        </div>
      </section>}

      {(isSuperAdmin || isHrAdmin) && <p className="mb-2 text-xs text-muted">Selected date: <b>{selectedDate}</b> · {isSuperAdmin ? 'Organization-wide attendance' : 'Your reporting managers and employees'}</p>}
      <section className="attendance-lower">
        <div className="attendance-calendar panel">
          <div className="mb-3 flex items-center justify-between gap-2"><h2>{monthName}</h2>{isSuperAdmin && <div className="flex gap-1"><button aria-label="Previous month" onClick={() => moveMonth(-1)}><ChevronLeft size={18}/></button><button aria-label="Next month" onClick={() => moveMonth(1)}><ChevronRight size={18}/></button></div>}</div>

          <div className="calendar-grid calendar-weekdays">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
              <span key={day}>{day}</span>
            ))}
          </div>

          <div className="calendar-grid">
            {calendarCells.map((day, index) => {
              if (!day) return <span key={`empty-${index}`} />;

              const dateKey = formatDate(new Date(
                month.getFullYear(), month.getMonth(), day
              ));
              const record = recordByDate[dateKey];
              const status = statusLabel(record).toLowerCase();
              const isToday = dateKey === today;
              const dayHoliday = holidays.filter((item) => item.date === dateKey);
              const dayLeaves = leaveRequests.filter((item) => {
                const start = String(item.startDate || '').slice(0, 10);
                const end = String(item.endDate || item.startDate || '').slice(0, 10);
                return dateKey >= start && dateKey <= end && ['APPROVED', 'PENDING'].includes(String(item.status || '').toUpperCase());
              });
              const markerClasses = [];
              if (['present', 'checked in', 'in progress'].includes(status)) markerClasses.push('dot-present');
              else if (status === 'absent') markerClasses.push('dot-absent');
              else if (status === 'late') markerClasses.push('dot-late');
              if (dayHoliday.length) markerClasses.push('dot-holiday');
              if (dayLeaves.some((leave) => String(leave.status).toUpperCase() === 'APPROVED')) markerClasses.push('dot-leave');
              if (dayLeaves.some((leave) => String(leave.status).toUpperCase() === 'PENDING')) markerClasses.push('dot-pending-leave');
              const markerTitle = [
                record ? statusLabel(record) : '',
                ...dayHoliday.map((item) => `Holiday: ${item.name}`),
                ...dayLeaves.map((item) => `Leave ${String(item.status).toLowerCase()}: ${item.leaveType || ''}`),
                isToday ? 'Today' : '',
              ].filter(Boolean).join(' • ') || 'No attendance marker';

              return (
                <div
                  className={`calendar-day ${isToday ? 'is-today' : ''} ${selectedDate === dateKey && isSuperAdmin ? 'is-selected' : ''} ${markerClasses.length ? 'has-markers' : ''}`} onClick={() => { if (isSuperAdmin || isHrAdmin) setSelectedDate(dateKey); }} role={isSuperAdmin || isHrAdmin ? 'button' : undefined} tabIndex={isSuperAdmin || isHrAdmin ? 0 : undefined}
                  key={dateKey}
                  title={`${dateKey}: ${markerTitle}`}
                >
                  <span>{day}</span>
                  <div className="calendar-markers" aria-label={markerTitle}>
                    {markerClasses.map((markerClass, markerIndex) => <i key={`${markerClass}-${markerIndex}`} className={markerClass} />)}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="calendar-legend">
            <span><i className="dot-present" /> Present</span>
            <span><i className="dot-absent" /> Absent</span>
            <span><i className="dot-late" /> Late</span>
            <span><i className="dot-holiday" /> Holiday</span>
            <span><i className="dot-leave" /> Approved Leave</span>
            <span><i className="dot-pending-leave" /> Pending Leave</span>
            <span><i className="dot-today" /> Today</span>
          </div>
        </div>

        <div className="attendance-history panel">
          <div className="history-heading">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveHistoryTab('history')}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  activeHistoryTab === 'history'
                    ? 'bg-accent text-accent-contrast shadow-sm'
                    : 'bg-surface-2 text-muted hover:text-foreground'
                }`}
              >
                Attendance Log
              </button>
              <button
                type="button"
                onClick={() => setActiveHistoryTab('corrections')}
                className={`relative rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  activeHistoryTab === 'corrections'
                    ? 'bg-accent text-accent-contrast shadow-sm'
                    : 'bg-surface-2 text-muted hover:text-foreground'
                }`}
              >
                Correction Requests
                {pendingCorrectionsCount > 0 && (
                  <span className="ml-1.5 rounded-full bg-danger px-1.5 py-0.2 text-[10px] font-bold text-white">
                    {pendingCorrectionsCount}
                  </span>
                )}
              </button>
            </div>

            <div className="flex items-center gap-2">
              {activeHistoryTab === 'history' && (
                <select value={filter} onChange={(event) => setFilter(event.target.value)}>
                  {['All', 'Present', 'Absent', 'Late', 'Holiday', 'Leave'].map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </select>
              )}
              {!isSuperAdmin && <button
                type="button"
                onClick={() => setShowCorrectionModal(true)}
                className="inline-flex items-center gap-1 rounded-md bg-accent px-2.5 py-1 text-xs font-semibold text-accent-contrast shadow-sm transition hover:opacity-90"
              >
                <Plus size={13} /> Request
              </button>}
            </div>
          </div>

          {activeHistoryTab === 'history' ? (
            <div className="attendance-table-wrap">
              <table className="attendance-table">
                <thead>
                  <tr>
                    {(isSuperAdmin || isHrAdmin) && <><th>Employee</th><th>Department</th></>}
                    <th>Date</th>
                    <th>Check In</th>
                    <th>Check Out</th>
                    <th>Working Hours</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {!loading && (isSuperAdmin ? teamDateRecords.length === 0 : filteredRecords.length === 0) && (
                    <tr>
                      <td colSpan={isSuperAdmin ? 7 : 5} className="attendance-empty">
                        {isSuperAdmin ? `No attendance records found for ${selectedDate}.` : 'No attendance records found for this month.'}
                      </td>
                    </tr>
                  )}

                  {(isSuperAdmin ? teamDateRecords : filteredRecords).map((record) => (
                    <tr key={record.id ?? record.date}>
                      {(isSuperAdmin || isHrAdmin) && <><td>{record.employeeName || '—'}<small className="block text-muted">{record.employeeCode || ''}</small></td><td>{record.department || '—'}</td></>}
                      <td>{record.date || '—'}</td>
                      <td>{formatTime(record.checkIn)}</td>
                      <td>{formatTime(record.checkOut)}</td>
                      <td>{record.checkIn && !record.checkOut && record.date === today
                        ? durationLabel(minutesBetween(record.checkIn, new Date(clockNow)))
                        : durationLabel(Number(record.workingMinutes) || minutesBetween(record.checkIn, record.checkOut))}</td>
                      <td>
                        <span className={`status-badge ${statusLabel(record).toLowerCase().replace(/\s+/g, '-')}`}>
                          {statusLabel(record)}
                        </span>
                      </td>
                    </tr>
                  ))}

                  {(isSuperAdmin ? teamDateLoading : loading) && (
                    <tr>
                      <td colSpan={isSuperAdmin ? 7 : 5} className="attendance-empty">Loading attendance…</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="attendance-table-wrap">
              <table className="attendance-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    {isManagerOrAdmin && <th>Employee</th>}
                    <th>Original</th>
                    <th>Requested</th>
                    <th>Reason</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {corrections.map((c) => (
                    <tr key={c.id}>
                      <td className="font-medium">{c.date}</td>
                      {isManagerOrAdmin && (
                        <td>
                          <div className="font-medium text-foreground">{c.employeeName || '—'}</div>
                          <div className="text-[11px] text-muted">{c.employeeCode}</div>
                        </td>
                      )}
                      <td className="text-xs text-muted">
                        {c.originalIn ? formatTime(c.originalIn) : 'Missed'} - {c.originalOut ? formatTime(c.originalOut) : 'Missed'}
                      </td>
                      <td className="text-xs font-medium text-foreground">
                        {c.requestedIn ? formatTime(c.requestedIn) : '—'} - {c.requestedOut ? formatTime(c.requestedOut) : '—'}
                      </td>
                      <td className="max-w-[200px] truncate text-xs text-muted" title={c.reason}>
                        {c.reason}
                      </td>
                      <td>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                            c.status === 'APPROVED'
                              ? 'bg-green-500/10 text-green-700 dark:text-green-400'
                              : c.status === 'REJECTED'
                              ? 'bg-danger/10 text-danger'
                              : 'bg-amber-500/10 text-amber-600'
                          }`}
                        >
                          {c.status}
                        </span>
                      </td>
                      <td>
                        {c.canApprove && c.status === 'PENDING' ? (
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => setDecisionModal({ open: true, correctionId: c.id, action: 'APPROVED', comment: '' })}
                              className="rounded-md bg-green-600 px-2 py-1 text-[11px] font-semibold text-white transition hover:bg-green-700"
                            >
                              Approve
                            </button>
                            <button
                              type="button"
                              onClick={() => setDecisionModal({ open: true, correctionId: c.id, action: 'REJECTED', comment: '' })}
                              className="rounded-md border border-danger/30 bg-danger/10 px-2 py-1 text-[11px] font-semibold text-danger transition hover:bg-danger/20"
                            >
                              Reject
                            </button>
                          </div>
                        ) : (
                          <span className="text-[11px] text-muted">
                            {c.decisionComment || '—'}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}

                  {corrections.length === 0 && (
                    <tr>
                      <td colSpan={isManagerOrAdmin ? 7 : 6} className="attendance-empty">
                        No attendance correction requests found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          <button className="refresh-attendance" onClick={() => { loadAttendance(); loadCorrections(); }}>
            <RefreshCw size={15} /> Refresh records
          </button>
        </div>
      </section>

      {/* Request Correction Modal */}
      {isHrAdmin && <section className="mt-5 rounded-2xl border border-border bg-surface p-5 shadow-card"><div className="mb-4 flex flex-wrap items-center justify-between gap-2"><div><h2 className="font-bold">My Team Attendance</h2><p className="text-xs text-muted">All employees and managers · {selectedDate}</p></div><span className="rounded-lg bg-accent-soft px-3 py-1.5 text-xs font-semibold text-accent">{teamDateRecords.length} people</span></div><div className="attendance-table-wrap"><table className="attendance-table"><thead><tr><th>Employee</th><th>Role</th><th>Department</th><th>Check In</th><th>Check Out</th><th>Status</th></tr></thead><tbody>{teamDateRecords.map((r)=><tr key={r.employeeId}><td>{r.employeeName}<small className="block text-muted">{r.employeeCode}</small></td><td>{r.role.replaceAll('_',' ')}</td><td>{r.department}</td><td>{formatTime(r.checkIn)}</td><td>{formatTime(r.checkOut)}</td><td>{r.status.replaceAll('_',' ')}</td></tr>)}{!teamDateRecords.length&&<tr><td colSpan="6" className="attendance-empty">No reporting employees or managers found for this date.</td></tr>}</tbody></table></div></section>}

      {showCorrectionModal && (
        createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-border pb-4">
              <h3 className="text-base font-bold text-foreground">Request Attendance Correction</h3>
              <button
                type="button"
                onClick={() => { setShowCorrectionModal(false); setCorrectionError(''); }}
                className="rounded-lg p-1 text-muted transition hover:bg-surface-2 hover:text-foreground"
              >
                <X size={18} />
              </button>
            </div>

            {correctionError && (
              <div className="mt-3 rounded-lg border border-danger/30 bg-danger/10 p-3 text-xs text-danger">
                {correctionError}
              </div>
            )}

            <form onSubmit={handleRequestCorrection} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted">
                  Correction Date
                </label>
                <input
                  type="date"
                  required
                  max={today}
                  value={correctionForm.date}
                  onChange={(e) => setCorrectionForm({ ...correctionForm, date: e.target.value })}
                  className="mt-1.5 w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm text-foreground outline-none focus:border-accent"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-muted">
                    Requested In Time
                  </label>
                  <input
                    type="time"
                    required
                    value={correctionForm.requestedIn}
                    onChange={(e) => setCorrectionForm({ ...correctionForm, requestedIn: e.target.value })}
                    className="mt-1.5 w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-muted">
                    Requested Out Time
                  </label>
                  <input
                    type="time"
                    required
                    value={correctionForm.requestedOut}
                    onChange={(e) => setCorrectionForm({ ...correctionForm, requestedOut: e.target.value })}
                    className="mt-1.5 w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted">
                  Reason for Correction (Mandatory)
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="Explain why correction is needed (e.g. system issue, client visit, forgot punch)..."
                  value={correctionForm.reason}
                  onChange={(e) => setCorrectionForm({ ...correctionForm, reason: e.target.value })}
                  className="mt-1.5 w-full rounded-xl border border-border bg-surface px-3.5 py-2 text-sm text-foreground outline-none focus:border-accent"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setShowCorrectionModal(false); setCorrectionError(''); }}
                  className="rounded-xl border border-border px-4 py-2 text-xs font-semibold text-muted hover:bg-surface-2"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-accent px-5 py-2 text-xs font-semibold text-accent-contrast shadow-sm transition hover:opacity-90 disabled:opacity-50"
                >
                  {actionLoading ? 'Submitting…' : 'Submit Request'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body,
        )
      )}

      {/* Decision Note Modal */}
      {decisionModal.open && (
        createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-border bg-surface p-6 shadow-2xl">
            <h3 className="text-base font-bold text-foreground">
              {decisionModal.action === 'APPROVED' ? 'Approve Correction' : 'Reject Correction'}
            </h3>
            <p className="mt-1 text-xs text-muted">
              {decisionModal.action === 'APPROVED'
                ? 'On approval, the employee attendance record and working hours will be automatically recalculated.'
                : 'Enter a remark or reason for rejecting this correction request.'}
            </p>

            <div className="mt-4">
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted">
                Decision Remark (Optional)
              </label>
              <textarea
                rows={3}
                placeholder="Add reviewer notes..."
                value={decisionModal.comment}
                onChange={(e) => setDecisionModal({ ...decisionModal, comment: e.target.value })}
                className="mt-1.5 w-full rounded-xl border border-border bg-surface px-3 py-2 text-xs text-foreground outline-none focus:border-accent"
              />
            </div>

            <div className="mt-5 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setDecisionModal({ open: false, correctionId: null, action: 'APPROVED', comment: '' })}
                className="rounded-xl border border-border px-4 py-2 text-xs font-semibold text-muted hover:bg-surface-2"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={actionLoading}
                onClick={() => submitDecision(decisionModal.correctionId, decisionModal.action, decisionModal.comment)}
                className={`rounded-xl px-4 py-2 text-xs font-semibold text-white shadow-sm transition ${
                  decisionModal.action === 'APPROVED' ? 'bg-green-600 hover:bg-green-700' : 'bg-danger hover:opacity-90'
                }`}
              >
                {actionLoading ? 'Saving…' : `Confirm ${decisionModal.action === 'APPROVED' ? 'Approval' : 'Rejection'}`}
              </button>
            </div>
          </div>
        </div>,
        document.body,
        )
      )}
    </main>
  );
}
