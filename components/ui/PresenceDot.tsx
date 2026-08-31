"use client";

import type { PresenceState } from "@/lib/presence";
import { useT } from "@/lib/settings";
import { cn } from "@/lib/utils";

/**
 * Il pallino dello stato di attività.
 *
 * Restituisce null quando lo stato non si può sapere — perché l'amico l'ha
 * spento, o perché l'hai spento tu. In quel caso non compare nessun pallino
 * grigio: un grigio direbbe "offline", che sarebbe una risposta inventata.
 */

const LOOK: Record<PresenceState, string> = {
  online: "bg-neon shadow-[0_0_6px_rgba(34,197,94,0.8)]",
  playing: "bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.8)]",
  offline: "bg-zinc-600",
};

const LABEL = {
  online: "presence.online",
  playing: "presence.playing",
  offline: "presence.offline",
} as const;

export function PresenceDot({
  state,
  className,
}: {
  state: PresenceState | null;
  className?: string;
}) {
  const t = useT();
  if (!state) return null;

  return (
    <span
      role="img"
      aria-label={t(LABEL[state])}
      title={t(LABEL[state])}
      className={cn("inline-block size-2.5 shrink-0 rounded-full", LOOK[state], className)}
    />
  );
}
