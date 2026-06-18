import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: NextRequest) {
  // Only an already-authenticated admin may invite new accounts.
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const { data: callerProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", authData.user.id)
    .single();
  if (callerProfile?.role !== "admin") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const { email, fullName, role, hourlyRate } = await request.json();
  if (!email || !fullName || !role) {
    return NextResponse.json({ error: "email, fullName, and role are required" }, { status: 400 });
  }
  if (!["admin", "employee", "contractor"].includes(role)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  const admin = createAdminClient();
  const redirectTo = `${request.nextUrl.origin}/auth/set-password`;

  const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo,
  });
  if (inviteError || !invited.user) {
    return NextResponse.json({ error: inviteError?.message ?? "Invite failed" }, { status: 400 });
  }

  const { error: profileError } = await admin.from("profiles").insert({
    id: invited.user.id,
    full_name: fullName,
    email,
    role,
    status: "active",
    hourly_rate: hourlyRate ?? 0,
  });
  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
