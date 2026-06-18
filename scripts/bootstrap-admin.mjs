// One-time setup script: invites the very first admin account.
// Run with: node scripts/bootstrap-admin.mjs <email> <full name>
import { readFileSync } from "fs";
import { createClient } from "@supabase/supabase-js";

function loadEnvLocal() {
  const text = readFileSync(new URL("../.env.local", import.meta.url), "utf-8");
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    process.env[key] = value;
  }
}

async function main() {
  loadEnvLocal();
  const email = process.argv[2];
  const fullName = process.argv[3] ?? "Admin";

  if (!email) {
    console.error("Usage: node scripts/bootstrap-admin.mjs <email> <full name>");
    process.exit(1);
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const redirectTo = `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/auth/set-password`;

  const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo,
  });

  if (inviteError?.message?.includes("already been registered")) {
    // User exists from a previous invite (e.g. pointed at the wrong URL).
    // Resend a fresh link via the password-recovery flow instead.
    const { data: list } = await admin.auth.admin.listUsers();
    const existing = list?.users.find((u) => u.email === email);
    if (!existing) {
      console.error("User reported as existing but not found in listUsers().");
      process.exitCode = 1;
      return;
    }

    const { error: resendError } = await admin.auth.resetPasswordForEmail(email, { redirectTo });
    if (resendError) {
      console.error("Resend failed:", resendError.message);
      process.exitCode = 1;
      return;
    }

    const { error: upsertError } = await admin.from("profiles").upsert({
      id: existing.id,
      full_name: fullName,
      email,
      role: "admin",
      status: "active",
      hourly_rate: 0,
    });
    if (upsertError) {
      console.error("Profile upsert failed:", upsertError.message);
      process.exitCode = 1;
      return;
    }

    console.log(`${email} already existed — resent a password-setup link instead.`);
    return;
  }

  if (inviteError) {
    console.error("Invite failed:", inviteError.message);
    process.exitCode = 1;
    return;
  }

  const { error: profileError } = await admin.from("profiles").insert({
    id: invited.user.id,
    full_name: fullName,
    email,
    role: "admin",
    status: "active",
    hourly_rate: 0,
  });
  if (profileError) {
    console.error("Profile insert failed:", profileError.message);
    process.exitCode = 1;
    return;
  }

  console.log(`Invited ${email} as admin. They'll receive an email to set their password.`);
}

main();
