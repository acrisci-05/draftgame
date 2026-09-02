"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Gavel, Target, Trophy } from "lucide-react";
import { useEffect, useState } from "react";
import type { TranslationKey } from "@/lib/i18n";
import { useT } from "@/lib/settings";
import { cn } from "@/lib/utils";
import { Modal } from "./Modal";

const SEEN_KEY = "pp:seen-tutorial";

/**
 * Le tre cose che servono sapere prima del primo lotto.
 *
 * Tre e non dieci: le regole complete stanno nel loro posto, e chi apre un
 * gioco per la prima volta non le legge comunque. Qui c'e' il minimo per non
 * restare fermi davanti al primo lotto -- come si offre, come si rinuncia,
 * perche' conviene tornare.
 */
const CARDS: { icon: typeof Gavel; title: TranslationKey; body: TranslationKey }[] = [
  { icon: Gavel, title: "tutorial.bid", body: "tutorial.bidBody" },
  { icon: Target, title: "tutorial.flop", body: "tutorial.flopBody" },
  { icon: Trophy, title: "tutorial.rewards", body: "tutorial.rewardsBody" },
];

/** true se questo dispositivo non ha mai visto il tutorial. */
function primaVolta(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return !window.localStorage.getItem(SEEN_KEY);
  } catch {
    // Senza storage non si puo' sapere: meglio non mostrarlo che mostrarlo
    // a ogni apertura.
    return false;
  }
}

export function OnboardingModal({
  forceOpen = false,
  onForcedClose,
}: {
  /** Riaperto a mano dal menu: allora si mostra anche a chi l'ha gia' visto. */
  forceOpen?: boolean;
  onForcedClose?: () => void;
} = {}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [card, setCard] = useState(0);

  useEffect(() => {
    if (!primaVolta()) return;
    // Un attimo dopo il caricamento: davanti a una pagina ancora bianca il
    // tutorial spiegherebbe qualcosa che non si e' ancora visto.
    const timer = setTimeout(() => setOpen(true), 900);
    return () => clearTimeout(timer);
  }, []);

  /**
   * Chiusura per sbaglio: si chiude, ma non si segna niente.
   *
   * Il tutorial compare da solo dopo un secondo, cioe' proprio mentre uno sta
   * ancora toccando la pagina. Un tocco a vuoto che cade sullo sfondo lo
   * chiudeva e lo marcava come visto per sempre -- e uno non sa nemmeno di
   * averlo avuto davanti. Adesso solo i due pulsanti in fondo dicono "visto":
   * quelli si premono apposta.
   */
  const chiudiSenzaSegnare = () => {
    setOpen(false);
    // Si riparte sempre dalla prima card: riaprirlo a meta' non ha senso.
    setCard(0);
    onForcedClose?.();
  };

  const chiudi = () => {
    setOpen(false);
    setCard(0);
    onForcedClose?.();
    try {
      window.localStorage.setItem(SEEN_KEY, "1");
    } catch {
      /* senza storage tornera' la prossima volta: pazienza */
    }
  };

  const { icon: Icon, title, body } = CARDS[card];
  const ultima = card === CARDS.length - 1;

  return (
    <Modal open={open || forceOpen} title={t("tutorial.title")} onClose={chiudiSenzaSegnare}>
      <div className="flex flex-col gap-4">
        <AnimatePresence mode="wait">
          <motion.div
            key={card}
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 }}
            transition={{ duration: 0.2 }}
            className="flex flex-col items-center gap-3 rounded-2xl border border-neon/30 bg-neon/5 p-5 text-center"
          >
            <span className="grid size-14 place-items-center rounded-2xl bg-neon/15 text-neon">
              <Icon className="size-7" />
            </span>
            <h3 className="text-xl font-black tracking-tight">{t(title)}</h3>
            <p className="text-sm leading-relaxed text-muted">{t(body)}</p>
          </motion.div>
        </AnimatePresence>

        {/* I pallini: dicono quante ne restano, e si possono anche toccare. */}
        <div className="flex justify-center gap-2">
          {CARDS.map((_, index) => (
            <button
              key={index}
              type="button"
              aria-label={`${index + 1}/${CARDS.length}`}
              onClick={() => setCard(index)}
              className={cn(
                "h-1.5 rounded-full transition-all",
                index === card ? "w-6 bg-neon" : "w-1.5 bg-line hover:bg-faint",
              )}
            />
          ))}
        </div>

        <button
          type="button"
          onClick={() => (ultima ? chiudi() : setCard((n) => n + 1))}
          className="flex h-13 items-center justify-center rounded-2xl bg-neon py-3.5 text-base font-black text-ink transition-opacity hover:opacity-90"
        >
          {t(ultima ? "tutorial.done" : "tutorial.next")}
        </button>

        {/*
          Si puo' saltare, e si deve poter saltare: chi ha gia' giocato altrove
          non vuole tre schermate prima di cominciare, e obbligarlo e' il modo
          di fargli chiudere la scheda invece del tutorial.
        */}
        {!ultima ? (
          <button
            type="button"
            onClick={chiudi}
            className="text-center text-xs text-faint transition-colors hover:text-fg"
          >
            {t("tutorial.skip")}
          </button>
        ) : null}
      </div>
    </Modal>
  );
}
