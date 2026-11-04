import { useEffect, useState } from 'react';
import {
  BarChart3,
  Download,
  Users,
  CalendarCheck,
  Plane,
  RefreshCw,
  Filter,
  CheckCircle2,
  FileSpreadsheet,
} from 'lucide-react';
import { api } from '../../services/api.js';

export default function ReportsPage() {
  const [reportType, setReportType] = useState('employees'); // 'employees' | 'attendance' | 'leaves'
  const [data, setData] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  // Filters
  const [selectedDept, setSelectedDept] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  async function loadReport() {
    setLoading(true);
    try {
      const [sumRes, optRes] = await Promise.all([
        api('/reports/summary').catch(() => ({ summary: null })),
        api('/organization/options').catch(() => ({ departments: [] })),
      ]);

      setSummary(sumRes.summary);
      setDepartments(optRes.departments || []);

      let endpoint = `/reports/${reportType}?`;
      if (selectedDept) endpoint += `departmentId=${selectedDept}&`;
      if (selectedStatus) endpoint += `status=${selectedStatus}&`;
      if (reportType === 'attendance') endpoint += `month=${selectedMonth}&year=${selectedYear}&`;
      if (reportType === 'leaves') endpoint += `year=${selectedYear}&`;

      const repRes = await api(endpoint);
      setData(repRes.data || []);
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportType, selectedDept, selectedStatus, selectedMonth, selectedYear]);

  function handleExportCsv() {
    let endpoint = `/api/reports/${reportType}?format=csv&`;
    if (selectedDept) endpoint += `departmentId=${selectedDept}&`;
    if (selectedStatus) endpoint += `status=${selectedStatus}&`;
    if (reportType === 'attendance') endpoint += `month=${selectedMonth}&year=${selectedYear}&`;
    if (reportType === 'leaves') endpoint += `year=${selectedYear}&`;

    window.open(endpoint, '_blank');
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="mb-1.5 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-accent">
            <BarChart3 size={16} />
            <span>Business Intelligence & Analytics</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Organization Reports</h1>
          <p className="mt-1 text-sm text-muted">Generate operational HR reports, analyze trends, and export CSV compliance data.</p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={loadReport}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2 text-sm font-semibold transition hover:bg-surface-2"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={loading || data.length === 0}
            className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-accent/90 disabled:opacity-50"
          >
            <Download size={16} />
            Export to CSV
          </button>
        </div>
      </div>

      {/* Summary Stat Cards */}
      {summary && (
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <article className="rounded-2xl border border-border bg-surface p-5 shadow-card">
            <div className="flex items-center justify-between text-muted">
              <span className="text-xs font-bold uppercase tracking-wider">Total Headcount</span>
              <Users size={18} />
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-text">{summary.totalEmployees}</span>
              <span className="text-xs text-muted">active: {summary.activeEmployees}</span>
            </div>
          </article>

          <article className="rounded-2xl border border-border bg-surface p-5 shadow-card">
            <div className="flex items-center justify-between text-muted">
              <span className="text-xs font-bold uppercase tracking-wider">Present Today</span>
              <CalendarCheck size={18} />
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-success">{summary.presentToday}</span>
              <span className="text-xs text-muted">punched in</span>
            </div>
          </article>

          <article className="rounded-2xl border border-border bg-surface p-5 shadow-card">
            <div className="flex items-center justify-between text-muted">
              <span className="text-xs font-bold uppercase tracking-wider">Active Departments</span>
              <FileSpreadsheet size={18} />
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-accent">{summary.departmentDistribution?.length || 0}</span>
              <span className="text-xs text-muted">units</span>
            </div>
          </article>
        </section>
      )}

      {/* Report Selector Tabs */}
      <div className="flex border-b border-border">
        <button
          type="button"
          onClick={() => { setReportType('employees'); setSelectedStatus(''); }}
          className={`flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-semibold transition ${
            reportType === 'employees' ? 'border-accent text-accent' : 'border-transparent text-muted hover:text-text'
          }`}
        >
          <Users size={16} />
          Workforce Directory
        </button>
        <button
          type="button"
          onClick={() => { setReportType('attendance'); setSelectedStatus(''); }}
          className={`flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-semibold transition ${
            reportType === 'attendance' ? 'border-accent text-accent' : 'border-transparent text-muted hover:text-text'
          }`}
        >
          <CalendarCheck size={16} />
          Monthly Attendance
        </button>
        <button
          type="button"
          onClick={() => { setReportType('leaves'); setSelectedStatus(''); }}
          className={`flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-semibold transition ${
            reportType === 'leaves' ? 'border-accent text-accent' : 'border-transparent text-muted hover:text-text'
          }`}
        >
          <Plane size={16} />
          Leave Utilization
        </button>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-surface p-4 shadow-card">
        <div className="flex items-center gap-2 text-xs font-bold uppercase text-muted">
          <Filter size={15} />
          <span>Filters:</span>
        </div>

        <select
          value={selectedDept}
          onChange={(e) => setSelectedDept(e.target.value)}
          className="rounded-xl border border-border bg-surface-2/50 px-3.5 py-2 text-sm outline-none transition focus:border-accent"
        >
          <option value="">All Departments</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>

        {reportType === 'employees' && (
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
        )}

        {reportType === 'attendance' && (
          <>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
              className="rounded-xl border border-border bg-surface-2/50 px-3.5 py-2 text-sm outline-none transition focus:border-accent"
            >
              {[
                'January', 'February', 'March', 'April', 'May', 'June',
                'July', 'August', 'September', 'October', 'November', 'December'
              ].map((m, idx) => (
                <option key={m} value={idx + 1}>{m}</option>
              ))}
            </select>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="rounded-xl border border-border bg-surface-2/50 px-3.5 py-2 text-sm outline-none transition focus:border-accent"
            >
              {[2024, 2025, 2026, 2027].map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </>
        )}

        {reportType === 'leaves' && (
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="rounded-xl border border-border bg-surface-2/50 px-3.5 py-2 text-sm outline-none transition focus:border-accent"
          >
            <option value="">All Decisions</option>
            <option value="APPROVED">Approved</option>
            <option value="PENDING">Pending</option>
            <option value="REJECTED">Rejected</option>
          </select>
        )}
      </div>

      {/* Data Table */}
      <section className="rounded-2xl border border-border bg-surface p-5 shadow-card sm:p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-bold">Report Preview ({data.length} records)</h2>
        </div>

        <div className="overflow-x-auto">
          {reportType === 'employees' && (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs font-semibold text-muted">
                  <th className="pb-3">Employee ID</th>
                  <th className="pb-3">Name</th>
                  <th className="pb-3">Email</th>
                  <th className="pb-3">Department</th>
                  <th className="pb-3">Designation</th>
                  <th className="pb-3">Manager</th>
                  <th className="pb-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.map((r, i) => (
                  <tr key={i} className="hover:bg-surface-2/40">
                    <td className="py-3 font-mono text-xs font-bold text-accent">{r.employeeCode}</td>
                    <td className="py-3 font-semibold text-text">{r.fullName}</td>
                    <td className="py-3 text-muted">{r.email}</td>
                    <td className="py-3">{r.department}</td>
                    <td className="py-3 text-muted">{r.designation}</td>
                    <td className="py-3 text-muted">{r.manager}</td>
                    <td className="py-3">
                      <span className="rounded-full bg-surface-2 px-2.5 py-0.5 text-xs font-semibold text-text">
                        {r.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {reportType === 'attendance' && (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs font-semibold text-muted">
                  <th className="pb-3">Date</th>
                  <th className="pb-3">Employee</th>
                  <th className="pb-3">Department</th>
                  <th className="pb-3">Check In</th>
                  <th className="pb-3">Check Out</th>
                  <th className="pb-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.map((r, i) => (
                  <tr key={i} className="hover:bg-surface-2/40">
                    <td className="py-3 font-mono text-xs text-muted">{r.date}</td>
                    <td className="py-3 font-semibold text-text">{r.fullName} ({r.employeeCode})</td>
                    <td className="py-3 text-muted">{r.department}</td>
                    <td className="py-3">{r.firstIn}</td>
                    <td className="py-3">{r.lastOut}</td>
                    <td className="py-3">
                      <span className="rounded-full bg-success/15 px-2.5 py-0.5 text-xs font-semibold text-success">
                        {r.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {reportType === 'leaves' && (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs font-semibold text-muted">
                  <th className="pb-3">Applied Date</th>
                  <th className="pb-3">Employee</th>
                  <th className="pb-3">Leave Type</th>
                  <th className="pb-3">Duration</th>
                  <th className="pb-3">Days</th>
                  <th className="pb-3">Approver</th>
                  <th className="pb-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.map((r, i) => (
                  <tr key={i} className="hover:bg-surface-2/40">
                    <td className="py-3 text-xs text-muted">{r.appliedOn}</td>
                    <td className="py-3 font-semibold text-text">{r.fullName}</td>
                    <td className="py-3 font-medium text-accent">{r.leaveType}</td>
                    <td className="py-3 text-muted">{r.startDate} to {r.endDate}</td>
                    <td className="py-3 font-bold">{r.days}</td>
                    <td className="py-3 text-muted">{r.approver}</td>
                    <td className="py-3">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        r.status === 'APPROVED' ? 'bg-success/15 text-success' : 'bg-amber-500/15 text-amber-600'
                      }`}>
                        {r.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {!loading && data.length === 0 && (
            <div className="py-8 text-center text-sm text-muted">
              No report records found for the selected filters.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
