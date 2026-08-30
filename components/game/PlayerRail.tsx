"use client";

import { motion } from "framer-motion";
import { Gavel } from "lucide-react";
import type { GameState } from "@/lib/types";
import { cn, money } from "@/lib/utils";
import { colorLook } from "@/lib/game";
import { Avatar } from "@/components/ui/Avatar";

export function PlayerRail({
  state,
  selfId,
  nextId,
}: {
  state: GameState;
  selfId?: string;
  nextId?: string | null;
}) {
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
              "min-w-[136px] shrink-0 rounded-xl border bg-surface p-2.5 transition-colors",
              isLeader
                ? "border-neon leader-pulse"
                : player.id === nextId
                  ? "border-violet/50"
                  : "border-line",
              (hasPassed || full) && !isLeader ? "opacity-45" : "",
            )}
          >
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
