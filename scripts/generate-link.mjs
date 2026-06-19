// Generates a scanner-safe link (points at our own /auth/confirm page,
// which only consumes the token on an explicit button click — not on
// page load — so email security scanners that pre-fetch links don't
// burn the one-time token before the real recipient clicks it).
// Run with: node scripts/generate-link.mjs <email> <recovery|invite>
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
  const type = process.argv[3] ?? "recovery";

  if (!email) {
    console.error("Usage: node scripts/generate-link.mjs <email> [recovery|invite]");
    process.exit(1);
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const { data, error } = await admin.auth.admin.generateLink({ type, email });
  if (error) {
    console.error("Generate failed:", error.message);
    process.exitCode = 1;
    return;
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const safeLink = `${siteUrl}/auth/confirm?token_hash=${data.properties.hashed_token}&type=${type}`;
  console.log(safeLink);
}

main();
