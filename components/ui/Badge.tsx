import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Tone = "neutral" | "neon" | "violet" | "gold" | "danger";

const TONES: Record<Tone, string> = {
  neutral: "border-line bg-surface-2 text-muted",
  neon: "border-neon/40 bg-neon/10 text-neon",
  violet: "border-violet/40 bg-violet/10 text-violet",
  gold: "border-gold/50 bg-gold/10 text-gold",
  danger: "border-red-500/40 bg-red-500/10 text-red-500",
};

export function Badge({
  tone = "neutral",
  className,
  children,
}: {
  tone?: Tone;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold leading-none",
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
