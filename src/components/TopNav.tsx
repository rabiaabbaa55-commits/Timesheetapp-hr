"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useApp } from "@/lib/store";

export default function TopNav() {
  const pathname = usePathname();
  const { currentUser, notifications, markAllRead, logout } = useApp();
  const [showNotifications, setShowNotifications] = useState(false);

  if (!currentUser) return null;

  const isAdmin = currentUser.role === "admin";
  const unreadCount = notifications.filter((n) => !n.read).length;

  const links = [
    { href: "/calendar", label: "Calendar" },
    ...(isAdmin ? [{ href: "/admin", label: "Admin" }] : []),
  ];

  function handleLogout() {
    logout();
  }

  function toggleNotifications() {
    setShowNotifications((prev) => {
      const next = !prev;
      if (next) markAllRead();
      return next;
    });
  }

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-slate-900 text-xs font-semibold text-white">
              T
            </div>
            <span className="font-semibold text-slate-900">Timesheet</span>
          </div>
          <nav className="flex gap-1">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  pathname.startsWith(link.href)
                    ? "bg-slate-900 text-white"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          {isAdmin && (
            <div className="relative">
              <button
                onClick={toggleNotifications}
                className="relative rounded-md border border-slate-200 p-2 text-slate-600 hover:bg-slate-50"
                aria-label="Notifications"
              >
                🔔
                {unreadCount > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-semibold text-white">
                    {unreadCount}
                  </span>
                )}
              </button>
              {showNotifications && (
                <div className="absolute right-0 z-10 mt-2 w-80 rounded-md border border-slate-200 bg-white shadow-lg">
                  <div className="border-b border-slate-100 px-4 py-2 text-sm font-medium text-slate-900">
                    Notifications
                  </div>
                  {notifications.length === 0 ? (
                    <p className="px-4 py-6 text-center text-sm text-slate-400">
                      No notifications yet.
                    </p>
                  ) : (
                    <ul className="max-h-80 overflow-y-auto">
                      {notifications.map((n) => (
                        <li
                          key={n.id}
                          className="border-b border-slate-50 px-4 py-3 text-sm text-slate-700 last:border-0"
                        >
                          <p>{n.message}</p>
                          <p className="mt-1 text-xs text-slate-400">
                            {new Date(n.createdAt).toLocaleString()}
                          </p>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="text-right">
            <p className="text-sm font-medium text-slate-900">{currentUser.name}</p>
            <p className="text-xs capitalize text-slate-500">{currentUser.role}</p>
          </div>
          <button
            onClick={handleLogout}
            className="rounded-md border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
          >
            Log out
          </button>
        </div>
      </div>
    </header>
  );
}
