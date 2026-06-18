"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { MONTH_NAMES, daysInMonth, isWeekend, toDateKey } from "@/lib/date-utils";
import { createClient } from "@/lib/supabase/client";
import { useApp } from "@/lib/store";
import { fetchHolidays, fetchLogsForUser, fetchProjects, saveLog } from "@/lib/queries";
import { DailyLog, Project } from "@/lib/types";
import DayEntryModal from "./DayEntryModal";

const statusBadge: Record<string, string> = {
  approved: "bg-emerald-100 text-emerald-700",
  submitted: "bg-blue-100 text-blue-700",
  draft: "bg-slate-100 text-slate-600",
  rejected: "bg-red-100 text-red-700",
};

export default function MonthView({ monthKey }: { monthKey: string }) {
  const supabase = createClient();
  const { currentUser, notifyAdmins } = useApp();
  const [year, monthNum] = monthKey.split("-").map(Number);
  const month = monthNum - 1;
  const numDays = daysInMonth(year, month);

  const [logs, setLogs] = useState<Record<string, DailyLog>>({});
  const [holidaysByDate, setHolidaysByDate] = useState<Map<string, string>>(new Map());
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeDate, setActiveDate] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const projectsById = new Map(projects.map((p) => [p.id, p.name]));

  const load = useCallback(async () => {
    if (!currentUser) return;
    setLoading(true);
    const [logMap, holidayRows, projectRows] = await Promise.all([
      fetchLogsForUser(supabase, currentUser.id, monthKey),
      fetchHolidays(supabase),
      fetchProjects(supabase),
    ]);
    setLogs(logMap);
    setHolidaysByDate(new Map(holidayRows.map((h) => [h.date, h.name])));
    setProjects(projectRows);
    setLoading(false);
  }, [supabase, currentUser, monthKey]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSave(log: DailyLog) {
    if (!currentUser) return;
    log = { ...log, userId: currentUser.id };
    await saveLog(supabase, log);
    setLogs((prev) => ({ ...prev, [log.date]: log }));
    setActiveDate(null);
    if (log.status === "submitted") {
      notifyAdmins(
        `${currentUser.name} (${currentUser.role}) submitted hours for ${log.date} — ${log.totalHours}h`
      );
    }
  }

  const totalHours = Object.values(logs)
    .filter((l) => l.date.startsWith(monthKey))
    .reduce((sum, l) => sum + l.totalHours, 0);
  const totalEarned = currentUser ? totalHours * currentUser.hourlyRate : 0;

  if (loading) {
    return <p className="text-sm text-slate-500">Loading…</p>;
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <Link href="/calendar" className="text-sm text-slate-500 hover:text-slate-700">
            ← Back to year
          </Link>
          <h1 className="mt-1 text-2xl font-semibold text-slate-900">
            {MONTH_NAMES[month]} {year}
          </h1>
        </div>
        <div className="flex gap-3">
          <div className="rounded-md border border-slate-200 bg-white px-4 py-2 text-sm">
            <span className="text-slate-500">Total logged: </span>
            <span className="font-semibold text-slate-900">{totalHours}h</span>
          </div>
          <div className="rounded-md border border-slate-200 bg-white px-4 py-2 text-sm">
            <span className="text-slate-500">Earned: </span>
            <span className="font-semibold text-slate-900">${totalEarned.toFixed(2)}</span>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-2">Date</th>
              <th className="px-4 py-2">Clock in/out</th>
              <th className="px-4 py-2">Hours</th>
              <th className="px-4 py-2">Leave</th>
              <th className="px-4 py-2">Project</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: numDays }, (_, i) => i + 1).map((day) => {
              const dateKey = toDateKey(year, month, day);
              const log = logs[dateKey];
              const holiday = holidaysByDate.get(dateKey);
              const weekend = isWeekend(year, month, day);

              return (
                <tr
                  key={dateKey}
                  className={`border-t border-slate-100 ${weekend ? "bg-slate-50/60" : ""}`}
                >
                  <td className="px-4 py-2 font-medium text-slate-700">
                    {dateKey}
                    {holiday && (
                      <span className="ml-2 rounded bg-purple-100 px-1.5 py-0.5 text-xs text-purple-700">
                        {holiday}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-slate-500">
                    {log?.clockIn && log?.clockOut ? `${log.clockIn} – ${log.clockOut}` : "—"}
                  </td>
                  <td className="px-4 py-2 text-slate-700">{log?.totalHours ?? "—"}</td>
                  <td className="px-4 py-2 text-slate-500 capitalize">
                    {log && log.leaveType !== "none" ? log.leaveType : "—"}
                  </td>
                  <td className="px-4 py-2 text-slate-500">
                    {log?.projectId ? projectsById.get(log.projectId) ?? "—" : "—"}
                  </td>
                  <td className="px-4 py-2">
                    {log ? (
                      <span
                        className={`rounded px-2 py-0.5 text-xs font-medium capitalize ${statusBadge[log.status]}`}
                      >
                        {log.status}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400">No entry</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <button
                      onClick={() => setActiveDate(dateKey)}
                      className="text-sm font-medium text-slate-700 hover:text-slate-900"
                    >
                      {log ? "Edit" : "Add"}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {activeDate && (
        <DayEntryModal
          date={activeDate}
          existing={logs[activeDate] ?? null}
          projects={projects}
          onClose={() => setActiveDate(null)}
          onSave={handleSave}
        />
      )}
    </div>
  );
}
