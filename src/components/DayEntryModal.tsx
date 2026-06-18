"use client";

import { useState } from "react";
import { DailyLog, LeaveType, Project } from "@/lib/types";

const LEAVE_OPTIONS: { value: LeaveType; label: string }[] = [
  { value: "none", label: "None (working day)" },
  { value: "sick", label: "Sick leave" },
  { value: "vacation", label: "Vacation" },
  { value: "holiday", label: "Holiday" },
  { value: "unpaid", label: "Unpaid leave" },
];

export default function DayEntryModal({
  date,
  existing,
  projects,
  onClose,
  onSave,
}: {
  date: string;
  existing: DailyLog | null;
  projects: Project[];
  onClose: () => void;
  onSave: (log: DailyLog) => void;
}) {
  const [clockIn, setClockIn] = useState(existing?.clockIn ?? "");
  const [clockOut, setClockOut] = useState(existing?.clockOut ?? "");
  const [totalHours, setTotalHours] = useState(existing?.totalHours?.toString() ?? "");
  const [leaveType, setLeaveType] = useState<LeaveType>(existing?.leaveType ?? "none");
  const [projectId, setProjectId] = useState(existing?.projectId ?? "");
  const [notes, setNotes] = useState(existing?.notes ?? "");

  function handleSave(status: "draft" | "submitted") {
    onSave({
      date,
      userId: existing?.userId ?? "",
      clockIn: clockIn || null,
      clockOut: clockOut || null,
      totalHours: parseFloat(totalHours) || 0,
      leaveType,
      projectId: projectId || null,
      notes,
      status,
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-lg">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">{date}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            ✕
          </button>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Clock in</label>
              <input
                type="time"
                value={clockIn}
                onChange={(e) => setClockIn(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Clock out</label>
              <input
                type="time"
                value={clockOut}
                onChange={(e) => setClockOut(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Total hours</label>
            <input
              type="number"
              step="0.25"
              value={totalHours}
              onChange={(e) => setTotalHours(e.target.value)}
              placeholder="8"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Leave / absence</label>
            <select
              value={leaveType}
              onChange={(e) => setLeaveType(e.target.value as LeaveType)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
            >
              {LEAVE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Project</label>
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
            >
              <option value="">No project</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="What did you work on?"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
            />
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button
            onClick={() => handleSave("draft")}
            className="rounded-md border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
          >
            Save draft
          </button>
          <button
            onClick={() => handleSave("submitted")}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            Submit
          </button>
        </div>
      </div>
    </div>
  );
}
