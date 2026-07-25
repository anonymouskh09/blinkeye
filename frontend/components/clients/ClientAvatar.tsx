import { cn, getInitials } from "@/lib/utils";

const AVATAR_COLORS = [
  "bg-amber-400 text-amber-900",
  "bg-teal-500 text-white",
  "bg-primary-500 text-white",
  "bg-secondary-500 text-white",
  "bg-rose-500 text-white",
  "bg-emerald-500 text-white",
];

export function getAvatarColor(name: string) {
  const index = name.charCodeAt(0) % AVATAR_COLORS.length;
  return AVATAR_COLORS[index];
}

interface ClientAvatarProps {
  name: string;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}

export default function ClientAvatar({ name, size = "md", className }: ClientAvatarProps) {
  const sizes = { sm: "w-7 h-7 text-xs", md: "w-9 h-9 text-sm", lg: "w-11 h-11 text-base", xl: "w-16 h-16 text-xl" };
  return (
    <div
      className={cn(
        "rounded-full flex items-center justify-center font-semibold shrink-0",
        getAvatarColor(name),
        sizes[size],
        className
      )}
    >
      {getInitials(name)}
    </div>
  );
}

export function UserAvatar({ name, size = "sm" }: { name: string; size?: "sm" | "md" }) {
  const sizes = { sm: "w-6 h-6 text-[10px]", md: "w-8 h-8 text-xs" };
  return (
    <div className={cn("rounded-full bg-teal-500 text-white flex items-center justify-center font-semibold shrink-0", sizes[size])}>
      {getInitials(name)}
    </div>
  );
}
