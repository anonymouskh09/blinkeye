import { apiRequest } from "./api";
import { storage, DROPDOWN_TTL_MS } from "./storage";
import type { DropdownData, JobOption, StageOption, TagOption, TeamMemberOption } from "../types";

// Loads the small dropdown datasets used by the preview form. Results are
// cached in chrome.storage for a short TTL to keep the popup snappy.

export async function loadDropdowns(force = false): Promise<DropdownData> {
  if (!force) {
    const cached = await storage.getDropdowns();
    if (cached && Date.now() - cached.fetchedAt < DROPDOWN_TTL_MS) {
      return cached;
    }
  }

  const [jobs, team, stages, tags] = await Promise.all([
    apiRequest<JobOption[]>("/jobs"),
    apiRequest<TeamMemberOption[]>("/team"),
    apiRequest<StageOption[]>("/stages"),
    apiRequest<TagOption[]>("/tags").catch(() => [] as TagOption[]),
  ]);

  const data: DropdownData = { jobs, team, stages, tags, fetchedAt: Date.now() };
  await storage.setDropdowns(data);
  return data;
}
