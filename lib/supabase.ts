import { createClient, type SupabaseClient } from "@supabase/supabase-js";
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
      auth: { persistSession: false },
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
/* Suggerimenti anonimi                                              */
/* ---------------------------------------------------------------- */

export async function sendSuggestion(name: string, idea: string): Promise<void> {
  const supabase = requireClient();
  const { error } = await supabase.from(SUGGESTIONS_TABLE).insert({
    name: name.trim().slice(0, 60),
    idea: idea.trim().slice(0, 1000),
  });
  if (error) throw new Error(error.message);
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
