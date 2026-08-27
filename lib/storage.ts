"use client";

import { BUILTIN_CATEGORIES, findBuiltin } from "./catalog";
import { notifyClientStore } from "./client-store";
import type { Category, Profile, RoomSession } from "./types";
import { PLAYER_EMOJIS } from "./game";
import { uid } from "./utils";

const CATEGORIES_KEY = "dg:categories";
const PROFILE_KEY = "dg:profile";
const SESSION_PREFIX = "dg:session:";

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
    emoji: PLAYER_EMOJIS[Math.floor(Math.random() * PLAYER_EMOJIS.length)],
  };
  write(PROFILE_KEY, profile);
  return profile;
}

export function saveProfile(profile: Profile) {
  write(PROFILE_KEY, profile);
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
  const next = index >= 0 ? all.map((c) => (c.id === category.id ? category : c)) : [...all, category];
  write(CATEGORIES_KEY, next);
  return next;
}

export function deleteCustomCategory(id: string): Category[] {
  const next = listCustomCategories().filter((c) => c.id !== id);
  write(CATEGORIES_KEY, next);
  return next;
}

export function allCategories(): Category[] {
  return [...BUILTIN_CATEGORIES, ...listCustomCategories()];
}

export function getCategory(id: string): Category | undefined {
  return findBuiltin(id) ?? listCustomCategories().find((c) => c.id === id);
}

/* ---------------------------------------------------------------- */
/* Sessione di stanza                                                */
/* ---------------------------------------------------------------- */

export function getSession(code: string): RoomSession | null {
  return read<RoomSession | null>(SESSION_PREFIX + code, null);
}

export function saveSession(session: RoomSession) {
  write(SESSION_PREFIX + session.code, session);
}

export function clearSession(code: string) {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(SESSION_PREFIX + code);
  notifyClientStore();
}
