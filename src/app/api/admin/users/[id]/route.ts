import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

async function requireAdmin() {
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) {
    return { error: NextResponse.json({ error: "Not authenticated" }, { status: 401 }) };
  }
  const { data: callerProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", authData.user.id)
    .single();
  if (callerProfile?.role !== "admin") {
    return { error: NextResponse.json({ error: "Admin access required" }, { status: 403 }) };
  }
  return { callerId: authData.user.id };
}

// DELETE with ?permanent=true → hard delete from auth (cascades to profiles + daily_logs).
// DELETE without that param → soft-delete: ban + stamp deleted_at so Bin can restore within 30 days.
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const { id } = await params;
  if (id === auth.callerId) {
    return NextResponse.json({ error: "You cannot delete your own account" }, { status: 400 });
  }

  const admin = createAdminClient();
  const permanent = new URL(request.url).searchParams.get("permanent") === "true";

  if (permanent) {
    const { error } = await admin.auth.admin.deleteUser(id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ success: true });
  }

  // Soft-delete: ban the auth user so they cannot log in while in the bin.
  const { error: banError } = await admin.auth.admin.updateUserById(id, {
    ban_duration: "876000h", // ~100 years
  });
  if (banError) {
    return NextResponse.json({ error: banError.message }, { status: 400 });
  }

  // Stamp deleted_at on the profile (keeps the row for Bin/restore).
  const { error: profileError } = await admin
    .from("profiles")
    .update({ deleted_at: new Date().toISOString(), status: "inactive" })
    .eq("id", id);
  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}

// Restore from bin: unban the auth user and clear deleted_at.
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const { id } = await params;
  const admin = createAdminClient();

  const { error: unbanError } = await admin.auth.admin.updateUserById(id, {
    ban_duration: "none",
  });
  if (unbanError) {
    return NextResponse.json({ error: unbanError.message }, { status: 400 });
  }

  const { error: profileError } = await admin
    .from("profiles")
    .update({ deleted_at: null, status: "active" })
    .eq("id", id);
  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
