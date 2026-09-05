"use client";

import { readSettings } from "./settings";

/**
 * Vibrazione breve sui dispositivi che la supportano. Silenziosa altrove.
 *
 * Segue l'interruttore del suono e non ne ha uno suo. Sono la stessa cosa vista
 * da due sensi diversi: chi mette il telefono in silenzioso in treno non vuole
 * nemmeno che gli tremi in mano, e due interruttori per una cosa sola sono due
 * posti dove cercarla.
 */
export function vibrate(pattern: number | number[] = HAPTIC_BID) {
  if (typeof navigator === "undefined") return;
  if (!readSettings().sound) return;
  const vibrator = navigator as Navigator & { vibrate?: (pattern: number | number[]) => boolean };
  try {
    vibrator.vibrate?.(pattern);
  } catch {
    /* alcuni browser bloccano la vibrazione senza interazione: si ignora */
  }
}

/*
 * Le tre durate.
 *
 * Il rilancio e' il gesto che si ripete di piu' -- decine di volte in una
 * partita -- e dieci millesimi bastano a sentirlo senza che la mano se ne
 * stanchi. Il flop e' una scelta che si prende una volta ogni tanto e si
 * rimpiange: trentacinque, il triplo, perche' deve restare addosso un istante
 * in piu'. La vittoria e' l'unica che si permette tre colpi.
 */
export const HAPTIC_BID = 10;
export const HAPTIC_PASS = 35;
export const HAPTIC_WIN = [24, 40, 24];

/*
 * Le due dell'asta al ribasso.
 *
 * Prendere e' un gesto solo, e va sentito piu' del rilancio: al ribasso si
 * preme una volta per lotto e quel tocco decide, mentre di rilanci ne partono
 * decine. Trenta millesimi -- il triplo del rilancio, meno di una rinuncia --
 * bastano a dire "e' partito" senza sembrare un allarme.
 *
 * Il flop e' l'unico caso in cui non ha premuto nessuno, e i tre colpi staccati
 * lo raccontano meglio di uno lungo: e' il tempo che finisce a vuoto, non una
 * cosa che e' successa.
 */
export const HAPTIC_TAKE = 30;
export const HAPTIC_FLOP = [50, 50, 50];
