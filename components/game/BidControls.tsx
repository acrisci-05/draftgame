"use client";

import { motion } from "framer-motion";
import { Ban, Gavel, PackageOpen } from "lucide-react";
import { bidOptions, canBid, canClaim, canPass, isMysteryLot, rosterFull } from "@/lib/game";
import { useT } from "@/lib/settings";
import type { GameState, Player } from "@/lib/types";
import { cn, money } from "@/lib/utils";
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

  return (
    <motion.div
      animate={highlight ? { scale: [1, 1.01, 1] } : { scale: 1 }}
      transition={highlight ? { duration: 1.6, repeat: Infinity } : { duration: 0.2 }}
      className={cn(
        "rounded-2xl border bg-surface transition-colors",
        isLeader
          ? "border-neon/60 glow-neon"
          : highlight
            ? "border-violet/60"
            : "border-line",
        (hasPassed || full) && !isLeader ? "opacity-50" : "",
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
          <motion.button
            type="button"
            whileTap={canClaim(state, player.id) ? { scale: 0.93 } : undefined}
            disabled={!canClaim(state, player.id)}
            onClick={onClaim}
            className={cn(
              "flex items-center justify-center gap-1.5 rounded-xl border font-bold transition-colors",
              compact ? "h-11 text-xs" : "h-14 text-sm",
              canClaim(state, player.id)
                ? "border-violet/60 bg-violet/15 text-violet hover:bg-violet/25"
                : "cursor-not-allowed border-line bg-surface-2 text-faint",
            )}
          >
            <PackageOpen className="size-4" />
            {t("auction.take")} {money(state.lotPrice, currency)}
          </motion.button>
          <PassButton
            compact={compact}
            disabled={!canPass(state, player.id)}
            onClick={onPass}
            label={t("auction.pass")}
          />
        </div>
      ) : (
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
              </motion.button>
            );
          })}

          <PassButton
            compact={compact}
            disabled={!canPass(state, player.id)}
            onClick={onPass}
            label={t("auction.pass")}
          />
        </div>
      )}

      <div className="mt-2.5 flex items-center gap-1.5 border-t border-line pt-2">
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
  compact,
  disabled,
  onClick,
  label,
}: {
  compact: boolean;
  disabled: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <motion.button
      type="button"
      whileTap={disabled ? undefined : { scale: 0.93 }}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex items-center justify-center gap-1 rounded-xl border font-bold transition-colors",
        compact ? "h-11 text-xs" : "h-14 text-sm",
        disabled
          ? "cursor-not-allowed border-line bg-surface-2 text-faint"
          : "border-line bg-surface-2 text-muted hover:border-red-500/50 hover:text-red-500",
      )}
    >
      <Ban className={compact ? "size-3.5" : "size-4"} />
      {label}
    </motion.button>
  );
}
