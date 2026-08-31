"use client";

import { Check, Lock } from "lucide-react";
import { GUEST_TIER, TIERS, type Level } from "@/lib/levels";
import { useT } from "@/lib/settings";
import { cn } from "@/lib/utils";

/**
 * Le fasce e cosa sblocca ognuna.
 *
 * Si mostrano tutte, anche quelle lontane: una scala di cui si vede solo il
 * gradino successivo non fa venire voglia di salire. Quelle già raggiunte
 * portano la spunta, le altre dicono a che livello si aprono.
 *
 * Qui compaiono soltanto le ricompense che esistono davvero — cornice
 * dell'avatar e titolo. Elencarne di più significherebbe far sbloccare a
 * qualcuno una cosa che poi non trova da nessuna parte.
 */
export function Rewards({ level }: { level: Level }) {
  const t = useT();
  const guest = level.level === 0;

  return (
    <div className="rounded-2xl border border-line bg-surface-2 p-3">
      <p className="mb-2.5 text-[11px] font-bold tracking-wider text-faint uppercase">
        {t("level.rewards")}
      </p>

      <div className="flex flex-col gap-1.5">
        {(guest ? [GUEST_TIER, ...TIERS] : TIERS).map((tier) => {
          const reached = !guest && level.level >= tier.from;
          return (
            <div
              key={tier.id}
              className={cn(
                "flex items-start gap-2.5 rounded-xl border p-2.5",
                reached ? tier.chip : "border-line bg-surface text-faint",
              )}
            >
              <span className="mt-0.5 shrink-0">
                {reached ? <Check className="size-4" /> : <Lock className="size-3.5" />}
              </span>

              <div className="min-w-0 flex-1">
                <p className="flex items-baseline gap-2 text-sm font-bold">
                  <span className="truncate">{t(tier.name)}</span>
                  {tier.id !== "guest" ? (
                    <span className="shrink-0 font-mono text-[10px] opacity-70">
                      Lv {tier.from}
                      {Number.isFinite(tier.to) ? `–${tier.to}` : "+"}
                    </span>
                  ) : null}
                </p>
                <p className="mt-0.5 text-xs opacity-80">
                  {tier.perks.map((perk) => t(perk)).join(" · ")}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
