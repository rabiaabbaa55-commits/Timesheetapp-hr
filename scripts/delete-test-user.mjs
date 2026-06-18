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
  const email = process.argv[2];
  if (!email) {
    console.error("Usage: node scripts/delete-test-user.mjs <email>");
    process.exit(1);
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const { data: list } = await admin.auth.admin.listUsers();
  const user = list?.users.find((u) => u.email === email);
  if (!user) {
    console.log("No such user, nothing to delete.");
    return;
  }
  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) {
    console.error("Delete failed:", error.message);
    process.exitCode = 1;
    return;
  }
  console.log(`Deleted ${email}`);
}

main();
