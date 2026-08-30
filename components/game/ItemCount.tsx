"use client";

import { useT } from "@/lib/settings";
import { cn } from "@/lib/utils";

/**
 * Quanti elementi ha una lista.
 *
 * Ha preso il posto della striscia delle fasce: sapere che ci sono trenta
 * elementi è utile, sapere come sono divisi per prezzo di apertura no — quello
 * si scopre giocando, un lotto alla volta.
 */
export function ItemCount({ count, className }: { count: number; className?: string }) {
  const t = useT();

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border border-line bg-surface-2 px-2.5 py-0.5 text-[11px] font-bold text-muted",
        className,
      )}
    >
      {t("categories.count", { n: count })}
    </span>
  );
}
