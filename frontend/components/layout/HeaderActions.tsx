"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Search, Plus, Bell, CheckSquare, Settings, Grip, User as UserIcon, LogOut,
  Sliders, Archive, Building2, Briefcase, UserCheck, BarChart3, CheckCircle2,
} from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "@/hooks/useAuth";
import { getInitials } from "@/lib/utils";

interface HeaderActionsProps {
  addLabel?: string;
  onAddClick?: () => void;
  showPlusText?: boolean;
}

export default function HeaderActions({
  addLabel,
  onAddClick,
  showPlusText = true,
}: HeaderActionsProps) {
  const { user, logout } = useAuth();
  const router = useRouter();

  const [searchOpen, setSearchOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const [notifOpen, setNotifOpen] = useState(false);
  const [tasksOpen, setTasksOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [appsOpen, setAppsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
        setNotifOpen(false);
        setTasksOpen(false);
        setSettingsOpen(false);
        setAppsOpen(false);
        setProfileOpen(false);
      }
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchValue.trim()) {
      toast.success(`Searching for "${searchValue.trim()}"...`);
      setSearchOpen(false);
      setSearchValue("");
    }
  };

  const userInitials = user ? getInitials(user.name) : "SA";

  return (
    <div ref={containerRef} className="flex items-center gap-1.5 sm:gap-2 shrink-0">
      {/* 1. Search Icon */}
      <div className="relative flex items-center">
        <button
          type="button"
          onClick={() => {
            setSearchOpen((o) => !o);
            setNotifOpen(false);
            setTasksOpen(false);
            setSettingsOpen(false);
            setAppsOpen(false);
            setProfileOpen(false);
          }}
          className="p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors flex items-center justify-center"
          title="Search"
          aria-label="Search"
        >
          <Search className="h-5 w-5" />
        </button>

        {searchOpen && (
          <div className="absolute right-0 top-full mt-2 w-72 sm:w-80 bg-white rounded-xl border border-slate-200 shadow-lg p-2.5 z-50 animate-slide-down">
            <form onSubmit={handleSearchSubmit} className="relative flex items-center">
              <Search className="absolute left-3 h-4 w-4 text-slate-400 pointer-events-none" />
              <input
                type="text"
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                placeholder="Search candidates, jobs, clients..."
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white text-slate-800"
                autoFocus
              />
            </form>
          </div>
        )}
      </div>

      {/* 2. Plus (+) Icon / Action Button */}
      {onAddClick && (
        <button
          type="button"
          onClick={onAddClick}
          className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#1F574A] hover:bg-[#18463c] text-white text-xs sm:text-sm font-semibold rounded-lg shadow-sm hover:shadow transition-all active:scale-[0.98] mx-1"
          title={addLabel ? `Add ${addLabel}` : "Add"}
        >
          <Plus className="h-4 w-4 stroke-[2.5]" />
          {showPlusText && addLabel && (
            <span className="font-semibold text-xs sm:text-sm leading-none">
              {addLabel.toLowerCase().startsWith("add") ? addLabel : `${addLabel}`}
            </span>
          )}
        </button>
      )}

      {/* 3. Notification Icon */}
      <div className="relative flex items-center">
        <button
          type="button"
          onClick={() => {
            setNotifOpen((o) => !o);
            setSearchOpen(false);
            setTasksOpen(false);
            setSettingsOpen(false);
            setAppsOpen(false);
            setProfileOpen(false);
          }}
          className="p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors relative flex items-center justify-center"
          title="Notifications"
          aria-label="Notifications"
        >
          <Bell className="h-5 w-5" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-emerald-500 border border-white" />
        </button>

        {notifOpen && (
          <div className="absolute right-0 top-full mt-2 w-72 bg-white rounded-xl border border-slate-200 shadow-lg py-2 z-50 animate-slide-down">
            <div className="px-3.5 py-2 border-b border-slate-100 flex items-center justify-between">
              <p className="text-xs font-semibold text-slate-800">Notifications</p>
              <span className="text-[10px] text-emerald-600 font-medium">1 new</span>
            </div>
            <div className="px-3.5 py-4 text-center">
              <p className="text-xs text-slate-500">All caught up! No unread notifications.</p>
            </div>
          </div>
        )}
      </div>

      {/* 4. Tasks Icon */}
      <div className="relative flex items-center">
        <button
          type="button"
          onClick={() => {
            setTasksOpen((o) => !o);
            setSearchOpen(false);
            setNotifOpen(false);
            setSettingsOpen(false);
            setAppsOpen(false);
            setProfileOpen(false);
          }}
          className="p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors flex items-center justify-center"
          title="Tasks"
          aria-label="Tasks"
        >
          <CheckSquare className="h-5 w-5" />
        </button>

        {tasksOpen && (
          <div className="absolute right-0 top-full mt-2 w-72 bg-white rounded-xl border border-slate-200 shadow-lg py-2 z-50 animate-slide-down">
            <div className="px-3.5 py-2 border-b border-slate-100 flex items-center justify-between">
              <p className="text-xs font-semibold text-slate-800">Pending Tasks</p>
            </div>
            <div className="px-3.5 py-3 space-y-2">
              <div className="flex items-start gap-2 text-xs text-slate-700">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 mt-0.5 shrink-0" />
                <span>Review new candidate applications</span>
              </div>
              <div className="flex items-start gap-2 text-xs text-slate-700">
                <CheckCircle2 className="h-3.5 w-3.5 text-slate-300 mt-0.5 shrink-0" />
                <span>Schedule follow-up interview with Client</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 5. Settings Icon */}
      <div className="relative flex items-center">
        <button
          type="button"
          onClick={() => {
            setSettingsOpen((o) => !o);
            setSearchOpen(false);
            setNotifOpen(false);
            setTasksOpen(false);
            setAppsOpen(false);
            setProfileOpen(false);
          }}
          className="p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors flex items-center justify-center"
          title="Settings"
          aria-label="Settings"
        >
          <Settings className="h-5 w-5" />
        </button>

        {settingsOpen && (
          <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-xl border border-slate-200 shadow-lg py-1.5 z-50 animate-slide-down">
            <Link
              href="/settings"
              className="flex items-center gap-2.5 px-3.5 py-2 text-xs text-slate-700 hover:bg-slate-50 transition-colors"
              onClick={() => setSettingsOpen(false)}
            >
              <Sliders className="h-3.5 w-3.5 text-slate-400" />
              Settings
            </Link>
            <Link
              href="/archive"
              className="flex items-center gap-2.5 px-3.5 py-2 text-xs text-slate-700 hover:bg-slate-50 transition-colors"
              onClick={() => setSettingsOpen(false)}
            >
              <Archive className="h-3.5 w-3.5 text-slate-400" />
              Archive
            </Link>
          </div>
        )}
      </div>

      {/* 6. Vertical Separator Line */}
      <div className="h-5 w-[1px] bg-slate-300 mx-0.5 shrink-0" />

      {/* 7. 9-Dots App Grid Icon (Grip Matrix) */}
      <div className="relative flex items-center">
        <button
          type="button"
          onClick={() => {
            setAppsOpen((o) => !o);
            setSearchOpen(false);
            setNotifOpen(false);
            setTasksOpen(false);
            setSettingsOpen(false);
            setProfileOpen(false);
          }}
          className="p-2 rounded-lg text-slate-700 hover:text-slate-950 hover:bg-slate-100 transition-colors flex items-center justify-center"
          title="App Grid"
          aria-label="App Grid"
        >
          <Grip className="h-[21px] w-[21px] text-slate-700" />
        </button>

        {appsOpen && (
          <div className="absolute right-0 top-full mt-2 w-60 bg-white rounded-xl border border-slate-200 shadow-lg p-3 z-50 animate-slide-down">
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Quick Apps</p>
            <div className="grid grid-cols-3 gap-2 text-center">
              <button
                onClick={() => { router.push("/clients"); setAppsOpen(false); }}
                className="p-2 rounded-lg hover:bg-slate-50 flex flex-col items-center gap-1 text-slate-700 transition-colors"
              >
                <Building2 className="h-4 w-4 text-emerald-600" />
                <span className="text-[10px] font-medium">Clients</span>
              </button>
              <button
                onClick={() => { router.push("/jobs"); setAppsOpen(false); }}
                className="p-2 rounded-lg hover:bg-slate-50 flex flex-col items-center gap-1 text-slate-700 transition-colors"
              >
                <Briefcase className="h-4 w-4 text-blue-600" />
                <span className="text-[10px] font-medium">Jobs</span>
              </button>
              <button
                onClick={() => { router.push("/candidates"); setAppsOpen(false); }}
                className="p-2 rounded-lg hover:bg-slate-50 flex flex-col items-center gap-1 text-slate-700 transition-colors"
              >
                <UserCheck className="h-4 w-4 text-purple-600" />
                <span className="text-[10px] font-medium">Candidates</span>
              </button>
              <button
                onClick={() => { router.push("/reports"); setAppsOpen(false); }}
                className="p-2 rounded-lg hover:bg-slate-50 flex flex-col items-center gap-1 text-slate-700 transition-colors"
              >
                <BarChart3 className="h-4 w-4 text-amber-600" />
                <span className="text-[10px] font-medium">Reports</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 8. Profile Avatar Icon (Blue Circle with White Initials) */}
      <div className="relative flex items-center ml-1">
        <button
          type="button"
          onClick={() => {
            setProfileOpen((o) => !o);
            setSearchOpen(false);
            setNotifOpen(false);
            setTasksOpen(false);
            setSettingsOpen(false);
            setAppsOpen(false);
          }}
          className="w-8 h-8 rounded-full bg-[#1D70B8] text-white flex items-center justify-center text-xs font-bold leading-none shadow-sm hover:opacity-90 transition-opacity border border-blue-600/20 shrink-0 overflow-hidden select-none"
          title={user?.name || "Profile"}
          aria-label="Profile"
        >
          {userInitials}
        </button>

        {profileOpen && (
          <div className="absolute right-0 top-full mt-2 w-52 bg-white rounded-xl border border-slate-200 shadow-lg py-1.5 z-50 animate-slide-down">
            {user && (
              <div className="px-3.5 py-2.5 border-b border-slate-100">
                <p className="text-xs font-semibold text-slate-900 truncate">{user.name}</p>
                <p className="text-[11px] text-slate-400 truncate">{user.email}</p>
              </div>
            )}
            <button
              type="button"
              className="w-full text-left px-3.5 py-2 text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2 transition-colors"
              onClick={() => {
                setProfileOpen(false);
                toast("Profile settings coming soon");
              }}
            >
              <UserIcon className="h-3.5 w-3.5 text-slate-400" />
              My Profile
            </button>
            <button
              type="button"
              className="w-full text-left px-3.5 py-2 text-xs text-red-600 hover:bg-red-50 flex items-center gap-2 transition-colors"
              onClick={async () => {
                setProfileOpen(false);
                await logout();
              }}
            >
              <LogOut className="h-3.5 w-3.5" />
              Logout
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
