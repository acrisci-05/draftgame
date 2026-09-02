"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Lock, Smile } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useIsClient } from "@/lib/client-store";
import { REACTIONS, type ReactionEmoji } from "@/lib/game";
import { useT } from "@/lib/settings";
import { showToast } from "@/lib/toast";
import { vibrate, HAPTIC_PASS } from "@/lib/haptics";
import { cn } from "@/lib/utils";

/**
 * Le reazioni dell'asta.
 *
 * Servono a una cosa sola: dire qualcosa mentre si gioca, senza scrivere. Un
 * tavolo d'asta dal vivo e' fatto di versi e sguardi piu' che di numeri, e a
 * distanza quella parte sparisce del tutto.
 *
 * Cinque faccine, un tocco, e via. Niente chat, niente testo libero: una chat
 * in un gioco fra sconosciuti e' una cosa da moderare, cinque emoji no.
 */

/** Il pulsante e il ventaglio che si apre sopra di lui. */
export function ReactionButton({
  canSend,
  locked,
  onSend,
  className,
}: {
  /** false quando il turno o la fase non lo consentono, o si e' appena reagito. */
  canSend: boolean;
  /** true per gli ospiti: il pulsante c'e' ma e' chiuso a chiave. */
  locked: boolean;
  onSend: (emoji: ReactionEmoji) => void;
  className?: string;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);

  /* Aperto e dimenticato li' e' un pannello che copre i comandi: si richiude. */
  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => setOpen(false), 4000);
    return () => clearTimeout(timer);
  }, [open]);

  const apri = () => {
    if (locked) {
      // Non un errore: un invito. Chi gioca da ospite non ha sbagliato niente.
      showToast(t("reactions.guest"), "info");
      return;
    }
    setOpen((era) => !era);
  };

  return (
    <div className={cn("relative", className)}>
      <AnimatePresence>
        {open ? (
          <>
            {/* Un tocco fuori richiude, senza coprire nulla di visibile. */}
            <button
              type="button"
              aria-label={t("common.close")}
              onClick={() => setOpen(false)}
              className="fixed inset-0 z-30 cursor-default"
            />
            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.9 }}
              transition={{ duration: 0.16 }}
              /*
                Il ventaglio si apre verso destra, non verso sinistra.

                Era ancorato a destra, e finche' il pulsante stava nell'angolo
                destro andava bene. Spostandolo a sinistra, la stessa ancora
                mandava le cinque faccine fuori dallo schermo: se ne vedeva
                una sola, tagliata a meta' dal bordo.
              */
              className="absolute bottom-full start-0 z-40 mb-2 flex gap-1 rounded-2xl border border-line bg-surface p-1.5 shadow-xl"
            >
              {REACTIONS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  disabled={!canSend}
                  aria-label={emoji}
                  onClick={() => {
                    vibrate(HAPTIC_PASS);
                    onSend(emoji);
                    setOpen(false);
                  }}
                  className={cn(
                    "grid size-10 touch-manipulation place-items-center rounded-xl text-xl transition-transform",
                    canSend
                      ? "hover:scale-110 hover:bg-surface-2 active:scale-95"
                      : "cursor-not-allowed opacity-40",
                  )}
                >
                  {emoji}
                </button>
              ))}
            </motion.div>
          </>
        ) : null}
      </AnimatePresence>

      <button
        type="button"
        onClick={apri}
        aria-label={t(locked ? "reactions.guest" : "reactions.open")}
        title={t(locked ? "reactions.guest" : "reactions.open")}
        className={cn(
          "grid size-11 shrink-0 place-items-center rounded-xl border transition-colors",
          locked
            ? "border-line bg-surface-2 text-faint"
            : open
              ? "border-violet bg-violet/20 text-violet"
              : "border-line bg-surface-2 text-muted hover:border-violet/50 hover:text-violet",
        )}
      >
        {locked ? <Lock className="size-4" /> : <Smile className="size-5" />}
      </button>
    </div>
  );
}

/**
 * L'emoji che sale sopra l'avatar di chi l'ha mandata.
 *
 * Disegnata in fondo alla pagina e non dentro la scheda del giocatore, anche
 * se e' li' che deve comparire. La ragione e' una regola del CSS che si scopre
 * solo sbattendoci: la barra dei giocatori scorre in orizzontale, e un
 * contenitore che scorre su un asse ritaglia anche sull'altro. L'emoji nasceva
 * dentro quella barra e saliva -- e usciva tagliata a meta'.
 *
 * Cosi' invece la posizione della scheda si misura al momento del lancio e
 * l'emoji vive in un livello sopra tutto, che non ritaglia niente.
 */
export function FloatingReactions({
  emojis,
  anchorRef,
}: {
  emojis: { id: string; emoji: string }[];
  /** La scheda sopra cui far salire l'emoji. */
  anchorRef: React.RefObject<HTMLElement | null>;
}) {
  const isClient = useIsClient();
  const layerRef = useRef<HTMLSpanElement>(null);
  const quante = emojis.length;

  /*
   * La posizione si scrive direttamente sul nodo, non in uno stato.
   *
   * Misurare e poi ridisegnare vorrebbe dire un giro di React a ogni pixel di
   * scorrimento, per un'animazione che dura un secondo e mezzo. Due variabili
   * CSS aggiornate a mano costano niente e fanno la stessa cosa.
   */
  useEffect(() => {
    if (quante === 0) return;
    const misura = () => {
      const rect = anchorRef.current?.getBoundingClientRect();
      const layer = layerRef.current;
      if (!rect || !layer) return;
      layer.style.setProperty("--pp-reaction-x", `${rect.left + rect.width / 2}px`);
      layer.style.setProperty("--pp-reaction-y", `${rect.top}px`);
    };
    misura();
    /*
     * La barra si puo' scorrere mentre l'emoji e' per aria, e la pagina pure:
     * senza questi due ascoltatori l'emoji resterebbe dove era la scheda un
     * secondo fa, cioe' nel posto sbagliato.
     */
    window.addEventListener("scroll", misura, true);
    window.addEventListener("resize", misura);
    return () => {
      window.removeEventListener("scroll", misura, true);
      window.removeEventListener("resize", misura);
    };
  }, [quante, anchorRef]);

  if (!isClient || quante === 0) return null;

  return createPortal(
    <span
      ref={layerRef}
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[60] block overflow-visible"
    >
      {emojis.map(({ id, emoji }, index) => (
        <span
          key={id}
          className="reaction-float absolute text-3xl drop-shadow-lg"
          style={{
            // Due reazioni ravvicinate non si sovrappongono: la seconda parte
            // leggermente di lato, come farebbero due mani alzate vicine.
            left: `calc(var(--pp-reaction-x, 50vw) + ${(index % 3) * 16 - 16}px)`,
            top: "var(--pp-reaction-y, 50vh)",
          }}
        >
          {emoji}
        </span>
      ))}
    </span>,
    document.body,
  );
}
