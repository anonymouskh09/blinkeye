"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  X,
  Building2,
  Briefcase,
  UserCheck,
  Loader2,
  Mail,
  MapPin,
  FileSearch,
  ChevronDown,
  UserPlus,
} from "lucide-react";
import api from "@/lib/api";
import { cn } from "@/lib/utils";
import type { ApiResponse, Candidate, Client, Job, PaginatedData } from "@/types";

export type SearchScope = "candidates" | "jobs" | "clients";

interface GlobalSearchModalProps {
  open: boolean;
  onClose: () => void;
  isAdmin?: boolean;
  canViewClients?: boolean;
}

interface SearchResult {
  id: number;
  title: string;
  subtitle?: string;
  meta?: string;
  href: string;
}

const ACCENT = "#1F574A";
const CYAN = "#22d3ee";
const RECENT_KEY = "global_search_recent";
const MAX_RECENT = 6;
const EXIT_MS = 280;

const SCOPE_OPTIONS: {
  id: SearchScope;
  label: string;
  icon: typeof Building2;
  needsClientView?: boolean;
}[] = [
  { id: "candidates", label: "Candidates", icon: UserCheck },
  { id: "jobs", label: "Jobs", icon: Briefcase },
  { id: "clients", label: "Clients", icon: Building2, needsClientView: true },
];

function loadRecent(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string").slice(0, MAX_RECENT) : [];
  } catch {
    return [];
  }
}

function saveRecent(items: string[]) {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(items.slice(0, MAX_RECENT)));
  } catch {
    /* ignore */
  }
}

function HighlightMatch({ text, query }: { text: string; query: string }) {
  const q = query.trim();
  if (!q || !text) return <>{text}</>;
  const lower = text.toLowerCase();
  const idx = lower.indexOf(q.toLowerCase());
  if (idx < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="rounded-sm bg-cyan-100/90 px-0.5 text-slate-900" style={{ borderRadius: 3 }}>
        {text.slice(idx, idx + q.length)}
      </mark>
      {text.slice(idx + q.length)}
    </>
  );
}

