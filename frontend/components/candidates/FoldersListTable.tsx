"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { ArrowUpDown, MoreVertical, Pencil, Star, Trash2 } from "lucide-react";
import { UserAvatar } from "@/components/clients/ClientAvatar";
import { cn } from "@/lib/utils";
import type { CandidateFolder } from "@/types";

interface Props {
  folders: CandidateFolder[];
  onToggleFavorite: (folder: CandidateFolder) => void;
  onEdit: (folder: CandidateFolder) => void;
  onDelete: (folder: CandidateFolder) => void;
}

export default function FoldersListTable({ folders, onToggleFavorite, onEdit, onDelete }: Props) {
  const [menuId, setMenuId] = useState<number | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full">
          <thead>
            <tr className="bg-[#f8fafc] border-b border-gray-200">
              <th className="w-10 px-3 py-3"><input type="checkbox" className="rounded border-gray-300" /></th>
              <th className="w-10 px-2 py-3" />
              <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">
                <span className="inline-flex items-center gap-1">Folder Name <ArrowUpDown className="h-3 w-3" /></span>
              </th>
              <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">Owner</th>
              <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">Shared to</th>
              <th className="w-12 px-3 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {folders.map((folder) => (
              <tr key={folder.id} className="hover:bg-gray-50/60 transition-colors">
                <td className="px-3 py-4"><input type="checkbox" className="rounded border-gray-300" /></td>
                <td className="px-2 py-4">
                  <button
                    type="button"
                    onClick={() => onToggleFavorite(folder)}
                    className="p-1 text-gray-400 hover:text-amber-500 transition-colors"
                  >
                    <Star className={cn("h-4 w-4", folder.is_favorite && "fill-amber-400 text-amber-400")} />
                  </button>
                </td>
                <td className="px-3 py-4">
                  <Link href={`/candidates/folders/${folder.id}`} className="group">
                    <p className="text-sm font-medium text-primary group-hover:underline">{folder.name}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {folder.candidate_count} Candidate{folder.candidate_count !== 1 ? "s" : ""}
                    </p>
                  </Link>
                </td>
                <td className="px-3 py-4">
                  <div className="flex items-center gap-2">
                    <UserAvatar name={folder.owner_name || "U"} size="md" />
                    <span className="text-sm text-primary">{folder.owner_name || "—"}</span>
                  </div>
                </td>
                <td className="px-3 py-4">
                  <div className="flex items-center gap-2">
                    <UserAvatar name={folder.shared_to_name || folder.owner_name || "U"} size="md" />
                    <span className="text-sm text-primary">{folder.shared_to_name || folder.owner_name || "—"}</span>
                  </div>
                </td>
                <td className="px-3 py-4 relative">
                  <button
                    type="button"
                    onClick={() => setMenuId(menuId === folder.id ? null : folder.id)}
                    className="p-1.5 rounded hover:bg-gray-100 text-gray-500"
                  >
                    <MoreVertical className="h-4 w-4" />
                  </button>
                  {menuId === folder.id && (
                    <div
                      ref={menuRef}
                      className="absolute right-3 top-10 z-20 w-36 bg-white border border-gray-200 rounded-lg shadow-lg py-1"
                    >
                      <button
                        type="button"
                        onClick={() => { onEdit(folder); setMenuId(null); }}
                        className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                      >
                        <Pencil className="h-4 w-4" /> Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => { onDelete(folder); setMenuId(null); }}
                        className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" /> Delete
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
