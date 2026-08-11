"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn, getInitials } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useSidebar } from "@/lib/sidebar-context";
import {
  Home, Building2, Briefcase, UserCheck, LogOut,
  Users, CalendarDays, BarChart3, GitBranch, BadgeCheck, Contact, MessagesSquare, Send,
  ChevronLeft, ChevronRight,
} from "lucide-react";

const ACCENT = "#1F574A";
const ACTIVE_BG = "#F1F4F8";
const ACTIVE_ICON_BG = "#D4EBE3";
const SECTION_COLOR = "#2D6B5A";
const SIDEBAR_BG = "#ffffff";

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
          "group relative flex items-center gap-2.5 mx-2 px-2.5 py-1.5 text-sm font-medium transition-all duration-200 rounded-lg",
          active
            ? "text-[#1F574A] font-semibold shadow-sm"
            : "text-slate-700 hover:text-slate-900 hover:bg-slate-100",
        )}
        style={active ? { backgroundColor: ACTIVE_BG } : undefined}
        title={collapsed ? label : undefined}
      >
        {active && (
          <span
            className="absolute left-0 top-1 bottom-1 w-[3px] rounded-r-full"
            style={{ backgroundColor: ACCENT }}
          />
        )}
        <span
          className={cn(
            "flex h-6.5 w-6.5 shrink-0 items-center justify-center rounded-md transition-colors",
            active ? "" : "bg-slate-100 group-hover:bg-slate-200/80",
          )}
          style={active ? { backgroundColor: ACTIVE_ICON_BG } : undefined}
        >
          <Icon
            className={cn(
              "h-4 w-4 transition-colors",
              active ? "text-[#1F574A]" : "text-slate-600 group-hover:text-slate-800",
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
        "fixed left-0 top-0 bottom-0 flex flex-col border-r border-slate-300/70 transition-all duration-300 z-30",
        collapsed ? "w-[72px]" : "w-48",
      )}
      style={{ backgroundColor: SIDEBAR_BG }}
    >
      {/* Brand Logo & Sidebar Toggle Header */}
      <div
        className={cn(
          "flex items-center h-14 shrink-0 transition-all duration-300",
          collapsed ? "justify-between px-3" : "justify-between px-3.5"
        )}
        style={{ backgroundColor: SIDEBAR_BG }}
      >
        <Link href="/dashboard" className="flex items-center gap-2.5 min-w-0">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 font-heading font-bold text-white text-xs shadow-sm"
            style={{ backgroundColor: ACCENT }}
          >
            R
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <span className="font-heading font-bold text-sm text-slate-900 tracking-tight truncate block leading-snug">
                RecruitPro
              </span>
              <span
                className="font-heading text-[10px] font-medium truncate block leading-none"
                style={{ color: SECTION_COLOR }}
              >
                Recruitment CRM
              </span>
            </div>
          )}
        </Link>
        <button
          onClick={toggle}
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors shrink-0"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>

      <nav className="flex-1 py-2.5 space-y-0.5 overflow-y-auto scrollbar-none">
        {navItems.map(({ href, label, icon: Icon }) => renderLink(href, label, Icon))}

        {!collapsed && (
          <div className="px-3.5 pt-3.5 pb-1">
            <p
              className="text-[10px] font-semibold uppercase tracking-widest"
              style={{ color: SECTION_COLOR }}
            >
              Recruitment Center
            </p>
            <div className="mt-1.5 h-px bg-slate-100" />
          </div>
        )}
        {collapsed && <div className="h-px bg-slate-100 my-2 mx-1" />}

        {recruitmentCenter
          .filter((i) => !i.adminOnly || isAdmin)
          .map(({ href, label, icon: Icon }) => renderLink(href, label, Icon))}

        {isAdmin && (
          <>
            {!collapsed && (
              <div className="px-3.5 pt-3.5 pb-1">
                <p
                  className="text-[10px] font-semibold uppercase tracking-widest"
                  style={{ color: SECTION_COLOR }}
                >
                  Admin
                </p>
                <div className="mt-1.5 h-px bg-slate-100" />
              </div>
            )}
            {adminExtra.map(({ href, label, icon: Icon }) => renderLink(href, label, Icon))}
          </>
        )}
      </nav>

      {user && (
        <div className="p-1.5">
          <div
            className={cn(
              "flex items-center gap-2 rounded-lg border border-[#D4EBE3] p-1.5",
              collapsed && "justify-center",
            )}
            style={{ backgroundColor: ACTIVE_BG }}
          >
            <div className="relative shrink-0">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white"
                style={{ backgroundColor: ACCENT }}
              >
                {getInitials(user.name)}
              </div>
              <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full border-2 border-white bg-emerald-400" />
            </div>
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-slate-800 truncate">{user.name}</p>
                <p className="text-[11px] text-slate-500 capitalize leading-tight">{user.role}</p>
              </div>
            )}
            <button
              onClick={logout}
              className="p-1.5 rounded-lg hover:bg-white/70 text-slate-400 hover:text-slate-700 shrink-0 transition-colors"
              title="Logout"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </aside>
  );
}
