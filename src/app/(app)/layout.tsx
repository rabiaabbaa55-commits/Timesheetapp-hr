"use client";

import TopNav from "@/components/TopNav";
import { useApp } from "@/lib/store";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { currentUser, loading } = useApp();

  if (loading || !currentUser) return null;

  return (
    <div className="min-h-screen bg-slate-50">
      <TopNav />
      <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
    </div>
  );
}
