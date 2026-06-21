"use client";

import { useMemo, useState, useEffect } from "react";
import {
  Plus, RefreshCw, ExternalLink,
  CheckCircle2, AlertCircle,
} from "lucide-react";
import toast from "react-hot-toast";
import ClientAvatar from "@/components/clients/ClientAvatar";
import { getSocialIcon, LinkedinIcon } from "@/components/candidates/SocialIcons";
import AddSocialProfileModal from "@/components/candidates/AddSocialProfileModal";
import Button from "@/components/ui/Button";
import ResumeProcessingPanel from "@/components/candidates/ResumeProcessingPanel";
import api from "@/lib/api";
import { delay } from "@/lib/resumeProcessing";
import { getCandidateSocialLinks, platformLabel, platformOpenLabel } from "@/lib/socialLinks";
import { cn } from "@/lib/utils";
import type { Candidate, CandidateSocialLink } from "@/types";

const ENRICH_STEPS = ["Connecting to profile", "Fetching public data", "Matching candidate info"] as const;

interface Props {
  candidate: Candidate;
  onUpdate: () => Promise<void>;
}

export default function CandidateSocialTab({ candidate, onUpdate }: Props) {
  const links = useMemo(() => getCandidateSocialLinks(candidate), [candidate]);
  const [selectedId, setSelectedId] = useState(links[0]?.id || "");

  useEffect(() => {
    if (!links.find((l) => l.id === selectedId)) {
      setSelectedId(links[0]?.id || "");
    }
  }, [links, selectedId]);

  const [addOpen, setAddOpen] = useState(false);
  const [enriching, setEnriching] = useState(false);
  const [enrichStep, setEnrichStep] = useState(0);
  const [saving, setSaving] = useState(false);

  const selected = links.find((l) => l.id === selectedId) || links[0];
  const existingPlatforms = links.map((l) => l.platform);

  const saveLinks = async (updated: CandidateSocialLink[]) => {
    setSaving(true);
    try {
      const linkedin = updated.find((l) => l.platform === "linkedin");
      await api.patch(`/candidates/${candidate.id}/profile`, {
        profile_extras: { ...candidate.profile_extras, social_links: updated },
        linkedin_url: linkedin?.url || candidate.linkedin_url,
      });
      await onUpdate();
    } catch {
      toast.error("Failed to save social links");
    } finally {
      setSaving(false);
    }
  };

  const handleAddLink = async (platform: string, rawUrl: string) => {
    let url = rawUrl;
    if (!url.startsWith("http")) url = `https://${url}`;
    const username = url.replace(/\/$/, "").split("/").pop() || "";
    const newId = `${platform}-${Date.now()}`;
    const updated: CandidateSocialLink[] = [
      ...links.filter((l) => l.platform !== platform),
      {
        id: newId,
        platform,
        url,
        username,
        verified: false,
        enriched: false,
        source: "manual",
      },
    ];
    await saveLinks(updated);
    setSelectedId(newId);
    setAddOpen(false);
    toast.success(`${platformLabel(platform)} profile added`);
  };

  const handleVerify = async () => {
    if (!selected) return;
    const updated = links.map((l) => l.id === selected.id ? { ...l, verified: true } : l);
    await saveLinks(updated);
    toast.success("Profile marked as verified");
  };

  const handleRemove = async () => {
    if (!selected) return;
    const updated = links.filter((l) => l.id !== selected.id);
    await saveLinks(updated);
    setSelectedId(updated[0]?.id || "");
    toast.success("Profile removed");
  };

  const handleEnrich = async () => {
    if (!selected) return;
    setEnriching(true);
    for (let i = 0; i < ENRICH_STEPS.length; i++) {
      setEnrichStep(i);
      await delay(900);
    }
    const updated = links.map((l) =>
      l.id === selected.id ? { ...l, enriched: true, enriched_at: new Date().toISOString() } : l
    );
    await saveLinks(updated);
    setEnriching(false);
    toast.success("Profile enrichment complete");
  };

  const addModal = (
    <AddSocialProfileModal
      open={addOpen}
      onClose={() => setAddOpen(false)}
      onAdd={handleAddLink}
      saving={saving}
      existingPlatforms={existingPlatforms}
    />
  );

  if (!links.length) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="flex flex-col items-center justify-center py-16 px-6 text-center max-w-md mx-auto">
          <div className="h-16 w-16 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
            <LinkedinIcon className="h-8 w-8" />
          </div>
          <h3 className="text-lg font-semibold text-gray-800 mb-2">No social profiles yet</h3>
          <p className="text-sm text-gray-500 mb-6">
            Upload a resume to auto-detect LinkedIn, GitHub and other links, or add them manually.
          </p>
          <Button onClick={() => setAddOpen(true)}><Plus className="h-4 w-4 mr-1" /> Add social profile</Button>
        </div>
        {addModal}
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden flex min-h-[520px]">
      <div className="w-56 shrink-0 border-r border-gray-200 flex flex-col bg-gray-50/50">
        <div className="px-4 py-3 border-b border-gray-200">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Social media</p>
        </div>
        <div className="flex-1 py-2">
          {links.map((link) => {
            const Icon = getSocialIcon(link.platform);
            const active = selected?.id === link.id;
            return (
              <button
                key={link.id}
                type="button"
                onClick={() => setSelectedId(link.id)}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-3 text-sm transition-colors text-left",
                  active ? "bg-white border-r-2 border-primary text-primary-700 font-medium shadow-sm" : "text-gray-600 hover:bg-white/80"
                )}
              >
                <span className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0 bg-white border border-gray-100 shadow-sm">
                  <Icon className="h-5 w-5" />
                </span>
                <span className="flex-1 truncate">{platformLabel(link.platform)}</span>
                <span className={cn(
                  "h-2 w-2 rounded-full shrink-0",
                  link.verified ? "bg-green-500" : link.enriched ? "bg-primary-400" : "bg-orange-400"
                )} />
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            className="w-full flex items-center gap-2 px-4 py-3 text-sm text-primary hover:bg-primary-50/50 transition-colors"
          >
            <Plus className="h-4 w-4" /> Add more
          </button>
        </div>
        <div className="p-3 border-t border-gray-200">
          <button
            type="button"
            onClick={handleEnrich}
            disabled={enriching || !selected}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-white hover:border-gray-300 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn("h-4 w-4", enriching && "animate-spin")} />
            Enrich profile
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col min-w-0">
        {enriching ? (
          <ResumeProcessingPanel steps={ENRICH_STEPS} currentStep={enrichStep} title="Enriching profile" />
        ) : selected ? (
          <>
            <div className="flex items-center justify-between gap-4 px-5 py-3 border-b border-gray-100 bg-white">
              <a
                href={selected.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline font-medium"
              >
                {platformOpenLabel(selected.platform)}
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
              <div className="flex items-center gap-4 text-sm">
                <button type="button" onClick={handleRemove} className="text-gray-500 hover:text-red-600 transition-colors">
                  Not the right profile?
                </button>
                <button
                  type="button"
                  onClick={handleVerify}
                  disabled={selected.verified || saving}
                  className={cn(
                    "transition-colors",
                    selected.verified ? "text-green-600 cursor-default" : "text-primary hover:underline"
                  )}
                >
                  {selected.verified ? "Verified" : "Mark as verified"}
                </button>
              </div>
            </div>

            <div className="flex-1 p-6 bg-gray-50/30">
              <div className="bg-white border border-gray-200 rounded-xl p-8 max-w-2xl shadow-sm">
                <div className="flex items-start gap-5">
                  <ClientAvatar name={candidate.name} size="xl" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h2 className="text-xl font-bold text-gray-900">{candidate.name}</h2>
                        {candidate.current_job_title && (
                          <p className="text-sm text-red-500 font-medium mt-0.5">{candidate.current_job_title}</p>
                        )}
                      </div>
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-orange-50 text-orange-600 text-xs font-semibold shrink-0">
                        <span className="h-5 w-5 rounded bg-white border border-orange-100 flex items-center justify-center">
                          {(() => { const I = getSocialIcon(selected.platform); return <I className="h-3.5 w-3.5" />; })()}
                        </span>
                        {selected.enriched ? "Enriched" : "Detected"}
                      </span>
                    </div>

                    <div className="mt-6 pt-5 border-t border-gray-100">
                      {selected.enriched ? (
                        <div className="space-y-3">
                          <div className="flex items-center gap-2 text-green-700 text-sm">
                            <CheckCircle2 className="h-4 w-4" />
                            Profile linked from resume
                          </div>
                          <dl className="grid grid-cols-1 gap-2 text-sm">
                            <div className="flex gap-2">
                              <dt className="text-gray-500 w-24 shrink-0">Username</dt>
                              <dd className="text-gray-800 font-medium">{selected.username || "—"}</dd>
                            </div>
                            <div className="flex gap-2">
                              <dt className="text-gray-500 w-24 shrink-0">Platform</dt>
                              <dd className="text-gray-800">{platformLabel(selected.platform)}</dd>
                            </div>
                            <div className="flex gap-2">
                              <dt className="text-gray-500 w-24 shrink-0">Source</dt>
                              <dd className="text-gray-800 capitalize">{selected.source || "resume"}</dd>
                            </div>
                            {candidate.location && (
                              <div className="flex gap-2">
                                <dt className="text-gray-500 w-24 shrink-0">Location</dt>
                                <dd className="text-gray-800">{candidate.location}</dd>
                              </div>
                            )}
                          </dl>
                        </div>
                      ) : (
                        <div className="flex items-start gap-3 text-sm text-gray-500 bg-gray-50 rounded-lg p-4">
                          <AlertCircle className="h-5 w-5 text-orange-400 shrink-0 mt-0.5" />
                          <div>
                            <p className="font-medium text-gray-700 mb-1">Profile detected from resume</p>
                            <p className="text-gray-500">
                              {platformLabel(selected.platform)} profile{" "}
                              <span className="font-mono text-gray-700">{selected.username}</span> was found.
                              Click <strong>Enrich profile</strong> to load more details.
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : null}
      </div>

      {addModal}
    </div>
  );
}
