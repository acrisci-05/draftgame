"use client";

import { PROFILES_TABLE, findAccountByNickname, type Account } from "./auth";
import type { TranslationKey } from "./i18n/it";
import { getSupabase } from "./supabase";
import type { VoteResultPayload } from "./types";

/**
 * Pickmates: la rubrica degli amici con cui si gioca.
 *
 * Ogni amicizia è una riga sola: chi invita è `user_id`, chi accetta è
 * `friend_id`. Accanto ci sono gli avversari recenti (chi si è incontrato nelle
 * ultime partite, e quante volte) e le sfide, cioè gli inviti a entrare in una
 * stanza che arrivano come notifica.
 */

export const PICKMATES_TABLE = "pickmates";
export const RECENT_OPPONENTS_TABLE = "recent_opponents";
export const CHALLENGES_TABLE = "challenges";
export const SHARED_RESULTS_TABLE = "shared_results";
export const PROFILE_EMAILS_TABLE = "profile_emails";

export type PickmateStatus = "pending" | "accepted";

export interface Pickmate {
  account: Account;
  status: PickmateStatus;
  /** true quando la richiesta è arrivata dall'altra persona e tocca a te accettarla. */
  incoming: boolean;
  /** Quante partite avete giocato insieme. */
  played: number;
}

function requireClient() {
  const supabase = getSupabase();
  if (!supabase) throw new Error("database-not-configured");
  return supabase;
}

async function accountsById(ids: string[]): Promise<Map<string, Account>> {
  const supabase = getSupabase();
  if (!supabase || ids.length === 0) return new Map();
  const { data } = await supabase
    .from(PROFILES_TABLE)
    .select("id, nickname, emoji")
    .in("id", ids);
  return new Map(((data ?? []) as Account[]).map((account) => [account.id, account]));
}

/** Quante partite ho giocato con ciascuno, dalla mia riga di avversari recenti. */
async function playedCounts(userId: string): Promise<Map<string, number>> {
  const supabase = getSupabase();
  if (!supabase) return new Map();
  const { data } = await supabase
    .from(RECENT_OPPONENTS_TABLE)
    .select("opponent_id, played_count")
    .eq("user_id", userId);
  const rows = (data ?? []) as { opponent_id: string; played_count: number }[];
  return new Map(rows.map((row) => [row.opponent_id, row.played_count]));
}

interface PickmateRow {
  user_id: string;
  friend_id: string;
  status: PickmateStatus;
}

export async function listPickmates(userId: string): Promise<Pickmate[]> {
  const supabase = getSupabase();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from(PICKMATES_TABLE)
    .select("user_id, friend_id, status")
    .or(`user_id.eq.${userId},friend_id.eq.${userId}`);
  if (error || !data) return [];

  const rows = data as PickmateRow[];
  const otherIds = rows.map((row) => (row.user_id === userId ? row.friend_id : row.user_id));
  if (otherIds.length === 0) return [];

  const [accounts, played] = await Promise.all([accountsById(otherIds), playedCounts(userId)]);

  return rows
    .map((row) => {
      const otherId = row.user_id === userId ? row.friend_id : row.user_id;
      const account = accounts.get(otherId);
      if (!account) return null;
      return {
        account,
        status: row.status,
        incoming: row.friend_id === userId,
        played: played.get(otherId) ?? 0,
      };
    })
    .filter((entry): entry is Pickmate => entry !== null);
}

/* ---------------------------------------------------------------- */
/* Ricerca                                                           */
/* ---------------------------------------------------------------- */

/** Ricerca per nickname: basta un pezzo del nome. */
export async function searchByNickname(query: string, selfId: string): Promise<Account[]> {
  const supabase = getSupabase();
  const clean = query.trim().toLowerCase().replace(/[^a-z0-9_]/g, "");
  if (!supabase || clean.length < 2) return [];

  const { data } = await supabase
    .from(PROFILES_TABLE)
    .select("id, nickname, emoji")
    .ilike("nickname", `%${clean}%`)
    .neq("id", selfId)
    .limit(10);
  return (data ?? []) as Account[];
}

/**
 * Ricerca per email: solo corrispondenza esatta, e passa da una funzione del
 * database. Gli indirizzi non sono leggibili né elencabili da nessun altro.
 */
