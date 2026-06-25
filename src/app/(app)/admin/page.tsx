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
  fetchHolidays,
  fetchPendingLogs,
  fetchProfiles,
  fetchProjects,
  removeHoliday,
  removeProject,
  setLogStatus,
  updateHourlyRate,
  updatePayType,
  updateSalaryAmount,
  updateUserRole,
} from "@/lib/queries";
import { DailyLog, PayType, Project, Role, User } from "@/lib/types";

const TABS = ["People", "Approvals", "Payroll", "Projects", "Holidays"] as const;
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
  const [loading, setLoading] = useState(true);
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
        const [u, p, h, pending, logs] = await Promise.all([
          fetchProfiles(supabase),
          fetchProjects(supabase),
          fetchHolidays(supabase),
          fetchPendingLogs(supabase),
          fetchApprovedLogs(supabase),
        ]);
        setUsers(u);
        setProjects(p);
        setHolidays(h);
        setPendingLogs(pending);
        setApprovedLogs(logs);
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

  const payroll = useMemo(
    () =>
      users
        .filter((u) => u.role !== "admin")
        .map((u) => {
          const hours = approvedHours[u.id] ?? 0;
          const total = u.payType === "salary" ? u.salaryAmount : hours * u.hourlyRate;
          return { user: u, hours, total };
        })
        .filter((p) => p.hours > 0),
    [users, approvedHours]
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

      <div className="mb-6 flex gap-1 border-b border-slate-200">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium ${
              tab === t
                ? "border-b-2 border-slate-900 text-slate-900"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {t}
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
