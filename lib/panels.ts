"use client";

/**
 * Apertura dei pannelli della navbar da qualsiasi punto del sito.
 *
 * I modali (regole, creatore, sostegno, account…) vivono dentro la navbar, che è
 * sempre montata: invece di passare funzioni di pagina in pagina, chi vuole
 * aprirne uno manda un evento e la navbar lo raccoglie.
 */

export type PanelName =
  | "rules"
  | "suggest"
  | "creator"
  | "support"
  | "language"
  | "rate"
  | "admin"
  | "account"
  /** Apre l'accesso gia' sulla scheda di registrazione. */
  | "register"
  /** "Perche' diventare un Picker?": i vantaggi del profilo. */
  | "picker"
  | "install";

const EVENT = "pp:panel";

export function openPanel(name: PanelName) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<PanelName>(EVENT, { detail: name }));
}

export function onPanelRequest(handler: (name: PanelName) => void): () => void {
  if (typeof window === "undefined") return () => {};
  const listener = (event: Event) => handler((event as CustomEvent<PanelName>).detail);
  window.addEventListener(EVENT, listener);
  return () => window.removeEventListener(EVENT, listener);
}
