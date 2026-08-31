"use client";

import { OFFICIAL_CATEGORIES, findOfficial } from "./catalog";
import { notifyClientStore } from "./client-store";
import { remoteCategories } from "./remote-lists";
import type { Category, Profile, RoomConfig, RoomSession } from "./types";
import { randomAvatar } from "./avatars";
import { DEFAULT_CONFIG } from "./game";
import { uid } from "./utils";

const CATEGORIES_KEY = "pp:categories";
const PROFILE_KEY = "pp:profile";
const CONFIG_KEY = "pp:config";
const OVERRIDES_KEY = "pp:overrides";
const SESSION_PREFIX = "pp:session:";
const VOTE_PREFIX = "pp:vote:";

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* quota o storage non disponibile: la partita resta comunque giocabile */
  }
  notifyClientStore();
}

/* ---------------------------------------------------------------- */
/* Profilo giocatore                                                 */
/* ---------------------------------------------------------------- */

/** Lettura pura: restituisce null finché il profilo non è stato creato. */
export function readProfile(): Profile | null {
  return read<Profile | null>(PROFILE_KEY, null);
}

/** Crea e salva il profilo se manca. Da usare nei gestori di evento, non in render. */
export function ensureProfile(): Profile {
  const stored = readProfile();
  if (stored?.id) return stored;
  const profile: Profile = {
    id: uid("p"),
    name: "",
    emoji: randomAvatar(),
  };
  write(PROFILE_KEY, profile);
  return profile;
}

export function saveProfile(profile: Profile) {
  write(PROFILE_KEY, profile);
}

/* ---------------------------------------------------------------- */
/* Ultime regole usate                                               */
/* ---------------------------------------------------------------- */

export function readConfig(): RoomConfig {
  return { ...DEFAULT_CONFIG, ...read<Partial<RoomConfig>>(CONFIG_KEY, {}) };
}

export function saveConfig(config: RoomConfig) {
  write(CONFIG_KEY, config);
}

/* ---------------------------------------------------------------- */
/* Categorie personalizzate                                          */
/* ---------------------------------------------------------------- */

export function listCustomCategories(): Category[] {
  return read<Category[]>(CATEGORIES_KEY, []);
}

export function saveCustomCategory(category: Category): Category[] {
  const all = listCustomCategories();
  const index = all.findIndex((c) => c.id === category.id);
  const next =
    index >= 0 ? all.map((c) => (c.id === category.id ? category : c)) : [...all, category];
  write(CATEGORIES_KEY, next);
  return next;
}

export function deleteCustomCategory(id: string): Category[] {
  const next = listCustomCategories().filter((c) => c.id !== id);
  write(CATEGORIES_KEY, next);
  return next;
}

/* ---------------------------------------------------------------- */
/* Modifiche locali alle liste ufficiali (Studio)                    */
/* ---------------------------------------------------------------- */

export function readOverrides(): Record<string, Category> {
  return read<Record<string, Category>>(OVERRIDES_KEY, {});
}

export function saveOverride(category: Category) {
  write(OVERRIDES_KEY, { ...readOverrides(), [category.id]: category });
}

export function removeOverride(id: string) {
  const next = { ...readOverrides() };
  delete next[id];
  write(OVERRIDES_KEY, next);
}

export function isOverridden(id: string): boolean {
  return id in readOverrides();
}

/**
 * Liste ufficiali: quelle incluse nel codice, aggiornate da quelle pubblicate sul
 * database e infine dalle modifiche locali fatte nello Studio.
 */
export function officialCategories(): Category[] {
  const overrides = readOverrides();
  const merged = new Map<string, Category>();
  OFFICIAL_CATEGORIES.forEach((category) => merged.set(category.id, category));
  remoteCategories().forEach((category) => merged.set(category.id, category));
  return [...merged.values()].map((category) => overrides[category.id] ?? category);
}

export function allCategories(): Category[] {
  return [...officialCategories(), ...listCustomCategories()];
}

