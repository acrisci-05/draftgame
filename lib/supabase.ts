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

/**
 * Un voto per dispositivo: `voterKey` evita i doppioni.
 *
 * Passa dal nostro server invece di scrivere dritto sul database, perché è lì
 * che vive il token del bot Telegram: il voto viene archiviato e nello stesso
 * momento arriva la notifica al creatore. Il commento è facoltativo.
 */
export async function sendRating(
  stars: number,
  comment: string,
  voterKey: string,
): Promise<void> {
  // Il token serve solo a firmare il messaggio col nickname: votare non
  // richiede un account, e chi non ce l'ha resta anonimo.
  const token = await accessToken();

  const response = await fetch("/api/rating", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ stars, comment, voterKey }),
  });
  if (!response.ok) throw new Error("rating-failed");
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
  practice?: boolean | null;
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
      practice: payload.practice === true,
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
    .select("id, code, category_name, category_emoji, currency, players, practice")
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
    practice: row.practice === true,
  };
}

/** Perche' un voto puo' essere rifiutato, detto in modo comprensibile. */
export type VoteRefusal = "self" | "already" | "unknown";

export class VoteFailure extends Error {
  constructor(readonly reason: VoteRefusal) {
    super(reason);
    this.name = "VoteFailure";
  }
}

/**
 * Un voto, una volta sola.
 *
 * Inserimento e non piu' upsert: il voto non si cambia. Chi guarda le
 * percentuali salire non deve poter spostare il proprio all'ultimo momento
 * per far vincere chi vuole -- a quel punto non e' un voto, e' un sondaggio
 * aperto.
 *
 * Due rifiuti hanno un nome e uno no: il 23505 e' la chiave doppia, cioe' hai
 * gia' votato; il 42501 e' la regola del database che riconosce nel votante
 * un giocatore di quella partita.
 */
export async function castVote(
  resultId: string,
  playerId: string,
  voterKey: string,
  voter?: { name?: string; accountId?: string },
): Promise<void> {
  const supabase = requireClient();
  const { error } = await supabase.from(VOTES_TABLE).insert({
    result_id: resultId,
    player_id: playerId,
    voter_key: voterKey,
    voter_name: voter?.name ?? null,
    voter_account: voter?.accountId ?? null,
  });
  if (!error) return;
  if (error.code === "23505") throw new VoteFailure("already");
  // 42501 e' il rifiuto delle regole di accesso: qui vuol dire autovoto.
  if (error.code === "42501") throw new VoteFailure("self");
  throw new VoteFailure("unknown");
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

export interface MatchDetail {
  code: string;
  resultId: string;
  practice: boolean;
  players: Player[];
}

/**
 * I risultati pubblicati per un elenco di codici stanza.
 *
 * Lo storico personale sa quante persone c'erano ma non chi: quello sta nel
 * risultato pubblicato, che pero' esiste solo se qualcuno ha generato il link
 * del voto. Le partite senza link restano senza dettaglio, ed e' giusto cosi'
 * -- non c'e' niente da mostrare.
 *
 * Una richiesta sola per tutta la pagina: dieci partite non devono diventare
 * dieci giri sul database.
 */
export async function fetchResultsByCodes(codes: string[]): Promise<MatchDetail[]> {
  const supabase = getSupabase();
  if (!supabase || codes.length === 0) return [];
  const { data, error } = await supabase
    .from(RESULTS_TABLE)
    .select("id, code, players, practice")
    .in("code", codes);
  if (error || !data) return [];
  return (data as { id: string; code: string; players: Player[]; practice: boolean | null }[]).map(
    (row) => ({
      code: row.code,
      resultId: row.id,
      practice: row.practice === true,
      players: row.players,
    }),
  );
}
export interface Voter {
  playerId: string;
  /** Il nickname di chi ha votato, o null se ha votato da ospite. */
  name: string | null;
  registered: boolean;
  at: string;
}

/**
 * Chi ha votato chi, non solo quanti.
 *
 * Serve allo storico: vedere che tre persone hanno scelto la tua rosa e
 * quali sono e' tutta un'altra cosa dal vedere il numero tre. Gli ospiti
 * restano senza nome, perche' un nome non ce l'hanno.
 */
export async function fetchVoters(resultId: string): Promise<Voter[]> {
  const supabase = getSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from(VOTES_TABLE)
    .select("player_id, voter_name, voter_account, created_at")
    .eq("result_id", resultId)
    .order("created_at", { ascending: true });
  if (error || !data) return [];
  return (data as {
    player_id: string;
    voter_name: string | null;
    voter_account: string | null;
    created_at: string;
  }[]).map((row) => ({
    playerId: row.player_id,
    name: row.voter_name,
    registered: Boolean(row.voter_account),
    at: row.created_at,
  }));
}
