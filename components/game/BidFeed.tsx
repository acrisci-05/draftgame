"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Ban, Gavel, PackageOpen, Radio, Trash2, Trophy } from "lucide-react";
import { useT } from "@/lib/settings";
import type { CurrencyCode, FeedEntry } from "@/lib/types";
import { money } from "@/lib/utils";

const ICONS = {
  bid: Gavel,
  pass: Ban,
  won: Trophy,
  discard: Trash2,
  mystery: PackageOpen,
  lot: Radio,
  start: Radio,
} as const;

const TONES = {
  bid: "text-neon",
  pass: "text-faint",
  won: "text-neon",
  discard: "text-faint",
  mystery: "text-violet",
  lot: "text-muted",
  start: "text-muted",
} as const;

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
  limit = 6,
}: {
  feed: FeedEntry[];
  currency: CurrencyCode;
  limit?: number;
}) {
  const t = useT();
  const entries = feed.slice(0, limit);

  return (
    <div className="rounded-2xl border border-line bg-surface p-3">
      <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.18em] text-faint">
        {t("auction.feed")}
      </p>
      {entries.length === 0 ? (
        <p className="text-sm text-faint">{t("auction.feedEmpty")}</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
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
