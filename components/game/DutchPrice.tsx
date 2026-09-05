"use client";

import { motion } from "framer-motion";
import { Zap } from "lucide-react";
import { canTakeDutch } from "@/lib/game";
import { useT } from "@/lib/settings";
import type { CurrencyCode, GameState } from "@/lib/types";
import { useDutchPrice } from "@/lib/useDutchPrice";
import { cn, money } from "@/lib/utils";

/**
 * Le due parti che battono col prezzo, e nient'altro.
 *
 * Il prezzo si ridisegna una dozzina di volte al secondo. Se il conto stesse
 * nella schermata dell'asta, a ogni scatto si ridisegnerebbe tutto quello che
 * c'e' dentro -- la foto del lotto, la fascia dei giocatori, il registro delle
 * offerte, i comandi di ognuno. Misurato: settantasei disegni dell'intera
 * schermata in tre secondi.
 *
 * Tenendo l'abbonamento all'orologio qui dentro, a battere sono solo la cifra e
 * il pulsante: due foglie senza figli, che React ridisegna senza toccare il
 * resto della pagina.
 */

/** La cifra grande nell'area del lotto. */
export function DutchHeadlinePrice({
  state,
  now,
  live,
}: {
  state: GameState;
  now: () => number;
  /**
   * false durante l'aggiudicazione, quando il prezzo non scende piu': si
   * mostra quello di apertura, cioe' la cifra da cui ripartira' il prossimo.
   */
  live: boolean;
}) {
  const { price, atFloor } = useDutchPrice(state, now);
  const currency = state.config.currency;

  return (
    <p
      className={cn(
        "font-mono text-4xl font-black tabular-nums",
        atFloor && live ? "text-gold" : "text-neon",
      )}
    >
      {money(live ? price : state.lotPrice, currency)}
    </p>
  );
}

/**
 * Il pulsante dell'asta al ribasso.
 *
 * Uno solo, perche' al ribasso c'e' una decisione sola da prendere: adesso o
 * mai piu'. La cifra sta dentro il pulsante e non sopra -- e' il prezzo che si
 * paga premendo, non un dato da consultare -- e la barra sotto dice quanto
 * manca al fondo senza che si debba leggere un altro numero.
 */
export function DutchTakeButton({
  state,
  playerId,
  now,
  height,
  compact,
  taking,
  locked,
  onClick,
}: {
  state: GameState;
  playerId: string;
  now: () => number;
  height: string;
  compact: boolean;
  /** Il tocco e' partito e si aspetta l'esito dall'host. */
  taking: boolean;
  /** Comandi spenti per una ragione che non e' il prezzo. */
  locked: boolean;
  onClick: () => void;
}) {
  const t = useT();
  const { price, progress, atFloor } = useDutchPrice(state, now);
  const currency: CurrencyCode = state.config.currency;

  const puoPrendere = canTakeDutch(state, playerId, now());
  const disabled = !puoPrendere || locked || taking;
  const attivo = !disabled;
  /* Spento perche' il prezzo non e' ancora sceso abbastanza, non per altro. */
  const troppoCaro = !puoPrendere && !locked && !taking;

  return (
    <div className="flex flex-col gap-1.5">
      <button
        type="button"
        disabled={disabled}
        onClick={onClick}
        /*
         * `touch-action: manipulation` toglie i trecento millesimi che Safari
         * aspetta per capire se il tocco e' un doppio -- e con essi il doppio
         * tocco che ingrandisce la pagina proprio mentre si preme. `select-none`
         * evita che una pressione un filo lunga selezioni la scritta e apra il
         * menu di copia: su un pulsante che si preme di scatto succede spesso.
         */
        className={cn(
          "flex w-full touch-manipulation select-none items-center justify-center gap-2",
          "rounded-xl border font-black transition-colors active:scale-[0.97]",
          height,
          attivo
            ? "border-neon bg-neon/15 text-neon shadow-[0_0_18px_-4px_var(--color-neon)] hover:bg-neon/25"
            : "cursor-not-allowed border-line bg-surface-2 text-faint",
        )}
        style={{ WebkitTapHighlightColor: "transparent", WebkitUserSelect: "none" }}
      >
        <Zap className={cn("size-4 shrink-0", attivo ? "animate-pulse" : "")} />
        <span className={compact ? "text-sm" : "text-base"}>
          {taking ? t("auction.dutchSending") : t("auction.dutchTake")}
        </span>
        {!taking ? (
          /*
           * La cifra e' a larghezza fissa e in monospazio: cambia dodici volte
           * al secondo, e senza le cifre tabulari il testo accanto ballerebbe
           * sotto il pollice a ogni credito perso.
           */
          <motion.span
            key={price}
            initial={{ scale: 1.18 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.14 }}
            className={cn(
              "font-mono tabular-nums",
              compact ? "text-lg" : "text-xl",
              atFloor && attivo ? "text-gold" : "",
            )}
          >
            {money(price, currency)}
          </motion.span>
        ) : null}
      </button>

      {/* Quanto e' scesa: piena all'apertura, vuota al pavimento. */}
      <div className="h-1 overflow-hidden rounded-full bg-surface-2" aria-hidden>
        <div
          className={cn(
            "h-full rounded-full transition-[width] duration-100 ease-linear",
            atFloor ? "bg-gold" : "bg-neon",
          )}
          style={{ width: `${Math.round((1 - progress) * 100)}%` }}
        />
      </div>

      <p className="text-center text-[11px] text-faint">
        {taking
          ? t("auction.dutchSending")
          : troppoCaro
            ? t("auction.dutchTooDear")
            : atFloor
              ? t("auction.dutchFloor")
              : t("auction.dutchHint")}
      </p>
    </div>
  );
}