export async function findByEmail(email: string, selfId: string): Promise<Account | null> {
  const supabase = getSupabase();
  const clean = email.trim().toLowerCase();
  if (!supabase || !clean.includes("@")) return null;

  const { data, error } = await supabase.rpc("find_pickmate_by_email", { target_email: clean });
  if (error || !data) return null;
  const found = (data as Account[])[0];
  return found && found.id !== selfId ? found : null;
}

export interface RecentOpponent {
  account: Account;
  played: number;
  lastPlayedAt: string;
}

/** Chi si è incontrato nelle ultime partite, dal più recente. */
export async function listRecentOpponents(userId: string): Promise<RecentOpponent[]> {
  const supabase = getSupabase();
  if (!supabase) return [];

  const { data } = await supabase
    .from(RECENT_OPPONENTS_TABLE)
    .select("opponent_id, played_count, last_played_at")
    .eq("user_id", userId)
    .order("last_played_at", { ascending: false })
    .limit(12);
  const rows = (data ?? []) as {
    opponent_id: string;
    played_count: number;
    last_played_at: string;
  }[];
  if (rows.length === 0) return [];

  const accounts = await accountsById(rows.map((row) => row.opponent_id));
  return rows
    .map((row) => {
      const account = accounts.get(row.opponent_id);
      return account
        ? { account, played: row.played_count, lastPlayedAt: row.last_played_at }
        : null;
    })
    .filter((entry): entry is RecentOpponent => entry !== null);
}

/** Segna una partita giocata con qualcuno: alimenta la lista degli avversari recenti. */
export async function recordOpponent(opponentId: string): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;
  await supabase.rpc("bump_recent_opponent", { opponent: opponentId });
}

/** L'email serve solo per farsi trovare dagli amici: si salva una volta sola. */
export async function saveSearchableEmail(userId: string, email: string): Promise<void> {
  const supabase = getSupabase();
  if (!supabase || !email.includes("@")) return;
  await supabase
    .from(PROFILE_EMAILS_TABLE)
    .upsert({ user_id: userId, email: email.trim().toLowerCase(), updated_at: new Date().toISOString() });
}

/* ---------------------------------------------------------------- */
/* Inviti                                                            */
/* ---------------------------------------------------------------- */

export type AddPickmateResult = "sent" | "not-found" | "self" | "duplicate";

export async function invitePickmate(userId: string, targetId: string): Promise<AddPickmateResult> {
  const supabase = requireClient();
  if (targetId === userId) return "self";
  const { error } = await supabase
    .from(PICKMATES_TABLE)
    .insert({ user_id: userId, friend_id: targetId, status: "pending" });
  return error ? "duplicate" : "sent";
}

export async function invitePickmateByNickname(
  userId: string,
  nickname: string,
): Promise<AddPickmateResult> {
  const target = await findAccountByNickname(nickname);
  if (!target) return "not-found";
  return invitePickmate(userId, target.id);
}

export async function acceptPickmate(userId: string, friendId: string): Promise<void> {
  const supabase = requireClient();
  const { error } = await supabase
    .from(PICKMATES_TABLE)
    .update({ status: "accepted" })
    .eq("user_id", friendId)
    .eq("friend_id", userId);
  if (error) throw new Error(error.message);
}

export async function removePickmate(userId: string, friendId: string): Promise<void> {
  const supabase = requireClient();
  const { error } = await supabase
    .from(PICKMATES_TABLE)
    .delete()
    .or(
      `and(user_id.eq.${userId},friend_id.eq.${friendId}),and(user_id.eq.${friendId},friend_id.eq.${userId})`,
    );
  if (error) throw new Error(error.message);
}

/* ---------------------------------------------------------------- */
/* Sfide                                                             */
/* ---------------------------------------------------------------- */

/** Le battute che accompagnano una sfida, una a sorte per ogni invito. */
export const TAUNT_KEYS = [
  "challenge.taunt1",
  "challenge.taunt2",
  "challenge.taunt3",
  "challenge.taunt4",
  "challenge.taunt5",
  "challenge.taunt6",
  "challenge.taunt7",
  "challenge.taunt8",
] as const satisfies readonly TranslationKey[];

export const TAUNT_COUNT = TAUNT_KEYS.length;

export function tauntKey(taunt: number): TranslationKey {
  const index = Number.isFinite(taunt) ? Math.trunc(taunt) - 1 : 0;
  return TAUNT_KEYS[((index % TAUNT_COUNT) + TAUNT_COUNT) % TAUNT_COUNT];
}

