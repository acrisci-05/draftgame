"use client";

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
  /** Aggiunge il significato della fascia accanto al prezzo. */
  withLabel?: boolean;
  count?: number;
  className?: string;
}

/**
 * Badge della fascia di valore.
 * Mostra il prezzo base, che è l'informazione utile: il colore distingue le fasce
 * a colpo d'occhio senza obbligare a imparare una sigla.
 */
export function TierChip({
  tier,
  currency = "EUR",
  withLabel = false,
  count,
  className,
}: TierChipProps) {
  const t = useT();
  const style = TIER_STYLES[tier];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-black leading-none",
        style.chip,
        className,
      )}
    >
      <span>{money(tier, currency)}</span>
      {withLabel ? <span className="font-bold opacity-80">{t(tierNameKey(tier))}</span> : null}
      {count !== undefined ? <span className="font-bold opacity-70">×{count}</span> : null}
    </span>
  );
}

/** Striscia con le cinque fasce, usata per riassumere una categoria. */
export function TierStrip({
  items,
  currency,
  className,
}: {
  items: { tier: Tier }[];
  currency?: CurrencyCode;
  className?: string;
}) {
  return (
    <span className={cn("flex flex-wrap gap-1", className)}>
      {TIER_ORDER.map((tier) => (
        <TierChip
          key={tier}
          tier={tier}
          currency={currency}
          count={items.filter((item) => item.tier === tier).length}
        />
      ))}
    </span>
  );
}

/** Legenda: quanto costa una fascia e che tipo di elementi contiene. */
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
      <p className="mb-2.5 text-xs text-muted">{t("tier.legendHint")}</p>
      <div className="flex flex-wrap gap-x-4 gap-y-2">
        {TIER_ORDER.map((tier) => (
          <span key={tier} className="flex items-center gap-1.5">
            <TierChip tier={tier} currency={currency} />
            <span className="text-xs text-muted">{t(tierNameKey(tier))}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
