import type { TranslationKey } from "./i18n/it";

/**
 * Gli otto colori dei giocatori.
 *
 * Uno per posto al tavolo: con otto persone in stanza servono otto tinte che si
 * distinguano a colpo d'occhio su uno schermo di telefono, anche viste di
 * sfuggita durante un rilancio. Sono tutte a tinta piena e ben separate sulla
 * ruota dei colori — niente due azzurri vicini, niente grigi: un colore poco
 * saturo su fondo scuro non legge come "questo giocatore", legge come
 * "elemento spento".
 *
 * Il colore vale per la singola partita: si sceglie in lobby, viaggia nello
 * stato del gioco e non viene conservato sul profilo. Chi ne ha già preso uno
 * lo toglie dal tavolo agli altri.
 */

export const PLAYER_COLORS = [
  "cyan",
  "purple",
  "emerald",
  "amber",
  "pink",
  "red",
  "orange",
  "indigo",
] as const;

export type PlayerColor = (typeof PLAYER_COLORS)[number];

export const DEFAULT_COLOR: PlayerColor = "cyan";

export function isPlayerColor(value: string): value is PlayerColor {
  return (PLAYER_COLORS as readonly string[]).includes(value);
}

/** Il primo colore libero, per non ritrovarsi due aloni uguali. */
export function firstFreeColor(taken: readonly string[]): PlayerColor {
  return PLAYER_COLORS.find((color) => !taken.includes(color)) ?? DEFAULT_COLOR;
}

/** L'etichetta da leggere, per chi naviga con lo schermo letto ad alta voce. */
export function colorLabel(color: PlayerColor): TranslationKey {
  return `color.${color}` as TranslationKey;
}

interface ColorLook {
  /** Anello attorno all'avatar. */
  ring: string;
  /** Testo del nome. */
  text: string;
  /** Sfondo tenue della riga. */
  soft: string;
  /** Pastiglia piena, per il selettore. */
  dot: string;
}

/*
 * Le classi sono scritte per esteso, una per una: Tailwind le cerca nel codice
 * cosi' come sono. Costruirle con un template (`ring-[${hex}]`) le renderebbe
 * invisibili al compilatore, e i colori non uscirebbero affatto.
 */
const LOOKS: Record<PlayerColor, ColorLook> = {
  cyan: {
    ring: "ring-2 ring-[#22d3ee]",
    text: "text-[#22d3ee]",
    soft: "bg-[#22d3ee]/10 border-[#22d3ee]/40",
    dot: "bg-[#22d3ee]",
  },
  purple: {
    ring: "ring-2 ring-[#a855f7]",
    text: "text-[#a855f7]",
    soft: "bg-[#a855f7]/10 border-[#a855f7]/40",
    dot: "bg-[#a855f7]",
  },
  emerald: {
    ring: "ring-2 ring-[#22c55e]",
    text: "text-[#22c55e]",
    soft: "bg-[#22c55e]/10 border-[#22c55e]/40",
    dot: "bg-[#22c55e]",
  },
  amber: {
    ring: "ring-2 ring-[#f59e0b]",
    text: "text-[#f59e0b]",
    soft: "bg-[#f59e0b]/10 border-[#f59e0b]/40",
    dot: "bg-[#f59e0b]",
  },
  pink: {
    ring: "ring-2 ring-[#f472b6]",
    text: "text-[#f472b6]",
    soft: "bg-[#f472b6]/10 border-[#f472b6]/40",
    dot: "bg-[#f472b6]",
  },
  red: {
    ring: "ring-2 ring-[#ef4444]",
    text: "text-[#ef4444]",
    soft: "bg-[#ef4444]/10 border-[#ef4444]/40",
    dot: "bg-[#ef4444]",
  },
  orange: {
    ring: "ring-2 ring-[#fb923c]",
    text: "text-[#fb923c]",
    soft: "bg-[#fb923c]/10 border-[#fb923c]/40",
    dot: "bg-[#fb923c]",
  },
  indigo: {
    ring: "ring-2 ring-[#818cf8]",
    text: "text-[#818cf8]",
    soft: "bg-[#818cf8]/10 border-[#818cf8]/40",
    dot: "bg-[#818cf8]",
  },
};

export function colorLook(color: string | undefined): ColorLook {
  return LOOKS[isPlayerColor(color ?? "") ? (color as PlayerColor) : DEFAULT_COLOR];
}
