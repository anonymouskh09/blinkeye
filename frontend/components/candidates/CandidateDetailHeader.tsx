"use client";

import Link from "next/link";
import { ArrowLeft, Building2, ExternalLink, MapPin, Phone, Plus } from "lucide-react";
import EditableEmailPill from "@/components/candidates/profile/EditableEmailPill";
import InlineEditableField from "@/components/candidates/profile/InlineEditableField";
import { cn, getInitials } from "@/lib/utils";
import type { Candidate } from "@/types";

interface Props {
  candidate: Candidate;
  onViewCv?: () => void;
  onAddContact?: () => void;
  onSaveLocation?: (location: string) => Promise<void>;
  onSaveCompany?: (company: string) => Promise<void>;
  onSaveEmail?: (email: string) => Promise<void>;
}

function experienceLevel(years?: number | null): string | null {
  if (years == null) return null;
  if (years <= 2) return "Junior";
  if (years <= 5) return "Mid";
  if (years <= 10) return "Senior";
  return "Lead";
}

function buildTags(candidate: Candidate): string[] {
  const extras = candidate.profile_extras || {};
  const tags: string[] = [];

  const pool = extras.candidate_pool || extras.pool || extras.candidate_type;
  if (pool) tags.push(String(pool));
  else if (extras.source?.toLowerCase().includes("internal")) tags.push("Internal");
  else tags.push("Internal");

  const dept = extras.industry || extras.current_department;
  if (dept) tags.push(String(dept).toLowerCase());

  const level = experienceLevel(candidate.experience_years);
  if (level) tags.push(level);

  return tags;
}

const TAG_STYLES = [
  "border-emerald-200 bg-emerald-50 text-emerald-700",
  "border-primary-200 bg-primary-50 text-primary-700",
  "border-gray-200 bg-gray-50 text-gray-600",
];

export default function CandidateDetailHeader({
  candidate,
  onViewCv,
  onAddContact,
  onSaveLocation,
  onSaveCompany,
  onSaveEmail,
}: Props) {
  const titleLine = [
    candidate.current_job_title,
    candidate.experience_years != null ? `${candidate.experience_years}yr exp` : null,
  ].filter(Boolean);

  const tags = buildTags(candidate);

  return (
    <div className="border-b border-gray-100 bg-[#f8fafc] px-6 pb-5 pt-5">
      <Link
        href="/candidates"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-gray-500 transition hover:text-gray-800"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Candidates
      </Link>

      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-gray-200 bg-gray-100">
              {candidate.profile_image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={candidate.profile_image_url}
                  alt={candidate.name}
                  className="h-full w-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <span className="text-base font-bold tracking-tight text-gray-800">
                  {getInitials(candidate.name)}
                </span>
              )}
            </div>

            <div className="min-w-0 pt-0.5">
              <h1 className="text-xl font-bold text-gray-900">{candidate.name}</h1>
              {titleLine.length > 0 && (
                <p className="mt-1 text-sm text-gray-500">{titleLine.join(" · ")}</p>
              )}
              {onSaveLocation && (
                <InlineEditableField
                  icon={<MapPin className="h-3.5 w-3.5" />}
                  value={candidate.location}
                  placeholder="location"
                  onSave={onSaveLocation}
                  className="mt-1.5"
                />
              )}
              {onSaveCompany && (
                <InlineEditableField
                  icon={<Building2 className="h-3.5 w-3.5" />}
                  value={candidate.current_company}
                  placeholder="company"
                  onSave={onSaveCompany}
                  className="mt-1"
                />
              )}
              {tags.length > 0 && (
                <div className="mt-2.5 flex flex-wrap gap-2">
                  {tags.map((tag, i) => (
                    <span
                      key={`${tag}-${i}`}
                      className={cn(
                        "inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize",
                        TAG_STYLES[i] ?? TAG_STYLES[2],
                      )}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {candidate.cv_file_path && (
            <button
              type="button"
              onClick={onViewCv}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
            >
              CV
              <ExternalLink className="h-3.5 w-3.5 text-gray-400" />
            </button>
          )}
        </div>

        <hr className="my-4 border-gray-100" />

        <div className="flex flex-wrap items-center gap-2">
          {onSaveEmail && (
            <EditableEmailPill value={candidate.email} onSave={onSaveEmail} />
          )}

          {candidate.phone ? (
            <a
              href={`tel:${candidate.phone}`}
              title={candidate.phone}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-500 transition hover:border-gray-300 hover:text-gray-700"
              aria-label={`Call ${candidate.phone}`}
            >
              <Phone className="h-4 w-4" />
            </a>
          ) : (
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-400">
              <Phone className="h-4 w-4" />
            </span>
          )}

          <button
            type="button"
            onClick={onAddContact}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-500 transition hover:border-gray-300 hover:text-gray-700"
            aria-label="Add contact"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