export interface Challenge {
  id: string;
  from: Account | null;
  code: string;
  taunt: number;
  createdAt: string;
}

interface ChallengeRow {
  id: string;
  from_user: string;
  code: string;
  taunt: number;
  created_at: string;
}

/** Invita un Pickmate nella stanza aperta, con una battuta a sorte. */
export async function sendChallenge(toUserId: string, code: string): Promise<void> {
  const supabase = requireClient();
  const { data } = await supabase.auth.getUser();
  const fromUser = data.user?.id;
  if (!fromUser) return;
  await supabase.from(CHALLENGES_TABLE).insert({
    from_user: fromUser,
    to_user: toUserId,
    code: code.toUpperCase(),
    taunt: 1 + Math.floor(Math.random() * TAUNT_COUNT),
  });
}

export async function listChallenges(userId: string): Promise<Challenge[]> {
  const supabase = getSupabase();
  if (!supabase) return [];

  // Un invito vecchio non serve più: la stanza a quest'ora è chiusa.
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { data } = await supabase
    .from(CHALLENGES_TABLE)
    .select("id, from_user, code, taunt, created_at")
    .eq("to_user", userId)
    .eq("status", "sent")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(10);

  const rows = (data ?? []) as ChallengeRow[];
  if (rows.length === 0) return [];
  const accounts = await accountsById(rows.map((row) => row.from_user));
  return rows.map((row) => ({
    id: row.id,
    from: accounts.get(row.from_user) ?? null,
    code: row.code,
    taunt: row.taunt,
    createdAt: row.created_at,
  }));
}

export async function answerChallenge(id: string, status: "joined" | "ignored"): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;
  await supabase.from(CHALLENGES_TABLE).update({ status }).eq("id", id);
}

export async function fetchChallenge(id: string): Promise<Challenge | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data } = await supabase
    .from(CHALLENGES_TABLE)
    .select("id, from_user, code, taunt, created_at")
    .eq("id", id)
    .maybeSingle();
  if (!data) return null;
  const row = data as ChallengeRow;
  const accounts = await accountsById([row.from_user]);
  return {
    id: row.id,
    from: accounts.get(row.from_user) ?? null,
    code: row.code,
    taunt: row.taunt,
    createdAt: row.created_at,
  };
}

/* ---------------------------------------------------------------- */
/* Draft condivisi con i Pickmates                                   */
/* ---------------------------------------------------------------- */

export interface SharedDraft {
  id: string;
  resultId: string;
  from: Account | null;
  createdAt: string;
  result: VoteResultPayload | null;
}

interface SharedRow {
  id: string;
  result_id: string;
  from_user: string;
  created_at: string;
  results: {
    code: string;
    category_name: string;
    category_emoji: string;
    currency: VoteResultPayload["currency"];
    players: VoteResultPayload["players"];
  } | null;
}

/** Manda il risultato di una partita a uno o più Pickmates. */
export async function shareResultWithPickmates(
  resultId: string,
  fromUser: string,
  toUsers: string[],
): Promise<void> {
  if (toUsers.length === 0) return;
  const supabase = requireClient();
  const { error } = await supabase.from(SHARED_RESULTS_TABLE).upsert(
    toUsers.map((toUser) => ({ result_id: resultId, from_user: fromUser, to_user: toUser })),
    { onConflict: "result_id,to_user" },
  );
  if (error) throw new Error(error.message);
}

export async function listSharedDrafts(userId: string): Promise<SharedDraft[]> {
  const supabase = getSupabase();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from(SHARED_RESULTS_TABLE)
    .select(
      "id, result_id, from_user, created_at, results(code, category_name, category_emoji, currency, players)",
    )
    .eq("to_user", userId)
    .order("created_at", { ascending: false })
    .limit(20);
  if (error || !data) return [];

  const rows = data as unknown as SharedRow[];
  const accounts = await accountsById([...new Set(rows.map((row) => row.from_user))]);

  return rows.map((row) => ({
    id: row.id,
    resultId: row.result_id,
    from: accounts.get(row.from_user) ?? null,
    createdAt: row.created_at,
    result: row.results
      ? {
          code: row.results.code,
          categoryName: row.results.category_name,
          categoryEmoji: row.results.category_emoji,
          currency: row.results.currency,
          players: row.results.players,
        }
      : null,
  }));
}
