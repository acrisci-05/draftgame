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
  /** Lettera del tier visivo: S, A, B, C, D. */
  letter: string;
  label: string;
  labelEn: string;
  hex: string;
  chip: string;
  text: string;
}

export const TIER_STYLES: Record<Tier, TierStyle> = {
  5: {
    letter: "S",
    label: "Top",
    labelEn: "Top",
    hex: "#22c55e",
    chip: "bg-neon/15 text-neon border-neon/40",
    text: "text-neon",
  },
  4: {
    letter: "A",
    label: "Elite",
    labelEn: "Elite",
    hex: "#a855f7",
    chip: "bg-violet/15 text-violet border-violet/40",
    text: "text-violet",
  },
  3: {
    letter: "B",
    label: "Solido",
    labelEn: "Solid",
    hex: "#38bdf8",
    chip: "bg-sky-400/15 text-sky-500 border-sky-400/40",
    text: "text-sky-500",
  },
  2: {
    letter: "C",
    label: "Rotazione",
    labelEn: "Rotation",
    hex: "#f59e0b",
    chip: "bg-amber-400/15 text-amber-500 border-amber-400/40",
    text: "text-amber-500",
  },
  1: {
    letter: "D",
    label: "Economy",
    labelEn: "Economy",
    hex: "#94a3b8",
    chip: "bg-slate-400/15 text-slate-400 border-slate-400/35",
    text: "text-slate-400",
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
