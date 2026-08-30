/**
 * Il colore personale di ogni giocatore.
 *
 * Serve a riconoscersi al volo nella lista durante l'asta: l'avatar è piccolo,
 * il nome si accorcia, ma l'alone colorato si vede anche con la coda dell'occhio.
 * I valori sono classi Tailwind già scritte, non colori calcolati: così restano
 * nel foglio di stile compilato.
 */

export const PLAYER_COLORS = ["neon", "sky", "violet", "cyan", "gold"] as const;

export type PlayerColor = (typeof PLAYER_COLORS)[number];

export const DEFAULT_COLOR: PlayerColor = "neon";

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

const LOOKS: Record<PlayerColor, ColorLook> = {
  neon: {
    ring: "ring-2 ring-[#22c55e]",
    text: "text-[#22c55e]",
    soft: "bg-[#22c55e]/10 border-[#22c55e]/40",
    dot: "bg-[#22c55e]",
  },
  sky: {
    ring: "ring-2 ring-[#38bdf8]",
    text: "text-[#38bdf8]",
    soft: "bg-[#38bdf8]/10 border-[#38bdf8]/40",
    dot: "bg-[#38bdf8]",
  },
  violet: {
    ring: "ring-2 ring-[#a855f7]",
    text: "text-[#a855f7]",
    soft: "bg-[#a855f7]/10 border-[#a855f7]/40",
    dot: "bg-[#a855f7]",
  },
  cyan: {
    ring: "ring-2 ring-[#22d3ee]",
    text: "text-[#22d3ee]",
    soft: "bg-[#22d3ee]/10 border-[#22d3ee]/40",
    dot: "bg-[#22d3ee]",
  },
  gold: {
    ring: "ring-2 ring-[#f5b301]",
    text: "text-[#f5b301]",
    soft: "bg-[#f5b301]/10 border-[#f5b301]/40",
    dot: "bg-[#f5b301]",
  },
};

export function colorLook(color: string | undefined): ColorLook {
  return LOOKS[isPlayerColor(color ?? "") ? (color as PlayerColor) : DEFAULT_COLOR];
}
