"use client";

import { findAccountByNickname, PROFILES_TABLE, type Account } from "./auth";
import { getSupabase } from "./supabase";
import type { VoteResultPayload } from "./types";

/**
 * Pickpockets: la rubrica di amici con cui scambiarsi i draft da votare.
 * Ogni amicizia è una riga sola: chi invita è `user_id`, chi accetta è `friend_id`.
 */

export const FRIENDSHIPS_TABLE = "friendships";
export const SHARED_RESULTS_TABLE = "shared_results";

export type FriendStatus = "pending" | "accepted";

export interface Friend {
  account: Account;
  status: FriendStatus;
  /** true quando la richiesta è arrivata dall'altra persona e tocca a te accettarla. */
  incoming: boolean;
}

function requireClient() {
  const supabase = getSupabase();
  if (!supabase) throw new Error("database-not-configured");
  return supabase;
}

interface FriendshipRow {
  user_id: string;
  friend_id: string;
  status: FriendStatus;
}

export async function listFriends(userId: string): Promise<Friend[]> {
  const supabase = getSupabase();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from(FRIENDSHIPS_TABLE)
    .select("user_id, friend_id, status")
    .or(`user_id.eq.${userId},friend_id.eq.${userId}`);
  if (error || !data) return [];

  const rows = data as FriendshipRow[];
  const otherIds = rows.map((row) => (row.user_id === userId ? row.friend_id : row.user_id));
  if (otherIds.length === 0) return [];

  const { data: profiles } = await supabase
    .from(PROFILES_TABLE)
    .select("id, nickname, emoji")
    .in("id", otherIds);
  const accounts = new Map<string, Account>(
    ((profiles ?? []) as Account[]).map((account) => [account.id, account]),
  );

  return rows
    .map((row) => {
      const otherId = row.user_id === userId ? row.friend_id : row.user_id;
      const account = accounts.get(otherId);
      if (!account) return null;
      return { account, status: row.status, incoming: row.friend_id === userId };
    })
    .filter((friend): friend is Friend => friend !== null);
}

export type AddFriendResult = "sent" | "not-found" | "self" | "duplicate";

export async function addFriend(userId: string, nickname: string): Promise<AddFriendResult> {
  const supabase = requireClient();
  const target = await findAccountByNickname(nickname);
  if (!target) return "not-found";
  if (target.id === userId) return "self";

  const { error } = await supabase
    .from(FRIENDSHIPS_TABLE)
    .insert({ user_id: userId, friend_id: target.id, status: "pending" });
  if (error) return "duplicate";
  return "sent";
}

export async function acceptFriend(userId: string, friendId: string): Promise<void> {
  const supabase = requireClient();
  const { error } = await supabase
    .from(FRIENDSHIPS_TABLE)
    .update({ status: "accepted" })
    .eq("user_id", friendId)
    .eq("friend_id", userId);
  if (error) throw new Error(error.message);
}

export async function removeFriend(userId: string, friendId: string): Promise<void> {
  const supabase = requireClient();
  const { error } = await supabase
    .from(FRIENDSHIPS_TABLE)
    .delete()
    .or(
      `and(user_id.eq.${userId},friend_id.eq.${friendId}),and(user_id.eq.${friendId},friend_id.eq.${userId})`,
    );
  if (error) throw new Error(error.message);
}

/* ---------------------------------------------------------------- */
/* Draft condivisi con gli amici                                     */
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

/** Manda il risultato di una partita a uno o più amici. */
export async function shareResultWithFriends(
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
  const senderIds = [...new Set(rows.map((row) => row.from_user))];
  const { data: profiles } = await supabase
    .from(PROFILES_TABLE)
    .select("id, nickname, emoji")
    .in("id", senderIds);
  const accounts = new Map<string, Account>(
    ((profiles ?? []) as Account[]).map((account) => [account.id, account]),
  );

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
