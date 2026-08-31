/**
 * Quando chiedere un voto sull'app, e quando tacere.
 *
 * Il momento giusto è subito dopo una partita finita bene, non all'apertura
 * del sito: chi ha appena vinto o riso con gli amici è disposto a spendere
 * cinque secondi, chi sta ancora cercando una stanza no.
 *
 * Le regole sono tre, e servono tutte a non diventare molesti:
 * - dopo almeno tre partite, perché prima non si ha un'opinione;
 * - una volta sola, se il voto è stato dato;
 * - non prima di trenta giorni dall'ultima volta che si è chiesto.
 *
 * Il conto sta sul dispositivo e non sul profilo: vale anche per chi gioca da
 * ospite, e a nessuno interessa sapere quante partite ha fatto un altro.
 */

const MATCHES_KEY = "pp:matches-done";
const RATED_KEY = "pp:rated";
const PROMPTED_KEY = "pp:rate-asked";

/** Partite da finire prima di poter chiedere. */
export const MATCHES_BEFORE_ASKING = 3;
/** Giorni di silenzio fra una richiesta e l'altra. */
export const DAYS_BETWEEN_ASKS = 30;

const DAY_MS = 24 * 60 * 60 * 1000;

function readNumber(key: string): number {
  if (typeof window === "undefined") return 0;
  try {
    return Number(window.localStorage.getItem(key)) || 0;
  } catch {
    return 0;
  }
}

function write(key: string, value: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* senza memoria si chiede una volta di troppo: meglio che rompersi */
  }
}

/** Quante partite sono state portate a termine su questo dispositivo. */
export function matchesCompleted(): number {
  return readNumber(MATCHES_KEY);
}

/** Da chiamare una volta per partita finita. */
export function countMatch(): void {
  write(MATCHES_KEY, String(matchesCompleted() + 1));
}

/** true se il voto è già stato dato, o se è stato chiesto di non chiedere più. */
export function hasRated(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(RATED_KEY) !== null;
  } catch {
    return true;
  }
}

/** Il voto è arrivato, oppure la persona ha detto di non voler più sentirne. */
export function markRated(): void {
  write(RATED_KEY, new Date().toISOString());
}

/** Si è chiesto adesso: da qui parte l'attesa. */
export function markPrompted(): void {
  write(PROMPTED_KEY, String(Date.now()));
}

/**
 * Se è il momento di chiedere.
 *
 * `now` si passa per poter provare la regola dei trenta giorni senza aspettare
 * trenta giorni.
 */
export function shouldAskRating(now = Date.now()): boolean {
  if (typeof window === "undefined") return false;
  if (hasRated()) return false;
  if (matchesCompleted() < MATCHES_BEFORE_ASKING) return false;

  const ultima = readNumber(PROMPTED_KEY);
  if (ultima === 0) return true;
  return now - ultima >= DAYS_BETWEEN_ASKS * DAY_MS;
}
