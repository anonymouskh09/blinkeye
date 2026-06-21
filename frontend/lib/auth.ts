import api from "./api";
import type { ApiResponse, User, UserRole } from "@/types";

export interface LoginPayload {
  email: string;
  password: string;
  remember_me?: boolean;
}

export interface LoginData {
  user: User;
  redirect_to: string;
}

export async function login(payload: LoginPayload) {
  const { data } = await api.post<ApiResponse<LoginData>>("/auth/login", payload);
  return data;
}

export async function logout() {
  const { data } = await api.post<ApiResponse<null>>("/auth/logout");
  return data;
}

export async function getMe() {
  const { data } = await api.get<ApiResponse<User>>("/auth/me");
  return data;
}

export function getRedirectForRole(role: UserRole): string {
  return role === "admin" ? "/dashboard" : "/my-jobs";
}
