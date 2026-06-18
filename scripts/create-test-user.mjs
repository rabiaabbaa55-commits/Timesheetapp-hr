// Temporary verification helper — creates a confirmed user with a known
// password so we can test the real auth flow end-to-end, then this user
// should be deleted via delete-test-user.mjs.
import { readFileSync } from "fs";
import { createClient } from "@supabase/supabase-js";

function loadEnvLocal() {
  const text = readFileSync(new URL("../.env.local", import.meta.url), "utf-8");
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    process.env[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
  }
}

async function main() {
  loadEnvLocal();
  const [, , email, password, fullName, role] = process.argv;
  if (!email || !password || !fullName || !role) {
    console.error("Usage: node scripts/create-test-user.mjs <email> <password> <full name> <role>");
    process.exit(1);
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (createError) {
    console.error("Create failed:", createError.message);
    process.exitCode = 1;
    return;
  }

  const { error: profileError } = await admin.from("profiles").insert({
    id: created.user.id,
    full_name: fullName,
    email,
    role,
    status: "active",
    hourly_rate: role === "admin" ? 0 : 20,
  });
  if (profileError) {
    console.error("Profile insert failed:", profileError.message);
    process.exitCode = 1;
    return;
  }

  console.log(`Created test user ${email} (id: ${created.user.id})`);
}

main();
