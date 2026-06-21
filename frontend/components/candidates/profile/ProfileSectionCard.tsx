"use client";

import { cn } from "@/lib/utils";

interface Props {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}

export default function ProfileSectionCard({ title, action, children, className, bodyClassName }: Props) {
  return (
    <section className={cn("overflow-hidden rounded-xl border border-gray-200/80 bg-white shadow-sm", className)}>
      <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-5 py-3.5">
        <h3 className="text-sm font-semibold tracking-tight text-gray-900">{title}</h3>
        {action}
      </div>
      <div className={cn("px-5 py-4", bodyClassName)}>{children}</div>
    </section>
  );
}
