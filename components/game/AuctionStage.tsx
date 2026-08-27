"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Flame, Gavel, Trash2, Trophy } from "lucide-react";
import {
  ITEM_SECONDS,
  RAISE_SECONDS,
  currentItem,
  drawnCount,
  playerById,
  type GameAction,
} from "@/lib/game";
import type { GameState } from "@/lib/types";
import { TIER_STYLES, cn } from "@/lib/utils";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { BidControls } from "./BidControls";
import { PlayerRail } from "./PlayerRail";
import { Timer } from "./Timer";

interface AuctionStageProps {
  state: GameState;
  selfId: string;
  isHost: boolean;
  now: () => number;
  dispatch: (action: GameAction) => void;
}

export function AuctionStage({ state, selfId, isHost, now, dispatch }: AuctionStageProps) {
  const item = currentItem(state);
  const leader = playerById(state, state.highBidderId);
  const self = playerById(state, selfId);
  const tier = item ? TIER_STYLES[item.tier] : null;
  const totalSeconds = state.highBidderId ? RAISE_SECONDS : ITEM_SECONDS;
  const index = drawnCount(state);

  const bid = (playerId: string, amount: number) =>
    dispatch({ type: "bid", playerId, amount, now: now() });
  const pass = (playerId: string) => dispatch({ type: "pass", playerId, now: now() });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xl">{state.category.emoji}</span>
          <div className="leading-tight">
            <p className="text-sm font-bold">{state.category.name}</p>
            <p className="text-xs text-zinc-500">
              Lotto {Math.min(index, state.items.length)} di {state.items.length}
            </p>
          </div>
        </div>
        <Badge tone="violet">
          <span className="font-mono tracking-widest">{state.code}</span>
        </Badge>
      </div>

      <div className="relative overflow-hidden rounded-3xl border border-line bg-surface grid-noise p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <AnimatePresence mode="wait">
              <motion.div
                key={item?.id ?? "empty"}
                initial={{ opacity: 0, y: 18, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -14, scale: 0.98 }}
                transition={{ type: "spring", stiffness: 260, damping: 26 }}
              >
                {tier ? (
                  <span
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider",
                      tier.chip,
                    )}
                  >
                    Tier ${item?.tier} · {tier.label}
                  </span>
                ) : null}
                <h1 className="mt-3 text-3xl leading-tight font-black tracking-tight text-balance sm:text-4xl">
                  {item?.name ?? "—"}
                </h1>
              </motion.div>
            </AnimatePresence>
          </div>

          {state.phase === "auction" && state.deadline ? (
            <Timer deadline={state.deadline} totalSeconds={totalSeconds} now={now} />
          ) : null}
        </div>

        <div className="mt-5 flex items-end justify-between gap-4 border-t border-line pt-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Offerta corrente</p>
            <motion.p
              key={`${state.currentBid}-${state.highBidderId ?? "none"}`}
              initial={{ scale: 1.18, color: "#4ade80" }}
              animate={{ scale: 1, color: "#f4f4f5" }}
              transition={{ duration: 0.3 }}
              className="font-mono text-4xl font-black"
            >
              ${state.currentBid}
            </motion.p>
          </div>
          <div className="text-right">
            {leader ? (
              <p className="flex items-center justify-end gap-1.5 text-sm font-bold text-neon text-glow">
                <Gavel className="size-4" />
                {leader.emoji} {leader.name}
              </p>
            ) : (
              <p className="flex items-center justify-end gap-1.5 text-sm text-zinc-500">
                <Flame className="size-4" />
                Base d&apos;asta, nessuna offerta
              </p>
            )}
            <p className="text-xs text-zinc-500">
              {state.players.length - state.passed.length} ancora in corsa
            </p>
          </div>
        </div>

        <AnimatePresence>
          {state.phase === "result" && state.lastResult ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-ink/92 p-6 text-center backdrop-blur-sm"
            >
              <motion.div
                initial={{ scale: 0.7, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 320, damping: 18 }}
                className="flex flex-col items-center gap-2"
              >
                {state.lastResult.winnerId ? (
                  <>
                    <Trophy className="size-9 text-neon" />
                    <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Aggiudicato</p>
                    <p className="text-2xl font-black text-balance">{state.lastResult.itemName}</p>
                    <p className="text-lg font-bold text-neon text-glow">
                      {state.lastResult.winnerName} · ${state.lastResult.price}
                    </p>
                  </>
                ) : (
                  <>
                    <Trash2 className="size-9 text-zinc-500" />
                    <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Nessuna offerta</p>
                    <p className="text-2xl font-black text-balance">{state.lastResult.itemName}</p>
                    <p className="text-sm text-zinc-500">Finisce negli scarti</p>
                  </>
                )}
              </motion.div>
              {isHost ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-3"
                  onClick={() => dispatch({ type: "next", now: now() })}
                >
                  Prossimo lotto <ArrowRight className="size-4" />
                </Button>
              ) : null}
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>

      <PlayerRail state={state} selfId={selfId} />

      {state.mode === "local" ? (
        <div className="grid gap-2 sm:grid-cols-2">
          {state.players.map((player) => (
            <BidControls
              key={player.id}
              compact
              state={state}
              player={player}
              onBid={(amount) => bid(player.id, amount)}
              onPass={() => pass(player.id)}
            />
          ))}
        </div>
      ) : self ? (
        <BidControls
          state={state}
          player={self}
          onBid={(amount) => bid(self.id, amount)}
          onPass={() => pass(self.id)}
        />
      ) : (
        <p className="rounded-2xl border border-line bg-surface p-4 text-center text-sm text-zinc-500">
          Stai seguendo l&apos;asta come spettatore.
        </p>
      )}

      {isHost ? (
        <Button variant="ghost" size="sm" onClick={() => dispatch({ type: "end" })}>
          Chiudi la partita e genera la card
        </Button>
      ) : null}
    </div>
  );
}
