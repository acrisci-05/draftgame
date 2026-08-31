import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { RawCategory } from "./catalog";
import type { Category, Player, VoteResultPayload, VoteTally } from "./types";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

let client: SupabaseClient | null = null;

/** Client condiviso; restituisce null se le variabili d'ambiente non sono impostate. */
export function getSupabase(): SupabaseClient | null {
  if (!isSupabaseConfigured) return null;
  if (!client) {
    client = createClient(SUPABASE_URL as string, SUPABASE_ANON_KEY as string, {
      auth: {
        // La sessione resta sul dispositivo: serve per l'accesso e la sezione amici.
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
      realtime: { params: { eventsPerSecond: 20 } },
    });
  }
  return client;
}

function requireClient(): SupabaseClient {
  const supabase = getSupabase();
  if (!supabase) throw new Error("database-not-configured");
  return supabase;
}

export const SHARED_CATEGORIES_TABLE = "categories";
export const SUGGESTIONS_TABLE = "suggestions";
export const RESULTS_TABLE = "results";
export const VOTES_TABLE = "votes";

interface SharedCategoryRow {
  id: string;
  name: string;
  emoji: string;
  items: Category["items"];
  created_at?: string;
}

/** Pubblica una categoria e restituisce l'id remoto usato nel link di condivisione. */
export async function publishCategory(category: Category): Promise<string> {
  const supabase = requireClient();
  const payload = {
    name: category.name,
    emoji: category.emoji,
    items: category.items,
  };

  const query = category.shareId
    ? supabase
        .from(SHARED_CATEGORIES_TABLE)
        .update(payload)
        .eq("id", category.shareId)
        .select("id")
        .single()
    : supabase.from(SHARED_CATEGORIES_TABLE).insert(payload).select("id").single();

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data as { id: string }).id;
}

export async function fetchSharedCategory(shareId: string): Promise<Category> {
  const supabase = requireClient();
  const { data, error } = await supabase
    .from(SHARED_CATEGORIES_TABLE)
    .select("id, name, emoji, items, created_at")
    .eq("id", shareId)
    .single();

  if (error) throw new Error(error.message);
  const row = data as SharedCategoryRow;
  return {
    id: `shared-${row.id}`,
    name: row.name,
    emoji: row.emoji,
    items: row.items,
    source: "shared",
    shareId: row.id,
    createdAt: row.created_at,
  };
}

/* ---------------------------------------------------------------- */
/* Suggerimenti                                                      */
/* ---------------------------------------------------------------- */

export interface Suggestion {
  id: string;
  name: string;
  idea: string;
  /** Nickname di chi l'ha proposto, o null se il profilo è stato cancellato. */
  author: string | null;
  createdAt: string;
  /** Quando è stato segnato come sistemato; null se è ancora da vedere. */
  handledAt: string | null;
}

interface SuggestionRow {
  id: string;
  name: string;
  idea: string;
  created_at: string;
  handled_at: string | null;
  profiles: { nickname: string } | { nickname: string }[] | null;
}

/** Il token della sessione, che il server usa per riconoscere chi scrive. */
async function accessToken(): Promise<string | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

/**
 * Richiede l'accesso: l'autore resta collegato al suggerimento.
 *
 * Passa dal nostro server invece di scrivere dritto sul database, perché è lì
 * che vive il token del bot Telegram: così il salvataggio e la notifica sul
 * telefono partono insieme.
 */
export async function sendSuggestion(name: string, idea: string): Promise<void> {
  const token = await accessToken();
  if (!token) throw new Error("not-signed-in");

  const response = await fetch("/api/suggestions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ name, idea }),
  });
  if (!response.ok) throw new Error("send-failed");
}

/**
 * I suggerimenti ricevuti, dal più recente.
 *
 * Le regole del database li mostrano solo a chi ha il contrassegno di creatore:
 * a chiunque altro questa chiamata risponde con una lista vuota, non con un
 * errore. Non c'è quindi modo di sbirciarli forzando l'interfaccia.
 */
export async function fetchSuggestions(): Promise<Suggestion[]> {
  const supabase = getSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from(SUGGESTIONS_TABLE)
    .select("id, name, idea, created_at, handled_at, profiles:author (nickname)")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error || !data) return [];

  return (data as SuggestionRow[]).map((row) => {
    const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
    return {
      id: row.id,
      name: row.name,
      idea: row.idea,
      author: profile?.nickname ?? null,
      createdAt: row.created_at,
      handledAt: row.handled_at,
    };
  });
}

