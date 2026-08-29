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

/**
 * Riduce il titolo alla sua parte identificativa: via il chiarimento fra parentesi
 * e via il sottotitolo dopo trattino o due punti, che su Wikipedia è frequente
 * ("Toy Story - Il mondo dei giocattoli" resta "Toy Story").
 * Il trattino attaccato alle parole non si tocca, per non spezzare "Spider-Man".
 */
function mainTitle(title: string): string {
  return title
    .replace(/\s*\([^)]*\)\s*/g, " ")
    .split(/\s+[-–—:]\s+|:\s+/)[0]
    .trim();
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

/**
 * Corrispondenza piena fra nome e titolo, senza parole in più.
 * Va preferita a quella per suffisso: cercando "Friends" si vuole la voce
 * "Friends" e non "Smiling Friends", mentre "Messi" ha solo "Lionel Messi".
 */
export function isExactTitle(name: string, title: string): boolean {
  const target = words(mainTitle(title));
  const needle = words(name);
  if (needle.length !== target.length) return false;
  return needle.every((word, index) => target[index] === word);
}
