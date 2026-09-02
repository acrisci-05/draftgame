"use client";

import { AnimatePresence, motion } from "framer-motion";
import confetti from "canvas-confetti";
import { useEffect } from "react";
import { playSfx } from "@/lib/audio";
import { vibrate } from "@/lib/haptics";
import { useSettings } from "@/lib/settings";

/** Quanto dura la scena. Oltre, il voto sarebbe una cosa che si aspetta. */
export const FIST_BUMP_MS = 1200;

/**
 * Il batti cinque, quando uno spettatore vota.
 *
 * Votare da fuori e' un gesto piccolo -- un tocco su un pulsante -- e senza
 * niente che lo accompagni non si distingue da un errore di battitura. Un
 * secondo di scena dice "e' andata" senza scrivere "e' andata", e chiude la
 * pagina del voto in un momento invece che in un silenzio.
 *
 * Dura poco piu' di un secondo apposta: il tempo di godersela una volta, non
 * abbastanza da annoiare chi vota la seconda partita della serata.
 */
export function FistBump({ show, onDone }: { show: boolean; onDone: () => void }) {
  const { sound } = useSettings();

  useEffect(() => {
    if (!show) return;

    // Botta secca, non un ronzio: e' un pugno, non una notifica.
    vibrate([40, 30, 60]);
    playSfx("win", sound);

    const ridotto =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    /*
     * Le scintille partono a meta' corsa, quando i pugni si toccano: prima
     * sarebbero un'esplosione senza causa, dopo un'eco.
     */
    const scintille = ridotto
      ? null
      : window.setTimeout(() => {
          confetti({
            particleCount: 70,
            spread: 360,
            startVelocity: 26,
            decay: 0.9,
            scalar: 0.9,
            ticks: 90,
            origin: { x: 0.5, y: 0.5 },
            colors: ["#facc15", "#f97316", "#22c55e", "#22d3ee", "#ffffff"],
            disableForReducedMotion: true,
          });
        }, 420);

    const fine = window.setTimeout(onDone, FIST_BUMP_MS);
    return () => {
      if (scintille) window.clearTimeout(scintille);
      window.clearTimeout(fine);
    };
  }, [show, sound, onDone]);

  return (
    <AnimatePresence>
      {show ? (
        <motion.div
          aria-hidden
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="pointer-events-none fixed inset-0 z-[70] grid place-items-center bg-ink/70 backdrop-blur-sm"
        >
          <div className="relative flex items-center">
            {/*
              I due pugni entrano da fuori schermo e si fermano al centro.
              Arrivano insieme e rimbalzano appena: e' lo scatto all'impatto a
              far sembrare che si siano toccati davvero.
            */}
            <motion.span
              initial={{ x: "-60vw", rotate: -20, opacity: 0 }}
              animate={{ x: 0, rotate: 0, opacity: 1 }}
              transition={{ type: "spring", stiffness: 260, damping: 14, delay: 0.05 }}
              className="text-7xl drop-shadow-2xl sm:text-8xl"
            >
              👊
            </motion.span>
            <motion.span
              initial={{ x: "60vw", rotate: 20, opacity: 0 }}
              animate={{ x: 0, rotate: 0, opacity: 1 }}
              transition={{ type: "spring", stiffness: 260, damping: 14, delay: 0.05 }}
              className="-ms-4 scale-x-[-1] text-7xl drop-shadow-2xl sm:text-8xl"
            >
              👊
            </motion.span>

            {/* L'onda d'urto: un cerchio che si allarga e svanisce. */}
            <motion.span
              initial={{ scale: 0.2, opacity: 0 }}
              animate={{ scale: 2.6, opacity: [0, 0.55, 0] }}
              transition={{ duration: 0.6, delay: 0.36, ease: "easeOut" }}
              className="absolute inset-0 -z-10 m-auto size-40 rounded-full border-4 border-gold"
            />
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
