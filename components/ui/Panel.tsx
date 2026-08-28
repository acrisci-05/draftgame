import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Panel({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={cn("rounded-2xl border border-line bg-surface p-4", className)}>
      {children}
    </section>
  );
}

export function PanelTitle({
  icon,
  children,
  action,
}: {
  icon?: ReactNode;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-faint">
        {icon}
        {children}
      </h2>
      {action}
    </div>
  );
}
