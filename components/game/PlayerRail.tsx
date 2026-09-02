"use client";

import { motion } from "framer-motion";
import { Gavel } from "lucide-react";
import type { GameState } from "@/lib/types";
import { cn, money } from "@/lib/utils";
import { colorLook } from "@/lib/game";
import { useT } from "@/lib/settings";
import { Avatar } from "@/components/ui/Avatar";
import { FloatingReactions } from "./Reactions";

/**
 * "Sta valutando", con i tre puntini che si accendono a turno.
 *
 * Il bot aspetta fino a sei secondi prima di rispondere, ed e' voluto: senza
 * quell'attesa non sembrerebbe un avversario. Ma un'attesa muta non si
 * distingue da un blocco, ed e' esattamente quello che veniva segnalato --
 * l'asta pareva piantata mentre stava solo aspettando il bot. Tre puntini
 * risolvono tutto: dicono che sta succedendo qualcosa.
 */
function BotThinking({ label }: { label: string }) {
  return (
    <span className="mt-1.5 flex items-center gap-1 text-[9px] font-bold uppercase tracking-wide text-violet">
      <span aria-hidden>💬</span>
      <span className="truncate">{label}</span>
      <span aria-hidden className="flex shrink-0 items-center gap-0.5">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="size-1 animate-pulse rounded-full bg-violet"
            style={{ animationDelay: `${i * 180}ms`, animationDuration: "1.1s" }}
          />
        ))}
      </span>
    </span>
  );
}

export function PlayerRail({
  state,
  selfId,
  nextId,
  thinkingId,
  reactions = [],
}: {
  state: GameState;
  selfId?: string;
  nextId?: string | null;
  /** Chi sta ragionando adesso: sotto di lui compaiono i tre puntini. */
  thinkingId?: string | null;
  /** Le reazioni ancora in volo, gia' filtrate per quelle vive. */
  reactions?: { id: string; playerId: string; emoji: string }[];
}) {
  const t = useT();
  const currency = state.config.currency;

  return (
    <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
      {state.players.map((player) => {
        const isLeader = state.highBidderId === player.id;
        const hasPassed = state.passed.includes(player.id);
        const full = player.roster.length >= state.config.slots;
        return (
          <motion.div
            key={player.id}
            layout
            className={cn(
              "relative min-w-[136px] shrink-0 rounded-xl border bg-surface p-2.5 transition-colors",
              isLeader
                ? "border-neon leader-pulse"
                : player.id === nextId
                  ? "border-violet/50"
                  : "border-line",
              (hasPassed || full) && !isLeader ? "opacity-45" : "",
            )}
          >
            <FloatingReactions emojis={reactions.filter((r) => r.playerId === player.id)} />

            <div className="flex items-center gap-1.5">
              {/* L'alone col colore scelto: e' come ci si riconosce al volo
                  mentre l'asta corre. Chi e' in testa resta verde, perche' quello
                  vuol dire un'altra cosa. */}
              <Avatar
                id={player.emoji}
                size="xs"
                selected={isLeader}
                className={cn(isLeader ? "leader-pulse" : colorLook(player.color).ring)}
              />
              <span
                className={cn(
                  "truncate text-sm font-semibold",
                  isLeader ? "" : colorLook(player.color).text,
                )}
              >
                {player.name}
              </span>
              {isLeader ? <Gavel className="ms-auto size-3.5 shrink-0 text-neon" /> : null}
              {player.id === selfId && !isLeader ? (
                <span className="ms-auto text-[9px] font-bold uppercase text-violet">•</span>
              ) : null}
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="font-mono text-lg font-bold text-neon">
                {money(player.budget, currency)}
              </span>
              <span className="text-[10px] uppercase tracking-wider text-faint">
                {player.roster.length}/{state.config.slots}
              </span>
            </div>

            {player.id === thinkingId ? <BotThinking label={t("auction.botThinking")} /> : null}
            <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-surface-2">
              <motion.div
                className="h-full rounded-full bg-neon"
                animate={{ width: `${(player.budget / Math.max(1, state.config.budget)) * 100}%` }}
                transition={{ type: "spring", stiffness: 180, damping: 24 }}
              />
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
