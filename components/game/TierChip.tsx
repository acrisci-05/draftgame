"use client";

import type { TranslationKey } from "@/lib/i18n";
import { useT } from "@/lib/settings";
import type { CurrencyCode, Tier } from "@/lib/types";
import { TIER_STYLES, cn, money } from "@/lib/utils";

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

