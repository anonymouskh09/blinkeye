"use client";

import { createContext, useContext, useEffect, useState, useCallback, useRef, type ReactNode } from "react";
import { useRouter, usePathname } from "next/navigation";
import { getMe, logout as logoutApi } from "@/lib/auth";
import type { User, UserRole } from "@/types";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  isAdmin: boolean;
  isRecruiter: boolean;
  canViewClients: boolean;
  canAddClients: boolean;
  canEditClients: boolean;
  canViewJobs: boolean;
  canAddJobs: boolean;
  canEditJobs: boolean;
  canViewCandidates: boolean;
  canAddCandidates: boolean;
  canEditCandidates: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const alwaysAdminPaths = ["/dashboard", "/team", "/reports", "/invoices", "/revenue"];
const recruiterOnlyPaths = ["/my-jobs"];

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const sessionLoadedRef = useRef(false);
  const router = useRouter();
  const pathname = usePathname();

  const refreshUser = useCallback(async () => {
    try {
      const res = await getMe();
      setUser(res.data);
    } catch {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    if (pathname === "/login") {
      sessionLoadedRef.current = false;
      setLoading(false);
      return;
    }
    if (sessionLoadedRef.current) {
      setLoading(false);
      return;
    }
    refreshUser()
      .finally(() => {
        sessionLoadedRef.current = true;
        setLoading(false);
      });
  }, [pathname, refreshUser]);

  const isAdmin = user?.role === "admin";
  const canViewClients = isAdmin || !!user?.can_view_clients;
  const canAddClients = isAdmin || !!user?.can_add_clients;
  const canEditClients = isAdmin || !!user?.can_edit_clients;
  const canViewJobs = isAdmin || !!user?.can_view_jobs;
  const canAddJobs = isAdmin || !!user?.can_add_jobs;
  const canEditJobs = isAdmin || !!user?.can_edit_jobs;
  const canViewCandidates = isAdmin || !!user?.can_view_candidates;
  const canAddCandidates = isAdmin || !!user?.can_add_candidates;
  const canEditCandidates = isAdmin || !!user?.can_edit_candidates;

  useEffect(() => {
    if (!user || loading || pathname === "/login") return;

    const isStaff = user.role === "recruiter" || user.role === "manager";

    if (isStaff && alwaysAdminPaths.some((p) => pathname.startsWith(p))) {
      router.replace("/my-jobs");
      return;
    }
    if (isStaff && pathname.startsWith("/clients") && !canViewClients) {
      router.replace("/my-jobs");
      return;
    }
    if (user.role === "admin" && pathname === "/my-jobs") {
      router.replace("/dashboard");
    }
  }, [user, loading, pathname, router, canViewClients]);

  const logout = async () => {
    await logoutApi();
    setUser(null);
    sessionLoadedRef.current = false;
    router.push("/login");
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        logout,
        refreshUser,
        isAdmin: !!isAdmin,
        isRecruiter: user?.role === "recruiter" || user?.role === "manager",
        canViewClients,
        canAddClients,
        canEditClients,
        canViewJobs,
        canAddJobs,
        canEditJobs,
        canViewCandidates,
        canAddCandidates,
        canEditCandidates,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}

export function useRequireRole(role: UserRole) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user && user.role !== role) {
      router.replace(role === "admin" ? "/dashboard" : "/my-jobs");
    }
  }, [user, loading, role, router]);

  return { user, loading };
}
