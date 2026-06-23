"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { createClient } from "./supabase/client";
import { fetchNotifications, insertNotification, markNotificationsRead } from "./queries";
import { User } from "./types";

export type Notification = {
  id: string;
  message: string;
  createdAt: string;
  read: boolean;
};

type AppState = {
  currentUser: User | null;
  loading: boolean;
  notifications: Notification[];
  logout: () => Promise<void>;
  notifyAdmins: (message: string) => Promise<void>;
  markAllRead: () => Promise<void>;
};

const AppContext = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const supabase = createClient();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const loadProfile = useCallback(async () => {
    const { data: authData } = await supabase.auth.getUser();
    if (!authData.user) {
      setCurrentUser(null);
      setLoading(false);
      return;
    }
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, full_name, email, role, status, hourly_rate, pay_type, salary_amount")
      .eq("id", authData.user.id)
      .single();

    if (profile) {
      setCurrentUser({
        id: profile.id,
        name: profile.full_name,
        email: profile.email,
        role: profile.role,
        status: profile.status,
        hourlyRate: profile.hourly_rate,
        payType: profile.pay_type,
        salaryAmount: profile.salary_amount,
      });
    } else {
      setCurrentUser(null);
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    loadProfile();
    const { data: listener } = supabase.auth.onAuthStateChange(() => {
      loadProfile();
    });
    return () => listener.subscription.unsubscribe();
  }, [loadProfile, supabase]);

  const loadNotifications = useCallback(async () => {
    if (!currentUser || currentUser.role !== "admin") return;
    const rows = await fetchNotifications(supabase);
    setNotifications(
      rows.map((r) => ({ id: r.id, message: r.message, createdAt: r.created_at, read: r.read }))
    );
  }, [supabase, currentUser]);

  useEffect(() => {
    if (!currentUser || currentUser.role !== "admin") return;
    loadNotifications();

    const channel = supabase
      .channel("notifications-feed")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications" },
        (payload) => {
          const row = payload.new as { id: string; message: string; created_at: string; read: boolean };
          setNotifications((prev) => [
            { id: row.id, message: row.message, createdAt: row.created_at, read: row.read },
            ...prev,
          ]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, currentUser, loadNotifications]);

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    setCurrentUser(null);
    router.push("/login");
    router.refresh();
  }, [supabase, router]);

  const notifyAdmins = useCallback(
    async (message: string) => {
      await insertNotification(supabase, message);
    },
    [supabase]
  );

  const markAllRead = useCallback(async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    await markNotificationsRead(supabase);
  }, [supabase]);

  return (
    <AppContext.Provider
      value={{ currentUser, loading, notifications, logout, notifyAdmins, markAllRead }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
