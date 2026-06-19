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

  // Create the account directly rather than relying on Supabase's own invite
  // email (the free tier's send quota is very low and easily exhausted).
  // We generate a setup link ourselves and hand it back to the admin to send
  // however they like.
  let userId: string;
  let linkType: "invite" | "recovery" = "invite";
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
  });

  if (createError?.message?.includes("already been registered")) {
    // Account already exists (e.g. an earlier invite attempt) — just make
    // sure their profile is up to date and send a fresh setup link.
    // generateLink only accepts type "invite" for brand-new accounts, so an
    // existing account needs "recovery" instead.
    const { data: list, error: listError } = await admin.auth.admin.listUsers();
    const existing = list?.users.find((u) => u.email === email);
    if (listError || !existing) {
      return NextResponse.json({ error: "Could not find the existing account" }, { status: 400 });
    }
    userId = existing.id;
    linkType = "recovery";
  } else if (createError || !created.user) {
    return NextResponse.json({ error: createError?.message ?? "Account creation failed" }, { status: 400 });
  } else {
    userId = created.user.id;
  }

  const { error: profileError } = await admin.from("profiles").upsert({
    id: userId,
    full_name: fullName,
    email,
    role,
    status: "active",
    hourly_rate: hourlyRate ?? 0,
  });
  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 400 });
  }

  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: linkType,
    email,
  });
  if (linkError) {
    return NextResponse.json({ error: linkError.message }, { status: 400 });
  }

  const setupLink = `${request.nextUrl.origin}/auth/confirm?token_hash=${linkData.properties.hashed_token}&type=${linkType}`;

  return NextResponse.json({ success: true, setupLink });
}
