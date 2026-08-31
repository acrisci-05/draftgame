import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { CurrencyCode, Tier } from "./types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Alfabeto senza caratteri ambigui (niente 0/O, 1/I/L). */
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export const ROOM_CODE_LENGTH = 5;

/** Codice stanza di 5 caratteri fra lettere e numeri. */
export function roomCode(length = ROOM_CODE_LENGTH): string {
  let out = "";
  for (let i = 0; i < length; i += 1) {
    out += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return out;
}

/**
 * Un codice stanza ben formato.
 *
 * Serve a distinguere "stanza che non esiste" da "indirizzo scritto male": un
 * codice storto si riconosce subito, senza aspettare che la connessione vada in
 * timeout, e si puo' dire alla persona cos'e' successo.
 */
export function isRoomCode(value: string): boolean {
  const code = value.trim().toUpperCase();
  if (code.length !== ROOM_CODE_LENGTH) return false;
  return [...code].every((letter) => CODE_ALPHABET.includes(letter));
}

export function uid(prefix = "id"): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;
}

const DIACRITICS = new RegExp("[\\u0300-\\u036f]", "g");

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(DIACRITICS, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Hash stabile usato per generare colori e cover deterministiche. */
export function hashString(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash);
}

export function initials(value: string): string {
  const words = value.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

export const CURRENCY_SYMBOLS: Record<CurrencyCode, string> = {
  EUR: "€",
  USD: "$",
  GBP: "£",
  JPY: "¥",
};

export const CURRENCIES: CurrencyCode[] = ["EUR", "USD", "GBP", "JPY"];

export function currencySymbol(currency: CurrencyCode): string {
  return CURRENCY_SYMBOLS[currency];
}

export function money(amount: number, currency: CurrencyCode = "EUR"): string {
  return `${CURRENCY_SYMBOLS[currency]}${amount}`;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export interface TierStyle {
  label: string;
  labelEn: string;
  /** Il simbolo che si vede sulla carta in asta, prima ancora del nome. */
  badge: string;
  hex: string;
  chip: string;
  text: string;
  /** Bordo e alone della carta durante l'asta. */
  frame: string;
}

/**
 * Le fasce degli elementi.
 *
 * Servono a una cosa sola: far capire in un colpo d'occhio quanto vale la pena
 * spendere su questo lotto. **Non danno punti e non decidono chi vince** — a
 * dirlo sono i voti degli altri giocatori a fine partita. Un tier 5 pagato caro
 * non fa vincere nessuno da solo, e una rosa di soli tier 1 puo' benissimo
 * prendere piu' voti se sta in piedi meglio.
 *
 * La scala va dall'oro al verde: piu' e' pregiato, piu' e' caldo il colore.
 */
export const TIER_STYLES: Record<Tier, TierStyle> = {
  5: {
    label: "Top",
    labelEn: "Top",
    badge: "👑",
    hex: "#facc15",
    chip: "bg-gold/15 text-gold border-gold/40",
    text: "text-gold",
    frame: "border-gold/60 shadow-[0_0_28px_-6px_rgba(250,204,21,0.55)]",
  },
  4: {
    label: "Elite",
    labelEn: "Elite",
    badge: "🟣",
    hex: "#a855f7",
    chip: "bg-violet/15 text-violet border-violet/40",
    text: "text-violet",
    frame: "border-violet/60 shadow-[0_0_24px_-8px_rgba(168,85,247,0.5)]",
  },
  3: {
    label: "Standard",
    labelEn: "Standard",
    badge: "🔵",
    hex: "#38bdf8",
    chip: "bg-sky-400/15 text-sky-400 border-sky-400/40",
    text: "text-sky-400",
    frame: "border-sky-400/55",
  },
  2: {
    label: "Base",
    labelEn: "Base",
    badge: "🟢",
    hex: "#22c55e",
    chip: "bg-neon/15 text-neon border-neon/40",
    text: "text-neon",
    frame: "border-neon/50",
  },
  1: {
    label: "Base",
    labelEn: "Base",
    badge: "🟢",
    hex: "#22c55e",
    chip: "bg-neon/15 text-neon border-neon/40",
    text: "text-neon",
    frame: "border-neon/50",
  },
};

export const TIER_ORDER: Tier[] = [5, 4, 3, 2, 1];

export async function copyText(value: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    return false;
  }
}
