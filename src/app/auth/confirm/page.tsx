"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function ConfirmPage() {
  return (
    <Suspense fallback={null}>
      <ConfirmForm />
    </Suspense>
  );
}

function ConfirmForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<"idle" | "confirming" | "error">("idle");
  const [error, setError] = useState("");

  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");

  async function handleConfirm() {
    if (!tokenHash || !type) {
      setError("This link is missing required information. Ask your admin to send a new one.");
      setStatus("error");
      return;
    }
    setStatus("confirming");
    const supabase = createClient();
    const { error: verifyError } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: type as "recovery" | "invite" | "email",
    });
    if (verifyError) {
      setError("This link has expired or already been used. Ask your admin to send you a new one.");
      setStatus("error");
      return;
    }
    router.push("/auth/set-password");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-8 shadow-sm text-center">
        <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-slate-900 text-white font-semibold">
          T
        </div>
        <h1 className="text-xl font-semibold text-slate-900">Confirm it's you</h1>
        <p className="mt-1 mb-6 text-sm text-slate-500">
          Click below to continue setting up your account.
        </p>

        {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

        <button
          onClick={handleConfirm}
          disabled={status === "confirming"}
          className="w-full rounded-md bg-slate-900 py-2 text-sm font-medium text-white hover:bg-slate-800 transition-colors disabled:opacity-60"
        >
          {status === "confirming" ? "Confirming…" : "Confirm & continue"}
        </button>
      </div>
    </div>
  );
}
