import rawCategories from "@/data/categories.json";
import type { CatalogItem, Category, CategoryTheme, Locale, Tier } from "./types";
import { slugify, TIER_ORDER } from "./utils";

/** Le liste ufficiali hanno 30 elementi: 6 per ciascuna delle 5 fasce. */
export const ITEMS_PER_TIER = 6;
export const ITEMS_PER_CATEGORY = ITEMS_PER_TIER * TIER_ORDER.length;

/** Riga dell'editor: nome corto, emoji di copertina e immagine facoltativa. */
export interface DraftItem {
  name: string;
  emoji: string;
  image: string;
}

export type TierDraft = Record<Tier, DraftItem[]>;

function emptyRows(): DraftItem[] {
  return Array.from({ length: ITEMS_PER_TIER }, () => ({ name: "", emoji: "", image: "" }));
}

export function emptyTierDraft(): TierDraft {
  return { 5: emptyRows(), 4: emptyRows(), 3: emptyRows(), 2: emptyRows(), 1: emptyRows() };
}

/** Trasforma le liste per fascia in elementi di catalogo con id stabili. */
export function buildItems(categoryId: string, tiers: TierDraft): CatalogItem[] {
  const items: CatalogItem[] = [];
  const seen = new Set<string>();
  TIER_ORDER.forEach((tier) => {
    tiers[tier]
      .map((row) => ({
        name: row.name.trim(),
        emoji: row.emoji.trim(),
        image: row.image.trim(),
      }))
      .filter((row) => row.name.length > 0)
      .forEach(({ name, emoji, image }) => {
        const base = `${categoryId}-${slugify(name) || "item"}`;
        let id = base;
        let suffix = 2;
        while (seen.has(id)) {
          id = `${base}-${suffix}`;
          suffix += 1;
        }
        seen.add(id);
        items.push({
          id,
          name,
          tier,
          emoji: emoji || undefined,
          image: image || undefined,
        });
      });
  });
  return items;
}

export function itemsToTierDraft(items: CatalogItem[]): TierDraft {
  const draft = emptyTierDraft();
  TIER_ORDER.forEach((tier) => {
    const rows = items
      .filter((i) => i.tier === tier)
      .map((i) => ({ name: i.name, emoji: i.emoji ?? "", image: i.image ?? "" }));
    draft[tier] = Array.from(
      { length: Math.max(ITEMS_PER_TIER, rows.length) },
      (_, index) => rows[index] ?? { name: "", emoji: "", image: "" },
    );
  });
  return draft;
}

export function countByTier(items: CatalogItem[], tier: Tier): number {
  return items.filter((i) => i.tier === tier).length;
}

export interface CategoryIssue {
  key: "name" | "emoji" | "tier";
  tier?: Tier;
  count?: number;
}

/**
 * Una categoria è giocabile quando ogni fascia ha lo stesso numero di elementi.
 * Le liste fatte nell'editor ne hanno sei per fascia (trenta in tutto); le
 * ufficiali possono averne meno quando il numero lo detta l'argomento — le
 * regioni italiane sono venti e non diventano trenta per far quadrare un
 * formato.
 */
export function validateCategory(
  name: string,
  emoji: string,
  items: CatalogItem[],
  perTier: number = ITEMS_PER_TIER,
): CategoryIssue[] {
  const issues: CategoryIssue[] = [];
  if (!name.trim()) issues.push({ key: "name" });
  if (!emoji.trim()) issues.push({ key: "emoji" });
  TIER_ORDER.forEach((tier) => {
    const count = countByTier(items, tier);
    if (count !== perTier) issues.push({ key: "tier", tier, count });
  });
  return issues;
}

/** Le liste ufficiali hanno il nome italiano e quello inglese: l'inglese copre le altre lingue. */
export function categoryName(
  category: { name: string; nameEn?: string },
  locale: Locale,
): string {
  return locale !== "it" && category.nameEn ? category.nameEn : category.name;
}

/* ------------------------------------------------------------------ */
/* Liste ufficiali                                                     */
/* ------------------------------------------------------------------ */

/**
 * Forma dei dati in `data/categories.json`: ogni fascia contiene sei coppie
 * [nome, emoji] e, se serve, un terzo valore con l'URL dell'immagine.
 * È il file da modificare per aggiungere o correggere le liste ufficiali.
 */
export interface RawCategory {
  id: string;
  name: string;
  nameEn?: string;
  emoji: string;
  theme?: CategoryTheme;
  tiers: Record<string, [string, string?, string?][]>;
}

export function fromRawCategory(raw: RawCategory): Category {
  const draft = emptyTierDraft();
  TIER_ORDER.forEach((tier) => {
    const rows = raw.tiers[String(tier)] ?? [];
    draft[tier] = rows.map(([name, emoji, image]) => ({
      name,
      emoji: emoji ?? "",
      image: image ?? "",
    }));
  });
  return {
    id: raw.id,
    name: raw.name,
    nameEn: raw.nameEn,
    emoji: raw.emoji,
    theme: raw.theme,
    items: buildItems(raw.id, draft),
    source: "official",
  };
}

/** Converte una categoria nel formato del file dati, pronta da incollare. */
export function toRawCategory(category: Category): RawCategory {
  const tiers: RawCategory["tiers"] = {};
  TIER_ORDER.forEach((tier) => {
    tiers[String(tier)] = category.items
      .filter((item) => item.tier === tier)
      .map((item) =>
        item.image
          ? ([item.name, item.emoji ?? "", item.image] as [string, string, string])
          : ([item.name, item.emoji ?? ""] as [string, string]),
      );
  });
  return {
    id: category.id,
    name: category.name,
    nameEn: category.nameEn,
    emoji: category.emoji,
    theme: category.theme,
    tiers,
  };
}

export const OFFICIAL_CATEGORIES: Category[] = (
  rawCategories as unknown as RawCategory[]
).map(fromRawCategory);

export function findOfficial(id: string): Category | undefined {
  return OFFICIAL_CATEGORIES.find((c) => c.id === id);
}

export const DEFAULT_CATEGORY = OFFICIAL_CATEGORIES[0];
