"use client";

import { motion } from "framer-motion";
import { Ban, Gavel, PackageOpen, Zap } from "lucide-react";
import {
  bidOptions,
  colorLook,
  canBid,
  canClaim,
  canPass,
  isMysteryLot,
  maxBidOption,
  rosterFull,
  slotsLeft,
} from "@/lib/game";
import { useT } from "@/lib/settings";
import type { GameState, Player } from "@/lib/types";
import { cn, money } from "@/lib/utils";
import { Avatar } from "@/components/ui/Avatar";
import { ItemCover } from "./ItemCover";

interface BidControlsProps {
  state: GameState;
  player: Player;
  onBid: (amount: number) => void;
  onPass: () => void;
  onClaim: () => void;
  /** Evidenzia il giocatore che dovrebbe agire ora. */
  highlight?: boolean;
  /** Layout ridotto per la modalità locale con più giocatori sullo stesso schermo. */
  compact?: boolean;
}

export function BidControls({
  state,
  player,
  onBid,
  onPass,
  onClaim,
  highlight = false,
  compact = false,
}: BidControlsProps) {
  const t = useT();
  const currency = state.config.currency;
  const options = bidOptions(state);
  const isLeader = state.highBidderId === player.id;
  const hasPassed = state.passed.includes(player.id);
  const full = rosterFull(state, player);
  const opening = !state.highBidderId;
  const mystery = isMysteryLot(state);
  const max = maxBidOption(state, player);
  const showMax = !mystery && max !== null && !options.some((option) => option.amount === max);
  const reserve = Math.max(0, slotsLeft(state, player) - 1);
  const buttonHeight = compact ? "h-12" : "h-14";

  return (
    <motion.div
      animate={highlight && !isLeader ? { scale: [1, 1.01, 1] } : { scale: 1 }}
      transition={highlight ? { duration: 1.6, repeat: Infinity } : { duration: 0.2 }}
      className={cn(
        "rounded-2xl border bg-surface transition-colors",
        isLeader
          ? "border-neon leader-pulse"
          : highlight
            ? "border-violet/60"
            : "border-line",
        (hasPassed || full) && !isLeader ? "opacity-50" : "",
        compact ? "p-2.5" : "p-3",
      )}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <Avatar
            id={player.emoji}
            size="sm"
            selected={isLeader}
            className={cn(isLeader ? "leader-pulse" : colorLook(player.color).ring)}
          />
          <span
            className={cn(
              "truncate font-bold",
              compact ? "text-sm" : "text-base",
              isLeader ? "" : colorLook(player.color).text,
            )}
          >
            {player.name}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {isLeader ? (
            <span className="flex items-center gap-1 rounded-full bg-neon/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-neon">
              <Gavel className="size-3" /> {t("auction.leading")}
            </span>
          ) : null}
          {highlight && !isLeader ? (
            <span className="rounded-full bg-violet/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-violet">
              {t("auction.yourTurn")}
            </span>
          ) : null}
          {full ? (
            <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-faint">
              {t("auction.full")}
            </span>
          ) : hasPassed ? (
            <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-faint">
              {t("auction.passed")}
            </span>
          ) : null}
          <span className="font-mono text-sm font-bold text-neon">
            {money(player.budget, currency)}
          </span>
          <span className="font-mono text-[11px] text-faint">
            {player.roster.length}/{state.config.slots}
          </span>
        </div>
      </div>

      {mystery ? (
        <div className="grid grid-cols-2 gap-1.5">
          <button
            type="button"
            disabled={!canClaim(state, player.id)}
            onClick={onClaim}
            className={cn(
              "flex touch-manipulation items-center justify-center gap-1.5 rounded-xl border font-bold transition-colors active:scale-[0.97]",
              buttonHeight,
              canClaim(state, player.id)
                ? "border-violet/60 bg-violet/15 text-violet hover:bg-violet/25"
                : "cursor-not-allowed border-line bg-surface-2 text-faint",
            )}
          >
            <PackageOpen className="size-4" />
            {t("auction.take")} {money(state.lotPrice, currency)}
          </button>
          <PassButton
            height={buttonHeight}
            disabled={!canPass(state, player.id)}
            onClick={onPass}
            label={t("auction.pass")}
          />
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          <div className={cn("grid gap-1.5", showMax ? "grid-cols-4" : "grid-cols-3")}>
            {options.map(({ step, amount }) => {
              const enabled = canBid(state, player.id, amount);
              return (
                <button
                  key={step}
                  type="button"
                  disabled={!enabled}
                  onClick={() => onBid(amount)}
                  className={cn(
                    "flex touch-manipulation flex-col items-center justify-center rounded-xl border font-bold transition-colors active:scale-[0.97]",
                    buttonHeight,
                    enabled
                      ? "border-neon/50 bg-neon/10 text-neon hover:bg-neon/20"
                      : "cursor-not-allowed border-line bg-surface-2 text-faint",
                  )}
                >
                  <span className={compact ? "text-sm" : "text-lg"}>
                    {opening ? money(amount, currency) : `+${money(step, currency)}`}
                  </span>
                  {!compact ? (
                    <span className="text-[10px] font-medium text-faint">
                      = {money(amount, currency)}
                    </span>
                  ) : null}
                </button>
              );
            })}

            {showMax && max !== null ? (
              <button
                type="button"
                disabled={!canBid(state, player.id, max)}
                onClick={() => onBid(max)}
                className={cn(
                  "flex touch-manipulation flex-col items-center justify-center rounded-xl border font-bold transition-colors active:scale-[0.97]",
                  buttonHeight,
                  canBid(state, player.id, max)
                    ? "border-gold/60 bg-gold/10 text-gold hover:bg-gold/20"
                    : "cursor-not-allowed border-line bg-surface-2 text-faint",
                )}
              >
                <span className={cn("flex items-center gap-1", compact ? "text-sm" : "text-lg")}>
                  <Zap className="size-3.5" />
                  {t("auction.max")}
                </span>
                {!compact ? (
                  <span className="text-[10px] font-medium text-faint">
                    = {money(max, currency)}
                  </span>
                ) : null}
              </button>
            ) : null}
          </div>

          <PassButton
            height={buttonHeight}
            disabled={!canPass(state, player.id)}
            onClick={onPass}
            label={t("auction.pass")}
            full
          />
        </div>
      )}

      {reserve > 0 && !full ? (
        <p className="mt-2 text-center text-[11px] text-faint">
          {t("auction.reserve", { amount: money(reserve, currency) })}
        </p>
      ) : null}

      <div className="mt-2 flex items-center gap-1.5 border-t border-line pt-2">
        <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider text-faint">
          {t("auction.inventory")}
        </span>
        <div className="no-scrollbar flex flex-1 gap-1 overflow-x-auto">
          {player.roster.length === 0
            ? Array.from({ length: Math.min(state.config.slots, 6) }, (_, index) => (
                <span
                  key={index}
                  className="size-8 shrink-0 rounded-lg border border-dashed border-line"
                />
              ))
            : player.roster.map((entry) => (
                <span key={entry.itemId} className="relative shrink-0" title={entry.name}>
                  <ItemCover item={entry} size="xs" />
                  <span className="absolute -bottom-0.5 -end-0.5 rounded-full bg-gold px-1 text-[9px] font-black text-ink">
                    {entry.price}
                  </span>
                </span>
              ))}
        </div>
      </div>
    </motion.div>
  );
}

function PassButton({
  height,
  disabled,
  onClick,
  label,
  full = false,
}: {
  height: string;
  disabled: boolean;
  onClick: () => void;
  label: string;
  full?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex touch-manipulation items-center justify-center gap-1.5 rounded-xl border font-bold transition-colors active:scale-[0.97]",
        height,
        full ? "w-full" : "",
        disabled
          ? "cursor-not-allowed border-line bg-surface-2 text-faint"
          : "border-red-500/50 bg-red-500/10 text-red-500 hover:bg-red-500/20",
      )}
    >
      <Ban className="size-4" />
      {label}
    </button>
  );
}
