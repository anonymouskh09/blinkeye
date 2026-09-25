"use client";

import { useCallback, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { MatchVerdict } from "@/types";

export type MatchView = "job" | "all";
export type MatchSort = "score" | "newest" | "candidate" | "job";

export interface MatchFilterState {
  view: MatchView;
  job: number | null;
  client: number | null;
  recruiter: number | null;
  verdicts: MatchVerdict[];
  min: number;
  q: string;
  must: boolean;
  fresh: boolean;
  status: "active" | "dismissed";
  sort: MatchSort;
  order: "asc" | "desc";
  page: number;
}

export const DEFAULT_MIN_SCORE = 30;
const VERDICTS: MatchVerdict[] = ["strong_fit", "good_fit", "partial_fit", "weak_fit"];

const num = (v: string | null) => {
  const n = v ? Number(v) : NaN;
  return Number.isFinite(n) && n > 0 ? n : null;
};

/** Filters live in the URL so any view can be bookmarked or shared. */
export function useMatchFilters() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const state: MatchFilterState = useMemo(() => {
    const min = Number(params.get("min"));
    return {
      view: params.get("view") === "all" ? "all" : "job",
      job: num(params.get("job")),
      client: num(params.get("client")),
      recruiter: num(params.get("recruiter")),
      verdicts: (params.get("verdict") || "")
        .split(",")
        .filter((v): v is MatchVerdict => VERDICTS.includes(v as MatchVerdict)),
      min: Number.isFinite(min) && params.get("min") ? Math.min(100, Math.max(20, min)) : DEFAULT_MIN_SCORE,
      q: params.get("q") || "",
      must: params.get("must") === "1",
      fresh: params.get("new") === "1",
      status: params.get("status") === "dismissed" ? "dismissed" : "active",
      sort: (["score", "newest", "candidate", "job"].includes(params.get("sort") || "")
        ? params.get("sort")
        : "score") as MatchSort,
      order: params.get("order") === "asc" ? "asc" : "desc",
      page: num(params.get("page")) ?? 1,
    };
  }, [params]);

  const update = useCallback(
    (patch: Partial<MatchFilterState>, opts: { keepPage?: boolean } = {}) => {
      const next = { ...state, ...patch };
      if (!opts.keepPage && !("page" in patch)) next.page = 1;
      const sp = new URLSearchParams();
      if (next.view !== "job") sp.set("view", next.view);
      if (next.job) sp.set("job", String(next.job));
      if (next.client) sp.set("client", String(next.client));
      if (next.recruiter) sp.set("recruiter", String(next.recruiter));
      if (next.verdicts.length) sp.set("verdict", next.verdicts.join(","));
      if (next.min !== DEFAULT_MIN_SCORE) sp.set("min", String(next.min));
      if (next.q) sp.set("q", next.q);
      if (next.must) sp.set("must", "1");
      if (next.fresh) sp.set("new", "1");
      if (next.status !== "active") sp.set("status", next.status);
      if (next.sort !== "score") sp.set("sort", next.sort);
      if (next.order !== "desc") sp.set("order", next.order);
      if (next.page > 1) sp.set("page", String(next.page));
      const qs = sp.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [state, router, pathname],
  );

  const clear = useCallback(() => {
    router.replace(state.view === "all" ? `${pathname}?view=all` : pathname, { scroll: false });
  }, [router, pathname, state.view]);

  const activeCount =
    (state.job ? 1 : 0) + (state.client ? 1 : 0) + (state.recruiter ? 1 : 0) + (state.verdicts.length ? 1 : 0) +
    (state.min !== DEFAULT_MIN_SCORE ? 1 : 0) + (state.q ? 1 : 0) + (state.must ? 1 : 0) + (state.fresh ? 1 : 0);

  return { state, update, clear, activeCount };
}

/** API query params for the current filters (shared by list, summary, export). */
export function toApiParams(s: MatchFilterState): URLSearchParams {
  const sp = new URLSearchParams();
  if (s.job) sp.set("job_id", String(s.job));
  if (s.client) sp.set("client_id", String(s.client));
  if (s.recruiter) sp.set("recruiter_id", String(s.recruiter));
  s.verdicts.forEach((v) => sp.append("verdict", v));
  sp.set("min_score", String(s.min));
  if (s.q) sp.set("q", s.q);
  if (s.must) sp.set("must_have_only", "true");
  if (s.fresh) sp.set("new_only", "true");
  sp.set("status", s.status);
  return sp;
}
