"use client";

import { motion } from "framer-motion";
import { levelFor, type Level } from "@/lib/levels";
import { useT } from "@/lib/settings";
import { cn } from "@/lib/utils";

/**
 * A che punto è un giocatore: fascia, livello e quanto manca al prossimo.
 *
 * Il numero da solo non dice niente ("livello 7" rispetto a cosa?), quindi
 * accanto c'è sempre il nome della fascia e sotto la barra con i punti che
 * mancano. È la differenza fra un'etichetta e un obiettivo.
 */

export function LevelChip({ level, className }: { level: Level; className?: string }) {
  const t = useT();
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold",
        level.tier.chip,
        className,
      )}
    >
      <span className="font-mono">Lv {level.level}</span>
      <span className="opacity-60">·</span>
      {t(level.tier.name)}
    </span>
  );
}

export function LevelBar({ xp, className }: { xp: number; className?: string }) {
  const t = useT();
  const level = levelFor(xp);
  const percent = Math.round(level.progress * 100);

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <div className="flex items-baseline justify-between gap-2">
        <LevelChip level={level} />
        <span className="font-mono text-xs text-faint tabular-nums">
          {xp.toLocaleString()} XP
        </span>
      </div>

      <div
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={t("level.progress")}
        className="h-2 overflow-hidden rounded-full bg-surface-2"
      >
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${percent}%` }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="h-full rounded-full bg-gradient-to-r from-neon/70 to-neon"
        />
      </div>

      <p className="text-[11px] text-faint tabular-nums">
        {t("level.toNext", { n: level.toNext.toLocaleString(), lv: level.level + 1 })}
      </p>
    </div>
  );
}
