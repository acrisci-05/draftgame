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
  process.env.NEXT_PUBLIC_INSTAGRAM_URL?.trim() || "https://instagram.com/pickandpay.game";

/** Base usata per i link di voto quando il browser non è disponibile (render server). */
export function siteOrigin(): string {
  if (typeof window !== "undefined") return window.location.origin;
  return SITE_URL;
}

export function voteUrlFor(resultId: string): string {
  return `${siteOrigin()}/vote/${resultId}`;
}
