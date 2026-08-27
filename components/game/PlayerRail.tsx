"use client";

import { motion } from "framer-motion";
import { Gavel } from "lucide-react";
import { START_BUDGET } from "@/lib/game";
import type { GameState } from "@/lib/types";
import { cn } from "@/lib/utils";

export function PlayerRail({ state, selfId }: { state: GameState; selfId?: string }) {
  return (
    <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
      {state.players.map((player) => {
        const isLeader = state.highBidderId === player.id;
        const hasPassed = state.passed.includes(player.id);
        return (
          <motion.div
            key={player.id}
            layout
            className={cn(
              "min-w-[132px] shrink-0 rounded-xl border bg-surface p-2.5 transition-colors",
              isLeader ? "border-neon/60 glow-neon" : "border-line",
              hasPassed && !isLeader ? "opacity-45" : "",
              player.id === selfId && !isLeader ? "border-violet/50" : "",
            )}
          >
            <div className="flex items-center gap-1.5">
              <span className="text-base">{player.emoji}</span>
              <span className="truncate text-sm font-semibold">{player.name}</span>
              {isLeader ? <Gavel className="ml-auto size-3.5 shrink-0 text-neon" /> : null}
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="font-mono text-lg font-bold text-neon">${player.budget}</span>
              <span className="text-[10px] uppercase tracking-wider text-zinc-500">
                {player.roster.length} pick
              </span>
            </div>
            <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-surface-2">
              <motion.div
                className="h-full rounded-full bg-neon"
                animate={{ width: `${(player.budget / START_BUDGET) * 100}%` }}
                transition={{ type: "spring", stiffness: 180, damping: 24 }}
              />
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
