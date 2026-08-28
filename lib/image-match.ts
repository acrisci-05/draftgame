import { slugify } from "./utils";

/**
 * Filtro di pertinenza per le foto trovate online.
 *
 * Il titolo viene ridotto alla sua parte principale, togliendo il chiarimento fra
 * parentesi: "Up (film 2009)" diventa "Up". La foto è accettabile solo se quella
 * parte coincide col nome cercato oppure vi termina, come accade con i nomi di
 * persona ("Messi" trova "Lionel Messi").
 *
 * Così restano fuori i risultati che contengono il nome ma parlano d'altro:
 * "Upload" per "Up", "Snake River" per "Snake", "Hamburger" per "Smash Burger".
 */

function words(value: string): string[] {
  return slugify(value).split("-").filter(Boolean);
}

/** Toglie il chiarimento fra parentesi, che serve solo a disambiguare. */
function mainTitle(title: string): string {
  return title.replace(/\s*\([^)]*\)\s*/g, " ").trim();
}

function endsWith(target: string[], needle: string[]): boolean {
  if (needle.length > target.length) return false;
  const offset = target.length - needle.length;
  return needle.every((word, index) => target[offset + index] === word);
}

export function isRelevant(name: string, title: string): boolean {
  const target = words(mainTitle(title));
  const needle = words(name);
  if (needle.length === 0 || target.length === 0) return false;
  return endsWith(target, needle);
}
