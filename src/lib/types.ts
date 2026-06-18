export type Role = "admin" | "employee" | "contractor";

export type LeaveType = "none" | "sick" | "vacation" | "holiday" | "unpaid";

export type LogStatus = "draft" | "submitted" | "approved" | "rejected";

export type User = {
  id: string;
  name: string;
  email: string;
  role: Role;
  status: "active" | "inactive";
  hourlyRate: number;
};

export type Project = {
  id: string;
  name: string;
};

export type DailyLog = {
  date: string; // YYYY-MM-DD
  userId: string;
  clockIn: string | null;
  clockOut: string | null;
  totalHours: number;
  leaveType: LeaveType;
  projectId: string | null;
  notes: string;
  status: LogStatus;
};
