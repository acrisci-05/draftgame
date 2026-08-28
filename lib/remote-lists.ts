"use client";

import { fromRawCategory, type RawCategory } from "./catalog";
import { notifyClientStore } from "./client-store";
import { fetchOfficialLists, isSupabaseConfigured } from "./supabase";
import type { Category } from "./types";

/**
 * Liste ufficiali pubblicate dal creatore sul database.
 * Vengono scaricate una volta per sessione e tenute in cache sul dispositivo,
 * così l'app resta giocabile anche offline con le liste incluse nel codice.
 */

const CACHE_KEY = "pp:remote-lists";
let synced = false;

function read(): RawCategory[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as RawCategory[]) : [];
  } catch {
    return [];
  }
}

/** Liste remote già scaricate, pronte da unire a quelle incluse nel codice. */
export function remoteCategories(): Category[] {
  return read().map(fromRawCategory);
}

/** Scarica le liste dal database. Va chiamata una sola volta all'avvio. */
export async function syncRemoteLists(): Promise<void> {
  if (synced || !isSupabaseConfigured || typeof window === "undefined") return;
  synced = true;
  const lists = await fetchOfficialLists();
  if (lists.length === 0) return;
  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(lists));
  } catch {
    /* senza storage le liste remote valgono solo per questa sessione */
  }
  notifyClientStore();
}
