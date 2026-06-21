"use client";

import { useMemo, useState } from "react";
import { Plus, MoreVertical, Lock, LockOpen, Share2, Pencil, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import { formatDistanceToNow } from "date-fns";
import AnimatedModal from "@/components/ui/AnimatedModal";
import Textarea from "@/components/ui/Textarea";
import Button from "@/components/ui/Button";
import { UserAvatar } from "@/components/clients/ClientAvatar";
import api from "@/lib/api";
import { cn, formatDateTimeBullet } from "@/lib/utils";
import type { Client, Note } from "@/types";

type NoteCategory = { key: string; label: string; type: string; refId?: number; count: number };

interface Props {
  client: Client;
  clientId: string;
  notes: Note[];
  onRefresh: () => void;
}

export default function ClientNotesTab({ client, clientId, notes, onRefresh }: Props) {
  const [activeCat, setActiveCat] = useState("general");
  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [menuId, setMenuId] = useState<number | null>(null);
  const [editNote, setEditNote] = useState<Note | null>(null);

  const categories = useMemo(() => {
    const cats: NoteCategory[] = [
      { key: "general", label: "General", type: "general", count: notes.filter((n) => n.category_type === "general").length },
    ];
    client.contacts?.forEach((c) => {
      cats.push({
        key: `contact-${c.id}`,
        label: c.name,
        type: "contact",
        refId: c.id,
        count: notes.filter((n) => n.category_type === "contact" && n.category_ref_id === c.id).length,
      });
    });
    client.guests?.forEach((g) => {
      cats.push({
        key: `guest-${g.id}`,
        label: g.name,
        type: "guest",
        refId: g.id,
        count: notes.filter((n) => n.category_type === "guest" && n.category_ref_id === g.id).length,
      });
    });
    return cats;
  }, [client, notes]);

  const activeCategory = categories.find((c) => c.key === activeCat) || categories[0];

  const filteredNotes = notes.filter((n) => {
    const matchCat =
      activeCategory.type === "general"
        ? n.category_type === "general"
        : n.category_type === activeCategory.type && n.category_ref_id === activeCategory.refId;
    const matchSearch = !search || n.content.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  const addNote = async () => {
    if (!noteText.trim()) return;
    await api.post("/notes", {
      entity_type: "client",
      entity_id: Number(clientId),
      content: noteText,
      is_private: isPrivate,
      category_type: activeCategory.type,
      category_ref_id: activeCategory.refId ?? null,
    });
    toast.success("Note added");
    setNoteText("");
    setIsPrivate(false);
    setAddOpen(false);
    onRefresh();
  };

  const deleteNote = async (id: number) => {
    if (!confirm("Delete this note?")) return;
    await api.delete(`/notes/${id}`);
    toast.success("Note deleted");
    setMenuId(null);
    onRefresh();
  };

  const toggleShare = async (note: Note) => {
    await api.put(`/notes/${note.id}`, { shared_with_guest: !note.shared_with_guest });
    toast.success(note.shared_with_guest ? "Unshared" : "Shared with guest");
    setMenuId(null);
    onRefresh();
  };

  const saveEdit = async () => {
    if (!editNote) return;
    await api.put(`/notes/${editNote.id}`, { content: editNote.content });
    toast.success("Note updated");
    setEditNote(null);
    onRefresh();
  };

  return (
    <div className="flex gap-0 border border-gray-200 rounded-lg overflow-hidden bg-white shadow-sm min-h-[420px]">
      <aside className="w-56 shrink-0 border-r border-gray-200 bg-gray-50/50">
        <div className="p-3 border-b border-gray-200">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search for contacts or guests"
            className="w-full text-xs px-3 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500/30"
          />
        </div>
        <nav className="py-1">
          {categories.map((cat) => (
            <button
              key={cat.key}
              type="button"
              onClick={() => setActiveCat(cat.key)}
              className={cn(
                "w-full flex items-center justify-between px-4 py-2.5 text-sm transition-colors",
                activeCat === cat.key ? "bg-primary text-white" : "text-gray-700 hover:bg-gray-100"
              )}
            >
              <span className="truncate">{cat.label}</span>
              {cat.count > 0 && (
                <span className={cn(
                  "text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1",
                  activeCat === cat.key ? "bg-white/20 text-white" : "bg-green-500 text-white"
                )}>
                  {cat.count}
                </span>
              )}
            </button>
          ))}
        </nav>
      </aside>

      <div className="flex-1 p-5">
        <button
          type="button"
          onClick={() => setAddOpen(true)}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-white text-sm font-medium rounded-md hover:bg-primary-700 transition-colors mb-5"
        >
          <Plus className="h-4 w-4" /> Add Note
        </button>

        <div className="space-y-4">
          {filteredNotes.length ? filteredNotes.map((n) => (
            <div key={n.id} className="flex gap-3 animate-fade-in">
              <UserAvatar name={n.created_by_name || "U"} size="md" />
              <div className="flex-1 min-w-0">
                <div className={cn(
                  "relative rounded-lg border px-4 py-3 shadow-sm",
                  n.is_private ? "bg-amber-50/80 border-amber-100" : "bg-white border-gray-200"
                )}>
                  <p className="text-sm text-gray-800 whitespace-pre-wrap">{n.content}</p>
                  <div className="flex items-center gap-2 mt-2 text-xs text-gray-400">
                    {n.is_private ? (
                      <span className="inline-flex items-center gap-1 text-red-500"><Lock className="h-3 w-3" /> Private</span>
                    ) : n.shared_with_guest ? (
                      <span className="inline-flex items-center gap-1 text-green-600"><LockOpen className="h-3 w-3" /> Shared</span>
                    ) : (
                      <span className="inline-flex items-center gap-1"><LockOpen className="h-3 w-3" /> Internal</span>
                    )}
                    <span>·</span>
                    <span>Created {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })} ({formatDateTimeBullet(n.created_at)})</span>
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-1 ml-1">{n.created_by_name}</p>
              </div>
              <div className="relative shrink-0">
                <button type="button" onClick={() => setMenuId(menuId === n.id ? null : n.id)}
                  className="p-1.5 rounded-md text-gray-400 hover:bg-gray-100">
                  <MoreVertical className="h-4 w-4" />
                </button>
                {menuId === n.id && (
                  <div className="absolute right-0 top-8 z-20 w-40 bg-white border border-gray-200 rounded-lg shadow-lg py-1 animate-slide-down">
                    <button type="button" onClick={() => { setEditNote(n); setMenuId(null); }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
                      <Pencil className="h-3.5 w-3.5" /> Edit
                    </button>
                    <button type="button" onClick={() => deleteNote(n.id)}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50">
                      <Trash2 className="h-3.5 w-3.5" /> Delete
                    </button>
                    <button type="button" onClick={() => toggleShare(n)}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
                      <Share2 className="h-3.5 w-3.5" /> Share with guest
                    </button>
                  </div>
                )}
              </div>
            </div>
          )) : (
            <p className="text-sm text-gray-400 py-12 text-center">No notes in this category yet</p>
          )}
        </div>
      </div>

      <AnimatedModal open={addOpen} onClose={() => setAddOpen(false)} title="Add Note" size="md">
        <Textarea value={noteText} onChange={(e) => setNoteText(e.target.value)} placeholder="Write a note..." rows={5} />
        <label className="flex items-center gap-2 mt-3 text-sm text-gray-600 cursor-pointer">
          <input type="checkbox" checked={isPrivate} onChange={(e) => setIsPrivate(e.target.checked)} className="rounded" />
          Mark as private
        </label>
        <div className="flex gap-3 mt-4">
          <Button onClick={addNote}>Add Note</Button>
          <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
        </div>
      </AnimatedModal>

      <AnimatedModal open={!!editNote} onClose={() => setEditNote(null)} title="Edit Note" size="md">
        {editNote && (
          <>
            <Textarea value={editNote.content} onChange={(e) => setEditNote({ ...editNote, content: e.target.value })} rows={5} />
            <div className="flex gap-3 mt-4">
              <Button onClick={saveEdit}>Save</Button>
              <Button variant="outline" onClick={() => setEditNote(null)}>Cancel</Button>
            </div>
          </>
        )}
      </AnimatedModal>
    </div>
  );
}
