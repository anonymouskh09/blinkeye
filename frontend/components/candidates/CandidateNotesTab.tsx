"use client";

import { useMemo, useState } from "react";
import {
  Lock, MessageSquarePlus, MoreVertical, Pencil, Search, Send, StickyNote, Trash2, X,
} from "lucide-react";
import toast from "react-hot-toast";
import { formatDistanceToNow } from "date-fns";
import AnimatedModal from "@/components/ui/AnimatedModal";
import { UserAvatar } from "@/components/clients/ClientAvatar";
import api from "@/lib/api";
import { cn, formatDateTimeBullet } from "@/lib/utils";
import type { Note } from "@/types";

interface Props {
  candidateId: string;
  candidateName: string;
  notes: Note[];
  onRefresh: () => void;
}

export default function CandidateNotesTab({ candidateId, candidateName, notes, onRefresh }: Props) {
  const [search, setSearch] = useState("");
  const [noteText, setNoteText] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [menuId, setMenuId] = useState<number | null>(null);
  const [editNote, setEditNote] = useState<Note | null>(null);
  const [focused, setFocused] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = [...notes].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
    if (!q) return list;
    return list.filter(
      (n) =>
        n.content.toLowerCase().includes(q) ||
        n.created_by_name?.toLowerCase().includes(q),
    );
  }, [notes, search]);

  const addNote = async () => {
    if (!noteText.trim()) return;
    setSubmitting(true);
    try {
      await api.post("/notes", {
        entity_type: "candidate",
        entity_id: Number(candidateId),
        content: noteText.trim(),
        is_private: isPrivate,
        category_type: "general",
      });
      toast.success("Note added");
      setNoteText("");
      setIsPrivate(false);
      setFocused(false);
      onRefresh();
    } catch {
      toast.error("Failed to add note");
    } finally {
      setSubmitting(false);
    }
  };

  const deleteNote = async (id: number) => {
    if (!confirm("Delete this note?")) return;
    await api.delete(`/notes/${id}`);
    toast.success("Note deleted");
    setMenuId(null);
    onRefresh();
  };

  const saveEdit = async () => {
    if (!editNote?.content.trim()) return;
    await api.put(`/notes/${editNote.id}`, { content: editNote.content.trim() });
    toast.success("Note updated");
    setEditNote(null);
    onRefresh();
  };

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <StickyNote className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Notes</h2>
              <p className="text-xs text-gray-500">
                {notes.length} note{notes.length !== 1 ? "s" : ""} on {candidateName}
              </p>
            </div>
          </div>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search notes..."
            className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-9 pr-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        </div>
      </div>

      {/* Composer */}
      <div
        className={cn(
          "overflow-hidden rounded-2xl border bg-white shadow-sm transition",
          focused ? "border-primary/40 ring-2 ring-primary/10" : "border-gray-200/80",
        )}
      >
        <div className="border-b border-gray-100 bg-gradient-to-r from-gray-50/80 to-white px-5 py-3">
          <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
            <MessageSquarePlus className="h-4 w-4 text-primary" />
            Write a new note
          </div>
        </div>
        <div className="p-5">
          <textarea
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => !noteText && setFocused(false)}
            rows={focused || noteText ? 4 : 2}
            placeholder="Share interview feedback, recruiter observations, or follow-up reminders..."
            className="w-full resize-y rounded-xl border border-gray-200 bg-gray-50/50 px-4 py-3 text-sm leading-relaxed text-gray-800 outline-none transition placeholder:text-gray-400 focus:border-primary focus:bg-white focus:ring-2 focus:ring-primary/20"
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) addNote();
            }}
          />
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-gray-600">
              <input
                type="checkbox"
                checked={isPrivate}
                onChange={(e) => setIsPrivate(e.target.checked)}
                className="rounded border-gray-300 text-primary focus:ring-primary"
              />
              <Lock className="h-3.5 w-3.5 text-gray-400" />
              Private note
            </label>
            <div className="flex items-center gap-2">
              {(focused || noteText) && (
                <button
                  type="button"
                  onClick={() => { setNoteText(""); setIsPrivate(false); setFocused(false); }}
                  className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm text-gray-500 transition hover:bg-gray-100"
                >
                  <X className="h-3.5 w-3.5" />
                  Clear
                </button>
              )}
              <button
                type="button"
                onClick={addNote}
                disabled={!noteText.trim() || submitting}
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Send className="h-4 w-4" />
                {submitting ? "Saving…" : "Add Note"}
              </button>
            </div>
          </div>
          <p className="mt-2 text-[11px] text-gray-400">Tip: Press Ctrl+Enter to save quickly</p>
        </div>
      </div>

      {/* Notes list */}
      <div className="rounded-2xl border border-gray-200/80 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3.5">
          <h3 className="text-sm font-semibold text-gray-900">All notes</h3>
          <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
            {filtered.length}
          </span>
        </div>

        {!filtered.length ? (
          <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-100 text-gray-400">
              <StickyNote className="h-7 w-7" />
            </div>
            <p className="text-sm font-medium text-gray-700">
              {search ? "No notes match your search" : "No notes yet"}
            </p>
            <p className="mt-1 max-w-sm text-sm text-gray-400">
              {search
                ? "Try a different keyword or clear the search."
                : "Add your first note above to keep track of conversations and recruiter insights."}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50 p-2">
            {filtered.map((note, index) => (
              <article
                key={note.id}
                className={cn(
                  "group relative flex gap-4 rounded-xl p-4 transition hover:bg-gray-50/80",
                  index === 0 && "bg-primary/[0.02]",
                )}
              >
                <div className="mt-0.5 shrink-0">
                  <UserAvatar name={note.created_by_name || "U"} size="md" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="text-sm font-semibold text-gray-900">
                      {note.created_by_name || "Recruiter"}
                    </span>
                    <span className="text-xs text-gray-400">·</span>
                    <time className="text-xs text-gray-500" dateTime={note.created_at}>
                      {formatDistanceToNow(new Date(note.created_at), { addSuffix: true })}
                    </time>
                    <span className="hidden text-xs text-gray-400 sm:inline">
                      ({formatDateTimeBullet(note.created_at)})
                    </span>
                    {note.is_private && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700 ring-1 ring-amber-200">
                        <Lock className="h-3 w-3" />
                        Private
                      </span>
                    )}
                    {index === 0 && !search && (
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                        Latest
                      </span>
                    )}
                  </div>
                  <div
                    className={cn(
                      "rounded-xl border px-4 py-3 text-sm leading-relaxed text-gray-700 whitespace-pre-wrap",
                      note.is_private
                        ? "border-amber-100 bg-amber-50/40"
                        : "border-gray-100 bg-gray-50/60 group-hover:border-primary/10 group-hover:bg-white",
                    )}
                  >
                    {note.content}
                  </div>
                </div>

                <div className="relative shrink-0">
                  <button
                    type="button"
                    onClick={() => setMenuId(menuId === note.id ? null : note.id)}
                    className="rounded-lg p-2 text-gray-400 opacity-0 transition hover:bg-gray-100 hover:text-gray-600 group-hover:opacity-100"
                    aria-label="Note options"
                  >
                    <MoreVertical className="h-4 w-4" />
                  </button>
                  {menuId === note.id && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setMenuId(null)} aria-hidden />
                      <div className="absolute right-0 top-10 z-20 w-40 overflow-hidden rounded-xl border border-gray-200 bg-white py-1 shadow-lg">
                        <button
                          type="button"
                          onClick={() => { setEditNote(note); setMenuId(null); }}
                          className="flex w-full items-center gap-2 px-3 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteNote(note.id)}
                          className="flex w-full items-center gap-2 px-3 py-2.5 text-sm text-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Delete
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      <AnimatedModal open={!!editNote} onClose={() => setEditNote(null)} title="Edit note" size="md">
        {editNote && (
          <>
            <textarea
              value={editNote.content}
              onChange={(e) => setEditNote({ ...editNote, content: e.target.value })}
              rows={6}
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditNote(null)}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveEdit}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90"
              >
                Save changes
              </button>
            </div>
          </>
        )}
      </AnimatedModal>
    </div>
  );
}
