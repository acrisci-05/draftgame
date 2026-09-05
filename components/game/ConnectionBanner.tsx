"use client";

import { AnimatePresence, motion } from "framer-motion";
import { WifiOff } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useT } from "@/lib/settings";
import { cn } from "@/lib/utils";

/**
 * L'avviso di connessione caduta.
 *
 * Una striscia in alto, non un riquadro che copre lo schermo: durante un lotto
 * al ribasso il prezzo continua a scendere e il tempo a scorrere: bloccare
 * l'interfaccia per dire "sto riprovando" toglierebbe di mano il lotto a chi lo
 * stava guardando, che e' esattamente il danno che l'avviso dovrebbe evitare.
 * La stanza si riallinea da sola quando la rete torna -- ci pensa il riaggancio
 * in `useRoom` -- e qui si dice solo che sta succedendo.
 *
 * Il ritorno online si mostra per un paio di secondi e poi sparisce: una
 * striscia verde fissa sarebbe rumore, perche' essere in linea e' la normalita'
 * e non una notizia.
 */

/** Quanto resta a schermo l'avviso di ritorno. */
const BACK_MS = 2200;

export function ConnectionBanner({ live }: { live: boolean }) {
  const t = useT();
  const [tornato, setTornato] = useState(false);
  /*
   * "Era giu'" e' una memoria, non qualcosa che si disegna: sta in un
   * riferimento. Se fosse stato, ogni caduta di rete produrrebbe un disegno in
   * piu' buono solo a ricordarsi una cosa che nessuno vede.
   */
  const eraGiuRef = useRef(false);

  useEffect(() => {
    if (!live) {
      eraGiuRef.current = true;
      return;
    }
    if (!eraGiuRef.current) return;
    eraGiuRef.current = false;
    /*
     * Comparsa e sparizione partono tutte e due da un timer.
     *
     * Cambiare stato dritti nel corpo dell'effetto incatena un secondo disegno
     * a ogni riaggancio; passando dai timer il cambio arriva da fuori, che e'
     * il modo in cui un effetto e' fatto per parlare con React.
     */
    const mostra = setTimeout(() => setTornato(true), 0);
    const nascondi = setTimeout(() => setTornato(false), BACK_MS);
    return () => {
      clearTimeout(mostra);
      clearTimeout(nascondi);
    };
  }, [live]);

  const mostra = !live || tornato;

  return (
    <AnimatePresence>
      {mostra ? (
        <motion.div
          initial={{ y: -28, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -28, opacity: 0 }}
          transition={{ duration: 0.22 }}
          role="status"
          aria-live="polite"
          className="pointer-events-none sticky top-2 z-40 flex justify-center"
        >
          <span
            className={cn(
              "flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-bold shadow-lg",
              live
                ? "border-neon/50 bg-neon/15 text-neon"
                : "border-amber-400/50 bg-amber-400/15 text-amber-400",
            )}
          >
            {live ? (
              <span className="size-2 rounded-full bg-neon" aria-hidden />
            ) : (
              <WifiOff className="size-3.5 shrink-0 animate-pulse" aria-hidden />
            )}
            {live ? t("room.backOnline") : t("room.reconnecting")}
          </span>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
