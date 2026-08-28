"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, EyeOff, Flame, Gavel, PackageOpen, Trash2, Trophy, Zap } from "lucide-react";
import { useEffect, useRef } from "react";
import { playSfx } from "@/lib/audio";
import { categoryName } from "@/lib/catalog";
import {
  ITEM_SECONDS,
  RAISE_SECONDS,
  currentItem,
  drawnCount,
  isMysteryLot,
  itemById,
  nextToAct,
  playerById,
  type GameAction,
} from "@/lib/game";
import { HAPTIC_BID, HAPTIC_PASS, HAPTIC_WIN, vibrate } from "@/lib/haptics";
import { useSettings } from "@/lib/settings";
import type { GameState } from "@/lib/types";
import { cn, money } from "@/lib/utils";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { RoomCode } from "@/components/ui/RoomCode";
import { BidControls } from "./BidControls";
import { BidFeed } from "./BidFeed";
import { ItemCover } from "./ItemCover";
import { PlayerRail } from "./PlayerRail";
import { TierChip } from "./TierChip";
import { Timer } from "./Timer";

interface AuctionStageProps {
  state: GameState;
  selfId: string;
  isHost: boolean;
  now: () => number;
  dispatch: (action: GameAction) => void;
}

export function AuctionStage({ state, selfId, isHost, now, dispatch }: AuctionStageProps) {
  const { locale, sound, t } = useSettings();
  const lastFeedRef = useRef<string | null>(null);

  const mystery = isMysteryLot(state);
  const item = currentItem(state);
  const leader = playerById(state, state.highBidderId);
  const self = playerById(state, selfId);
  const currency = state.config.currency;
  const totalSeconds = state.highBidderId ? RAISE_SECONDS : ITEM_SECONDS;
  const turnId = nextToAct(state);
  const inRace = state.players.filter(
    (p) => !state.passed.includes(p.id) && p.roster.length < state.config.slots,
  ).length;
  const blurred = state.config.blindDraft && state.phase === "auction";
  const resultItem = state.lastResult ? itemById(state, state.lastResult.itemId) : undefined;

  useEffect(() => {
    const latest = state.feed[0];
    if (!latest || lastFeedRef.current === latest.id) return;
    const first = lastFeedRef.current === null;
    lastFeedRef.current = latest.id;
    if (first) return;
    if (latest.kind === "bid") playSfx("bid", sound);
    else if (latest.kind === "pass") playSfx("pass", sound);
    else if (latest.kind === "won") {
      playSfx("win", sound);
      vibrate(HAPTIC_WIN);
    } else if (latest.kind === "mystery") playSfx("mystery", sound);
    else if (latest.kind === "discard") playSfx("timeup", sound);
  }, [state.feed, sound]);

  const bid = (playerId: string, amount: number) => {
    vibrate(HAPTIC_BID);
    dispatch({ type: "bid", playerId, amount, now: now() });
  };
  const pass = (playerId: string) => {
    vibrate(HAPTIC_PASS);
    dispatch({ type: "pass", playerId, now: now() });
  };
  const claim = (playerId: string) => {
    vibrate(HAPTIC_BID);
    dispatch({ type: "claim", playerId, now: now() });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="text-xl">{state.category.emoji}</span>
          <div className="min-w-0 leading-tight">
            <p className="truncate text-sm font-bold">{categoryName(state.category, locale)}</p>
            <p className="text-xs text-faint">
              {t("auction.lot", { current: drawnCount(state), total: state.items.length })}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          <RoomCode code={state.code} />
          {state.phase === "auction" && state.deadline ? (
            <Timer deadline={state.deadline} totalSeconds={totalSeconds} now={now} />
          ) : null}
        </div>
      </div>

      <div className="relative overflow-hidden rounded-3xl border border-line bg-surface grid-noise p-5">
        <div className="mx-auto flex max-w-[19rem] flex-col items-center gap-3 text-center">
          <AnimatePresence mode="wait">
            <motion.div
              key={mystery ? `mystery-${state.lotNumber}` : (item?.id ?? "empty")}
              initial={{ opacity: 0, scale: 0.88, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94 }}
              transition={{ type: "spring", stiffness: 240, damping: 22 }}
              className="w-full"
            >
              <ItemCover
                item={item ?? null}
                size="xl"
                mystery={mystery}
                blurred={blurred}
                auto
                hint={state.category.name}
              />
            </motion.div>
          </AnimatePresence>

          <div className="flex flex-col items-center gap-1.5">
            {mystery ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-violet/40 bg-violet/10 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-violet">
                <PackageOpen className="size-3" /> {t("auction.mystery")}
              </span>
            ) : item ? (
              <TierChip tier={item.tier} currency={currency} />
            ) : null}

            <h1 className="text-2xl leading-tight font-black tracking-tight text-balance sm:text-3xl">
              {mystery ? t("auction.mystery") : (item?.name ?? "—")}
            </h1>

            {mystery ? (
              <p className="text-xs text-muted">{t("auction.mysteryHint")}</p>
            ) : blurred ? (
              <p className="flex items-center gap-1.5 text-xs text-violet">
                <EyeOff className="size-3.5" />
                {t("auction.blind")}
              </p>
            ) : null}
          </div>
        </div>

        <div className="mt-5 flex items-end justify-between gap-4 border-t border-line pt-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-faint">
              {t("auction.currentBid")}
            </p>
            <motion.p
              key={`${state.currentBid}-${state.highBidderId ?? "none"}`}
              initial={{ scale: 1.18 }}
              animate={{ scale: 1 }}
              transition={{ duration: 0.3 }}
              className="font-mono text-4xl font-black"
            >
              {money(mystery ? state.lotPrice : state.currentBid, currency)}
            </motion.p>
          </div>
          <div className="text-end">
            {leader ? (
              <p className="flex items-center justify-end gap-1.5 text-sm font-bold text-neon text-glow">
                <Gavel className="size-4" />
                <Avatar id={leader.emoji} size="xs" />
                {leader.name}
              </p>
            ) : (
              <p className="flex items-center justify-end gap-1.5 text-sm text-faint">
                <Flame className="size-4" />
                {mystery ? t("auction.mysteryHint") : t("auction.noBid")}
              </p>
            )}
            <p className="text-xs text-faint">{t("auction.inRace", { n: inRace })}</p>
          </div>
        </div>

        <AnimatePresence>
          {state.sniped && state.phase === "auction" ? (
            <motion.p
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mt-3 flex items-center justify-center gap-1.5 rounded-full border border-amber-400/40 bg-amber-400/10 px-3 py-1.5 text-[11px] font-bold text-amber-500"
            >
              <Zap className="size-3.5" />
              {t("auction.antiSnipe", { n: RAISE_SECONDS })}
            </motion.p>
          ) : null}
        </AnimatePresence>

        <AnimatePresence>
          {state.phase === "result" && state.lastResult ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-ink/95 p-6 text-center"
            >
              <motion.div
                initial={{ scale: 0.7, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 320, damping: 18 }}
                className="flex flex-col items-center gap-2"
              >
                {state.lastResult.winnerId ? (
                  <>
                    <ItemCover item={resultItem ?? null} size="lg" auto hint={state.category.name} />
                    <span className="flex items-center gap-1.5 text-xs uppercase tracking-[0.2em] text-faint">
                      {state.lastResult.mystery ? (
                        <PackageOpen className="size-3.5 text-violet" />
                      ) : (
                        <Trophy className="size-3.5 text-neon" />
                      )}
                      {t("auction.awarded")}
                    </span>
                    <p className="text-2xl font-black text-balance">{state.lastResult.itemName}</p>
                    <p className="text-lg font-bold text-neon text-glow">
                      {state.lastResult.winnerName} · {money(state.lastResult.price, currency)}
                    </p>
                  </>
                ) : (
                  <>
                    <Trash2 className="size-9 text-faint" />
                    <p className="text-xs uppercase tracking-[0.2em] text-faint">
                      {t("auction.noOffers")}
                    </p>
                    <p className="text-2xl font-black text-balance">{state.lastResult.itemName}</p>
                    <p className="text-sm text-faint">
                      {state.lastResult.mystery
                        ? t("auction.mysteryLost")
                        : t("auction.toDiscards")}
                    </p>
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
                  {t("auction.nextLot")} <ArrowRight className="size-4" />
                </Button>
              ) : null}
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>

      <BidFeed feed={state.feed} currency={currency} />

      {turnId && state.mode === "local" ? (
        <p className="text-center text-xs font-bold uppercase tracking-[0.18em] text-violet">
          {t("auction.turnOf", { player: playerById(state, turnId)?.name ?? "" })}
        </p>
      ) : null}

      {state.mode === "local" ? (
        <div className={cn("grid gap-2", state.players.length > 1 && "sm:grid-cols-2")}>
          {state.players.map((player) => (
            <BidControls
              key={player.id}
              compact
              state={state}
              player={player}
              highlight={player.id === turnId}
              onBid={(amount) => bid(player.id, amount)}
              onPass={() => pass(player.id)}
              onClaim={() => claim(player.id)}
            />
          ))}
        </div>
      ) : (
        <>
          <PlayerRail state={state} selfId={selfId} nextId={turnId} />

          {self ? (
            <>
              {/* Su telefono i comandi restano fissi in basso, a portata di pollice. */}
              <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-ink/95 p-3 backdrop-blur safe-bottom sm:static sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
                <div className="mx-auto w-full max-w-2xl">
                  <BidControls
                    state={state}
                    player={self}
                    highlight={self.id === turnId}
                    onBid={(amount) => bid(self.id, amount)}
                    onPass={() => pass(self.id)}
                    onClaim={() => claim(self.id)}
                  />
                </div>
              </div>
              <div aria-hidden className="h-56 sm:hidden" />
            </>
          ) : (
            <p className="rounded-2xl border border-line bg-surface p-4 text-center text-sm text-faint">
              {t("auction.spectator")}
            </p>
          )}
        </>
      )}

      {isHost ? (
        <Button variant="ghost" size="sm" onClick={() => dispatch({ type: "end" })}>
          {t("auction.endGame")}
        </Button>
      ) : null}
    </div>
  );
}
