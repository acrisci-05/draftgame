"use client";

import { motion } from "framer-motion";
import { Gavel, Layers, Sparkles, Target, Trophy, Users } from "lucide-react";
import type { TranslationKey } from "@/lib/i18n";
import { useT } from "@/lib/settings";
import { Modal } from "./Modal";

/**
 * Le regole del gioco.
 *
 * Ogni riga descrive quello che il motore fa davvero: sono state riscritte
 * leggendo lib/game.ts, non a memoria. Cambiando una regola nel codice va
 * cambiata anche qui, altrimenti il sito promette una cosa e ne fa un'altra.
 */

interface Point {
  label: TranslationKey;
  body: TranslationKey;
}

interface Section {
  icon: typeof Gavel;
  title: TranslationKey;
  points: Point[];
}

const SECTIONS: Section[] = [
  {
    icon: Gavel,
    title: "rules.auction.title",
    points: [
      { label: "rules.auction.budget", body: "rules.auction.budgetBody" },
      { label: "rules.auction.live", body: "rules.auction.liveBody" },
      { label: "rules.auction.timer", body: "rules.auction.timerBody" },
      { label: "rules.auction.reserve", body: "rules.auction.reserveBody" },
    ],
  },
  {
    icon: Trophy,
    title: "rules.special.title",
    points: [
      { label: "rules.special.nobid", body: "rules.special.nobidBody" },
      { label: "rules.special.last", body: "rules.special.lastBody" },
      { label: "rules.special.winner", body: "rules.special.winnerBody" },
    ],
  },
  {
    icon: Sparkles,
    title: "rules.xp.title",
    points: [
      { label: "rules.xp.fair", body: "rules.xp.fairBody" },
      { label: "rules.xp.guest", body: "rules.xp.guestBody" },
      { label: "rules.xp.earn", body: "rules.xp.earnBody" },
      { label: "rules.xp.tiers", body: "rules.xp.tiersBody" },
    ],
  },
  {
    icon: Layers,
    title: "rules.modes.title",
    points: [
      { label: "rules.modes.where", body: "rules.modes.whereBody" },
      { label: "rules.modes.extras", body: "rules.modes.extrasBody" },
    ],
  },
  {
    icon: Users,
    title: "rules.mates.title",
    points: [{ label: "rules.mates.friends", body: "rules.mates.friendsBody" }],
  },
];

export function RulesModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT();

  return (
    <Modal open={open} title={t("rules.title")} onClose={onClose}>
      <div className="flex flex-col gap-3">
        {/* L'obiettivo sta in cima e da solo: è la cosa che serve capire per prima. */}
        <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-neon/30 bg-neon/5 p-4"
        >
          <span className="flex items-center gap-2 font-bold text-neon">
            <Target className="size-4 shrink-0" />
            {t("rules.goal.title")}
          </span>
          <p className="mt-1.5 text-sm leading-relaxed text-muted">{t("rules.goal.body")}</p>
        </motion.section>

        {SECTIONS.map(({ icon: Icon, title, points }, index) => (
          <motion.section
            key={title}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: (index + 1) * 0.05 }}
            className="rounded-2xl border border-line bg-surface-2 p-4"
          >
            <span className="flex items-center gap-2.5">
              <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-neon/15 text-neon">
                <Icon className="size-4" />
              </span>
              <span className="font-bold">{t(title)}</span>
            </span>

            <ul className="mt-3 flex flex-col gap-2.5">
              {points.map(({ label, body }) => (
                <li key={label} className="flex gap-2.5 text-sm leading-relaxed">
                  <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-neon/60" />
                  <span className="min-w-0 text-muted">
                    <b className="font-semibold text-fg">{t(label)}</b> {t(body)}
                  </span>
                </li>
              ))}
            </ul>
          </motion.section>
        ))}
      </div>
    </Modal>
  );
}
