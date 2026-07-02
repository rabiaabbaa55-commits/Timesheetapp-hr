"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  MONTH_NAMES,
  daysInMonth,
  firstWeekday,
  isWeekend,
  pad,
  toDateKey,
} from "@/lib/date-utils";
import { createClient } from "@/lib/supabase/client";
import { useApp } from "@/lib/store";
import { fetchAllLogsForYear, fetchHolidays } from "@/lib/queries";
import { DailyLog } from "@/lib/types";

function dayColor(
  dateKey: string,
  year: number,
  month: number,
  day: number,
  logsByDate: Map<string, DailyLog>,
  holidaysByDate: Map<string, string>
) {
  if (holidaysByDate.has(dateKey)) return "bg-purple-100 text-purple-700";
  const log = logsByDate.get(dateKey);
  if (log) {
    if (log.leaveType !== "none") return "bg-amber-100 text-amber-700";
    if (log.status === "approved") return "bg-emerald-100 text-emerald-700";
    if (log.status === "submitted") return "bg-blue-100 text-blue-700";
    if (log.status === "rejected") return "bg-red-100 text-red-700";
    return "bg-slate-100 text-slate-600";
  }
  if (isWeekend(year, month, day)) return "bg-slate-50 text-slate-400";
  const today = new Date();
  const cellDate = new Date(year, month, day);
  if (cellDate < today) return "bg-rose-50 text-rose-500";
  return "text-slate-700";
}

function MiniMonth({
  year,
  month,
  logsByDate,
  holidaysByDate,
}: {
  year: number;
  month: number;
  logsByDate: Map<string, DailyLog>;
  holidaysByDate: Map<string, string>;
}) {
  const numDays = daysInMonth(year, month);
  const startOffset = firstWeekday(year, month);
  const cells: (number | null)[] = [
    ...Array(startOffset).fill(null),
    ...Array.from({ length: numDays }, (_, i) => i + 1),
  ];

  return (
    <Link
      href={`/calendar/${year}-${pad(month + 1)}`}
      className="block rounded-lg border border-slate-200 bg-white p-3 hover:border-slate-400 hover:shadow-sm transition-all"
    >
      <p className="mb-2 text-sm font-semibold text-slate-900">{MONTH_NAMES[month]}</p>
      <div className="grid grid-cols-7 gap-1 text-[10px]">
        {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
          <div key={i} className="text-center text-slate-400">{d}</div>
        ))}
        {cells.map((day, i) =>
          day === null ? (
            <div key={i} />
          ) : (
            <div
              key={i}
              className={`flex h-5 w-5 items-center justify-center rounded ${dayColor(
                toDateKey(year, month, day),
                year,
                month,
                day,
                logsByDate,
                holidaysByDate
              )}`}
            >
              {day}
            </div>
          )
        )}
      </div>
    </Link>
  );
}

const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  submitted: "Pending approval",
  approved: "Approved",
  rejected: "Rejected",
};

const STATUS_BADGE: Record<string, string> = {
  draft: "bg-slate-100 text-slate-600",
  submitted: "bg-blue-100 text-blue-700",
  approved: "bg-emerald-100 text-emerald-700",
  rejected: "bg-red-100 text-red-700",
};

export default function YearCalendar({ initialYear }: { initialYear: number }) {
  const supabase = createClient();
  const { currentUser } = useApp();
  const [year, setYear] = useState(initialYear);
  const [logsByDate, setLogsByDate] = useState<Map<string, DailyLog>>(new Map());
  const [holidaysByDate, setHolidaysByDate] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!currentUser) return;
    setLoading(true);
    const [logMap, holidayRows] = await Promise.all([
      fetchAllLogsForYear(supabase, currentUser.id, year),
      fetchHolidays(supabase),
    ]);
    setLogsByDate(new Map(Object.entries(logMap)));
    setHolidaysByDate(new Map(holidayRows.map((h) => [h.date, h.name])));
    setLoading(false);
  }, [supabase, currentUser, year]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setYear((y) => y - 1)}
            className="rounded-md border border-slate-200 px-2 py-1 text-sm text-slate-600 hover:bg-slate-100"
          >
            ←
          </button>
          <h1 className="text-2xl font-semibold text-slate-900">{year}</h1>
          <button
            onClick={() => setYear((y) => y + 1)}
            className="rounded-md border border-slate-200 px-2 py-1 text-sm text-slate-600 hover:bg-slate-100"
          >
            →
          </button>
        </div>
        <Legend />
      </div>

      {loading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 12 }, (_, m) => (
              <MiniMonth
                key={m}
                year={year}
                month={m}
                logsByDate={logsByDate}
                holidaysByDate={holidaysByDate}
              />
            ))}
          </div>

          <HoursSummary year={year} logsByDate={logsByDate} />
        </>
      )}
    </div>
  );
}

function HoursSummary({ year, logsByDate }: { year: number; logsByDate: Map<string, DailyLog> }) {
  const allLogs = Array.from(logsByDate.values())
    .filter((l) => l.date.startsWith(String(year)))
    .sort((a, b) => b.date.localeCompare(a.date));

  const approvedHours = allLogs.filter((l) => l.status === "approved").reduce((s, l) => s + l.totalHours, 0);
  const pendingCount = allLogs.filter((l) => l.status === "submitted").length;
  const rejectedCount = allLogs.filter((l) => l.status === "rejected").length;

  const recent = allLogs.filter((l) => l.status !== "draft").slice(0, 10);

  return (
    <div className="mt-8">
      {/* Stat cards */}
      <div className="mb-4 grid grid-cols-3 gap-3">
        <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
          <p className="text-xs text-slate-500">Approved hours</p>
          <p className="mt-1 text-2xl font-semibold text-emerald-700">{approvedHours}h</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
          <p className="text-xs text-slate-500">Pending approval</p>
          <p className="mt-1 text-2xl font-semibold text-blue-700">{pendingCount}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
          <p className="text-xs text-slate-500">Rejected</p>
          <p className="mt-1 text-2xl font-semibold text-red-600">{rejectedCount}</p>
        </div>
      </div>

      {/* Recent submissions list */}
      {recent.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <div className="border-b border-slate-100 px-4 py-2">
            <p className="text-sm font-medium text-slate-700">Recent submissions</p>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-2">Date</th>
                <th className="px-4 py-2">Hours</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Notes</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((log) => (
                <tr key={log.date} className="border-t border-slate-100">
                  <td className="px-4 py-2 font-medium text-slate-700">{log.date}</td>
                  <td className="px-4 py-2 text-slate-600">{log.totalHours}h</td>
                  <td className="px-4 py-2">
                    <span className={`rounded px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[log.status]}`}>
                      {STATUS_LABEL[log.status]}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-slate-500">{log.notes || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Legend() {
  const items: { label: string; cls: string }[] = [
    { label: "Approved", cls: "bg-emerald-100 text-emerald-700" },
    { label: "Submitted", cls: "bg-blue-100 text-blue-700" },
    { label: "Leave", cls: "bg-amber-100 text-amber-700" },
    { label: "Holiday", cls: "bg-purple-100 text-purple-700" },
    { label: "Missing", cls: "bg-rose-50 text-rose-500" },
  ];
  return (
    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-1.5">
          <span className={`h-3 w-3 rounded ${item.cls}`} />
          {item.label}
        </div>
      ))}
    </div>
  );
}
