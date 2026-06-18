import { DailyLog, Project, User } from "./types";

export const currentUser: User = {
  id: "u1",
  name: "Jordan Lee",
  email: "jordan@company.com",
  role: "employee",
  status: "active",
  hourlyRate: 22,
};

export const users: User[] = [
  currentUser,
  { id: "u2", name: "Sam Rivera", email: "sam@company.com", role: "contractor", status: "active", hourlyRate: 28 },
  { id: "u3", name: "Priya Nair", email: "priya@company.com", role: "employee", status: "active", hourlyRate: 24 },
  { id: "u4", name: "Admin User", email: "admin@company.com", role: "admin", status: "active", hourlyRate: 0 },
];

export const projects: Project[] = [
  { id: "p1", name: "Cleaning" },
  { id: "p2", name: "ACHR Office" },
  { id: "p3", name: "Concession Stand" },
];

export const holidays: { date: string; name: string }[] = [
  { date: "2026-01-01", name: "New Year's Day" },
  { date: "2026-07-04", name: "Independence Day" },
  { date: "2026-12-25", name: "Christmas Day" },
];

export const sampleLogs: DailyLog[] = [
  {
    date: "2026-06-15",
    userId: "u1",
    clockIn: "09:00",
    clockOut: "17:30",
    totalHours: 8.5,
    leaveType: "none",
    projectId: "p1",
    notes: "Finished homepage layout, started on calendar component.",
    status: "approved",
  },
  {
    date: "2026-06-16",
    userId: "u1",
    clockIn: "09:15",
    clockOut: "17:00",
    totalHours: 7.75,
    leaveType: "none",
    projectId: "p2",
    notes: "Sprint planning + API integration.",
    status: "submitted",
  },
  {
    date: "2026-06-17",
    userId: "u1",
    clockIn: null,
    clockOut: null,
    totalHours: 8,
    leaveType: "vacation",
    projectId: null,
    notes: "Day off.",
    status: "approved",
  },
];