export default function GlobalSearchModal({
  open,
  onClose,
  isAdmin = false,
  canViewClients = false,
}: GlobalSearchModalProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const exitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [mounted, setMounted] = useState(false);
  const [closing, setClosing] = useState(false);
  const [scope, setScope] = useState<SearchScope>("candidates");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [recent, setRecent] = useState<string[]>([]);
  const [filterOpen, setFilterOpen] = useState(false);
  const [barHovered, setBarHovered] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const scopes = SCOPE_OPTIONS.filter((s) => !s.needsClientView || canViewClients || isAdmin);
  const activeScope = scopes.find((s) => s.id === scope) || scopes[0];

  const requestClose = useCallback(() => {
    if (closing) return;
    setClosing(true);
    setFilterOpen(false);
    if (exitTimer.current) clearTimeout(exitTimer.current);
    exitTimer.current = setTimeout(() => {
      setClosing(false);
      setMounted(false);
      onClose();
    }, EXIT_MS);
  }, [closing, onClose]);

  useEffect(() => {
    if (!open) {
      setMounted(false);
      setClosing(false);
      return;
    }
    setMounted(true);
    setClosing(false);
    setQuery("");
    setResults([]);
    setSearched(false);
    setLoading(false);
    setScope("candidates");
    setFilterOpen(false);
    setActiveIndex(-1);
    setRecent(loadRecent());
    const t = setTimeout(() => inputRef.current?.focus(), 80);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      clearTimeout(t);
      document.body.style.overflow = prev;
      if (exitTimer.current) clearTimeout(exitTimer.current);
    };
  }, [open]);

  useEffect(() => {
    if (!mounted || closing) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        requestClose();
        return;
      }
      if (e.key === "ArrowDown" && results.length > 0) {
        e.preventDefault();
        setActiveIndex((i) => (i + 1) % results.length);
      }
      if (e.key === "ArrowUp" && results.length > 0) {
        e.preventDefault();
        setActiveIndex((i) => (i <= 0 ? results.length - 1 : i - 1));
      }
      if (e.key === "Enter" && activeIndex >= 0 && results[activeIndex]) {
        e.preventDefault();
        openResult(results[activeIndex].href);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, closing, results, activeIndex, requestClose]);

  const pushRecent = useCallback((term: string) => {
    const t = term.trim();
    if (t.length < 3) return;
    setRecent((prev) => {
      const next = [t, ...prev.filter((x) => x.toLowerCase() !== t.toLowerCase())].slice(0, MAX_RECENT);
      saveRecent(next);
      return next;
    });
  }, []);

  const clearRecent = () => {
    setRecent([]);
    saveRecent([]);
  };

  const runSearch = useCallback(
    async (q: string, currentScope: SearchScope) => {
      const term = q.trim();
      if (term.length < 3) {
        setResults([]);
        setSearched(false);
        setLoading(false);
        setActiveIndex(-1);
        return;
      }
      setLoading(true);
      setSearched(true);
      try {
        if (currentScope === "clients") {
          const res = await api.get<ApiResponse<PaginatedData<Client>>>("/clients", {
            params: { search: term, page: 1, page_size: 12 },
          });
          setResults(
            (res.data.data?.items || []).map((c) => ({
              id: c.id,
              title: c.company_name,
              subtitle: [c.contact_person, c.email].filter(Boolean).join(" · "),
              meta: c.industry || c.location || undefined,
              href: `/clients/${c.id}`,
            }))
          );
        } else if (currentScope === "jobs") {
          const res = await api.get<ApiResponse<PaginatedData<Job>>>("/jobs", {
            params: { search: term, page: 1, page_size: 12 },
          });
          setResults(
            (res.data.data?.items || []).map((j) => ({
              id: j.id,
              title: j.title,
              subtitle: j.client_name || j.engagement_name || undefined,
              meta: `Ref Y${j.id.toString(36).toUpperCase().padStart(7, "0").slice(0, 7)}${j.location ? ` · ${j.location}` : ""}`,
              href: `/jobs/${j.id}`,
            }))
          );
        } else {
          const res = await api.get<ApiResponse<PaginatedData<Candidate>>>("/candidates", {
            params: { search: term, page: 1, page_size: 12 },
          });
          setResults(
            (res.data.data?.items || []).map((c) => ({
              id: c.id,
              title: c.name,
              subtitle: c.email || undefined,
              meta: `Ref ${c.id.toString(36).toUpperCase().padStart(9, "0").slice(0, 9)}${c.current_job_title ? ` · ${c.current_job_title}` : ""}`,
              href: `/candidates/${c.id}`,
            }))
          );
        }
        pushRecent(term);
        setActiveIndex(0);
      } catch {
        setResults([]);
        setActiveIndex(-1);
      } finally {
        setLoading(false);
      }
    },
    [pushRecent]
  );

  useEffect(() => {
    if (!mounted || closing) return;
    const handle = setTimeout(() => runSearch(query, scope), 260);
    return () => clearTimeout(handle);
  }, [query, scope, mounted, closing, runSearch]);

  const openResult = (href: string) => {
    if (closing) return;
    setClosing(true);
    if (exitTimer.current) clearTimeout(exitTimer.current);
    exitTimer.current = setTimeout(() => {
      setClosing(false);
      setMounted(false);
      onClose();
      router.push(href);
    }, EXIT_MS);
  };

  const applyRecent = (term: string) => {
    setQuery(term);
    inputRef.current?.focus();
  };

  if (!open && !mounted) return null;

  const ActiveIcon = activeScope.icon;
  const queryReady = query.trim().length >= 3;
  const showRecent = !queryReady && recent.length > 0;
  const exiting = closing;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center px-3 pt-6 sm:px-4 sm:pt-10">
      <button
        type="button"
        aria-label="Close search"
        className={cn(
          "absolute inset-0 border-0",
          exiting ? "gs-backdrop-out" : "gs-backdrop-in"
        )}
        style={{
          background: "rgba(15, 23, 42, 0.55)",
          backdropFilter: "blur(10px)",
          WebkitBackdropFilter: "blur(10px)",
        }}
        onClick={requestClose}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Quick search"
        className={cn(
          "relative z-10 flex w-full max-w-[720px] flex-col gap-3",
          exiting ? "gs-bar-out" : "gs-bar-in"
        )}
      >
        {/* Top-centered frosted search bar */}
        <div
          className="relative group"
          onMouseEnter={() => setBarHovered(true)}
          onMouseLeave={() => setBarHovered(false)}
        >
          <div
            className="flex items-center gap-2 border border-white/50 bg-white/85 px-4 py-3 shadow-xl backdrop-blur-xl transition-[box-shadow,border-color] duration-300 sm:gap-3 sm:px-5 sm:py-3.5"
            style={{
              borderRadius: 16,
              boxShadow: barHovered
                ? `0 0 0 3px rgba(34, 211, 238, 0.35), 0 0 28px rgba(34, 211, 238, 0.4), 0 12px 40px rgba(15, 23, 42, 0.2)`
                : `0 0 0 1px rgba(255,255,255,0.4), 0 10px 36px rgba(15, 23, 42, 0.18)`,
              borderColor: barHovered ? CYAN : "rgba(255,255,255,0.55)",
            }}
          >
            <Search
              className={cn(
                "h-5 w-5 shrink-0 text-slate-400 transition-transform duration-300",
                barHovered && "scale-110 text-cyan-600"
              )}
            />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActiveIndex(-1);
              }}
                      placeholder="Search by name, email, job or reference number"
              className="w-full cursor-text bg-transparent text-[15px] font-medium text-slate-900 caret-[#1F574A] outline-none placeholder:font-normal placeholder:text-slate-400"
              autoComplete="off"
              spellCheck={false}
            />
            {loading && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-slate-400" />}
            {query && !loading && (
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setResults([]);
                  setSearched(false);
                  inputRef.current?.focus();
                }}
                className="rounded-md p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                style={{ borderRadius: 8 }}
                aria-label="Clear"
              >
                <X className="h-4 w-4" />
              </button>
            )}
            <button
              type="button"
              onClick={requestClose}
              className="rounded-md p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              style={{ borderRadius: 8 }}
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Results panel under search bar */}
        <div
          className={cn(
            "flex flex-col overflow-hidden border border-white/40 bg-white/95 shadow-2xl backdrop-blur-xl",
            exiting ? "gs-panel-out" : "gs-panel-in"
          )}
          style={{
            borderRadius: 16,
            minHeight: 400,
            maxHeight: "min(520px, 72vh)",
          }}
        >
          <div className="flex min-h-0 flex-1">
            <aside className="w-[180px] shrink-0 border-r border-slate-100/80 bg-slate-50/80 py-4 sm:w-[200px]">
              <div className="mb-2 flex items-center gap-1.5 px-4">
                <UserPlus className="h-3.5 w-3.5 text-slate-400" />
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Search for
                </p>
              </div>
              <nav className="space-y-0.5 px-2">
                {scopes.map((s) => {
                  const SIcon = s.icon;
                  const active = scope === s.id;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setScope(s.id)}
                      className={cn(
                        "relative flex w-full cursor-pointer items-center gap-2.5 px-3 py-2.5 text-left text-sm font-medium transition-colors duration-200",
                        active
                          ? "text-white shadow-sm"
                          : "text-slate-600 hover:bg-white hover:text-slate-900"
                      )}
                      style={{
                        borderRadius: 10,
                        ...(active ? { backgroundColor: ACCENT } : {}),
                      }}
                    >
                      <SIcon className={cn("h-4 w-4", active ? "text-white" : "text-slate-400")} />
                      {s.label}
                    </button>
                  );
                })}
              </nav>
            </aside>

            <section className="flex min-w-0 flex-1 flex-col">
              <div className="flex items-center justify-between px-5 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  {showRecent && !queryReady ? "Recent" : "Results"}
                </p>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto">
                {showRecent && !queryReady && (
                  <div className="px-2 pb-2">
                    <div className="mb-1 flex items-center justify-between px-3">
                      <span className="text-xs font-semibold text-slate-600">Recent Searches</span>
                      <button
                        type="button"
                        onClick={clearRecent}
                        className="cursor-pointer text-xs font-medium transition hover:underline"
                        style={{ color: ACCENT }}
                      >
                        Clear
                      </button>
                    </div>
                    <ul>
                      {recent.map((term, i) => (
                        <li key={term}>
                          <button
                            type="button"
                            onClick={() => applyRecent(term)}
                            className="gs-result-in flex w-full cursor-pointer items-center gap-2.5 px-3 py-2.5 text-left text-sm text-slate-700 transition-colors duration-200 hover:bg-teal-50"
                            style={{
                              borderRadius: 10,
                              animationDelay: `${i * 40}ms`,
                            }}
                          >
                            <Search className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                            <span className="truncate">{term}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {!queryReady && !showRecent && (
                  <div className="flex h-full flex-col items-center justify-center px-8 py-14 text-center">
                    <div className="relative mb-5">
                      <div
                        className="flex h-24 w-20 items-center justify-center border border-dashed border-slate-200 bg-gradient-to-b from-slate-50 to-white shadow-sm"
                        style={{ borderRadius: 12 }}
                      >
                        <FileSearch className="h-10 w-10 text-slate-300" />
                      </div>
                      <div
                        className="absolute -bottom-2 -right-3 flex h-11 w-11 items-center justify-center rounded-full border-4 border-white shadow-md"
                        style={{ backgroundColor: ACCENT }}
                      >
                        <Search className="h-5 w-5 text-white" />
                      </div>
                    </div>
                    <p className="text-sm text-slate-600">
                      Please enter <span className="font-semibold text-slate-800">3 characters</span>{" "}
                      or more
                    </p>
                    <p className="mt-1.5 max-w-xs text-xs text-slate-400">
                      Searching in {activeScope.label.toLowerCase()} — results will appear here.
                    </p>
                  </div>
                )}

                {queryReady && searched && !loading && results.length === 0 && (
                  <div className="flex h-full flex-col items-center justify-center px-8 py-14 text-center">
                    <div
                      className="mb-4 flex h-14 w-14 items-center justify-center bg-slate-50 text-slate-300"
                      style={{ borderRadius: 14 }}
                    >
                      <ActiveIcon className="h-7 w-7" />
                    </div>
                    <p className="text-sm font-medium text-slate-700">
                      No {activeScope.label.toLowerCase()} found for “{query.trim()}”
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      Try another keyword or switch category on the left.
                    </p>
                  </div>
                )}

                {results.length > 0 && (
                  <ul className="space-y-0.5 px-2 pb-2">
                    {results.map((r, i) => (
                      <li key={`${scope}-${r.id}`}>
                        <button
                          type="button"
                          onClick={() => openResult(r.href)}
                          onMouseEnter={() => setActiveIndex(i)}
                          className={cn(
                            "gs-result-in flex w-full cursor-pointer items-start gap-3 px-3 py-3 text-left transition-colors duration-200",
                            activeIndex === i ? "bg-teal-50" : "hover:bg-teal-50"
                          )}
                          style={{
                            borderRadius: 12,
                            animationDelay: `${Math.min(i, 8) * 35}ms`,
                          }}
                        >
                          <span
                            className={cn(
                              "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center",
                              scope === "clients" && "bg-emerald-50 text-emerald-700",
                              scope === "jobs" && "bg-blue-50 text-blue-700",
                              scope === "candidates" && "bg-teal-50 text-teal-800"
                            )}
                            style={{ borderRadius: 12 }}
                          >
                            <ActiveIcon className="h-4 w-4" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-semibold text-slate-900">
                              <HighlightMatch text={r.title} query={query} />
                            </span>
                            {r.subtitle && (
                              <span className="mt-0.5 flex items-center gap-1 truncate text-xs text-slate-500">
                                {scope === "candidates" && <Mail className="h-3 w-3 shrink-0" />}
                                <HighlightMatch text={r.subtitle} query={query} />
                              </span>
                            )}
                            {r.meta && (
                              <span className="mt-0.5 flex items-center gap-1 truncate text-[11px] text-slate-400">
                                <MapPin className="h-3 w-3 shrink-0 opacity-70" />
                                {r.meta}
                              </span>
                            )}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>
          </div>

          <div className="relative flex items-center justify-between border-t border-slate-100/80 bg-slate-50/70 px-4 py-2.5 text-[11px] text-slate-400">
            <div className="relative">
              <button
                type="button"
                onClick={() => setFilterOpen((v) => !v)}
                className="inline-flex cursor-pointer items-center gap-1 px-1.5 py-0.5 transition hover:bg-white"
                style={{ borderRadius: 8 }}
              >
                Filter: <span className="font-semibold text-slate-600">{activeScope.label}</span>
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
              {filterOpen && (
                <div
                  className="absolute bottom-full left-0 mb-1 min-w-[140px] overflow-hidden border border-slate-200 bg-white py-1 shadow-lg"
                  style={{ borderRadius: 10 }}
                >
                  {scopes.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => {
                        setScope(s.id);
                        setFilterOpen(false);
                      }}
                      className={cn(
                        "block w-full cursor-pointer px-3 py-2 text-left text-xs font-medium transition hover:bg-teal-50",
                        scope === s.id ? "text-[#1F574A]" : "text-slate-600"
                      )}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <span>
              <kbd
                className="border border-slate-200 bg-white px-1.5 py-0.5 font-mono text-[10px]"
                style={{ borderRadius: 6 }}
              >
                Esc
              </kbd>{" "}
              to close
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
