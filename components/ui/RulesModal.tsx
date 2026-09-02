"use client";

import { motion } from "framer-motion";
import { Bot, Dices, Gavel, Layers, Medal, Sparkles, Target, Trophy, Users } from "lucide-react";
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
  /**
   * Una formula da mostrare staccata dal discorso, in corsivo.
   *
   * Sta fuori dalle traduzioni perche' e' la stessa in ogni lingua: i nomi
   * delle variabili non si traducono, e ripeterla in dieci file vorrebbe dire
   * dieci occasioni di scriverla diversa.
   */
  formula?: string;
}

interface Section {
  icon: typeof Gavel;
  title: TranslationKey;
  /** Frase d'apertura, prima dell'elenco. Solo dove serve un contesto. */
  lead?: TranslationKey;
  points: Point[];
}

const SECTIONS: Section[] = [
  {
    icon: Trophy,
    title: "rules.win.title",
    lead: "rules.win.body",
    points: [
      { label: "rules.win.tie", body: "rules.win.tieBody" },
      { label: "rules.win.two", body: "rules.win.twoBody" },
    ],
  },
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
  /*
   * Il tetto dei flop, tavolo per tavolo.
   *
   * Sta in una sezione sua e non dentro "casi speciali" perche' e' l'unico
   * numero del gioco che cambia con quanti si e': leggerlo di sfuggita dentro
   * un paragrafo vorrebbe dire scoprirlo quando la riserva e' gia' finita.
   */
  {
    icon: Target,
    title: "rules.flop.title",
    lead: "rules.flop.body",
    points: [
      { label: "rules.flop.p2", body: "rules.flop.p2Body" },
      { label: "rules.flop.p3", body: "rules.flop.p3Body" },
      { label: "rules.flop.p4", body: "rules.flop.p4Body" },
      { label: "rules.flop.p5", body: "rules.flop.p5Body" },
      { label: "rules.flop.out", body: "rules.flop.outBody" },
    ],
  },
  /*
   * Le targhe di fine partita.
   *
   * Stanno subito dopo "come si vince" perche' e' la stessa schermata: la
   * classifica premia uno solo, e queste servono a dare qualcosa da
   * raccontare anche agli altri quattro. Non erano documentate da nessuna
   * parte, quindi comparivano a fine partita senza che nessuno sapesse cosa
   * fossero.
   */
  {
    icon: Medal,
    title: "rules.titles.title",
    lead: "rules.titles.body",
    points: [
      { label: "rules.titles.dominator", body: "rules.titles.dominatorBody" },
      { label: "rules.titles.spender", body: "rules.titles.spenderBody" },
      { label: "rules.titles.tightwad", body: "rules.titles.tightwadBody" },
      { label: "rules.titles.flopMaster", body: "rules.titles.flopMasterBody" },
      { label: "rules.titles.tie", body: "rules.titles.tieBody" },
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
    icon: Medal,
    title: "rules.rewards.title",
    points: [
      { label: "rules.rewards.r0", body: "rules.rewards.r0Body" },
      { label: "rules.rewards.r1", body: "rules.rewards.r1Body" },
      { label: "rules.rewards.r2", body: "rules.rewards.r2Body" },
      { label: "rules.rewards.r3", body: "rules.rewards.r3Body" },
      { label: "rules.rewards.r4", body: "rules.rewards.r4Body" },
      { label: "rules.rewards.r5", body: "rules.rewards.r5Body" },
    ],
  },
  {
    icon: Layers,
    title: "rules.modes.title",
    points: [
      { label: "rules.modes.where", body: "rules.modes.whereBody" },
      { label: "rules.modes.extras", body: "rules.modes.extrasBody" },
      { label: "rules.modes.reactions", body: "rules.modes.reactionsBody" },
      {
        label: "rules.modes.pool",
        body: "rules.modes.poolBody",
        formula: "(numero_giocatori * slot_roster) + 5",
      },
    ],
  },
  /*
   * Le due strade per sedersi al tavolo senza aspettare nessuno: un avversario
   * che c'e' sempre e una lista scelta dal banditore. Stanno qui, subito dopo
   * le modalita', perche' rispondono alla stessa domanda -- "e adesso come
   * comincio?" -- e non a quella delle regole d'asta.
   */
  {
    icon: Bot,
    title: "rules.solo.title",
    lead: "rules.solo.body",
    points: [
      { label: "rules.solo.how", body: "rules.solo.howBody" },
      { label: "rules.solo.xp", body: "rules.solo.xpBody" },
      { label: "rules.solo.two", body: "rules.solo.twoBody" },
    ],
  },
  {
    icon: Dices,
    title: "rules.random.title",
    lead: "rules.random.body",
    points: [{ label: "rules.random.how", body: "rules.random.howBody" }],
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

        {SECTIONS.map(({ icon: Icon, title, lead, points }, index) => (
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

            {lead ? (
              <p className="mt-2.5 text-sm leading-relaxed text-muted">{t(lead)}</p>
            ) : null}

            <ul className="mt-3 flex flex-col gap-2.5">
              {points.map(({ label, body, formula }) => (
                <li key={label} className="flex gap-2.5 text-sm leading-relaxed">
                  <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-neon/60" />
                  <span className="min-w-0 text-muted">
                    <b className="font-semibold text-fg">{t(label)}</b> {t(body)}
                    {formula ? (
                      <em className="mt-1.5 block font-mono text-xs text-neon not-italic">
                        <span className="italic">{formula}</span>
                      </em>
                    ) : null}
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
