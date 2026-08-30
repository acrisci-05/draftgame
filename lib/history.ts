"use client";

import { getSupabase } from "./supabase";

/**
 * Storico delle partite di chi ha un profilo.
 *
 * Ognuno scrive la propria riga a fine partita e legge solo le proprie: le
 * regole del database non permettono altro. Da qui escono le statistiche
 * mostrate nella scheda del profilo.
 */

export const MATCH_HISTORY_TABLE = "match_history";

export interface MatchRecord {
  code: string;
  category: string;
  players: number;
  /** 1 = primo classificato. */
  position: number;
  spent: number;
  items: number;
  currency: string;
}

export interface PlayerStats {
  played: number;
  won: number;
  /** Percentuale di vittorie, arrotondata. 0 quando non si è ancora giocato. */
  winRate: number;
  spent: number;
  items: number;
}

export const EMPTY_STATS: PlayerStats = { played: 0, won: 0, winRate: 0, spent: 0, items: 0 };

/** Segna una partita giocata. Silenzioso: un errore qui non deve rovinare la festa. */
export async function recordMatch(userId: string, match: MatchRecord): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;
  try {
    await supabase.from(MATCH_HISTORY_TABLE).insert({ user_id: userId, ...match });
  } catch {
    /* lo storico è un di più: la partita resta valida comunque */
  }
}

interface HistoryRow {
  position: number;
  spent: number;
  items: number;
}

/** Le statistiche di chi ha fatto l'accesso, calcolate sulle proprie righe. */
export async function fetchStats(userId: string): Promise<PlayerStats> {
  const supabase = getSupabase();
  if (!supabase) return EMPTY_STATS;

  const { data, error } = await supabase
    .from(MATCH_HISTORY_TABLE)
    .select("position, spent, items")
    .eq("user_id", userId)
    .limit(500);
  if (error || !data) return EMPTY_STATS;

  const rows = data as HistoryRow[];
  const played = rows.length;
  if (played === 0) return EMPTY_STATS;

  const won = rows.filter((row) => row.position === 1).length;
  return {
    played,
    won,
    winRate: Math.round((won / played) * 100),
    spent: rows.reduce((total, row) => total + row.spent, 0),
    items: rows.reduce((total, row) => total + row.items, 0),
  };
}
