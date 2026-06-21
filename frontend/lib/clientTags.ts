import {
  Star, ThumbsUp, Globe, Clock, Briefcase, Tag as TagIcon,
  type LucideIcon,
} from "lucide-react";

export interface ClientTagDef {
  id: string;
  label: string;
  dot: string;
  pill: string;
  icon: LucideIcon;
}

export interface CustomTagDef {
  id: string;
  label: string;
  color: string;
  icon?: string;
}

export const TAG_COLORS = [
  { id: "yellow", dot: "bg-yellow-400", pill: "bg-yellow-100 text-yellow-800 border-yellow-200" },
  { id: "green", dot: "bg-green-500", pill: "bg-green-100 text-green-800 border-green-200" },
  { id: "purple", dot: "bg-purple-500", pill: "bg-purple-100 text-purple-800 border-purple-200" },
  { id: "amber", dot: "bg-amber-700", pill: "bg-amber-100 text-amber-900 border-amber-200" },
  { id: "orange", dot: "bg-orange-500", pill: "bg-orange-100 text-orange-800 border-orange-200" },
  { id: "pink", dot: "bg-pink-500", pill: "bg-pink-100 text-pink-800 border-pink-200" },
  { id: "blue", dot: "bg-primary-500", pill: "bg-primary-100 text-primary-800 border-primary-200" },
  { id: "teal", dot: "bg-teal-500", pill: "bg-teal-100 text-teal-800 border-teal-200" },
];

export const CLIENT_TAG_OPTIONS: ClientTagDef[] = [
  { id: "few_vacancies", label: "Few vacancies", dot: "bg-yellow-400", pill: "bg-yellow-100 text-yellow-800 border-yellow-200", icon: Briefcase },
  { id: "good", label: "Good", dot: "bg-green-500", pill: "bg-green-100 text-green-800 border-green-200", icon: ThumbsUp },
  { id: "important", label: "Important", dot: "bg-purple-500", pill: "bg-purple-100 text-purple-800 border-purple-200", icon: Star },
  { id: "international", label: "International", dot: "bg-amber-700", pill: "bg-amber-100 text-amber-900 border-amber-200", icon: Globe },
  { id: "late_payment", label: "Late payment", dot: "bg-orange-500", pill: "bg-orange-100 text-orange-800 border-orange-200", icon: Clock },
  { id: "many_vacancies", label: "Many vacancies", dot: "bg-pink-500", pill: "bg-pink-100 text-pink-800 border-pink-200", icon: Briefcase },
];

export function getPresetTag(id: string) {
  return CLIENT_TAG_OPTIONS.find((t) => t.id === id);
}

export function getTagDisplay(id: string, customTags: CustomTagDef[] = []) {
  const preset = getPresetTag(id);
  if (preset) return { label: preset.label, dot: preset.dot, pill: preset.pill, Icon: preset.icon, customIcon: undefined as string | undefined };
  const custom = customTags.find((t) => t.id === id);
  if (custom) {
    const color = TAG_COLORS.find((c) => c.id === custom.color) || TAG_COLORS[0];
    return { label: custom.label, dot: color.dot, pill: color.pill, Icon: TagIcon, customIcon: custom.icon };
  }
  return null;
}

export function makeCustomTagId(label: string) {
  return `custom_${label.toLowerCase().replace(/\s+/g, "_")}_${Date.now()}`;
}
