"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Ban, ChevronDown, Gavel, PackageOpen, Radio, Trash2, Trophy, Wand2 } from "lucide-react";
import { useState } from "react";
import { useT } from "@/lib/settings";
import type { CurrencyCode, FeedEntry, FeedKind } from "@/lib/types";
import { cn, money } from "@/lib/utils";

const ICONS: Record<FeedKind, typeof Gavel> = {
  bid: Gavel,
  pass: Ban,
  won: Trophy,
  discard: Trash2,
  mystery: PackageOpen,
  lot: Radio,
  start: Radio,
  auto: Wand2,
};

const TONES: Record<FeedKind, string> = {
  bid: "text-neon",
  pass: "text-faint",
  won: "text-neon",
  discard: "text-faint",
  mystery: "text-violet",
  lot: "text-muted",
  start: "text-muted",
  auto: "text-gold",
};

function label(entry: FeedEntry, currency: CurrencyCode, t: ReturnType<typeof useT>): string {
  const player = `${entry.playerEmoji ?? ""} ${entry.playerName ?? ""}`.trim();
  const amount = entry.amount !== undefined ? money(entry.amount, currency) : "";
  switch (entry.kind) {
    case "bid":
      return t("auction.feedBid", { player, amount });
    case "pass":
      return t("auction.feedPass", { player });
    case "won":
      return t("auction.feedWon", { player, item: entry.itemName ?? "", amount });
    case "mystery":
      return t("auction.feedMystery", { player, item: entry.itemName ?? "", amount });
    case "auto":
      return t("auction.feedAuto", { player, item: entry.itemName ?? "" });
    case "discard":
      return t("auction.feedDiscard", { item: entry.itemName ?? "" });
    case "lot":
      return t("auction.feedLot", { item: entry.itemName ?? t("auction.mystery") });
    default:
      return t("auction.feedStart");
  }
}

export function BidFeed({
  feed,
  currency,
  limit = 12,
  collapsible = true,
}: {
  feed: FeedEntry[];
  currency: CurrencyCode;
  limit?: number;
  collapsible?: boolean;
}) {
  const t = useT();
  const [open, setOpen] = useState(true);
  const entries = feed.slice(0, limit);
  const latest = feed[0];

  return (
    <div className="rounded-2xl border border-line bg-surface p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-faint">
          {t("auction.feed")}
        </p>
        {collapsible ? (
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            className="flex items-center gap-1 text-[11px] font-semibold text-faint transition-colors hover:text-fg"
          >
            {t("auction.history")}
            <ChevronDown
              className={cn("size-3.5 transition-transform", open ? "rotate-180" : "")}
            />
          </button>
        ) : null}
      </div>

      {!open && latest ? (
        <p className="truncate text-sm text-muted">{label(latest, currency, t)}</p>
      ) : !open ? null : entries.length === 0 ? (
        <p className="text-sm text-faint">{t("auction.feedEmpty")}</p>
      ) : (
        <ul className="no-scrollbar flex max-h-40 flex-col gap-1.5 overflow-y-auto">
          <AnimatePresence initial={false}>
            {entries.map((entry) => {
              const Icon = ICONS[entry.kind];
              return (
                <motion.li
                  key={entry.id}
                  layout
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center gap-2 text-sm"
                >
                  <Icon className={`size-3.5 shrink-0 ${TONES[entry.kind]}`} />
                  <span className="truncate text-muted">{label(entry, currency, t)}</span>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>
      )}
    </div>
  );
}