/** Segna un suggerimento come sistemato, o lo riporta fra quelli da vedere. */
export async function markSuggestion(id: string, handled: boolean): Promise<void> {
  const supabase = requireClient();
  const { error } = await supabase
    .from(SUGGESTIONS_TABLE)
    .update({ handled_at: handled ? new Date().toISOString() : null })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteSuggestion(id: string): Promise<void> {
  const supabase = requireClient();
  const { error } = await supabase.from(SUGGESTIONS_TABLE).delete().eq("id", id);
  if (error) throw new Error(error.message);
}

/* ---------------------------------------------------------------- */
/* Liste ufficiali pubblicate dal creatore                           */
/* ---------------------------------------------------------------- */

export const OFFICIAL_LISTS_TABLE = "official_lists";

interface OfficialListRow {
  id: string;
  name: string;
  name_en: string | null;
  emoji: string;
  theme: string | null;
  tiers: RawCategory["tiers"];
}

/**
 * Liste ufficiali salvate sul database. Sono in sola lettura per l'app:
 * si aggiungono dall'SQL editor di Supabase (lo Studio prepara la query).
 */
export async function fetchOfficialLists(): Promise<RawCategory[]> {
  const supabase = getSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from(OFFICIAL_LISTS_TABLE)
    .select("id, name, name_en, emoji, theme, tiers");
  if (error || !data) return [];
  return (data as OfficialListRow[]).map((row) => ({
    id: row.id,
    name: row.name,
    nameEn: row.name_en ?? undefined,
    emoji: row.emoji,
    theme: (row.theme as RawCategory["theme"]) ?? undefined,
    tiers: row.tiers,
  }));
}

/* ---------------------------------------------------------------- */
/* Voto del gioco (1-5 stelle, anonimo)                              */
/* ---------------------------------------------------------------- */

export const FEEDBACK_TABLE = "feedback";
export const RATING_SUMMARY_VIEW = "ratings_summary";

export interface RatingSummary {
  average: number;
  count: number;
}

/** Un voto per dispositivo: `voterKey` evita i doppioni. */
export async function sendRating(
  stars: number,
  comment: string,
  voterKey: string,
): Promise<void> {
  const supabase = requireClient();
  const { error } = await supabase.from(FEEDBACK_TABLE).upsert(
    {
      stars: Math.min(5, Math.max(1, Math.round(stars))),
      comment: comment.trim().slice(0, 1000) || null,
      voter_key: voterKey,
    },
    { onConflict: "voter_key" },
  );
  if (error) throw new Error(error.message);
}

/** Media e numero di voti: la vista espone solo i due numeri, non i commenti. */
export async function fetchRatingSummary(): Promise<RatingSummary | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from(RATING_SUMMARY_VIEW)
    .select("average, count")
    .single();
  if (error || !data) return null;
  const row = data as { average: number | null; count: number | null };
  return { average: Number(row.average ?? 0), count: Number(row.count ?? 0) };
}

/* ---------------------------------------------------------------- */
/* Risultati e votazione                                             */
/* ---------------------------------------------------------------- */

interface ResultRow {
  id: string;
  code: string;
  category_name: string;
  category_emoji: string;
  currency: VoteResultPayload["currency"];
  players: Player[];
}

/** Salva i roster finali e restituisce l'id da usare nel link di voto. */
export async function publishResult(payload: VoteResultPayload): Promise<string> {
  const supabase = requireClient();
  const { data, error } = await supabase
    .from(RESULTS_TABLE)
    .insert({
      code: payload.code,
      category_name: payload.categoryName,
      category_emoji: payload.categoryEmoji,
      currency: payload.currency,
      players: payload.players,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  return (data as { id: string }).id;
}

export async function fetchResult(id: string): Promise<VoteResultPayload> {
  const supabase = requireClient();
  const { data, error } = await supabase
    .from(RESULTS_TABLE)
    .select("id, code, category_name, category_emoji, currency, players")
    .eq("id", id)
    .single();

  if (error) throw new Error(error.message);
  const row = data as ResultRow;
  return {
    code: row.code,
    categoryName: row.category_name,
    categoryEmoji: row.category_emoji,
    currency: row.currency,
    players: row.players,
  };
}

export async function castVote(
  resultId: string,
  playerId: string,
  voterKey: string,
): Promise<void> {
  const supabase = requireClient();
  const { error } = await supabase
    .from(VOTES_TABLE)
    .upsert({ result_id: resultId, player_id: playerId, voter_key: voterKey }, {
      onConflict: "result_id,voter_key",
    });
  if (error) throw new Error(error.message);
}

export async function fetchVotes(resultId: string): Promise<VoteTally[]> {
  const supabase = requireClient();
  const { data, error } = await supabase
    .from(VOTES_TABLE)
    .select("player_id")
    .eq("result_id", resultId);

  if (error) throw new Error(error.message);
  const counts = new Map<string, number>();
  (data as { player_id: string }[]).forEach((row) => {
    counts.set(row.player_id, (counts.get(row.player_id) ?? 0) + 1);
  });
  return [...counts.entries()].map(([playerId, votes]) => ({ playerId, votes }));
}
