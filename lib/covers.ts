import type { CSSProperties } from "react";
import type { CatalogItem, RosterEntry } from "./types";
import { hashString, initials } from "./utils";

export interface CoverPalette {
  from: string;
  to: string;
  accent: string;
}

/** Palette deterministica: lo stesso elemento ha sempre la stessa cover. */
export function coverPalette(seed: string): CoverPalette {
  const hash = hashString(seed);
  const hue = hash % 360;
  const second = (hue + 35 + (hash % 70)) % 360;
  return {
    from: `hsl(${hue} 68% 26%)`,
    to: `hsl(${second} 72% 13%)`,
    accent: `hsl(${hue} 85% 62%)`,
  };
}

export function coverStyle(seed: string): CSSProperties {
  const palette = coverPalette(seed);
  return {
    backgroundImage: `linear-gradient(140deg, ${palette.from}, ${palette.to})`,
  };
}

export interface CoverContent {
  image?: string;
  emoji?: string;
  label: string;
  style: CSSProperties;
}

export function coverContent(source: CatalogItem | RosterEntry): CoverContent {
  const seed = "itemId" in source ? source.itemId : source.id;
  return {
    image: source.image,
    emoji: source.emoji,
    label: initials(source.name),
    style: coverStyle(seed + source.name),
  };
}
