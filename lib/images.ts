"use client";

import { useEffect, useState } from "react";
import { useSettings } from "./settings";
import type { CatalogItem, Locale, RosterEntry } from "./types";
import { isExactTitle, isRelevant } from "./image-match";

export { isExactTitle, isRelevant };

/**
 * Foto reali per gli elementi del catalogo.
 *
 * Ordine di risoluzione:
 * 1. `item.image`, se il creatore ha già salvato un URL;
 * 2. ricerca automatica su Wikipedia/Wikimedia (CORS aperto, foto pertinenti al nome);
 * 3. URL generico di Unsplash come ultima spiaggia;
 * 4. copertina con emoji, se anche l'immagine remota non carica.
 *
 * Le licenze Wikimedia variano: prima di pubblicare vanno verificate.
 */

const CACHE_KEY = "pp:item-images";
const memory = new Map<string, string | null>();

function cacheKey(name: string): string {
  return name.trim().toLowerCase();
}

function readCache(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, string>) : {};
  } catch {
    return {};
  }
}

function writeCache(name: string, url: string) {
  if (typeof window === "undefined") return;
  try {
    const cache = readCache();
    cache[cacheKey(name)] = url;
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    /* storage pieno: la cache resta solo in memoria */
  }
}

/** Ultima spiaggia: immagine generica per parola chiave. */
export function unsplashUrl(name: string): string {
  return `https://source.unsplash.com/featured/600x600/?${encodeURIComponent(name)}`;
}

/**
 * URL da usare subito per un elemento: quello salvato oppure la ricerca per parola chiave.
 * Per la foto pertinente conviene passare da `useItemImage`, che interroga Wikipedia.
 */
export function getItemImage(item: { name: string; image?: string }): string {
  const explicit = item.image?.trim();
  return explicit && explicit.length > 0 ? explicit : unsplashUrl(item.name);
}

interface WikiPage {
  title?: string;
  index?: number;
  description?: string;
  thumbnail?: { source?: string };
}

interface WikiResponse {
  query?: { pages?: Record<string, WikiPage> };
}

function endpoint(lang: string, query: string, limit: number): string {
  const params = new URLSearchParams({
    action: "query",
    generator: "search",
    gsrsearch: query,
    gsrlimit: String(limit),
    prop: "pageimages|description",
    piprop: "thumbnail",
    pithumbsize: "600",
    format: "json",
    origin: "*",
  });
  return `https://${lang}.wikipedia.org/w/api.php?${params.toString()}`;
}

export interface ImageCandidate {
  title: string;
  description?: string;
  url: string;
  /** true quando il titolo trovato corrisponde davvero al nome cercato. */
  relevant: boolean;
}

/** Elenco di foto candidate, in ordine di pertinenza. */
export async function searchImages(
  name: string,
  locale: Locale = "it",
  hint?: string,
  limit = 6,
): Promise<ImageCandidate[]> {
  const query = hint ? `${name} ${hint}` : name;
  const languages = locale === "en" ? ["en"] : [locale, "en"];
  const found: ImageCandidate[] = [];
  const seen = new Set<string>();

  for (const lang of languages) {
    try {
      const response = await fetch(endpoint(lang, query, limit));
      if (!response.ok) continue;
      const data = (await response.json()) as WikiResponse;
      const pages = data.query?.pages ? Object.values(data.query.pages) : [];

      pages
        .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
        .forEach((page) => {
          const url = page.thumbnail?.source;
          const title = page.title ?? "";
          if (!url || seen.has(url)) return;
          seen.add(url);
          found.push({
            title,
            description: page.description,
            url,
            relevant: isRelevant(name, title),
          });
        });

      if (found.some((candidate) => candidate.relevant)) break;
    } catch {
      /* offline o richiesta bloccata: si prova la lingua successiva */
    }
  }

  // Prima le corrispondenze piene, poi quelle per suffisso, infine il resto.
  return found.sort((a, b) => {
    const exact = Number(isExactTitle(name, b.title)) - Number(isExactTitle(name, a.title));
    return exact !== 0 ? exact : Number(b.relevant) - Number(a.relevant);
  });
}

/**
 * Foto automatica: si accetta solo un risultato pertinente.
 * Meglio la copertina con l'icona che una foto sbagliata.
 */
export async function findImage(
  name: string,
  locale: Locale = "it",
  hint?: string,
): Promise<string | null> {
  const key = `${locale}:${name.toLowerCase()}:${hint ?? ""}`;
  if (memory.has(key)) return memory.get(key) ?? null;

  const candidates = await searchImages(name, locale, hint, 6);
  const best = candidates.find((candidate) => candidate.relevant)?.url ?? null;
  memory.set(key, best);
  return best;
}

/**
 * Risolve e memorizza la foto di un elemento sul dispositivo.
 * Salva anche i buchi, per non ripetere ricerche inutili a ogni partita.
 */
export async function resolveItemImage(
  name: string,
  locale: Locale,
  hint?: string,
): Promise<string | null> {
  const stored = readCache()[cacheKey(name)];
  if (stored !== undefined) return stored.length > 0 ? stored : null;

  const found = await findImage(name, locale, hint);
  writeCache(name, found ?? "");
  return found;
}

export interface ItemImage {
  /** URL da passare al tag img, oppure null per mostrare la copertina con emoji. */
  src: string | null;
  /** Da collegare a onError: prova l'alternativa e poi ripiega sull'emoji. */
  onError: () => void;
}

/**
 * Foto di un elemento con ricerca automatica e ripiego progressivo.
 * `hint` (di solito il nome della categoria) rende la ricerca più precisa.
 */
export function useItemImage(
  item: CatalogItem | RosterEntry | null,
  hint?: string,
  enabled = true,
): ItemImage {
  const { locale } = useSettings();
  const name = item?.name ?? "";
  const explicit = item?.image?.trim() ?? "";
  const [found, setFound] = useState<string | null>(null);
  const [stage, setStage] = useState<"primary" | "generic" | "emoji">("primary");
  const [stageFor, setStageFor] = useState<string>("");

  useEffect(() => {
    if (!enabled || !name || explicit) return;
    let active = true;
    resolveItemImage(name, locale, hint).then((url) => {
      if (active) setFound(url);
    });
    return () => {
      active = false;
    };
  }, [name, explicit, locale, hint, enabled]);

  // Il livello di ripiego vale solo per l'elemento corrente.
  const currentStage = stageFor === name ? stage : "primary";
  const primary = explicit || found;

  let src: string | null = null;
  if (enabled) {
    if (currentStage === "primary") src = primary ?? null;
    else if (currentStage === "generic" && name) src = unsplashUrl(name);
  } else {
    src = explicit || null;
  }

  const onError = () => {
    setStageFor(name);
    setStage(currentStage === "primary" && !explicit ? "generic" : "emoji");
  };

  return { src, onError };
}

/** Ricerca in sequenza, con una pausa fra le chiamate per non martellare l'API. */
export async function findImages(
  names: string[],
  locale: Locale,
  hint: string | undefined,
  onResult: (name: string, url: string | null) => void,
): Promise<void> {
  for (const name of names) {
    const url = await findImage(name, locale, hint);
    onResult(name, url);
    await new Promise((resolve) => setTimeout(resolve, 120));
  }
}
