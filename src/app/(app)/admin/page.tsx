"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useApp } from "@/lib/store";
import {
  addHoliday,
  addProject,
  fetchApprovedHoursByUser,
  fetchHolidays,
  fetchPendingLogs,
  fetchProfiles,
  fetchProjects,
  removeHoliday,
  removeProject,
  setLogStatus,
  updateHourlyRate,
} from "@/lib/queries";
import { DailyLog, Project, Role, User } from "@/lib/types";

const TABS = ["People", "Approvals", "Payroll", "Projects", "Holidays"] as const;
type Tab = (typeof TABS)[number];

export default function AdminPage() {
  const supabase = createClient();
  const { currentUser } = useApp();
  const [tab, setTab] = useState<Tab>("People");

  const [users, setUsers] = useState<User[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [holidays, setHolidays] = useState<{ id: string; date: string; name: string }[]>([]);
  const [pendingLogs, setPendingLogs] = useState<{ log: DailyLog; employeeName: string }[]>([]);
  const [approvedHours, setApprovedHours] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

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
        const [u, p, h, pending, hours] = await Promise.all([
          fetchProfiles(supabase),
          fetchProjects(supabase),
          fetchHolidays(supabase),
          fetchPendingLogs(supabase),
          fetchApprovedHoursByUser(supabase),
        ]);
        setUsers(u);
        setProjects(p);
        setHolidays(h);
        setPendingLogs(pending);
        setApprovedHours(hours);
      } finally {
        if (showSpinner) setLoading(false);
      }
    },
    [supabase]
  );

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const payroll = useMemo(
    () =>
      users
        .filter((u) => u.role !== "admin")
        .map((u) => {
          const hours = approvedHours[u.id] ?? 0;
          return { user: u, hours, total: hours * u.hourlyRate };
        }),
    [users, approvedHours]
  );

  async function updateRate(userId: string, rate: number) {
    setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, hourlyRate: rate } : u)));
    try {
      await updateHourlyRate(supabase, userId, rate);
    } catch {
      loadAll();
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
                <th className="px-4 py-2">Wage / hr</th>
                <th className="px-4 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-t border-slate-100">
                  <td className="px-4 py-2 font-medium text-slate-700">{u.name}</td>
                  <td className="px-4 py-2 text-slate-500">{u.email}</td>
                  <td className="px-4 py-2 capitalize text-slate-600">{u.role}</td>
                  <td className="px-4 py-2">
                    {u.role === "admin" ? (
                      <span className="text-slate-400">—</span>
                    ) : (
                      <div className="flex items-center gap-1 text-slate-700">
                        <span>$</span>
                        <input
                          type="number"
                          step="0.5"
                          value={u.hourlyRate}
                          onChange={(e) => updateRate(u.id, parseFloat(e.target.value) || 0)}
                          className="w-20 rounded-md border border-slate-300 px-2 py-1 text-sm outline-none focus:border-slate-900"
                        />
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
                </tr>
              ))}
            </tbody>
          </table>
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
                  <option value="employee">Employee</option>
                  <option value="contractor">Contractor</option>
                  <option value="admin">Admin</option>
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
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-2">Employee</th>
                <th className="px-4 py-2">Approved hours</th>
                <th className="px-4 py-2">Wage / hr</th>
                <th className="px-4 py-2">Total paid</th>
              </tr>
            </thead>
            <tbody>
              {payroll.map(({ user, hours, total }) => (
                <tr key={user.id} className="border-t border-slate-100">
                  <td className="px-4 py-2 font-medium text-slate-700">{user.name}</td>
                  <td className="px-4 py-2 text-slate-600">{hours}h</td>
                  <td className="px-4 py-2 text-slate-600">${user.hourlyRate.toFixed(2)}</td>
                  <td className="px-4 py-2 font-semibold text-slate-900">${total.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="border-t border-slate-100 px-4 py-3 text-xs text-slate-400">
            Based on approved logs only. Set wages from the People tab.
          </p>
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
