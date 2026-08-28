"use client";

import type { Locale } from "./types";

/**
 * Ricerca di una foto reale per un elemento del catalogo.
 * Usa l'API pubblica di Wikipedia (CORS aperto) e restituisce la miniatura
 * ospitata su upload.wikimedia.org, che si lascia esportare nella card PNG.
 *
 * Le immagini di Wikimedia hanno licenze diverse: prima di pubblicare
 * controlla licenza e attribuzione della singola foto.
 */

const cache = new Map<string, string | null>();

interface WikiPage {
  thumbnail?: { source?: string };
}

interface WikiResponse {
  query?: { pages?: Record<string, WikiPage> };
}

function endpoint(lang: string, query: string): string {
  const params = new URLSearchParams({
    action: "query",
    generator: "search",
    gsrsearch: query,
    gsrlimit: "1",
    prop: "pageimages",
    piprop: "thumbnail",
    pithumbsize: "480",
    format: "json",
    origin: "*",
  });
  return `https://${lang}.wikipedia.org/w/api.php?${params.toString()}`;
}

/** Restituisce l'URL della miniatura oppure null se non c'è nulla di adatto. */
export async function findImage(
  name: string,
  locale: Locale = "it",
  hint?: string,
): Promise<string | null> {
  const query = hint ? `${name} ${hint}` : name;
  const key = `${locale}:${query}`;
  if (cache.has(key)) return cache.get(key) ?? null;

  const languages = locale === "en" ? ["en"] : [locale, "en"];
  for (const lang of languages) {
    try {
      const response = await fetch(endpoint(lang, query));
      if (!response.ok) continue;
      const data = (await response.json()) as WikiResponse;
      const pages = data.query?.pages ? Object.values(data.query.pages) : [];
      const source = pages.find((page) => page.thumbnail?.source)?.thumbnail?.source;
      if (source) {
        cache.set(key, source);
        return source;
      }
    } catch {
      /* offline o richiesta bloccata: si prova la lingua successiva */
    }
  }

  cache.set(key, null);
  return null;
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
