"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useApp } from "@/lib/store";
import { MONTH_NAMES } from "@/lib/date-utils";
import {
  addHoliday,
  addProject,
  ApprovedLogRow,
  deleteApprovedLogs,
  fetchApprovedLogs,
  fetchDeletedProfiles,
  fetchHolidays,
  fetchLogsForPeriod,
  fetchPendingLogs,
  fetchProfiles,
  fetchProjects,
  ReportLogRow,
  removeHoliday,
  removeProject,
  setLogStatus,
  updateHourlyRate,
  updatePayType,
  updateSalaryAmount,
  updateUserRole,
} from "@/lib/queries";
import { DailyLog, DeletedUser, PayType, Project, Role, User } from "@/lib/types";

const TABS = ["People", "Approvals", "Payroll", "Reports", "Projects", "Holidays", "Bin"] as const;
type Tab = (typeof TABS)[number];

const ROLE_OPTIONS: { value: Role; label: string }[] = [
  { value: "employee", label: "Employee" },
  { value: "contractor", label: "Contractor" },
  { value: "volunteer", label: "Volunteer" },
  { value: "court_community_service", label: "Court Community Service" },
  { value: "concession_stand", label: "Concession Stand" },
  { value: "cleaning_staff", label: "Cleaning Staff" },
  { value: "other", label: "Other" },
  { value: "admin", label: "Admin" },
];

