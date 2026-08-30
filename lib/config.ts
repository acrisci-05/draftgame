import type { TranslationKey } from "./i18n/it";

/**
 * Costanti di configurazione del sito.
 * Dominio e profilo social sono segnaposto: sostituiscili con i tuoi valori reali
 * (oppure imposta NEXT_PUBLIC_SITE_URL in .env.local).
 */

export const APP_NAME = "Pick & Pay";
export const APP_TAGLINE = "The Draft Game";
export const APP_FULL_NAME = `${APP_NAME} - ${APP_TAGLINE}`;

const RAW_SITE_URL = process.env.NEXT_PUBLIC_SITE_URL?.trim();

/** Dominio mostrato nel footer della card e nei link di voto. */
export const SITE_URL = RAW_SITE_URL && RAW_SITE_URL.length > 0 ? RAW_SITE_URL : "https://pickandpay.app";

export const SITE_DOMAIN = SITE_URL.replace(/^https?:\/\//, "").replace(/\/$/, "");

export const INSTAGRAM_URL =
  process.env.NEXT_PUBLIC_INSTAGRAM_URL?.trim() || "https://www.instagram.com/acrisci05";

/** Profilo X e repository: lasciando vuota la variabile il collegamento sparisce. */
export const X_URL = process.env.NEXT_PUBLIC_X_URL?.trim() ?? "";
export const GITHUB_URL =
  process.env.NEXT_PUBLIC_GITHUB_URL?.trim() || "https://github.com/acrisci05/draftgame";
/** Ko-fi: se non c'è, il pulsante delle donazioni apre il pannello di sostegno interno. */
export const KOFI_URL = process.env.NEXT_PUBLIC_KOFI_URL?.trim() ?? "";

/* ---------------------------------------------------------------- */
/* Scheda del creatore                                               */
/* ---------------------------------------------------------------- */

export const CREATOR_NAME = "Antonio";

export const APP_VERSION = "1.1.0";

/** Ultime novità mostrate nella scheda del creatore, dalla più recente. */
export const CHANGELOG: { version: string; date: string; key: TranslationKey }[] = [
  { version: "1.1.0", date: "2026-08", key: "creator.log0" },
  { version: "1.0.0", date: "2026-08", key: "creator.log1" },
  { version: "0.9.0", date: "2026-08", key: "creator.log2" },
  { version: "0.8.0", date: "2026-08", key: "creator.log3" },
];

/** Base usata per i link di voto quando il browser non è disponibile (render server). */
export function siteOrigin(): string {
  if (typeof window !== "undefined") return window.location.origin;
  return SITE_URL;
}

export function voteUrlFor(resultId: string): string {
  return `${siteOrigin()}/vote/${resultId}`;
}
