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
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const adminOnlyPaths = ["/dashboard", "/clients", "/team", "/reports"];
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

  useEffect(() => {
    if (!user || loading || pathname === "/login") return;

    if ((user.role === "recruiter" || user.role === "manager") && adminOnlyPaths.some((p) => pathname.startsWith(p))) {
      router.replace("/my-jobs");
    }
    if (user.role === "admin" && pathname === "/my-jobs") {
      router.replace("/dashboard");
    }
  }, [user, loading, pathname, router]);

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
        isAdmin: user?.role === "admin",
        isRecruiter: user?.role === "recruiter" || user?.role === "manager",
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
