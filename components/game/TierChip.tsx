import type { CurrencyCode, Tier } from "@/lib/types";
import { TIER_ORDER, TIER_STYLES, cn, money } from "@/lib/utils";

interface TierChipProps {
  tier: Tier;
  currency?: CurrencyCode;
  /** Mostra il prezzo base accanto alla lettera del tier. */
  withPrice?: boolean;
  count?: number;
  className?: string;
}

/** Badge del tier: lettera visiva (S/A/B/C/D) e, se serve, il valore base. */
export function TierChip({
  tier,
  currency = "EUR",
  withPrice = true,
  count,
  className,
}: TierChipProps) {
  const style = TIER_STYLES[tier];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-black leading-none",
        style.chip,
        className,
      )}
    >
      <span>{style.letter}</span>
      {withPrice ? <span className="font-bold opacity-80">{money(tier, currency)}</span> : null}
      {count !== undefined ? <span className="font-bold opacity-70">×{count}</span> : null}
    </span>
  );
}

/** Striscia con tutti e cinque i tier, usata per riassumere una categoria. */
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
          withPrice={false}
          count={items.filter((item) => item.tier === tier).length}
        />
      ))}
    </span>
  );
}
