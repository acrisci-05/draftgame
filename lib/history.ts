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
    // Il doppione lo rifiuta il database, per vincolo su utente e codice
    // stanza: qui non e' un errore da segnalare, e' il comportamento voluto
    // quando la schermata finale viene riaperta.
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

export interface PastMatch {
  id: string;
  code: string;
  category: string;
  players: number;
  position: number;
  spent: number;
  currency: string;
  playedAt: string;
}

/**
 * Le ultime partite giocate, dalla più recente.
 *
 * È la parte che rende vera la frase "l'altra settimana ti ho battuto": senza
 * un elenco da guardare, i totali non raccontano niente.
 */
export async function fetchHistory(userId: string, limit = 10): Promise<PastMatch[]> {
  const supabase = getSupabase();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from(MATCH_HISTORY_TABLE)
    .select("id, code, category, players, position, spent, currency, played_at")
    .eq("user_id", userId)
    .order("played_at", { ascending: false })
    .limit(limit);
  if (error || !data) return [];

  return (data as Record<string, unknown>[]).map((row) => ({
    id: String(row.id),
    code: String(row.code),
    category: String(row.category),
    players: Number(row.players),
    position: Number(row.position),
    spent: Number(row.spent),
    currency: String(row.currency ?? "EUR"),
    playedAt: String(row.played_at),
  }));
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

/* ---------------------------------------------------------------- */
/* Esperienza                                                        */
/* ---------------------------------------------------------------- */

/**
 * Chiede al database l'esperienza di una partita finita.
 *
 * I punti li conta il database, non questa funzione: qui si dice solo com'è
 * andata. Il conto e i tetti stanno dentro `award_match_xp`, che è l'unico
 * punto che non si può scavalcare cambiando il codice della pagina. La stessa
 * partita paga una volta sola, quindi ripetere la chiamata restituisce zero.
 *
 * Torna 0 anche per gli ospiti, che non hanno un profilo a cui accreditare
 * niente.
 */
export async function awardMatchXp(input: {
  code: string;
  won: boolean;
  votes: number;
  /** Vero se in stanza c'era almeno un PickMate: apre il bonus giornaliero. */
  withMate: boolean;
}): Promise<number> {
  const supabase = getSupabase();
  if (!supabase) return 0;
  try {
    const { data, error } = await supabase.rpc("award_match_xp", {
      match_code: input.code,
      won: input.won,
      votes: input.votes,
      with_mate: input.withMate,
    });
    if (error) return 0;
    return typeof data === "number" ? data : 0;
  } catch {
    /* l'esperienza è un di più: la partita resta valida comunque */
    return 0;
  }
}
