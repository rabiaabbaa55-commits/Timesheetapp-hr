export type Role =
  | "admin"
  | "employee"
  | "contractor"
  | "volunteer"
  | "court_community_service"
  | "concession_stand"
  | "cleaning_staff"
  | "other";

export const ROLE_LABELS: Record<Role, string> = {
  admin: "Admin",
  employee: "Employee",
  contractor: "Contractor",
  volunteer: "Volunteer",
  court_community_service: "Court Community Service",
  concession_stand: "Concession Stand",
  cleaning_staff: "Cleaning Staff",
  other: "Other",
};

export type LeaveType = "none" | "sick" | "vacation" | "holiday" | "unpaid";

export type LogStatus = "draft" | "submitted" | "approved" | "rejected";

export type PayType = "hourly" | "salary" | "daily";

export type User = {
  id: string;
  name: string;
  email: string;
  role: Role;
  status: "active" | "inactive";
  hourlyRate: number;
  payType: PayType;
  salaryAmount: number;
};

export type DeletedUser = User & { deletedAt: string };

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
