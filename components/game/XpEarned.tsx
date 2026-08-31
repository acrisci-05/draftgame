"use client";

import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import { levelFor } from "@/lib/levels";
import { useT } from "@/lib/settings";
import { LevelChip } from "@/components/ui/LevelBar";

/**
 * L'esperienza guadagnata con questa partita.
 *
 * Compare solo a chi è iscritto e solo se la partita ha davvero pagato: la
 * stessa partita vale una volta sola, quindi riaprendo la schermata il
 * riquadro non torna. A chi gioca da ospite si mostra invece cosa si sta
 * perdendo, che è l'unico momento in cui la cosa interessa davvero.
 */

export function XpEarned({ earned, totalXp }: { earned: number; totalXp: number }) {
  const t = useT();
  if (earned <= 0) return null;

  const level = levelFor(totalXp);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
      className="flex items-center gap-3 rounded-2xl border border-gold/40 bg-gold/10 p-4"
    >
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-gold/20 text-gold">
        <Sparkles className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-lg font-black text-gold">{t("xp.earned", { n: earned })}</p>
        <p className="mt-0.5 text-xs text-muted">
          {t("level.toNext", { n: level.toNext.toLocaleString(), lv: level.level + 1 })}
        </p>
      </div>
      <LevelChip level={level} />
    </motion.div>
  );
}

/** Il grado zero: quello che si porta chi gioca senza essersi iscritto. */
export function GuestBadge() {
  const t = useT();
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-line bg-surface-2 p-4">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-surface text-2xl">
        👻
      </span>
      <div className="min-w-0">
        <p className="font-bold">{t("level.guestTitle")}</p>
        <p className="mt-0.5 text-xs text-muted">{t("level.guestHint")}</p>
      </div>
    </div>
  );
}
