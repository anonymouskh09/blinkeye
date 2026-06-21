import type { Candidate, CandidateSocialLink } from "@/types";
import { SOCIAL_PLATFORMS } from "@/components/candidates/SocialIcons";

export function getCandidateSocialLinks(candidate: Candidate): CandidateSocialLink[] {
  const stored = candidate.profile_extras?.social_links;
  if (Array.isArray(stored) && stored.length > 0) {
    return stored as CandidateSocialLink[];
  }

  const links: CandidateSocialLink[] = [];
  if (candidate.linkedin_url) {
    const username = candidate.linkedin_url.split("/in/")[1]?.replace(/\/$/, "") || "";
    links.push({
      id: "linkedin-0",
      platform: "linkedin",
      url: candidate.linkedin_url,
      username,
      verified: false,
      enriched: false,
      source: "manual",
    });
  }
  return links;
}

const LABEL_MAP = Object.fromEntries(SOCIAL_PLATFORMS.map((p) => [p.id, p.label]));

export function platformLabel(platform: string): string {
  return LABEL_MAP[platform] || platform.charAt(0).toUpperCase() + platform.slice(1);
}

export function platformOpenLabel(platform: string): string {
  const def = SOCIAL_PLATFORMS.find((p) => p.id === platform);
  if (def?.id === "twitter") return "Open in X";
  return `Open in ${platformLabel(platform)}`;
}