export default function AdminPage() {
  const supabase = createClient();
  const { currentUser } = useApp();
  const [tab, setTab] = useState<Tab>("People");

  const [users, setUsers] = useState<User[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [holidays, setHolidays] = useState<{ id: string; date: string; name: string }[]>([]);
  const [pendingLogs, setPendingLogs] = useState<{ log: DailyLog; employeeName: string }[]>([]);
  const [approvedLogs, setApprovedLogs] = useState<ApprovedLogRow[]>([]);
  const [deletedUsers, setDeletedUsers] = useState<DeletedUser[]>([]);
  const [authMeta, setAuthMeta] = useState<Record<string, { lastSignInAt: string | null; createdAt: string }>>({});
  const [loading, setLoading] = useState(true);

  // Reports tab state
  const [reportType, setReportType] = useState<"weekly" | "monthly">("monthly");
  const [reportMonthInput, setReportMonthInput] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [reportWeekInput, setReportWeekInput] = useState(() => {
    const now = new Date();
    return now.toISOString().slice(0, 10);
  });
  const [reportLogs, setReportLogs] = useState<ReportLogRow[]>([]);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportGenerated, setReportGenerated] = useState(false);
  const [payrollMonth, setPayrollMonth] = useState("all");
  const [deleteUserError, setDeleteUserError] = useState("");
  const [breakdownUserId, setBreakdownUserId] = useState<string | null>(null);

  const [newProjectName, setNewProjectName] = useState("");
  const [newHolidayDate, setNewHolidayDate] = useState("");
  const [newHolidayName, setNewHolidayName] = useState("");

  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteRole, setInviteRole] = useState<Role>("employee");
  const [inviteRate, setInviteRate] = useState("0");
  const [inviteError, setInviteError] = useState("");
  const [inviteLoading, setInviteLoading] = useState(false);
  const [setupLink, setSetupLink] = useState("");
  const [linkCopied, setLinkCopied] = useState(false);

  const loadAll = useCallback(
    async (showSpinner = true) => {
      if (showSpinner) setLoading(true);
      try {
        const [u, p, h, pending, logs, deleted, authRes] = await Promise.all([
          fetchProfiles(supabase),
          fetchProjects(supabase),
          fetchHolidays(supabase),
          fetchPendingLogs(supabase),
          fetchApprovedLogs(supabase),
          fetchDeletedProfiles(supabase),
          fetch("/api/admin/users").then((r) => r.json()),
        ]);
        setUsers(u);
        setProjects(p);
        setHolidays(h);
        setPendingLogs(pending);
        setApprovedLogs(logs);
        setDeletedUsers(deleted);
        if (Array.isArray(authRes)) {
          const meta: Record<string, { lastSignInAt: string | null; createdAt: string }> = {};
          for (const row of authRes) meta[row.id] = { lastSignInAt: row.lastSignInAt, createdAt: row.createdAt };
          setAuthMeta(meta);
        }
      } finally {
        if (showSpinner) setLoading(false);
      }
    },
    [supabase]
  );

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const payrollMonths = useMemo(() => {
    const months = new Set(approvedLogs.map((l) => l.date.slice(0, 7)));
    return Array.from(months).sort().reverse();
  }, [approvedLogs]);

  const approvedHours = useMemo(() => {
    const totals: Record<string, number> = {};
    for (const log of approvedLogs) {
      if (payrollMonth !== "all" && !log.date.startsWith(payrollMonth)) continue;
      totals[log.userId] = (totals[log.userId] ?? 0) + log.totalHours;
    }
    return totals;
  }, [approvedLogs, payrollMonth]);

  const approvedDays = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const log of approvedLogs) {
      if (payrollMonth !== "all" && !log.date.startsWith(payrollMonth)) continue;
      counts[log.userId] = (counts[log.userId] ?? 0) + 1;
    }
    return counts;
  }, [approvedLogs, payrollMonth]);

  const payroll = useMemo(
    () =>
      users
        .filter((u) => u.role !== "admin")
        .map((u) => {
          const hours = approvedHours[u.id] ?? 0;
          const days = approvedDays[u.id] ?? 0;
          let total: number;
          if (u.payType === "salary") total = u.salaryAmount;
          else if (u.payType === "daily") total = days * u.salaryAmount;
          else total = hours * u.hourlyRate;
          return { user: u, hours, days, total };
        })
        .filter((p) => p.hours > 0),
    [users, approvedHours, approvedDays]
  );

  const breakdownUser = breakdownUserId ? users.find((u) => u.id === breakdownUserId) ?? null : null;
  const breakdownLogs = useMemo(() => {
    if (!breakdownUserId) return [];
    return approvedLogs
      .filter((l) => l.userId === breakdownUserId)
      .filter((l) => payrollMonth === "all" || l.date.startsWith(payrollMonth))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [approvedLogs, breakdownUserId, payrollMonth]);
  const projectsById = useMemo(() => new Map(projects.map((p) => [p.id, p.name])), [projects]);

  async function handleDeletePayroll(userId: string, userName: string) {
    const scopeLabel = payrollMonth === "all" ? "all time" : payrollMonth;
    const confirmed = window.confirm(
      `Delete ${userName}'s approved payroll for ${scopeLabel}? This permanently removes the underlying approved log entries and cannot be undone.`
    );
    if (!confirmed) return;
    await deleteApprovedLogs(supabase, userId, payrollMonth === "all" ? undefined : payrollMonth);
    loadAll();
  }

  async function updateRate(userId: string, rate: number) {
    setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, hourlyRate: rate } : u)));
    try {
      await updateHourlyRate(supabase, userId, rate);
    } catch {
      loadAll();
    }
  }

  async function handlePayTypeChange(userId: string, payType: PayType) {
    setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, payType } : u)));
    try {
      await updatePayType(supabase, userId, payType);
    } catch {
      loadAll();
    }
  }

  async function updateSalary(userId: string, salaryAmount: number) {
    setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, salaryAmount } : u)));
    try {
      await updateSalaryAmount(supabase, userId, salaryAmount);
    } catch {
      loadAll();
    }
  }

  async function handleRoleChange(userId: string, role: Role) {
    setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, role } : u)));
    try {
      await updateUserRole(supabase, userId, role);
    } catch {
      loadAll();
    }
  }

  async function handleDeleteUser(userId: string, userName: string) {
    if (currentUser?.id === userId) {
      window.alert("You cannot delete your own account.");
      return;
    }
    const confirmed = window.confirm(
      `Delete ${userName}'s account? This permanently removes their login and all of their logged hours, and cannot be undone.`
    );
    if (!confirmed) return;
    setDeleteUserError("");
    try {
      const res = await fetch(`/api/admin/users/${userId}`, { method: "DELETE" });
      const body = await res.json();
      if (!res.ok) {
        setDeleteUserError(body.error ?? "Could not delete this account.");
        return;
      }
      loadAll();
    } catch {
      setDeleteUserError("Something went wrong talking to the server. Please try again.");
    }
  }

  async function handlePermanentDelete(userId: string, userName: string) {
    const confirmed = window.confirm(
      `Permanently delete ${userName}? This removes their account and ALL their logged hours forever. This cannot be undone.`
    );
    if (!confirmed) return;
    try {
      const res = await fetch(`/api/admin/users/${userId}?permanent=true`, { method: "DELETE" });
      const body = await res.json();
      if (!res.ok) {
        window.alert(body.error ?? "Could not permanently delete this account.");
        return;
      }
      loadAll();
    } catch {
      window.alert("Something went wrong talking to the server. Please try again.");
    }
  }

  async function handleRestoreUser(userId: string, userName: string) {
    const confirmed = window.confirm(`Restore ${userName}'s account? They will be able to log in again.`);
    if (!confirmed) return;
    try {
      const res = await fetch(`/api/admin/users/${userId}`, { method: "PUT" });
      const body = await res.json();
      if (!res.ok) {
        window.alert(body.error ?? "Could not restore this account.");
        return;
      }
      loadAll();
    } catch {
      window.alert("Something went wrong talking to the server. Please try again.");
    }
  }

  function getReportDateRange(): { start: string; end: string; label: string } {
    if (reportType === "monthly") {
      const [y, m] = reportMonthInput.split("-").map(Number);
      const lastDay = new Date(y, m, 0).getDate();
      return {
        start: `${reportMonthInput}-01`,
        end: `${reportMonthInput}-${String(lastDay).padStart(2, "0")}`,
        label: `${MONTH_NAMES[m - 1]} ${y}`,
      };
    } else {
      const d = new Date(reportWeekInput);
      const day = d.getDay();
      const monday = new Date(d);
      monday.setDate(d.getDate() - ((day + 6) % 7));
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      const fmt = (dt: Date) => dt.toISOString().slice(0, 10);
      return {
        start: fmt(monday),
        end: fmt(sunday),
        label: `Week of ${fmt(monday)} – ${fmt(sunday)}`,
      };
    }
  }

  async function handleGenerateReport() {
    setReportLoading(true);
    setReportGenerated(false);
    try {
      const { start, end } = getReportDateRange();
      const logs = await fetchLogsForPeriod(supabase, start, end);
      setReportLogs(logs);
      setReportGenerated(true);
    } finally {
      setReportLoading(false);
    }
  }

  function handleDownloadCSV() {
    const { start, end, label } = getReportDateRange();

    // Build per-person summary
    const summaryMap: Record<string, { name: string; role: string; days: number; totalHours: number; approvedHours: number; submittedHours: number; rejectedHours: number }> = {};
    for (const log of reportLogs) {
      if (!summaryMap[log.userId]) {
        summaryMap[log.userId] = { name: log.userName, role: log.userRole, days: 0, totalHours: 0, approvedHours: 0, submittedHours: 0, rejectedHours: 0 };
      }
      const s = summaryMap[log.userId];
      s.days += 1;
      s.totalHours += log.totalHours;
      if (log.status === "approved") s.approvedHours += log.totalHours;
      if (log.status === "submitted") s.submittedHours += log.totalHours;
      if (log.status === "rejected") s.rejectedHours += log.totalHours;
    }

    const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;

    const rows: string[] = [];
    rows.push(`"Report: ${label}"`);
    rows.push(`"Period: ${start} to ${end}"`);
    rows.push("");

    // Summary section
    rows.push("SUMMARY");
    rows.push(["Name", "Role", "Days Logged", "Total Hours", "Approved Hours", "Pending Hours", "Rejected Hours"].map(esc).join(","));
    for (const s of Object.values(summaryMap)) {
      rows.push([s.name, s.role, s.days, s.totalHours, s.approvedHours, s.submittedHours, s.rejectedHours].map(esc).join(","));
    }

    rows.push("");

    // Detail section
    rows.push("DETAILED LOG");
    rows.push(["Name", "Role", "Date", "Clock In", "Clock Out", "Hours", "Leave", "Status", "Notes"].map(esc).join(","));
    for (const log of reportLogs) {
      rows.push([
        log.userName,
        log.userRole,
        log.date,
        log.clockIn ?? "",
        log.clockOut ?? "",
        log.totalHours,
        log.leaveType !== "none" ? log.leaveType : "",
        log.status,
        log.notes,
      ].map(esc).join(","));
    }

    const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `timesheet-report-${start}-to-${end}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleAddProject() {
    const name = newProjectName.trim();
    if (!name) return;
    await addProject(supabase, name);
    setNewProjectName("");
    loadAll();
  }

  async function handleRemoveProject(id: string) {
    await removeProject(supabase, id);
    loadAll();
  }

  async function handleAddHoliday() {
    if (!newHolidayDate || !newHolidayName.trim()) return;
    await addHoliday(supabase, newHolidayDate, newHolidayName.trim());
    setNewHolidayDate("");
    setNewHolidayName("");
    loadAll();
  }

  async function handleRemoveHoliday(id: string) {
    await removeHoliday(supabase, id);
    loadAll();
  }

  async function handleDecision(userId: string, date: string, status: "approved" | "rejected") {
    if (!currentUser) return;
    await setLogStatus(supabase, userId, date, status, currentUser.id);
    loadAll();
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setInviteError("");
    if (!inviteEmail.trim() || !inviteName.trim()) {
      setInviteError("Name and email are required.");
      return;
    }
    setInviteLoading(true);
    try {
      const res = await fetch("/api/admin/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: inviteEmail.trim(),
          fullName: inviteName.trim(),
          role: inviteRole,
          hourlyRate: parseFloat(inviteRate) || 0,
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        setInviteError(body.error ?? "Invite failed");
        return;
      }
      setSetupLink(body.setupLink ?? "");
      setInviteEmail("");
      setInviteName("");
      setInviteRole("employee");
      setInviteRate("0");
      loadAll(false);
    } catch {
      setInviteError("Something went wrong talking to the server. Please try again.");
    } finally {
      setInviteLoading(false);
    }
  }

  function closeInvite() {
    setShowInvite(false);
    setSetupLink("");
    setLinkCopied(false);
    setInviteError("");
  }

  async function copySetupLink() {
    await navigator.clipboard.writeText(setupLink);
    setLinkCopied(true);
  }

  if (loading) {
    return <p className="text-sm text-slate-500">Loading…</p>;
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold text-slate-900">Admin</h1>

      <div className="mb-6 flex gap-1 overflow-x-auto border-b border-slate-200">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium ${
              tab === t
                ? "border-b-2 border-slate-900 text-slate-900"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {t}
            {t === "People" && (
              <span className="rounded-full bg-slate-200 px-1.5 py-0.5 text-xs font-semibold text-slate-700">
                {users.length}
              </span>
            )}
            {t === "Approvals" && pendingLogs.length > 0 && (
              <span className="flex items-center gap-1 rounded-full bg-emerald-100 px-1.5 py-0.5 text-xs font-semibold text-emerald-700">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                {pendingLogs.length}
              </span>
            )}
            {t === "Bin" && deletedUsers.length > 0 && (
              <span className="rounded-full bg-red-100 px-1.5 py-0.5 text-xs font-semibold text-red-600">
                {deletedUsers.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {tab === "People" && (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-2">Name</th>
                <th className="px-4 py-2">Email</th>
                <th className="px-4 py-2">Role</th>
                <th className="px-4 py-2">Pay</th>
                <th className="px-4 py-2">Last login</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-t border-slate-100">
                  <td className="px-4 py-2 font-medium text-slate-700">{u.name}</td>
                  <td className="px-4 py-2 text-slate-500">{u.email}</td>
                  <td className="px-4 py-2">
                    <select
                      value={u.role}
                      onChange={(e) => handleRoleChange(u.id, e.target.value as Role)}
                      disabled={currentUser?.id === u.id}
                      className="rounded-md border border-slate-300 px-2 py-1 text-sm text-slate-700 outline-none focus:border-slate-900 disabled:opacity-60"
                    >
                      {ROLE_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-2">
                    {u.role === "admin" ? (
                      <span className="text-slate-400">—</span>
                    ) : (
                      <div className="flex items-center gap-1.5 text-slate-700">
                        <select
                          value={u.payType}
                          onChange={(e) => handlePayTypeChange(u.id, e.target.value as PayType)}
                          className="rounded-md border border-slate-300 px-1.5 py-1 text-xs text-slate-600 outline-none focus:border-slate-900"
                        >
                          <option value="hourly">Hourly</option>
                          <option value="salary">Salary</option>
                          <option value="daily">Daily</option>
                        </select>
                        <span>$</span>
                        {u.payType === "salary" ? (
                          <input
                            type="number"
                            step="1"
                            value={u.salaryAmount}
                            onChange={(e) => updateSalary(u.id, parseFloat(e.target.value) || 0)}
                            title="Fixed salary amount"
                            className="w-24 rounded-md border border-slate-300 px-2 py-1 text-sm outline-none focus:border-slate-900"
                          />
                        ) : u.payType === "daily" ? (
                          <input
                            type="number"
                            step="1"
                            value={u.salaryAmount}
                            onChange={(e) => updateSalary(u.id, parseFloat(e.target.value) || 0)}
                            title="Daily wage"
                            className="w-24 rounded-md border border-slate-300 px-2 py-1 text-sm outline-none focus:border-slate-900"
                          />
                        ) : (
                          <input
                            type="number"
                            step="0.5"
                            value={u.hourlyRate}
                            onChange={(e) => updateRate(u.id, parseFloat(e.target.value) || 0)}
                            title="Hourly wage"
                            className="w-20 rounded-md border border-slate-300 px-2 py-1 text-sm outline-none focus:border-slate-900"
                          />
                        )}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-2 text-slate-500 text-xs">
                    {authMeta[u.id]?.lastSignInAt
                      ? new Date(authMeta[u.id].lastSignInAt!).toLocaleString(undefined, {
                          month: "short", day: "numeric", year: "numeric",
                          hour: "2-digit", minute: "2-digit",
                        })
                      : <span className="text-slate-400">Never</span>}
                  </td>
                  <td className="px-4 py-2">
                    <span
                      className={`rounded px-2 py-0.5 text-xs font-medium ${
                        u.status === "active"
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {u.status}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right">
                    {currentUser?.id !== u.id && (
                      <button
                        onClick={() => handleDeleteUser(u.id, u.name)}
                        className="text-sm font-medium text-red-600 hover:text-red-700"
                      >
                        Delete
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {deleteUserError && (
            <p className="border-t border-slate-100 px-4 py-2 text-sm text-red-600">
              {deleteUserError}
            </p>
          )}
          <div className="border-t border-slate-100 px-4 py-3">
            {!showInvite ? (
              <button
                onClick={() => setShowInvite(true)}
                className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
              >
                + Invite employee / contractor
              </button>
            ) : setupLink ? (
              <div className="max-w-xl space-y-3">
                <p className="text-sm text-slate-700">
                  Account created. Send this link to the new person so they can set their
                  password — we don't rely on Supabase's email here, so send it however you like
                  (email, text, Slack, etc).
                </p>
                <div className="flex gap-2">
                  <input
                    readOnly
                    value={setupLink}
                    onFocus={(e) => e.target.select()}
                    className="flex-1 rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-700 outline-none"
                  />
                  <button
                    onClick={copySetupLink}
                    className="rounded-md border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    {linkCopied ? "Copied!" : "Copy"}
                  </button>
                </div>
                <button
                  onClick={closeInvite}
                  className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
                >
                  Done
                </button>
              </div>
            ) : (
              <form onSubmit={handleInvite} className="grid max-w-xl grid-cols-2 gap-3">
                <input
                  type="text"
                  placeholder="Full name"
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  className="col-span-2 rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
                />
                <input
                  type="email"
                  placeholder="Email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="col-span-2 rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
                />
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as Role)}
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
                >
                  {ROLE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <div className="flex items-center gap-1">
                  <span className="text-sm text-slate-500">$/hr</span>
                  <input
                    type="number"
                    step="0.5"
                    value={inviteRate}
                    onChange={(e) => setInviteRate(e.target.value)}
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
                  />
                </div>
                {inviteError && <p className="col-span-2 text-sm text-red-600">{inviteError}</p>}
                <div className="col-span-2 flex gap-2">
                  <button
                    type="submit"
                    disabled={inviteLoading}
                    className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
                  >
                    {inviteLoading ? "Creating…" : "Create account"}
                  </button>
                  <button
                    type="button"
                    onClick={closeInvite}
                    className="rounded-md border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {tab === "Approvals" && (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          {pendingLogs.length === 0 ? (
            <p className="px-4 py-6 text-sm text-slate-500">No pending submissions.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-2">Date</th>
                  <th className="px-4 py-2">Employee</th>
                  <th className="px-4 py-2">Hours</th>
                  <th className="px-4 py-2">Notes</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {pendingLogs.map(({ log, employeeName }) => (
                  <tr key={`${log.userId}-${log.date}`} className="border-t border-slate-100">
                    <td className="px-4 py-2 text-slate-700">{log.date}</td>
                    <td className="px-4 py-2 text-slate-700">{employeeName}</td>
                    <td className="px-4 py-2 text-slate-700">{log.totalHours}</td>
                    <td className="px-4 py-2 text-slate-500">{log.notes}</td>
                    <td className="px-4 py-2 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => handleDecision(log.userId, log.date, "approved")}
                          className="rounded-md border border-emerald-200 px-3 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-50"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => handleDecision(log.userId, log.date, "rejected")}
                          className="rounded-md border border-red-200 px-3 py-1 text-xs font-medium text-red-700 hover:bg-red-50"
                        >
                          Reject
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === "Payroll" && (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
            <label className="text-sm text-slate-500">Period:</label>
            <select
              value={payrollMonth}
              onChange={(e) => setPayrollMonth(e.target.value)}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-slate-900"
            >
              <option value="all">All time</option>
              {payrollMonths.map((m) => (
                <option key={m} value={m}>
                  {MONTH_NAMES[Number(m.slice(5, 7)) - 1]} {m.slice(0, 4)}
                </option>
              ))}
            </select>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-2">Employee</th>
                <th className="px-4 py-2">Approved hours</th>
                <th className="px-4 py-2">Pay rate</th>
                <th className="px-4 py-2">Total paid</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {payroll.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-sm text-slate-400">
                    No approved payroll for this period.
                  </td>
                </tr>
              ) : (
                payroll.map(({ user, hours, total }) => (
                  <tr key={user.id} className="border-t border-slate-100">
                    <td className="px-4 py-2 font-medium text-slate-700">{user.name}</td>
                    <td className="px-4 py-2">
                      <button
                        onClick={() => setBreakdownUserId(user.id)}
                        className="text-slate-600 underline hover:text-slate-900"
                      >
                        {hours}h
                      </button>
                    </td>
                    <td className="px-4 py-2 text-slate-600">
                      {user.payType === "salary"
                        ? `$${user.salaryAmount.toFixed(2)}`
                        : user.payType === "daily"
                          ? `$${user.salaryAmount.toFixed(2)}/day`
                          : `$${user.hourlyRate.toFixed(2)}/hr`}
                    </td>
                    <td className="px-4 py-2 font-semibold text-slate-900">${total.toFixed(2)}</td>
                    <td className="px-4 py-2 text-right">
                      <button
                        onClick={() => handleDeletePayroll(user.id, user.name)}
                        className="text-sm font-medium text-red-600 hover:text-red-700"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          <p className="border-t border-slate-100 px-4 py-3 text-xs text-slate-400">
            Based on approved logs only. Set pay type and rate from the People tab.
          </p>
        </div>
      )}

      {breakdownUser && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4 py-6 overflow-y-auto"
          onClick={() => setBreakdownUserId(null)}
        >
          <div
            className="w-full max-w-2xl rounded-xl bg-white p-6 shadow-lg my-auto max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">{breakdownUser.name}</h2>
                <p className="text-sm text-slate-500">
                  {payrollMonth === "all"
                    ? "All approved days"
                    : `${MONTH_NAMES[Number(payrollMonth.slice(5, 7)) - 1]} ${payrollMonth.slice(0, 4)}`}
                </p>
              </div>
              <button
                onClick={() => setBreakdownUserId(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            {breakdownLogs.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-400">
                No approved days in this period.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-slate-200">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-3 py-2">Date</th>
                      <th className="px-3 py-2">Clock in/out</th>
                      <th className="px-3 py-2">Hours</th>
                      <th className="px-3 py-2">Leave</th>
                      <th className="px-3 py-2">Project</th>
                      <th className="px-3 py-2">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {breakdownLogs.map((log) => (
                      <tr key={log.date} className="border-t border-slate-100">
                        <td className="px-3 py-2 font-medium text-slate-700">{log.date}</td>
                        <td className="px-3 py-2 text-slate-500">
                          {log.clockIn && log.clockOut ? `${log.clockIn} – ${log.clockOut}` : "—"}
                        </td>
                        <td className="px-3 py-2 text-slate-700">{log.totalHours}</td>
                        <td className="px-3 py-2 text-slate-500 capitalize">
                          {log.leaveType !== "none" ? log.leaveType : "—"}
                        </td>
                        <td className="px-3 py-2 text-slate-500">
                          {log.projectId ? projectsById.get(log.projectId) ?? "—" : "—"}
                        </td>
                        <td className="px-3 py-2 text-slate-500">{log.notes || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === "Reports" && (
        <div className="space-y-6">
          {/* Controls */}
          <div className="rounded-lg border border-slate-200 bg-white px-4 py-4">
            <div className="flex flex-wrap items-end gap-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">Report type</label>
                <div className="flex rounded-md border border-slate-300 overflow-hidden">
                  <button
                    onClick={() => { setReportType("monthly"); setReportGenerated(false); }}
                    className={`px-4 py-2 text-sm font-medium transition-colors ${reportType === "monthly" ? "bg-slate-900 text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}
                  >
                    Monthly
                  </button>
                  <button
                    onClick={() => { setReportType("weekly"); setReportGenerated(false); }}
                    className={`px-4 py-2 text-sm font-medium transition-colors ${reportType === "weekly" ? "bg-slate-900 text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}
                  >
                    Weekly
                  </button>
                </div>
              </div>

              {reportType === "monthly" ? (
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-500">Month</label>
                  <input
                    type="month"
                    value={reportMonthInput}
                    onChange={(e) => { setReportMonthInput(e.target.value); setReportGenerated(false); }}
                    className="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
                  />
                </div>
              ) : (
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-500">Any day in the week</label>
                  <input
                    type="date"
                    value={reportWeekInput}
                    onChange={(e) => { setReportWeekInput(e.target.value); setReportGenerated(false); }}
                    className="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
                  />
                </div>
              )}

              <button
                onClick={handleGenerateReport}
                disabled={reportLoading}
                className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
              >
                {reportLoading ? "Loading…" : "Generate report"}
              </button>

              {reportGenerated && reportLogs.length > 0 && (
                <button
                  onClick={handleDownloadCSV}
                  className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  ↓ Download CSV
                </button>
              )}
            </div>

            {reportGenerated && (
              <p className="mt-3 text-xs text-slate-500">
                {getReportDateRange().label} · {reportLogs.length} log entries · {[...new Set(reportLogs.map((l) => l.userId))].length} people
              </p>
            )}
          </div>

          {/* Summary table */}
          {reportGenerated && (() => {
            const summaryMap: Record<string, { name: string; role: string; days: number; totalHours: number; approvedHours: number; submittedHours: number; rejectedHours: number }> = {};
            for (const log of reportLogs) {
              if (!summaryMap[log.userId]) summaryMap[log.userId] = { name: log.userName, role: log.userRole, days: 0, totalHours: 0, approvedHours: 0, submittedHours: 0, rejectedHours: 0 };
              const s = summaryMap[log.userId];
              s.days++;
              s.totalHours += log.totalHours;
              if (log.status === "approved") s.approvedHours += log.totalHours;
              if (log.status === "submitted") s.submittedHours += log.totalHours;
              if (log.status === "rejected") s.rejectedHours += log.totalHours;
            }
            const summaries = Object.values(summaryMap);
            return summaries.length === 0 ? (
              <p className="rounded-lg border border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-400">
                No logs found for this period.
              </p>
            ) : (
              <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                <div className="border-b border-slate-100 px-4 py-2 text-sm font-medium text-slate-700">Summary</div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                      <tr>
                        <th className="px-4 py-2">Name</th>
                        <th className="px-4 py-2">Role</th>
                        <th className="px-4 py-2">Days logged</th>
                        <th className="px-4 py-2">Total hours</th>
                        <th className="px-4 py-2">Approved</th>
                        <th className="px-4 py-2">Pending</th>
                        <th className="px-4 py-2">Rejected</th>
                      </tr>
                    </thead>
                    <tbody>
                      {summaries.map((s) => (
                        <tr key={s.name} className="border-t border-slate-100">
                          <td className="px-4 py-2 font-medium text-slate-700">{s.name}</td>
                          <td className="px-4 py-2 text-slate-500 capitalize">{s.role.replace(/_/g, " ")}</td>
                          <td className="px-4 py-2 text-slate-700">{s.days}</td>
                          <td className="px-4 py-2 font-semibold text-slate-900">{s.totalHours}h</td>
                          <td className="px-4 py-2 text-emerald-700">{s.approvedHours}h</td>
                          <td className="px-4 py-2 text-blue-700">{s.submittedHours}h</td>
                          <td className="px-4 py-2 text-red-600">{s.rejectedHours}h</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })()}

          {/* Detailed log table */}
          {reportGenerated && reportLogs.length > 0 && (
            <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
              <div className="border-b border-slate-100 px-4 py-2 text-sm font-medium text-slate-700">Detailed log</div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-4 py-2">Name</th>
                      <th className="px-4 py-2">Date</th>
                      <th className="px-4 py-2">Clock in/out</th>
                      <th className="px-4 py-2">Hours</th>
                      <th className="px-4 py-2">Leave</th>
                      <th className="px-4 py-2">Status</th>
                      <th className="px-4 py-2">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportLogs.map((log, i) => (
                      <tr key={i} className="border-t border-slate-100">
                        <td className="px-4 py-2 font-medium text-slate-700">{log.userName}</td>
                        <td className="px-4 py-2 text-slate-600">{log.date}</td>
                        <td className="px-4 py-2 text-slate-500">
                          {log.clockIn && log.clockOut ? `${log.clockIn} – ${log.clockOut}` : "—"}
                        </td>
                        <td className="px-4 py-2 text-slate-700">{log.totalHours}h</td>
                        <td className="px-4 py-2 text-slate-500 capitalize">
                          {log.leaveType !== "none" ? log.leaveType : "—"}
                        </td>
                        <td className="px-4 py-2">
                          <span className={`rounded px-2 py-0.5 text-xs font-medium capitalize ${
                            log.status === "approved" ? "bg-emerald-100 text-emerald-700" :
                            log.status === "submitted" ? "bg-blue-100 text-blue-700" :
                            log.status === "rejected" ? "bg-red-100 text-red-700" :
                            "bg-slate-100 text-slate-600"
                          }`}>
                            {log.status}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-slate-500">{log.notes || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === "Projects" && (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-2">Project</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {projects.map((p) => (
                <tr key={p.id} className="border-t border-slate-100">
                  <td className="px-4 py-2 font-medium text-slate-700">{p.name}</td>
                  <td className="px-4 py-2 text-right">
                    <button
                      onClick={() => handleRemoveProject(p.id)}
                      className="text-sm font-medium text-red-600 hover:text-red-700"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex gap-2 border-t border-slate-100 px-4 py-3">
            <input
              type="text"
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddProject()}
              placeholder="New project name"
              className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
            />
            <button
              onClick={handleAddProject}
              className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
            >
              + Add project
            </button>
          </div>
        </div>
      )}

      {tab === "Bin" && (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <div className="border-b border-slate-100 px-4 py-3">
            <p className="text-sm text-slate-500">
              Deleted people are kept here for 30 days. Restore them before then or they are
              permanently gone.
            </p>
          </div>
          {deletedUsers.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-slate-400">The bin is empty.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-2">Name</th>
                  <th className="px-4 py-2">Email</th>
                  <th className="px-4 py-2">Role</th>
                  <th className="px-4 py-2">Deleted</th>
                  <th className="px-4 py-2">Days left</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {deletedUsers.map((u) => {
                  const deletedMs = new Date(u.deletedAt).getTime();
                  const daysLeft = Math.ceil((deletedMs + 30 * 24 * 60 * 60 * 1000 - Date.now()) / (24 * 60 * 60 * 1000));
                  return (
                    <tr key={u.id} className="border-t border-slate-100">
                      <td className="px-4 py-2 font-medium text-slate-700">{u.name}</td>
                      <td className="px-4 py-2 text-slate-500">{u.email}</td>
                      <td className="px-4 py-2 text-slate-500 capitalize">{u.role}</td>
                      <td className="px-4 py-2 text-slate-500">
                        {new Date(u.deletedAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-2">
                        <span className={`text-sm font-medium ${daysLeft <= 3 ? "text-red-600" : "text-slate-600"}`}>
                          {daysLeft}d
                        </span>
                      </td>
                      <td className="px-4 py-2 text-right">
                        <div className="flex justify-end gap-3">
                          <button
                            onClick={() => handleRestoreUser(u.id, u.name)}
                            className="text-sm font-medium text-emerald-600 hover:text-emerald-700"
                          >
                            Restore
                          </button>
                          <button
                            onClick={() => handlePermanentDelete(u.id, u.name)}
                            className="text-sm font-medium text-red-600 hover:text-red-700"
                          >
                            Delete forever
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === "Holidays" && (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-2">Date</th>
                <th className="px-4 py-2">Name</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {holidays.map((h) => (
                <tr key={h.id} className="border-t border-slate-100">
                  <td className="px-4 py-2 font-medium text-slate-700">{h.date}</td>
                  <td className="px-4 py-2 text-slate-500">{h.name}</td>
                  <td className="px-4 py-2 text-right">
                    <button
                      onClick={() => handleRemoveHoliday(h.id)}
                      className="text-sm font-medium text-red-600 hover:text-red-700"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex gap-2 border-t border-slate-100 px-4 py-3">
            <input
              type="date"
              value={newHolidayDate}
              onChange={(e) => setNewHolidayDate(e.target.value)}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
            />
            <input
              type="text"
              value={newHolidayName}
              onChange={(e) => setNewHolidayName(e.target.value)}
              placeholder="Holiday name"
              className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
            />
            <button
              onClick={handleAddHoliday}
              className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
            >
              + Add holiday
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
