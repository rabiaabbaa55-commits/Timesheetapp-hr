import { SupabaseClient } from "@supabase/supabase-js";
import { DailyLog, LeaveType, LogStatus, PayType, Project, Role, User } from "./types";

type ProfileRow = {
  id: string;
  full_name: string;
  email: string;
  role: Role;
  status: "active" | "inactive";
  hourly_rate: number;
  pay_type: PayType;
  salary_amount: number;
};

type DailyLogRow = {
  id?: string;
  user_id: string;
  date: string;
  clock_in: string | null;
  clock_out: string | null;
  total_hours: number;
  leave_type: LeaveType;
  project_id: string | null;
  notes: string;
  status: LogStatus;
};

function toUser(row: ProfileRow): User {
  return {
    id: row.id,
    name: row.full_name,
    email: row.email,
    role: row.role,
    status: row.status,
    hourlyRate: row.hourly_rate,
    payType: row.pay_type,
    salaryAmount: row.salary_amount,
  };
}

function toLog(row: DailyLogRow): DailyLog {
  return {
    date: row.date,
    userId: row.user_id,
    clockIn: row.clock_in,
    clockOut: row.clock_out,
    totalHours: row.total_hours,
    leaveType: row.leave_type,
    projectId: row.project_id,
    notes: row.notes,
    status: row.status,
  };
}

export async function fetchProfiles(supabase: SupabaseClient): Promise<User[]> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, email, role, status, hourly_rate, pay_type, salary_amount")
    .order("full_name");
  if (error) throw error;
  return (data as ProfileRow[]).map(toUser);
}

export async function updateUserRole(supabase: SupabaseClient, userId: string, role: Role) {
  const { error } = await supabase.from("profiles").update({ role }).eq("id", userId);
  if (error) throw error;
}

export async function updateHourlyRate(
  supabase: SupabaseClient,
  userId: string,
  hourlyRate: number
) {
  const { error } = await supabase
    .from("profiles")
    .update({ hourly_rate: hourlyRate })
    .eq("id", userId);
  if (error) throw error;
}

export async function updatePayType(supabase: SupabaseClient, userId: string, payType: PayType) {
  const { error } = await supabase.from("profiles").update({ pay_type: payType }).eq("id", userId);
  if (error) throw error;
}

export async function updateSalaryAmount(
  supabase: SupabaseClient,
  userId: string,
  salaryAmount: number
) {
  const { error } = await supabase
    .from("profiles")
    .update({ salary_amount: salaryAmount })
    .eq("id", userId);
  if (error) throw error;
}

export async function fetchProjects(supabase: SupabaseClient): Promise<Project[]> {
  const { data, error } = await supabase
    .from("projects")
    .select("id, name")
    .eq("active", true)
    .order("name");
  if (error) throw error;
  return data as Project[];
}

export async function addProject(supabase: SupabaseClient, name: string) {
  const { error } = await supabase.from("projects").insert({ name });
  if (error) throw error;
}

export async function removeProject(supabase: SupabaseClient, id: string) {
  const { error } = await supabase.from("projects").delete().eq("id", id);
  if (error) throw error;
}

export async function fetchHolidays(
  supabase: SupabaseClient
): Promise<{ date: string; name: string; id: string }[]> {
  const { data, error } = await supabase
    .from("holidays")
    .select("id, date, name")
    .order("date");
  if (error) throw error;
  return data;
}

export async function addHoliday(supabase: SupabaseClient, date: string, name: string) {
  const { error } = await supabase.from("holidays").insert({ date, name });
  if (error) throw error;
}

export async function removeHoliday(supabase: SupabaseClient, id: string) {
  const { error } = await supabase.from("holidays").delete().eq("id", id);
  if (error) throw error;
}