export function getCategory(id: string): Category | undefined {
  const override = readOverrides()[id];
  if (override) return override;
  return findOfficial(id) ?? listCustomCategories().find((c) => c.id === id);
}

/* ---------------------------------------------------------------- */
/* Sessione di stanza                                                */
/* ---------------------------------------------------------------- */

export function getSession(code: string): RoomSession | null {
  return read<RoomSession | null>(SESSION_PREFIX + code, null);
}

export function saveSession(session: RoomSession) {
  // L'orario di ingresso si segna qui, cosi' nessuno se lo dimentica: serve a
  // sapere se la stanza vale ancora la pena di essere riproposta.
  write(SESSION_PREFIX + session.code, { openedAt: Date.now(), ...session });
}

export function clearSession(code: string) {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(SESSION_PREFIX + code);
  notifyClientStore();
}

/**
 * Codice dell'ultima stanza online aperta su questo dispositivo: è quello che si
 * propone quando si vuole sfidare un Pickmate.
 */
export function lastOnlineRoomCode(): string | null {
  if (typeof window === "undefined") return null;
  let latest: RoomSession | null = null;
  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index);
    if (!key?.startsWith(SESSION_PREFIX)) continue;
    const session = read<RoomSession | null>(key, null);
    if (session?.mode === "online") latest = session;
  }
  return latest?.code ?? null;
}

/* ---------------------------------------------------------------- */
/* Voti e suggerimenti senza database                                */
/* ---------------------------------------------------------------- */

const FEEDBACK_KEY = "pp:feedback";
const SUGGESTIONS_KEY = "pp:suggestions";

export interface LocalFeedback {
  stars: number;
  comment: string;
  at: string;
}

export interface LocalSuggestion {
  name: string;
  idea: string;
  at: string;
}

/** Senza database il voto resta qui: lo si potrà inviare quando il database c'è. */
export function saveLocalFeedback(stars: number, comment: string) {
  write(FEEDBACK_KEY, { stars, comment, at: new Date().toISOString() } satisfies LocalFeedback);
}

export function readLocalFeedback(): LocalFeedback | null {
  return read<LocalFeedback | null>(FEEDBACK_KEY, null);
}

export function saveLocalSuggestion(name: string, idea: string) {
  const all = read<LocalSuggestion[]>(SUGGESTIONS_KEY, []);
  write(SUGGESTIONS_KEY, [...all, { name, idea, at: new Date().toISOString() }].slice(-50));
}

export function readLocalSuggestions(): LocalSuggestion[] {
  return read<LocalSuggestion[]>(SUGGESTIONS_KEY, []);
}

/* ---------------------------------------------------------------- */
/* Voto già espresso                                                 */
/* ---------------------------------------------------------------- */

export function readVote(resultId: string): string | null {
  return read<string | null>(VOTE_PREFIX + resultId, null);
}

export function saveVote(resultId: string, playerId: string) {
  write(VOTE_PREFIX + resultId, playerId);
}

/**
 * L'ultima stanza aperta su questo dispositivo, se è ancora fresca.
 *
 * Serve a ritrovare la partita dopo un ricarico o una chiusura per sbaglio: su
 * telefono basta uno scorrimento storto per uscire dal sito, e ripartire dalla
 * home con l'asta ancora in corso significa perdere il proprio turno.
 *
 * "Fresca" vuol dire aperta nelle ultime ore: una stanza di ieri non va
 * riproposta, perché quella partita è finita e riaprirla confonderebbe.
 */
export function resumableSession(maxAgeHours = 6): RoomSession | null {
  if (typeof window === "undefined") return null;
  let migliore: { session: RoomSession; at: number } | null = null;

  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index);
    if (!key?.startsWith(SESSION_PREFIX)) continue;
    const session = read<RoomSession | null>(key, null);
    if (!session) continue;
    const at = session.openedAt ?? 0;
    if (!migliore || at > migliore.at) migliore = { session, at };
  }

  if (!migliore) return null;
  const eta = Date.now() - migliore.at;
  return eta <= maxAgeHours * 60 * 60 * 1000 ? migliore.session : null;
}
