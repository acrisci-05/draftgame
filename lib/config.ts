import type { TranslationKey } from "./i18n/it";

/**
 * Costanti di configurazione del sito.
 * Il profilo social e' un segnaposto: sostituiscilo col tuo valore reale.
 */

export const APP_NAME = "Pick & Pay";
export const APP_TAGLINE = "The Draft Game";
export const APP_FULL_NAME = `${APP_NAME} - ${APP_TAGLINE}`;

const RAW_SITE_URL = process.env.NEXT_PUBLIC_SITE_URL?.trim();

/**
 * Dominio mostrato nel footer della card, nei link di voto e nell'anteprima
 * social dei link di stanza.
 *
 * Il ripiego e' l'indirizzo dove il sito sta davvero, non un segnaposto: da qui
 * esce anche l'indirizzo assoluto dell'immagine di anteprima, e un dominio che
 * non risponde vuol dire link condivisi senza figura su WhatsApp e Telegram --
 * cioe' il posto da cui arriva quasi tutto l'invito a giocare. Con
 * NEXT_PUBLIC_SITE_URL impostata comanda quella: serve il giorno in cui il sito
 * cambia indirizzo.
 */
export const SITE_URL =
  RAW_SITE_URL && RAW_SITE_URL.length > 0 ? RAW_SITE_URL : "https://pickandpaygame.vercel.app";

export const SITE_DOMAIN = SITE_URL.replace(/^https?:\/\//, "").replace(/\/$/, "");

/**
 * Indirizzo pubblico da passare agli altri: QR e "copia link" del menu.
 *
 * Non usa l'origine del browser come i link di voto: quelli devono restare sul
 * server dove si sta giocando, questo invece finisce in una storia o in una
 * chat e da li' deve funzionare per chiunque -- da `localhost` non ci arriva
 * nessuno. Se `NEXT_PUBLIC_SITE_URL` e' impostata comanda quella.
 */
export const SHARE_URL =
  RAW_SITE_URL && RAW_SITE_URL.length > 0 ? RAW_SITE_URL : "https://pickandpaygame.vercel.app";

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

export const APP_VERSION = "1.4.0";

/**
 * Ultime novità mostrate nella scheda del creatore, dalla più recente.
 *
 * La riga sola bastava finché una versione portava una cosa. Quando ne porta
 * sei, la riga diventa un elenco separato da virgole che non si legge: da qui
 * una versione può avere un titolo e sotto i suoi punti.
 */
export const CHANGELOG: {
  version: string;
  date: string;
  key: TranslationKey;
  /** I punti sotto il titolo. Le versioni vecchie non ne hanno. */
  highlights?: TranslationKey[];
}[] = [
  {
    version: "1.4.0",
    date: "2026-09",
    key: "creator.log11",
    highlights: [
      "creator.log11a",
      "creator.log11b",
      "creator.log11c",
      "creator.log11d",
      "creator.log11e",
    ],
  },
  {
    version: "1.3.0",
    date: "2026-09",
    key: "creator.log10",
    highlights: [
      "creator.log10a",
      "creator.log10b",
      "creator.log10c",
      "creator.log10d",
      "creator.log10e",
    ],
  },
  {
    version: "1.2.0",
    date: "2026-09",
    key: "creator.log00",
    highlights: [
      "creator.log000",
      "creator.log00a",
      "creator.log00b",
      "creator.log00c",
      "creator.log00d",
      "creator.log00e",
      "creator.log00f",
    ],
  },
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
