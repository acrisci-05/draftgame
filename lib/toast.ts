"use client";

/**
 * Avvisi brevi in sovrimpressione.
 *
 * Stesso principio dei pannelli della navbar: chi vuole mostrare un avviso manda
 * un evento, e il contenitore montato nella barra in alto lo raccoglie. Così un
 * modale che si sta chiudendo può lasciare un messaggio a schermo senza dover
 * restare vivo per mostrarlo.
 */

export type ToastTone = "success" | "info" | "error";

export interface ToastMessage {
  /** Testo già tradotto: qui non si passa dal dizionario. */
  text: string;
  tone: ToastTone;
  /** Millisecondi a schermo. */
  duration: number;
}

const EVENT = "pp:toast";

export function showToast(text: string, tone: ToastTone = "success", duration = 4000) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<ToastMessage>(EVENT, { detail: { text, tone, duration } }),
  );
}

export function onToast(handler: (message: ToastMessage) => void): () => void {
  if (typeof window === "undefined") return () => {};
  const listener = (event: Event) => handler((event as CustomEvent<ToastMessage>).detail);
  window.addEventListener(EVENT, listener);
  return () => window.removeEventListener(EVENT, listener);
}
