"use client";

import { cn } from "@/lib/utils";

export type PermissionFlags = {
  can_view_clients: boolean;
  can_add_clients: boolean;
  can_edit_clients: boolean;
  can_view_jobs: boolean;
  can_add_jobs: boolean;
  can_edit_jobs: boolean;
  can_view_candidates: boolean;
  can_add_candidates: boolean;
  can_edit_candidates: boolean;
};

export const DEFAULT_PERMISSIONS: PermissionFlags = {
  can_view_clients: true,
  can_add_clients: true,
  can_edit_clients: true,
  can_view_jobs: true,
  can_add_jobs: true,
  can_edit_jobs: true,
  can_view_candidates: true,
  can_add_candidates: true,
  can_edit_candidates: true,
};

const MODULES: {
  key: "clients" | "jobs" | "candidates";
  label: string;
  hint: string;
}[] = [
  { key: "clients", label: "Clients", hint: "See and manage companies" },
  { key: "jobs", label: "Jobs", hint: "Create and work on openings" },
  { key: "candidates", label: "Candidates", hint: "Add and update talent" },
];

const ACTIONS: { key: "view" | "add" | "edit"; label: string }[] = [
  { key: "view", label: "View" },
  { key: "add", label: "Add" },
  { key: "edit", label: "Edit" },
];

function flagName(module: string, action: string): keyof PermissionFlags {
  return `can_${action}_${module}` as keyof PermissionFlags;
}

interface Props {
  value: PermissionFlags;
  onChange: (next: PermissionFlags) => void;
  disabled?: boolean;
}

export default function TeamPermissionMatrix({ value, onChange, disabled }: Props) {
  const toggle = (key: keyof PermissionFlags) => {
    if (disabled) return;
    const next = { ...value, [key]: !value[key] };
    // View off → also turn off add/edit for that module
    for (const mod of MODULES) {
      const viewKey = flagName(mod.key, "view");
      if (key === viewKey && !next[viewKey]) {
        next[flagName(mod.key, "add")] = false;
        next[flagName(mod.key, "edit")] = false;
      }
      // Add/edit on → ensure view on
      if ((key === flagName(mod.key, "add") || key === flagName(mod.key, "edit")) && next[key]) {
        next[viewKey] = true;
      }
    }
    onChange(next);
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
      <div className="mb-3">
        <p className="text-sm font-semibold text-slate-800">Permissions</p>
        <p className="mt-0.5 text-xs text-slate-500">
          Turn off a permission to block that action. Hiding a client from this member also hides its
          jobs and candidates.
        </p>
      </div>

      <div className="space-y-3">
        {MODULES.map((mod, idx) => (
          <div
            key={mod.key}
            className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm"
          >
            <div className="mb-2 flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#1F574A]/10 text-[11px] font-bold text-[#1F574A]">
                {idx + 1}
              </span>
              <div>
                <p className="text-sm font-semibold text-slate-800">{mod.label}</p>
                <p className="text-[11px] text-slate-400">{mod.hint}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {ACTIONS.map((act) => {
                const key = flagName(mod.key, act.key);
                const on = value[key];
                return (
                  <button
                    key={key}
                    type="button"
                    disabled={disabled}
                    onClick={() => toggle(key)}
                    className={cn(
                      "rounded-lg border px-3 py-1.5 text-xs font-semibold transition",
                      on
                        ? "border-[#1F574A] bg-[#1F574A] text-white"
                        : "border-slate-200 bg-white text-slate-500 hover:border-slate-300",
                      disabled && "cursor-not-allowed opacity-60"
                    )}
                  >
                    {act.label}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
