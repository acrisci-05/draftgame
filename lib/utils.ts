import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { Tier } from "./types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ";

/** Codice stanza di 4 lettere, senza caratteri ambigui. */
export function roomCode(length = 4): string {
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

export function money(value: number): string {
  return `$${value}`;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export interface TierStyle {
  label: string;
  hex: string;
  chip: string;
  ring: string;
  text: string;
}

export const TIER_STYLES: Record<Tier, TierStyle> = {
  5: {
    label: "Top",
    hex: "#22c55e",
    chip: "bg-neon/15 text-neon border-neon/40",
    ring: "ring-neon/50",
    text: "text-neon",
  },
  4: {
    label: "Elite",
    hex: "#a855f7",
    chip: "bg-violet/15 text-violet border-violet/40",
    ring: "ring-violet/50",
    text: "text-violet",
  },
  3: {
    label: "Solid",
    hex: "#38bdf8",
    chip: "bg-sky-400/15 text-sky-300 border-sky-400/40",
    ring: "ring-sky-400/50",
    text: "text-sky-300",
  },
  2: {
    label: "Rotazione",
    hex: "#fbbf24",
    chip: "bg-amber-400/15 text-amber-300 border-amber-400/40",
    ring: "ring-amber-400/50",
    text: "text-amber-300",
  },
  1: {
    label: "Economy",
    hex: "#a1a1aa",
    chip: "bg-zinc-400/10 text-zinc-300 border-zinc-400/30",
    ring: "ring-zinc-400/40",
    text: "text-zinc-300",
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
