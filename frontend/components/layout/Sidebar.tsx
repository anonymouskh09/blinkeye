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

  { href: "/contacts", label: "Contacts and Guests", icon: Contact, adminOnly: true },

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

          "group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200",

          active

            ? "bg-gradient-to-r from-primary-50 to-primary-50/50 text-primary-700 shadow-sm border border-primary/10"

            : "text-gray-600 hover:bg-gray-50 hover:text-gray-900",

          active && !collapsed && "border-l-[3px] border-l-primary rounded-l-lg pl-[9px]",

        )}

        title={collapsed ? label : undefined}

      >

        <Icon className={cn(

          "h-[18px] w-[18px] shrink-0 transition-colors",

          active ? "text-primary" : "text-gray-400 group-hover:text-gray-600",

        )} />

        {!collapsed && <span className="truncate">{label}</span>}

      </Link>

    );

  };



  return (

    <aside className={cn(

      "fixed left-0 top-0 h-full bg-white border-r border-gray-200/80 flex flex-col transition-all duration-300 z-40 shadow-sm",

      collapsed ? "w-[72px]" : "w-60",

    )}>

      <div className="flex items-center justify-between px-4 h-16 border-b border-gray-100">

        {!collapsed && (

          <div className="flex items-center gap-2.5 min-w-0">

            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow-sm shrink-0">

              <Briefcase className="h-4 w-4 text-white" />

            </div>

            <span className="font-bold text-base text-gray-900 tracking-tight truncate">RecruitPro</span>

          </div>

        )}

        <button

          onClick={toggle}

          className="p-2 rounded-xl hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors ml-auto"

          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}

        >

          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}

        </button>

      </div>



      <nav className="flex-1 py-4 space-y-1 px-3 overflow-y-auto">

        {navItems.map(({ href, label, icon: Icon }) => renderLink(href, label, Icon))}



        {!collapsed && (

          <p className="px-3 pt-5 pb-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest">

            Recruitment Center

          </p>

        )}

        {collapsed && <div className="h-px bg-gray-100 my-3 mx-1" />}

        {recruitmentCenter.filter((i) => !i.adminOnly || isAdmin).map(({ href, label, icon: Icon }) =>

          renderLink(href, label, Icon),

        )}



        {isAdmin && (

          <>

            {!collapsed && (

              <p className="px-3 pt-5 pb-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest">

                Admin

              </p>

            )}

            {adminExtra.map(({ href, label, icon: Icon }) => renderLink(href, label, Icon))}

          </>

        )}

      </nav>



      {user && (

        <div className="border-t border-gray-100 p-3">

          <div className={cn("flex items-center gap-2.5", collapsed && "justify-center")}>

            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-secondary text-white flex items-center justify-center text-xs font-bold shrink-0 shadow-sm">

              {getInitials(user.name)}

            </div>

            {!collapsed && (

              <div className="flex-1 min-w-0">

                <p className="text-sm font-semibold text-gray-900 truncate">{user.name}</p>

                <p className="text-xs text-gray-400 capitalize">{user.role}</p>

              </div>

            )}

            <button

              onClick={logout}

              className="p-2 rounded-xl hover:bg-red-50 text-gray-400 hover:text-red-500 shrink-0 transition-colors"

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

