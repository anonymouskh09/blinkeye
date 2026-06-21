import { cn } from "@/lib/utils";

interface IconProps {
  className?: string;
}

function IconBase({ className, children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" className={cn("h-7 w-7", className)} aria-hidden>
      {children}
    </svg>
  );
}

export function AngellistIcon({ className }: IconProps) {
  return (
    <IconBase className={className}>
      <circle cx="12" cy="12" r="11" fill="#000" />
      <path fill="#fff" d="M16.5 7.5c-1.2 0-2.1.6-2.6 1.4-.5-.8-1.4-1.4-2.6-1.4-1.7 0-3 1.3-3 3v5.5h2v-5.5c0-.6.4-1 1-1s1 .4 1 1v5.5h2v-5.5c0-.6.4-1 1-1s1 .4 1 1v5.5h2v-5.5c0-1.7-1.3-3-3-3z" />
    </IconBase>
  );
}

export function BitbucketIcon({ className }: IconProps) {
  return (
    <IconBase className={className}>
      <path fill="#2684FF" d="M2 3.5A2 2 0 014 1.5h16a2 2 0 012 2l-2.5 15a2 2 0 01-2 1.5H8.5a2 2 0 01-2-1.5L2 3.5z" />
      <path fill="#fff" d="M8 9h8l-.8 5H8.8L8 9z" />
    </IconBase>
  );
}

export function CrunchbaseIcon({ className }: IconProps) {
  return (
    <IconBase className={className}>
      <rect width="24" height="24" rx="4" fill="#0288D1" />
      <text x="12" y="16.5" textAnchor="middle" fill="#fff" fontSize="10" fontWeight="700" fontFamily="Arial,sans-serif">cb</text>
    </IconBase>
  );
}

export function FacebookIcon({ className }: IconProps) {
  return (
    <IconBase className={className}>
      <circle cx="12" cy="12" r="11" fill="#1877F2" />
      <path fill="#fff" d="M15.5 8h-2c-.8 0-1.5.7-1.5 1.5V11h2.5l-.4 2.5H12v7h-2.5v-7H8v-2.5h1.5V9.5C9.5 7 11 5.5 13.5 5.5H15.5V8z" />
    </IconBase>
  );
}

export function GithubIcon({ className }: IconProps) {
  return (
    <IconBase className={className}>
      <path fill="#24292f" d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.56 0-.28-.01-1.02-.02-2-3.2.7-3.88-1.54-3.88-1.54-.53-1.35-1.29-1.71-1.29-1.71-1.05-.72.08-.71.08-.71 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.71 1.26 3.37.96.11-.75.4-1.26.73-1.55-2.56-.29-5.25-1.28-5.25-5.71 0-1.26.45-2.29 1.19-3.1-.12-.29-.52-1.46.11-3.04 0 0 .97-.31 3.18 1.19.92-.26 1.91-.39 2.89-.39.98 0 1.97.13 2.89.39 2.21-1.5 3.18-1.19 3.18-1.19.63 1.58.23 2.75.11 3.04.74.81 1.19 1.84 1.19 3.1 0 4.44-2.69 5.42-5.26 5.71.41.35.78 1.04.78 2.1 0 1.52-.01 2.74-.01 3.11 0 .31.21.67.8.56A10.5 10.5 0 0023.5 12C23.5 5.65 18.35.5 12 .5z" />
    </IconBase>
  );
}

export function GitlabIcon({ className }: IconProps) {
  return (
    <IconBase className={className}>
      <path fill="#FC6D26" d="M12 23.5 1.2 9.5h4.3L12 18l6.5-8.5h4.3L12 23.5z" />
      <path fill="#E24329" d="M12 23.5 6.5 14.5H1.2L12 23.5z" />
      <path fill="#FC6D26" d="M12 23.5 17.5 14.5h5.3L12 23.5z" />
      <path fill="#FCA326" d="M1.2 9.5 6.5 14.5 12 4.5 17.5 14.5 22.8 9.5H1.2z" />
    </IconBase>
  );
}

export function InstagramIcon({ className }: IconProps) {
  return (
    <IconBase className={className}>
      <defs>
        <linearGradient id="ig" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#FD5949" />
          <stop offset="50%" stopColor="#D6249F" />
          <stop offset="100%" stopColor="#285AEB" />
        </linearGradient>
      </defs>
      <rect width="24" height="24" rx="6" fill="url(#ig)" />
      <circle cx="12" cy="12" r="4.2" fill="none" stroke="#fff" strokeWidth="1.8" />
      <circle cx="17.2" cy="6.8" r="1.2" fill="#fff" />
    </IconBase>
  );
}

export function KaggleIcon({ className }: IconProps) {
  return (
    <IconBase className={className}>
      <rect width="24" height="24" rx="4" fill="#20BEFF" />
      <text x="12" y="16" textAnchor="middle" fill="#fff" fontSize="13" fontWeight="700" fontFamily="Arial,sans-serif">k</text>
    </IconBase>
  );
}

export function LinkedinIcon({ className }: IconProps) {
  return (
    <IconBase className={className}>
      <path fill="#0A66C2" d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 114.126 0 2.063 2.063 0 01-2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </IconBase>
  );
}

