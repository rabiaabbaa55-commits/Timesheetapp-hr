import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// Server-only. Uses the service role key, which bypasses RLS — never import
// this from a Client Component or anywhere that ships to the browser.
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
