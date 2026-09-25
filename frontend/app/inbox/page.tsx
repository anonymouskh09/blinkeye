"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import Link from "next/link";
import {
  MessagesSquare, Search, UserCheck, Briefcase, Building2, Share2, ArrowUpRight,
} from "lucide-react";
import toast from "react-hot-toast";
import PageWrapper from "@/components/layout/PageWrapper";
import Header from "@/components/layout/Header";
import EmptyState from "@/components/ui/EmptyState";
import { TableSkeleton } from "@/components/ui/Skeleton";
import api from "@/lib/api";
import { cn, formatDateTime, getInitials } from "@/lib/utils";
import type { ApiResponse, InboxItem } from "@/types";

type Filter = "all" | "candidate" | "job" | "client";

const entityLink = (type: string, id: number) => {
  if (type === "candidate") return `/candidates/${id}`;
  if (type === "job") return `/jobs/${id}`;
  if (type === "client") return `/clients/${id}`;
  return null;
};

const ENTITY_META: Record<string, { icon: React.ElementType; chip: string }> = {
  candidate: { icon: UserCheck, chip: "bg-teal-50 text-teal-700 ring-teal-200" },
  job: { icon: Briefcase, chip: "bg-primary-50 text-primary-600 ring-primary-200" },
  client: { icon: Building2, chip: "bg-amber-50 text-amber-700 ring-amber-200" },
};

export default function InboxPage() {
  const [items, setItems] = useState<InboxItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");

  const fetchInbox = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<ApiResponse<{ items: InboxItem[] }>>("/recruitment/inbox");
      setItems(res.data.data.items);
    } catch {
      toast.error("Failed to load inbox");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchInbox(); }, [fetchInbox]);

  const countFor = (f: Filter) => (f === "all" ? items.length : items.filter((n) => n.entity_type === f).length);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((n) => {
      if (filter !== "all" && n.entity_type !== filter) return false;
      if (!q) return true;
      return [n.content, n.entity_label, n.created_by_name].some((v) => v?.toLowerCase().includes(q));
    });
  }, [items, filter, query]);

  const tabs: { id: Filter; label: string }[] = [
    { id: "all", label: "All Notes" },
    { id: "candidate", label: "Candidates" },
    { id: "job", label: "Jobs" },
    { id: "client", label: "Clients" },
  ];

  return (
    <PageWrapper>
      <Header
        title="Notes Feed"
        subtitle="Notes added across candidates, jobs, and clients"
        icon={<MessagesSquare className="h-5 w-5" />}
      />

      <div className="rounded-xl border border-slate-200 bg-white shadow-card">
        <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-1.5">
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setFilter(t.id)}
                className={cn(
                  "inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-[13px] font-bold transition-colors",
                  filter === t.id ? "bg-primary text-white shadow-sm" : "text-slate-600 hover:bg-slate-100",
                )}
              >
                {t.label}
                <span className={cn(
                  "rounded-full px-1.5 text-[11px] tabular-nums",
                  filter === t.id ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500",
                )}>
                  {countFor(t.id)}
                </span>
              </button>
            ))}
          </div>
          <div className="relative w-full lg:w-72">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search notes..."
              className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm font-medium text-slate-800 placeholder:text-slate-400 focus:border-primary focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/15"
            />
          </div>
        </div>

        {loading ? <div className="p-5"><TableSkeleton rows={6} cols={1} /></div> : !visible.length ? (
          <EmptyState
            title={items.length ? "No matching notes" : "No notes yet"}
            description={items.length ? "Try a different filter or search term." : "Notes you add to candidates, jobs, or clients will appear here."}
            icon={<MessagesSquare className="w-8 h-8" />}
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 p-5 xl:grid-cols-2">
            {visible.map((note) => {
              const href = entityLink(note.entity_type, note.entity_id);
              const meta = ENTITY_META[note.entity_type] ?? { icon: MessagesSquare, chip: "bg-slate-50 text-slate-600 ring-slate-200" };
              const Icon = meta.icon;
              const author = note.created_by_name || "Unknown";
              return (
                <article
                  key={note.id}
                  className="flex flex-col rounded-xl border border-slate-200 bg-white p-4 transition-all hover:border-primary-200 hover:shadow-card-hover"
                >
                  <header className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-white">
                        {getInitials(author)}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-slate-900">{author}</p>
                        <p className="text-[11px] font-medium text-slate-400 tabular-nums">
                          {note.updated_at
                            ? formatDateTime(note.updated_at.split("T")[0], note.updated_at.split("T")[1]?.slice(0, 5))
                            : ""}
                        </p>
                      </div>
                    </div>
                    <span className={cn("status-pill capitalize", meta.chip)}>
                      <Icon className="h-3 w-3" /> {note.entity_type}
                    </span>
                  </header>

                  <p className="mt-3 flex-1 whitespace-pre-wrap rounded-lg bg-slate-50 px-3.5 py-3 text-[13.5px] leading-relaxed text-slate-700">
                    {note.content}
                  </p>

                  <footer className="mt-3 flex items-center justify-between gap-2">
                    {href ? (
                      <Link href={href} className="inline-flex min-w-0 items-center gap-1 truncate text-[13px] font-bold text-primary hover:underline">
                        {note.entity_label} <ArrowUpRight className="h-3.5 w-3.5 shrink-0" />
                      </Link>
                    ) : (
                      <span className="truncate text-[13px] font-bold text-slate-800">{note.entity_label}</span>
                    )}
                    {note.shared_with_guest && (
                      <span className="status-pill bg-teal-50 text-teal-700 ring-teal-200 normal-case">
                        <Share2 className="h-3 w-3" /> Shared with guest
                      </span>
                    )}
                  </footer>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </PageWrapper>
  );
}
