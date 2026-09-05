"use client";

import { motion, useAnimationControls } from "framer-motion";
import { Gavel } from "lucide-react";
import { playSfx } from "@/lib/audio";
import { HAPTIC_TAKE, vibrate } from "@/lib/haptics";
import { useSettings } from "@/lib/settings";
import { cn } from "@/lib/utils";

/**
 * Il martello del banditore: il modo di dire "ci sono".
 *
 * Sostituisce la spunta di "pronto" perche' dice la stessa cosa restando dentro
 * al gioco: si sta per aprire un'asta, e un'asta si apre col martello. Il colpo
 * si sente in tre sensi -- si vede, si sente e si sente in mano -- e i tre
 * insieme fanno capire che e' successo qualcosa anche a chi sta guardando
 * altrove mentre preme.
 *
 * Si puo' ribattere per ritirarsi: chi si accorge di avere ancora l'avatar
 * sbagliato deve poter fermare il tavolo senza uscire dalla stanza.
 */
export function GavelButton({
  ready,
  disabled = false,
  onStrike,
  /**
   * Il nome di chi deve battere.
   *
   * Serve in locale, dove i martelli sono uno per giocatore sullo stesso
   * schermo: tre pulsanti identici in fila non dicono di chi sono, e si finisce
   * per batterli a caso. Online il martello e' uno solo ed e' il proprio,
   * quindi il nome sarebbe rumore.
   */
  name,
  className,
}: {
  ready: boolean;
  disabled?: boolean;
  onStrike: () => void;
  name?: string;
  className?: string;
}) {
  const { sound, t } = useSettings();
  const controls = useAnimationControls();

  const colpisci = () => {
    if (disabled) return;
    /*
     * Il colpo parte comunque, anche quando si sta ritirando il martello: e'
     * il gesto che si sta facendo, e un pulsante che suona solo a volte sembra
     * rotto piu' che discreto.
     */
    playSfx("gavel", sound);
    vibrate(HAPTIC_TAKE);
    /*
     * Alza, cala secco, rimbalza. La salita e' lenta e la discesa e' un
     * istante: un colpo simmetrico non sembra un colpo, sembra un'oscillazione.
     */
    void controls.start({
      rotate: [0, -32, 14, -6, 0],
      transition: { duration: 0.42, times: [0, 0.35, 0.62, 0.82, 1], ease: "easeOut" },
    });
    onStrike();
  };

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={colpisci}
      aria-pressed={ready}
      /*
       * In locale il pulsante mostra il nome, non l'azione: chi legge lo
       * schermo ad alta voce sentirebbe solo "Ana". L'etichetta dice cosa fa,
       * e `aria-pressed` qui sopra dice se e' gia' stato battuto.
       */
      aria-label={name ? `${t("lobby.gavel")} — ${name}` : undefined}
      className={cn(
        "flex touch-manipulation select-none items-center justify-center gap-2",
        "rounded-xl border px-4 py-3 font-black transition-colors active:scale-[0.97]",
        ready
          ? "border-neon bg-neon/15 text-neon shadow-[0_0_18px_-6px_var(--color-neon)]"
          : "border-gold/60 bg-gold/10 text-gold hover:bg-gold/20",
        disabled ? "cursor-not-allowed opacity-50" : "",
        className,
      )}
      style={{ WebkitTapHighlightColor: "transparent", WebkitUserSelect: "none" }}
    >
      <motion.span animate={controls} style={{ originX: 0.7, originY: 0.8 }} className="flex">
        <Gavel className="size-5 shrink-0" />
      </motion.span>
      <span className="min-w-0 truncate">
        {name ? name : ready ? t("lobby.gavelDone") : t("lobby.gavel")}
      </span>
    </button>
  );
}
