"use client";

import { motion } from "framer-motion";
import { Ban, Gavel } from "lucide-react";
import { bidOptions, canBid, canPass } from "@/lib/game";
import type { GameState, Player } from "@/lib/types";
import { cn } from "@/lib/utils";

interface BidControlsProps {
  state: GameState;
  player: Player;
  onBid: (amount: number) => void;
  onPass: () => void;
  /** Layout ridotto usato nella modalità locale con più giocatori sullo stesso schermo. */
  compact?: boolean;
}

export function BidControls({ state, player, onBid, onPass, compact = false }: BidControlsProps) {
  const options = bidOptions(state);
  const isLeader = state.highBidderId === player.id;
  const hasPassed = state.passed.includes(player.id);
  const opening = !state.highBidderId;

  return (
    <div
      className={cn(
        "rounded-2xl border bg-surface transition-colors",
        isLeader ? "border-neon/60 glow-neon" : hasPassed ? "border-line opacity-50" : "border-line",
        compact ? "p-2.5" : "p-4",
      )}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className={compact ? "text-lg" : "text-xl"}>{player.emoji}</span>
          <span className={cn("truncate font-bold", compact ? "text-sm" : "text-base")}>
            {player.name}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {isLeader ? (
            <span className="flex items-center gap-1 rounded-full bg-neon/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-neon">
              <Gavel className="size-3" /> in testa
            </span>
          ) : null}
          {hasPassed ? (
            <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-zinc-500">
              passato
            </span>
          ) : null}
          <span className="font-mono text-sm font-bold text-neon">${player.budget}</span>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-1.5">
        {options.map(({ step, amount }) => {
          const enabled = canBid(state, player.id, amount);
          return (
            <motion.button
              key={step}
              type="button"
              whileTap={enabled ? { scale: 0.93 } : undefined}
              disabled={!enabled}
              onClick={() => onBid(amount)}
              className={cn(
                "flex flex-col items-center justify-center rounded-xl border font-bold transition-colors",
                compact ? "h-11 text-xs" : "h-14 text-sm",
                enabled
                  ? "border-neon/50 bg-neon/10 text-neon hover:bg-neon/20"
                  : "cursor-not-allowed border-line bg-surface-2 text-zinc-600",
              )}
            >
              <span className={compact ? "text-sm" : "text-lg"}>
                {opening ? `$${amount}` : `+$${step}`}
              </span>
              {!compact ? (
                <span className="text-[10px] font-medium text-zinc-500">= ${amount}</span>
              ) : null}
            </motion.button>
          );
        })}

        <motion.button
          type="button"
          whileTap={canPass(state, player.id) ? { scale: 0.93 } : undefined}
          disabled={!canPass(state, player.id)}
          onClick={onPass}
          className={cn(
            "flex items-center justify-center gap-1 rounded-xl border font-bold transition-colors",
            compact ? "h-11 text-xs" : "h-14 text-sm",
            canPass(state, player.id)
              ? "border-line bg-surface-2 text-zinc-300 hover:border-red-500/50 hover:text-red-300"
              : "cursor-not-allowed border-line bg-surface-2 text-zinc-600",
          )}
        >
          <Ban className={compact ? "size-3.5" : "size-4"} />
          Passa
        </motion.button>
      </div>
    </div>
  );
}
