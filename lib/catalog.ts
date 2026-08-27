import type { CatalogItem, Category, Tier } from "./types";
import { slugify, TIER_ORDER } from "./utils";

export const ITEMS_PER_TIER = 5;
export const ITEMS_PER_CATEGORY = ITEMS_PER_TIER * TIER_ORDER.length;

export type TierDraft = Record<Tier, string[]>;

export function emptyTierDraft(): TierDraft {
  return {
    5: Array(ITEMS_PER_TIER).fill(""),
    4: Array(ITEMS_PER_TIER).fill(""),
    3: Array(ITEMS_PER_TIER).fill(""),
    2: Array(ITEMS_PER_TIER).fill(""),
    1: Array(ITEMS_PER_TIER).fill(""),
  };
}

/** Trasforma le liste per fascia in elementi di catalogo con id stabili. */
export function buildItems(categoryId: string, tiers: TierDraft): CatalogItem[] {
  const items: CatalogItem[] = [];
  const seen = new Set<string>();
  TIER_ORDER.forEach((tier) => {
    tiers[tier]
      .map((name) => name.trim())
      .filter(Boolean)
      .forEach((name) => {
        let id = `${categoryId}-${slugify(name) || "item"}`;
        let suffix = 2;
        while (seen.has(id)) {
          id = `${categoryId}-${slugify(name) || "item"}-${suffix}`;
          suffix += 1;
        }
        seen.add(id);
        items.push({ id, name, tier });
      });
  });
  return items;
}

export function itemsToTierDraft(items: CatalogItem[]): TierDraft {
  const draft = emptyTierDraft();
  TIER_ORDER.forEach((tier) => {
    const names = items.filter((i) => i.tier === tier).map((i) => i.name);
    draft[tier] = Array.from(
      { length: Math.max(ITEMS_PER_TIER, names.length) },
      (_, index) => names[index] ?? "",
    );
  });
  return draft;
}

export function countByTier(items: CatalogItem[], tier: Tier): number {
  return items.filter((i) => i.tier === tier).length;
}

/** Una categoria è giocabile solo con 5 elementi per ciascuna delle 5 fasce. */
export function validateCategory(name: string, emoji: string, items: CatalogItem[]): string[] {
  const errors: string[] = [];
  if (!name.trim()) errors.push("Il nome della categoria è obbligatorio.");
  if (!emoji.trim()) errors.push("Scegli un'icona o un'emoji.");
  TIER_ORDER.forEach((tier) => {
    const count = countByTier(items, tier);
    if (count !== ITEMS_PER_TIER) {
      errors.push(`Tier $${tier}: servono ${ITEMS_PER_TIER} elementi (ora ${count}).`);
    }
  });
  return errors;
}

function builtin(id: string, name: string, emoji: string, tiers: TierDraft): Category {
  return { id, name, emoji, items: buildItems(id, tiers), source: "builtin" };
}

export const BUILTIN_CATEGORIES: Category[] = [
  builtin("calcio", "Leggende del Calcio", "⚽", {
    5: ["Messi", "Cristiano Ronaldo", "Maradona", "Pelé", "Ronaldo il Fenomeno"],
    4: ["Zidane", "Ronaldinho", "Cruyff", "Del Piero", "Roberto Baggio"],
    3: ["Totti", "Kaká", "Buffon", "Beckham", "Thierry Henry"],
    2: ["Pirlo", "Nedved", "Sneijder", "Eto'o", "Drogba"],
    1: ["Luca Toni", "Gattuso", "Materazzi", "Zambrotta", "Pazzini"],
  }),
  builtin("film", "Film Cult", "🎬", {
    5: ["Il Padrino", "Pulp Fiction", "Il Signore degli Anelli", "Matrix", "Interstellar"],
    4: ["Fight Club", "Inception", "Il Cavaliere Oscuro", "Forrest Gump", "Titanic"],
    3: ["Jurassic Park", "Ritorno al Futuro", "Il Gladiatore", "Shining", "Alien"],
    2: ["Rocky", "Mad Max: Fury Road", "Il Grande Lebowski", "Scarface", "Blade Runner"],
    1: ["Sharknado", "Space Jam", "Twilight", "Piranha 3D", "The Room"],
  }),
  builtin("supereroi", "Supereroi", "🦸", {
    5: ["Superman", "Batman", "Spider-Man", "Hulk", "Thor"],
    4: ["Iron Man", "Wolverine", "Capitan America", "Doctor Strange", "Flash"],
    3: ["Black Panther", "Wonder Woman", "Deadpool", "Venom", "Scarlet Witch"],
    2: ["Ant-Man", "Aquaman", "Occhio di Falco", "Vedova Nera", "Silver Surfer"],
    1: ["Robin", "Howard il Papero", "Squirrel Girl", "Matter-Eater Lad", "Arm-Fall-Off-Boy"],
  }),
  builtin("cibo", "Cibo Italiano", "🍕", {
    5: ["Pizza Margherita", "Carbonara", "Lasagna", "Tiramisù", "Parmigiana"],
    4: ["Amatriciana", "Risotto allo Zafferano", "Cacio e Pepe", "Ragù alla Bolognese", "Arancino"],
    3: ["Pesto alla Genovese", "Focaccia", "Gnocchi", "Cannolo", "Porchetta"],
    2: ["Bruschetta", "Piadina", "Supplì", "Caponata", "Panzanella"],
    1: ["Insalata di riso", "Wurstel e patatine", "Sofficini", "Panino da autogrill", "Ananas sulla pizza"],
  }),
  builtin("videogiochi", "Videogiochi", "🎮", {
    5: ["Minecraft", "GTA V", "Zelda: Breath of the Wild", "Super Mario Bros", "Fortnite"],
    4: ["The Witcher 3", "Elden Ring", "Call of Duty", "Red Dead Redemption 2", "God of War"],
    3: ["Skyrim", "Among Us", "Rocket League", "Dark Souls", "Pokémon Rosso"],
    2: ["Tetris", "Crash Bandicoot", "Pac-Man", "Angry Birds", "Subway Surfers"],
    1: ["Flappy Bird", "Snake", "Solitario", "Campo Minato", "Pong"],
  }),
  builtin("rap", "Rap Italiano", "🎤", {
    5: ["Marracash", "Sfera Ebbasta", "Fabri Fibra", "Salmo", "Lazza"],
    4: ["Ghali", "Guè", "Tedua", "Capo Plaza", "Geolier"],
    3: ["Ernia", "Rkomi", "Shiva", "Paky", "Nayt"],
    2: ["Jake La Furia", "Emis Killa", "Clementino", "Rocco Hunt", "Gemitaiz"],
    1: ["Bello Figo", "Il Pagante", "DJ Matrix", "Fred De Palma", "Gionnyscandal"],
  }),
];

export function findBuiltin(id: string): Category | undefined {
  return BUILTIN_CATEGORIES.find((c) => c.id === id);
}

export const DEFAULT_CATEGORY = BUILTIN_CATEGORIES[0];
