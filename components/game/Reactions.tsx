"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Lock, Smile } from "lucide-react";
import { useEffect, useState } from "react";
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
              className="absolute bottom-full end-0 z-40 mb-2 flex gap-1 rounded-2xl border border-line bg-surface p-1.5 shadow-xl"
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
 * Sta sopra la scheda e non dentro: dentro allargherebbe la riga dei giocatori
 * a ogni reazione, e la barra ballerebbe mentre si gioca.
 */
export function FloatingReactions({ emojis }: { emojis: { id: string; emoji: string }[] }) {
  if (emojis.length === 0) return null;
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute inset-x-0 top-0 z-20 block h-0 text-center"
    >
      {emojis.map(({ id, emoji }, index) => (
        <span
          key={id}
          className="reaction-float absolute start-1/2 text-2xl drop-shadow-lg"
          // Due reazioni ravvicinate non si sovrappongono: la seconda parte
          // leggermente di lato, come farebbero due mani alzate vicine.
          style={{ marginInlineStart: `${(index % 3) * 14 - 14}px` }}
        >
          {emoji}
        </span>
      ))}
    </span>
  );
}
