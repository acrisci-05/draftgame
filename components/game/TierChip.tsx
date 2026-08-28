"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import type { TranslationKey } from "@/lib/i18n";
import { useT } from "@/lib/settings";
import type { CurrencyCode, Tier } from "@/lib/types";
import { TIER_ORDER, TIER_STYLES, cn, money } from "@/lib/utils";

const TIER_NAME_KEYS: Record<Tier, TranslationKey> = {
  5: "tier.name5",
  4: "tier.name4",
  3: "tier.name3",
  2: "tier.name2",
  1: "tier.name1",
};

export function tierNameKey(tier: Tier): TranslationKey {
  return TIER_NAME_KEYS[tier];
}

interface TierChipProps {
  tier: Tier;
  currency?: CurrencyCode;
  /** Mostra il prezzo base accanto alla lettera del tier. */
  withPrice?: boolean;
  count?: number;
  /** Al tocco o al passaggio del mouse mostra il prezzo base. */
  interactive?: boolean;
  className?: string;
}

/** Badge del tier: lettera visiva (S/A/B/C/D) e, se serve, il valore base. */
export function TierChip({
  tier,
  currency = "EUR",
  withPrice = true,
  count,
  interactive = false,
  className,
}: TierChipProps) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const style = TIER_STYLES[tier];
  const tooltip = t("tier.tooltip", { letter: style.letter, price: money(tier, currency) });

  const content = (
    <>
      <span>{style.letter}</span>
      {withPrice ? <span className="font-bold opacity-80">{money(tier, currency)}</span> : null}
      {count !== undefined ? <span className="font-bold opacity-70">×{count}</span> : null}
    </>
  );

  const base = cn(
    "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-black leading-none",
    style.chip,
    className,
  );

  if (!interactive) {
    return <span className={base}>{content}</span>;
  }

  return (
    <span className="relative inline-flex">
      <button
        type="button"
        title={tooltip}
        aria-label={tooltip}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={(event) => {
          event.stopPropagation();
          setOpen((value) => !value);
        }}
        className={cn(base, "transition-transform hover:scale-105")}
      >
        {content}
      </button>

      <AnimatePresence>
        {open ? (
          <motion.span
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            role="tooltip"
            className="pointer-events-none absolute -top-8 start-1/2 z-20 -translate-x-1/2 whitespace-nowrap rounded-lg border border-line bg-surface px-2 py-1 text-[11px] font-semibold text-fg shadow-lg rtl:translate-x-1/2"
          >
            {tooltip}
          </motion.span>
        ) : null}
      </AnimatePresence>
    </span>
  );
}

/** Striscia con tutti e cinque i tier, usata per riassumere una categoria. */
export function TierStrip({
  items,
  currency,
  interactive = false,
  className,
}: {
  items: { tier: Tier }[];
  currency?: CurrencyCode;
  interactive?: boolean;
  className?: string;
}) {
  return (
    <span className={cn("flex flex-wrap gap-1", className)}>
      {TIER_ORDER.map((tier) => (
        <TierChip
          key={tier}
          tier={tier}
          currency={currency}
          withPrice={false}
          interactive={interactive}
          count={items.filter((item) => item.tier === tier).length}
        />
      ))}
    </span>
  );
}

/** Legenda delle fasce: lettera, prezzo base e significato. */
export function TierLegend({
  currency = "EUR",
  className,
}: {
  currency?: CurrencyCode;
  className?: string;
}) {
  const t = useT();

  return (
    <div className={cn("rounded-2xl border border-line bg-surface p-3", className)}>
      <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.18em] text-faint">
        {t("tier.legend")}
      </p>
      <div className="flex flex-wrap gap-x-4 gap-y-2">
        {TIER_ORDER.map((tier) => (
          <span key={tier} className="flex items-center gap-1.5">
            <TierChip tier={tier} currency={currency} interactive />
            <span className="text-xs text-muted">{t(tierNameKey(tier))}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
