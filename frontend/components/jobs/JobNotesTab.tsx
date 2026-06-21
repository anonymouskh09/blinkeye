"use client";

import { useState } from "react";
import { Plus, MoreVertical, Pencil, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import { formatDistanceToNow } from "date-fns";
import AnimatedModal from "@/components/ui/AnimatedModal";
import Textarea from "@/components/ui/Textarea";
import Button from "@/components/ui/Button";
import { UserAvatar } from "@/components/clients/ClientAvatar";
import api from "@/lib/api";
import { formatDateTimeBullet } from "@/lib/utils";
import type { Note } from "@/types";

interface Props {
  jobId: string;
  notes: Note[];
  onRefresh: () => void;
}

export default function JobNotesTab({ jobId, notes, onRefresh }: Props) {
  const [addOpen, setAddOpen] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [menuId, setMenuId] = useState<number | null>(null);
  const [editNote, setEditNote] = useState<Note | null>(null);

  const addNote = async () => {
    if (!noteText.trim()) return;
    await api.post("/notes", {
      entity_type: "job",
      entity_id: Number(jobId),
      content: noteText,
      category_type: "general",
    });
    toast.success("Note added");
    setNoteText("");
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

  const saveEdit = async () => {
    if (!editNote) return;
    await api.put(`/notes/${editNote.id}`, { content: editNote.content });
    toast.success("Note updated");
    setEditNote(null);
    onRefresh();
  };

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden bg-white shadow-sm min-h-[420px]">
      <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 bg-gray-50/50">
        <h3 className="text-sm font-semibold text-gray-700">Notes ({notes.length})</h3>
        <button type="button" onClick={() => setAddOpen(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white text-sm rounded-md hover:bg-primary-700">
          <Plus className="h-4 w-4" /> Add Note
        </button>
      </div>

      <div className="p-4 space-y-3">
        {notes.length ? notes.map((note) => (
          <div key={note.id} className="relative bg-primary-50/60 border border-primary/10 rounded-lg p-4 max-w-2xl">
            <div className="flex items-start gap-3">
              <UserAvatar name={note.created_by_name || "U"} size="md" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium text-gray-800">{note.created_by_name}</span>
                  <span className="text-xs text-gray-400">{formatDateTimeBullet(note.created_at)}</span>
                  <span className="text-xs text-gray-400">· {formatDistanceToNow(new Date(note.created_at), { addSuffix: true })}</span>
                </div>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{note.content}</p>
              </div>
              <div className="relative">
                <button type="button" onClick={() => setMenuId(menuId === note.id ? null : note.id)}
                  className="text-gray-400 hover:text-gray-600"><MoreVertical className="h-4 w-4" /></button>
                {menuId === note.id && (
                  <div className="absolute right-0 top-6 z-10 w-36 bg-white border border-gray-200 rounded-lg shadow-lg py-1">
                    <button type="button" onClick={() => { setEditNote(note); setMenuId(null); }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50"><Pencil className="h-3.5 w-3.5" /> Edit</button>
                    <button type="button" onClick={() => deleteNote(note.id)}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50"><Trash2 className="h-3.5 w-3.5" /> Delete</button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )) : (
          <p className="text-sm text-gray-400 text-center py-16">No notes yet. Add your first note.</p>
        )}
      </div>

      <AnimatedModal open={addOpen} onClose={() => setAddOpen(false)} title="Add Note" size="md">
        <Textarea value={noteText} onChange={(e) => setNoteText(e.target.value)} rows={5} placeholder="Write a note..." />
        <Button className="mt-4" onClick={addNote}>Save Note</Button>
      </AnimatedModal>

      <AnimatedModal open={!!editNote} onClose={() => setEditNote(null)} title="Edit Note" size="md">
        {editNote && (
          <>
            <Textarea value={editNote.content} onChange={(e) => setEditNote({ ...editNote, content: e.target.value })} rows={5} />
            <Button className="mt-4" onClick={saveEdit}>Update</Button>
          </>
        )}
      </AnimatedModal>
    </div>
  );
}
