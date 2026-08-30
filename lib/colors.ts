/**
 * Il colore personale di ogni giocatore.
 *
 * Serve a riconoscersi al volo nella lista durante l'asta: l'avatar è piccolo,
 * il nome si accorcia, ma l'alone colorato si vede anche con la coda dell'occhio.
 *
 * Sono otto, quanti sono i giocatori al massimo: così in una stanza piena
 * nessuno resta senza il proprio. Sono scelti a distanza sulla ruota dei colori
 * — verde, azzurro, viola, rosa, rosso, arancio, oro, argento — perché due
 * tinte vicine, viste piccole e in movimento, si confondono.
 *
 * I valori sono classi Tailwind già scritte, non colori calcolati: così restano
 * nel foglio di stile compilato.
 */

export const PLAYER_COLORS = [
  "green",
  "blue",
  "purple",
  "pink",
  "red",
  "orange",
  "gold",
  "silver",
] as const;

export type PlayerColor = (typeof PLAYER_COLORS)[number];

export const DEFAULT_COLOR: PlayerColor = "green";

export function isPlayerColor(value: string): value is PlayerColor {
  return (PLAYER_COLORS as readonly string[]).includes(value);
}

/** Il primo colore libero, per non ritrovarsi due aloni uguali. */
export function firstFreeColor(taken: readonly string[]): PlayerColor {
  return PLAYER_COLORS.find((color) => !taken.includes(color)) ?? DEFAULT_COLOR;
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
  green: {
    ring: "ring-2 ring-[#22c55e]",
    text: "text-[#22c55e]",
    soft: "bg-[#22c55e]/10 border-[#22c55e]/40",
    dot: "bg-[#22c55e]",
  },
  blue: {
    ring: "ring-2 ring-[#38bdf8]",
    text: "text-[#38bdf8]",
    soft: "bg-[#38bdf8]/10 border-[#38bdf8]/40",
    dot: "bg-[#38bdf8]",
  },
  purple: {
    ring: "ring-2 ring-[#a855f7]",
    text: "text-[#a855f7]",
    soft: "bg-[#a855f7]/10 border-[#a855f7]/40",
    dot: "bg-[#a855f7]",
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
  gold: {
    ring: "ring-2 ring-[#facc15]",
    text: "text-[#facc15]",
    soft: "bg-[#facc15]/10 border-[#facc15]/40",
    dot: "bg-[#facc15]",
  },
  silver: {
    ring: "ring-2 ring-[#cbd5e1]",
    text: "text-[#cbd5e1]",
    soft: "bg-[#cbd5e1]/10 border-[#cbd5e1]/40",
    dot: "bg-[#cbd5e1]",
  },
};

export function colorLook(color: string | undefined): ColorLook {
  return LOOKS[isPlayerColor(color ?? "") ? (color as PlayerColor) : DEFAULT_COLOR];
}
