"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { users as initialUsers } from "./mock-data";
import { User } from "./types";

export type Notification = {
  id: string;
  message: string;
  createdAt: string;
  read: boolean;
};

type AppState = {
  currentUser: User | null;
  users: User[];
  notifications: Notification[];
  login: (email: string) => boolean;
  logout: () => void;
  notifyAdmins: (message: string) => void;
  markAllRead: () => void;
};

const AppContext = createContext<AppState | null>(null);

const STORAGE_KEY = "timesheet:currentUserId";

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const savedId = localStorage.getItem(STORAGE_KEY);
    if (savedId) {
      const match = initialUsers.find((u) => u.id === savedId);
      if (match) setCurrentUser(match);
    }
    setHydrated(true);
  }, []);

  const login = useCallback((email: string) => {
    const match = initialUsers.find(
      (u) => u.email.toLowerCase() === email.trim().toLowerCase()
    );
    if (!match) return false;
    setCurrentUser(match);
    localStorage.setItem(STORAGE_KEY, match.id);
    return true;
  }, []);

  const logout = useCallback(() => {
    setCurrentUser(null);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  const notifyAdmins = useCallback((message: string) => {
    setNotifications((prev) => [
      {
        id: `n${Date.now()}`,
        message,
        createdAt: new Date().toISOString(),
        read: false,
      },
      ...prev,
    ]);
  }, []);

  const markAllRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  if (!hydrated) return null;

  return (
    <AppContext.Provider
      value={{
        currentUser,
        users: initialUsers,
        notifications,
        login,
        logout,
        notifyAdmins,
        markAllRead,
      }}
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