export async function fetchLogsForUser(
  supabase: SupabaseClient,
  userId: string,
  monthPrefix?: string
): Promise<Record<string, DailyLog>> {
  let query = supabase.from("daily_logs").select("*").eq("user_id", userId);
  if (monthPrefix) {
    const [y, m] = monthPrefix.split("-").map(Number);
    const lastDay = new Date(y, m, 0).getDate();
    query = query.gte("date", `${monthPrefix}-01`).lte("date", `${monthPrefix}-${String(lastDay).padStart(2, "0")}`);
  }
  const { data, error } = await query;
  if (error) throw error;
  const map: Record<string, DailyLog> = {};
  for (const row of data as DailyLogRow[]) map[row.date] = toLog(row);
  return map;
}

export async function fetchAllLogsForYear(
  supabase: SupabaseClient,
  userId: string,
  year: number
): Promise<Record<string, DailyLog>> {
  const { data, error } = await supabase
    .from("daily_logs")
    .select("*")
    .eq("user_id", userId)
    .gte("date", `${year}-01-01`)
    .lte("date", `${year}-12-31`);
  if (error) throw error;
  const map: Record<string, DailyLog> = {};
  for (const row of data as DailyLogRow[]) map[row.date] = toLog(row);
  return map;
}

export async function saveLog(supabase: SupabaseClient, log: DailyLog) {
  const row: DailyLogRow = {
    user_id: log.userId,
    date: log.date,
    clock_in: log.clockIn,
    clock_out: log.clockOut,
    total_hours: log.totalHours,
    leave_type: log.leaveType,
    project_id: log.projectId,
    notes: log.notes,
    status: log.status,
  };
  const { error } = await supabase
    .from("daily_logs")
    .upsert(row, { onConflict: "user_id,date" });
  if (error) throw error;
}

export async function fetchPendingLogs(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from("daily_logs")
    .select("*, profiles!daily_logs_user_id_fkey(full_name)")
    .eq("status", "submitted")
    .order("date");
  if (error) throw error;
  return (data as (DailyLogRow & { profiles: { full_name: string } | null })[]).map((row) => ({
    log: toLog(row),
    employeeName: row.profiles?.full_name ?? "Unknown",
  }));
}

export async function setLogStatus(
  supabase: SupabaseClient,
  userId: string,
  date: string,
  status: "approved" | "rejected",
  approvedBy: string
) {
  const { error } = await supabase
    .from("daily_logs")
    .update({ status, approved_by: approvedBy, approved_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("date", date);
  if (error) throw error;
}

export type ApprovedLogRow = { userId: string; date: string; totalHours: number };

export async function fetchApprovedLogs(supabase: SupabaseClient): Promise<ApprovedLogRow[]> {
  const { data, error } = await supabase
    .from("daily_logs")
    .select("user_id, date, total_hours")
    .eq("status", "approved");
  if (error) throw error;
  return (data as { user_id: string; date: string; total_hours: number }[]).map((row) => ({
    userId: row.user_id,
    date: row.date,
    totalHours: row.total_hours,
  }));
}

export async function deleteApprovedLogs(
  supabase: SupabaseClient,
  userId: string,
  monthPrefix?: string
) {
  let query = supabase.from("daily_logs").delete().eq("user_id", userId).eq("status", "approved");
  if (monthPrefix) {
    const [y, m] = monthPrefix.split("-").map(Number);
    const lastDay = new Date(y, m, 0).getDate();
    query = query
      .gte("date", `${monthPrefix}-01`)
      .lte("date", `${monthPrefix}-${String(lastDay).padStart(2, "0")}`);
  }
  const { error } = await query;
  if (error) throw error;
}

export type NotificationRow = {
  id: string;
  message: string;
  created_at: string;
  read: boolean;
};

export async function fetchNotifications(supabase: SupabaseClient): Promise<NotificationRow[]> {
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return data;
}

export async function insertNotification(supabase: SupabaseClient, message: string) {
  const { error } = await supabase.from("notifications").insert({ message });
  if (error) throw error;
}

export async function markNotificationsRead(supabase: SupabaseClient) {
  const { error } = await supabase.from("notifications").update({ read: true }).eq("read", false);
  if (error) throw error;
}
