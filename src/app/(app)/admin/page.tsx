"use client";

import { useMemo, useState } from "react";
import { holidays, projects as initialProjects, sampleLogs, users as initialUsers } from "@/lib/mock-data";
import { Project, User } from "@/lib/types";

const TABS = ["People", "Approvals", "Payroll", "Projects", "Holidays"] as const;
type Tab = (typeof TABS)[number];

export default function AdminPage() {
  const [tab, setTab] = useState<Tab>("People");
  const [users, setUsers] = useState<User[]>(initialUsers);
  const [projects, setProjects] = useState<Project[]>(initialProjects);
  const [newProjectName, setNewProjectName] = useState("");

  const pendingLogs = sampleLogs.filter((l) => l.status === "submitted");

  const payroll = useMemo(
    () =>
      users
        .filter((u) => u.role !== "admin")
        .map((u) => {
          const approvedHours = sampleLogs
            .filter((l) => l.userId === u.id && l.status === "approved")
            .reduce((sum, l) => sum + l.totalHours, 0);
          return { user: u, hours: approvedHours, total: approvedHours * u.hourlyRate };
        }),
    [users]
  );

  function updateRate(userId: string, rate: number) {
    setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, hourlyRate: rate } : u)));
  }

  function addProject() {
    const name = newProjectName.trim();
    if (!name) return;
    setProjects((prev) => [...prev, { id: `p${Date.now()}`, name }]);
    setNewProjectName("");
  }

  function removeProject(id: string) {
    setProjects((prev) => prev.filter((p) => p.id !== id));
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
                <th className="px-4 py-2"></th>
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
                  <td className="px-4 py-2 text-right">
                    <button className="text-sm font-medium text-slate-700 hover:text-slate-900">
                      Manage
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="border-t border-slate-100 px-4 py-3">
            <button className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800">
              + Invite employee / contractor
            </button>
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
                {pendingLogs.map((log) => {
                  const user = users.find((u) => u.id === log.userId);
                  return (
                    <tr key={log.date} className="border-t border-slate-100">
                      <td className="px-4 py-2 text-slate-700">{log.date}</td>
                      <td className="px-4 py-2 text-slate-700">{user?.name}</td>
                      <td className="px-4 py-2 text-slate-700">{log.totalHours}</td>
                      <td className="px-4 py-2 text-slate-500">{log.notes}</td>
                      <td className="px-4 py-2 text-right">
                        <div className="flex justify-end gap-2">
                          <button className="rounded-md border border-emerald-200 px-3 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-50">
                            Approve
                          </button>
                          <button className="rounded-md border border-red-200 px-3 py-1 text-xs font-medium text-red-700 hover:bg-red-50">
                            Reject
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
                      onClick={() => removeProject(p.id)}
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
              onKeyDown={(e) => e.key === "Enter" && addProject()}
              placeholder="New project name"
              className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
            />
            <button
              onClick={addProject}
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
                <tr key={h.date} className="border-t border-slate-100">
                  <td className="px-4 py-2 font-medium text-slate-700">{h.date}</td>
                  <td className="px-4 py-2 text-slate-500">{h.name}</td>
                  <td className="px-4 py-2 text-right">
                    <button className="text-sm font-medium text-slate-700 hover:text-slate-900">
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="border-t border-slate-100 px-4 py-3">
            <button className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800">
              + Add holiday
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
