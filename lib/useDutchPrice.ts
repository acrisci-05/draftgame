"use client";

import { useEffect, useState } from "react";
import { DUTCH_FLOOR, dutchOpening, dutchPriceAt, isDutchLot, lotSeconds } from "./game";
import type { GameState } from "./types";

/** Ogni quanto si ridisegna il prezzo. */
const REFRESH_MS = 80;

export interface DutchPrice {
  /** Il prezzo da pagare in questo istante. */
  price: number;
  /** Da quanto e' partita la discesa. */
  opening: number;
  /** Dove si ferma. */
  floor: number;
  /** Quanto e' scesa: 0 appena aperto, 1 quando ha toccato il fondo. */
  progress: number;
  /** true quando il prezzo e' al pavimento e non scende piu'. */
  atFloor: boolean;
}

/**
 * Il prezzo dell'asta al ribasso, sempre aggiornato.
 *
 * Non tiene un contatore che scala per conto suo: il prezzo viene ricavato dal
 * tempo trascorso a ogni disegno, e il cronometro qui sotto serve solo a far
 * succedere quel disegno. La differenza non e' un dettaglio -- un contatore che
 * si decrementa da solo accumula il ritardo di ogni giro (una scheda in secondo
 * piano, lo schermo che si spegne) e dopo qualche secondo due dispositivi
 * mostrano due cifre diverse per lo stesso lotto. Ricavandolo dal tempo,
 * l'unico scarto possibile e' quello del prossimo ridisegno.
 *
 * `now` e' l'orologio comune della stanza, non `Date.now()`: chi partecipa lo
 * allinea su quello di chi ospita a ogni aggiornamento di stato, e senza quella
 * correzione un telefono con l'ora avanti di due secondi vedrebbe un prezzo
 * diverso da quello che pagherebbe davvero.
 */
export function useDutchPrice(state: GameState, now: () => number): DutchPrice {
  const attivo = isDutchLot(state);
  const opening = dutchOpening(state.config.budget);

  /*
   * Il numero che cambia serve solo a chiedere un altro disegno.
   *
   * Il prezzo non si tiene nello stato: sarebbe una seconda copia di un dato
   * che si sa gia' calcolare, e una copia si puo' disallineare da cio' che
   * copia. Qui l'unica fonte resta l'orologio.
   */
  const [, ridisegna] = useState(0);

  useEffect(() => {
    if (!attivo) return;
    const timer = setInterval(() => ridisegna((n) => n + 1), REFRESH_MS);
    return () => clearInterval(timer);
  }, [attivo]);

  const price = attivo ? dutchPriceAt(state, now()) : opening;
  const corsa = Math.max(1, opening - DUTCH_FLOOR);

  return {
    price,
    opening,
    floor: DUTCH_FLOOR,
    progress: Math.min(1, Math.max(0, (opening - price) / corsa)),
    atFloor: price <= DUTCH_FLOOR,
  };
}

/** Quanti secondi mancano alla fine della discesa. */
export function dutchSecondsLeft(state: GameState, now: number): number {
  if (!isDutchLot(state)) return 0;
  return Math.max(0, Math.ceil((state.deadline - now) / 1000));
}

/** Quanto dura la discesa, per le spiegazioni in interfaccia. */
export function dutchDuration(state: GameState): number {
  return lotSeconds(state);
}
