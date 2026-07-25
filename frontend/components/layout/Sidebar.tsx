"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn, getInitials } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useSidebar } from "@/lib/sidebar-context";
import {
  Home, Building2, Briefcase, UserCheck, LogOut, ChevronLeft, ChevronRight,
  Users, CalendarDays, BarChart3, GitBranch, BadgeCheck, Contact, MessagesSquare, Send,
} from "lucide-react";

const ACCENT = "#1F574A";
const ACTIVE_BG = "#E8F3EF";
const ACTIVE_ICON_BG = "#D4EBE3";
const SECTION_COLOR = "#2D6B5A";

const mainNav = [
  { href: "/dashboard", label: "Home", icon: Home, adminOnly: true },
  { href: "/my-jobs", label: "Home", icon: Home, recruiterOnly: true },
  { href: "/clients", label: "Clients", icon: Building2, adminOnly: true },
  { href: "/jobs", label: "Jobs", icon: Briefcase },
  { href: "/candidates", label: "Candidates", icon: UserCheck },
];

const recruitmentCenter = [
  { href: "/matches", label: "Matches", icon: GitBranch },
  { href: "/placements", label: "Placements", icon: BadgeCheck },
  { href: "/contacts", label: "Guests", icon: Contact, adminOnly: true },
  { href: "/activities", label: "Activities", icon: CalendarDays },
  { href: "/inbox", label: "Inbox", icon: MessagesSquare },
  { href: "/outreach", label: "Outreach", icon: Send },
];

const adminExtra = [
  { href: "/reports", label: "Reports", icon: BarChart3, adminOnly: true },
  { href: "/team", label: "Team", icon: Users, adminOnly: true },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { user, logout, isAdmin } = useAuth();
  const { collapsed, toggle } = useSidebar();

  const navItems = mainNav.filter((item) => {
    if (item.adminOnly && !isAdmin) return false;
    if (item.recruiterOnly && isAdmin) return false;
    return true;
  });

  const renderLink = (href: string, label: string, Icon: React.ElementType) => {
    const active = pathname === href || (href !== "/dashboard" && href !== "/my-jobs" && pathname.startsWith(href));

    return (
      <Link
        key={href + label}
        href={href}
        className={cn(
          "group relative flex items-center gap-2.5 mx-2 px-3 py-2.5 text-sm font-medium transition-all duration-200 rounded-xl",
          active
            ? "text-[#1F574A] font-semibold"
            : "text-slate-600 hover:text-slate-900 hover:bg-slate-50",
        )}
        style={active ? { backgroundColor: ACTIVE_BG } : undefined}
        title={collapsed ? label : undefined}
      >
        {active && (
          <span
            className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r-full"
            style={{ backgroundColor: ACCENT }}
          />
        )}
        <span
          className={cn(
            "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-colors",
            active ? "" : "bg-slate-100 group-hover:bg-slate-200/80",
          )}
          style={active ? { backgroundColor: ACTIVE_ICON_BG } : undefined}
        >
          <Icon
            className={cn(
              "h-[16px] w-[16px] transition-colors",
              active ? "text-[#1F574A]" : "text-slate-500 group-hover:text-slate-700",
            )}
          />
        </span>
        {!collapsed && <span className="truncate">{label}</span>}
      </Link>
    );
  };

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 h-full flex flex-col bg-white border-r border-slate-200 transition-all duration-300 z-40",
        collapsed ? "w-[72px]" : "w-52",
      )}
    >
      <div className="flex items-center justify-between px-3 h-16 border-b border-slate-100">
        {!collapsed && (
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 font-bold text-white text-sm"
              style={{ backgroundColor: ACCENT }}
            >
              R
            </div>
            <div className="min-w-0">
              <span className="font-bold text-base text-slate-900 tracking-tight truncate block">RecruitPro</span>
              <span className="text-[10px] text-slate-400 truncate block">Recruitment CRM</span>
            </div>
          </div>
        )}
        <button
          onClick={toggle}
          className="p-2 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors ml-auto border border-slate-200"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
        </button>
      </div>

      <nav className="flex-1 py-4 space-y-0.5 overflow-y-auto scrollbar-none">
        {navItems.map(({ href, label, icon: Icon }) => renderLink(href, label, Icon))}

        {!collapsed && (
          <div className="px-3.5 pt-6 pb-2">
            <p
              className="text-[10px] font-semibold uppercase tracking-widest"
              style={{ color: SECTION_COLOR }}
            >
              Recruitment Center
            </p>
            <div className="mt-2 h-px bg-slate-100" />
          </div>
        )}
        {collapsed && <div className="h-px bg-slate-100 my-3 mx-1" />}

        {recruitmentCenter
          .filter((i) => !i.adminOnly || isAdmin)
          .map(({ href, label, icon: Icon }) => renderLink(href, label, Icon))}

        {isAdmin && (
          <>
            {!collapsed && (
              <div className="px-3.5 pt-6 pb-2">
                <p
                  className="text-[10px] font-semibold uppercase tracking-widest"
                  style={{ color: SECTION_COLOR }}
                >
                  Admin
                </p>
                <div className="mt-2 h-px bg-slate-100" />
              </div>
            )}
            {adminExtra.map(({ href, label, icon: Icon }) => renderLink(href, label, Icon))}
          </>
        )}
      </nav>

      {user && (
        <div className="p-2">
          <div
            className={cn(
              "flex items-center gap-2 rounded-xl border border-[#D4EBE3] p-2",
              collapsed && "justify-center",
            )}
            style={{ backgroundColor: ACTIVE_BG }}
          >
            <div className="relative shrink-0">
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white"
                style={{ backgroundColor: ACCENT }}
              >
                {getInitials(user.name)}
              </div>
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-white bg-emerald-400" />
            </div>
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-800 truncate">{user.name}</p>
                <p className="text-xs text-slate-500 capitalize">{user.role}</p>
              </div>
            )}
            <button
              onClick={logout}
              className="p-2 rounded-lg hover:bg-white/70 text-slate-400 hover:text-slate-700 shrink-0 transition-colors"
              title="Logout"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </aside>
  );
}
