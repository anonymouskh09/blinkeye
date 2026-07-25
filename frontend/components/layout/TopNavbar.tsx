"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell, Settings, Archive, Search, LogOut, User as UserIcon, Sliders } from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "@/hooks/useAuth";
import { useSidebar } from "@/lib/sidebar-context";
import { cn, getInitials } from "@/lib/utils";

export default function TopNavbar() {
  const { user, logout } = useAuth();
  const { collapsed } = useSidebar();
  const [search, setSearch] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (settingsRef.current && !settingsRef.current.contains(target)) setSettingsOpen(false);
      if (profileRef.current && !profileRef.current.contains(target)) setProfileOpen(false);
      if (notifRef.current && !notifRef.current.contains(target)) setNotifOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!search.trim()) return;
    toast("Search coming soon");
  };

  return (
    <header
      className={cn(
        "fixed top-0 right-0 z-30 h-16 bg-white border-b border-gray-200/80 shadow-sm transition-all duration-300",
        collapsed ? "left-[72px]" : "left-52",
      )}
    >
      <div className="h-full flex items-center justify-end px-4 lg:px-6 gap-3">
        <form onSubmit={handleSearch} className="relative w-full max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search candidates, jobs, companies..."
            className="w-full h-10 pl-10 pr-14 rounded-full border border-gray-200 bg-white text-sm text-gray-800
              placeholder:text-gray-400
              focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
          />
          <kbd className="absolute right-3.5 top-1/2 -translate-y-1/2 hidden sm:inline-flex items-center rounded-md border border-gray-200 bg-gray-50 px-1.5 py-0.5 text-[10px] font-medium text-gray-400">
            ⌘K
          </kbd>
        </form>

        <div className="flex items-center gap-1.5 shrink-0">
          {/* Notifications */}
          <div className="relative" ref={notifRef}>
            <button
              type="button"
              onClick={() => {
                setNotifOpen((o) => !o);
                setSettingsOpen(false);
                setProfileOpen(false);
              }}
              className="p-2.5 rounded-full text-gray-600 hover:bg-gray-100 hover:text-gray-800 transition-colors relative"
              aria-label="Notifications"
            >
              <Bell className="h-5 w-5" />
              <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-[#1F574A]" />
            </button>
            {notifOpen && (
              <div className="dropdown-menu w-72">
                <div className="px-4 py-3 border-b border-gray-100">
                  <p className="text-sm font-semibold text-gray-900">Notifications</p>
                </div>
                <p className="px-4 py-8 text-sm text-gray-400 text-center">No notifications yet</p>
              </div>
            )}
          </div>

          {/* Settings */}
          <div className="relative" ref={settingsRef}>
            <button
              type="button"
              onClick={() => {
                setSettingsOpen((o) => !o);
                setNotifOpen(false);
                setProfileOpen(false);
              }}
              className="p-2.5 rounded-full text-gray-600 hover:bg-gray-100 hover:text-gray-800 transition-colors"
              aria-label="Settings"
            >
              <Settings className="h-5 w-5" />
            </button>
            {settingsOpen && (
              <div className="dropdown-menu">
                <Link
                  href="/settings"
                  className="dropdown-item flex items-center gap-2.5"
                  onClick={() => setSettingsOpen(false)}
                >
                  <Sliders className="h-4 w-4 text-gray-400" />
                  Settings
                </Link>
                <Link
                  href="/archive"
                  className="dropdown-item flex items-center gap-2.5"
                  onClick={() => setSettingsOpen(false)}
                >
                  <Archive className="h-4 w-4 text-gray-400" />
                  Archive
                </Link>
              </div>
            )}
          </div>

          {/* Profile */}
          <div className="relative" ref={profileRef}>
            <button
              type="button"
              onClick={() => {
                setProfileOpen((o) => !o);
                setSettingsOpen(false);
                setNotifOpen(false);
              }}
              className="ml-0.5 flex items-center gap-2 p-1.5 rounded-full hover:bg-gray-100 transition-colors"
              aria-label="Profile"
            >
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-secondary text-white flex items-center justify-center text-xs font-bold shadow-sm">
                {user ? getInitials(user.name) : "?"}
              </div>
            </button>
            {profileOpen && user && (
              <div className="dropdown-menu w-56">
                <div className="px-4 py-3 border-b border-gray-100">
                  <p className="text-sm font-semibold text-gray-900 truncate">{user.name}</p>
                  <p className="text-xs text-gray-400 truncate">{user.email}</p>
                  <p className="text-[10px] uppercase font-semibold text-gray-400 mt-1 tracking-wide">{user.role}</p>
                </div>
                <button
                  type="button"
                  className="dropdown-item flex items-center gap-2.5"
                  onClick={() => {
                    setProfileOpen(false);
                    toast("Profile settings — coming soon");
                  }}
                >
                  <UserIcon className="h-4 w-4 text-gray-400" />
                  My Profile
                </button>
                <button
                  type="button"
                  className="dropdown-item flex items-center gap-2.5 text-red-600 hover:bg-red-50"
                  onClick={async () => {
                    setProfileOpen(false);
                    await logout();
                  }}
                >
                  <LogOut className="h-4 w-4" />
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