export function MediumIcon({ className }: IconProps) {
  return (
    <IconBase className={className}>
      <circle cx="12" cy="12" r="11" fill="#000" />
      <ellipse cx="8.5" cy="12" rx="2.2" ry="5.5" fill="#fff" />
      <ellipse cx="14.5" cy="12" rx="4.2" ry="5.5" fill="#fff" />
    </IconBase>
  );
}

export function QuoraIcon({ className }: IconProps) {
  return (
    <IconBase className={className}>
      <rect width="24" height="24" rx="4" fill="#B92B27" />
      <text x="12" y="17" textAnchor="middle" fill="#fff" fontSize="14" fontWeight="700" fontFamily="Georgia,serif">Q</text>
    </IconBase>
  );
}

export function RedditIcon({ className }: IconProps) {
  return (
    <IconBase className={className}>
      <circle cx="12" cy="12" r="11" fill="#FF4500" />
      <circle cx="9" cy="11" r="1.3" fill="#fff" />
      <circle cx="15" cy="11" r="1.3" fill="#fff" />
      <path fill="none" stroke="#fff" strokeWidth="1.2" d="M8 14c1.2 1.5 2.8 2.2 4 2.2s2.8-.7 4-2.2" />
    </IconBase>
  );
}

export function StackOverflowIcon({ className }: IconProps) {
  return (
    <IconBase className={className}>
      <path fill="#F48024" d="M18 18H6l1.1-7.5 4.2 1.1-.5 3.4 3.4.9L18 18z" />
      <path fill="#BCBBBB" d="M17.1 9.5 7.2 7.1l.7-1.8 9.9 2.4-.7 1.8zM16 12.2 8.4 9.8l.7-1.8 7.6 2.4-.7 1.8zM15 14.9 9.6 13.1l.7-1.8 5.4 1.8-.7 1.8z" />
    </IconBase>
  );
}

export function TwitterIcon({ className }: IconProps) {
  return (
    <IconBase className={className}>
      <rect width="24" height="24" rx="4" fill="#000" />
      <path fill="#fff" d="M13.2 11.1 18.5 5h-1.3l-4.6 5.3L9.1 5H5l5.5 8-5.5 6.5h1.3l4.9-5.7 3.9 5.7H19l-5.8-8.2z" />
    </IconBase>
  );
}

export function YoutubeIcon({ className }: IconProps) {
  return (
    <IconBase className={className}>
      <rect width="24" height="24" rx="5" fill="#FF0000" />
      <path fill="#fff" d="M10 8.5v7l6-3.5-6-3.5z" />
    </IconBase>
  );
}

export type SocialPlatformId =
  | "angellist" | "bitbucket" | "crunchbase" | "facebook" | "github"
  | "gitlab" | "instagram" | "kaggle" | "linkedin" | "medium"
  | "quora" | "reddit" | "stackoverflow" | "twitter" | "youtube";

export interface SocialPlatformDef {
  id: SocialPlatformId;
  label: string;
  shortLabel?: string;
  icon: React.ComponentType<IconProps>;
  placeholder: string;
}

export const SOCIAL_PLATFORMS: SocialPlatformDef[] = [
  { id: "angellist", label: "AngelList", icon: AngellistIcon, placeholder: "https://angel.co/u/username" },
  { id: "bitbucket", label: "Bitbucket", icon: BitbucketIcon, placeholder: "https://bitbucket.org/username" },
  { id: "crunchbase", label: "Crunchbase", icon: CrunchbaseIcon, placeholder: "https://www.crunchbase.com/person/username" },
  { id: "facebook", label: "Facebook", icon: FacebookIcon, placeholder: "https://www.facebook.com/username" },
  { id: "github", label: "GitHub", icon: GithubIcon, placeholder: "https://github.com/username" },
  { id: "gitlab", label: "GitLab", icon: GitlabIcon, placeholder: "https://gitlab.com/username" },
  { id: "instagram", label: "Instagram", icon: InstagramIcon, placeholder: "https://www.instagram.com/username" },
  { id: "kaggle", label: "Kaggle", icon: KaggleIcon, placeholder: "https://www.kaggle.com/username" },
  { id: "linkedin", label: "LinkedIn", icon: LinkedinIcon, placeholder: "https://www.linkedin.com/in/username" },
  { id: "medium", label: "Medium", icon: MediumIcon, placeholder: "https://medium.com/@username" },
  { id: "quora", label: "Quora", icon: QuoraIcon, placeholder: "https://www.quora.com/profile/username" },
  { id: "reddit", label: "Reddit", icon: RedditIcon, placeholder: "https://www.reddit.com/user/username" },
  { id: "stackoverflow", label: "Stack Overflow", shortLabel: "Stack Over...", icon: StackOverflowIcon, placeholder: "https://stackoverflow.com/users/id/username" },
  { id: "twitter", label: "X (Formerly Twitter)", shortLabel: "X (Formerl...", icon: TwitterIcon, placeholder: "https://x.com/username" },
  { id: "youtube", label: "YouTube", icon: YoutubeIcon, placeholder: "https://www.youtube.com/@username" },
];

const ICON_MAP: Record<string, React.ComponentType<IconProps>> = Object.fromEntries(
  SOCIAL_PLATFORMS.map((p) => [p.id, p.icon])
);

export function getSocialIcon(platform: string): React.ComponentType<IconProps> {
  return ICON_MAP[platform] || LinkedinIcon;
}

export function getPlatformDef(platform: string): SocialPlatformDef | undefined {
  return SOCIAL_PLATFORMS.find((p) => p.id === platform);
}
