"use client";

import type { Session } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import { getSupabase, isSupabaseConfigured } from "./supabase";

/**
 * Accesso con email: nessuna password da gestire.
 * Supabase invia un link (e, se il template usa {{ .Token }}, anche un codice a 6 cifre).
 */

export interface Account {
  id: string;
  nickname: string;
  emoji: string;
}

function requireClient() {
  const supabase = getSupabase();
  if (!supabase) throw new Error("database-not-configured");
  return supabase;
}

export async function signInWithEmail(email: string): Promise<void> {
  const supabase = requireClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: email.trim(),
    options: {
      shouldCreateUser: true,
      emailRedirectTo:
        typeof window === "undefined" ? undefined : `${window.location.origin}/pickpockets`,
    },
  });
  if (error) throw new Error(error.message);
}

/** Alternativa al link: il codice a 6 cifre ricevuto per email. */
export async function verifyEmailCode(email: string, token: string): Promise<void> {
  const supabase = requireClient();
  const { error } = await supabase.auth.verifyOtp({
    email: email.trim(),
    token: token.trim(),
    type: "email",
  });
  if (error) throw new Error(error.message);
}

export async function signOut(): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;
  await supabase.auth.signOut();
}

export const PROFILES_TABLE = "profiles";

interface ProfileRow {
  id: string;
  nickname: string;
  emoji: string;
}

export async function fetchAccount(userId: string): Promise<Account | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from(PROFILES_TABLE)
    .select("id, nickname, emoji")
    .eq("id", userId)
    .maybeSingle();
  if (error || !data) return null;
  const row = data as ProfileRow;
  return { id: row.id, nickname: row.nickname, emoji: row.emoji };
}

/** Nickname pubblico: è l'indirizzo con cui gli amici ti aggiungono. */
export async function createAccount(
  userId: string,
  nickname: string,
  emoji: string,
): Promise<Account> {
  const supabase = requireClient();
  const clean = nickname.trim().toLowerCase().replace(/[^a-z0-9_]/g, "");
  const { data, error } = await supabase
    .from(PROFILES_TABLE)
    .upsert({ id: userId, nickname: clean, emoji })
    .select("id, nickname, emoji")
    .single();
  if (error) throw new Error(error.message);
  const row = data as ProfileRow;
  return { id: row.id, nickname: row.nickname, emoji: row.emoji };
}

export async function findAccountByNickname(nickname: string): Promise<Account | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from(PROFILES_TABLE)
    .select("id, nickname, emoji")
    .eq("nickname", nickname.trim().toLowerCase())
    .maybeSingle();
  if (error || !data) return null;
  const row = data as ProfileRow;
  return { id: row.id, nickname: row.nickname, emoji: row.emoji };
}

export interface AuthState {
  /** true quando lo stato della sessione è stato caricato. */
  ready: boolean;
  available: boolean;
  session: Session | null;
  email: string | null;
  account: Account | null;
  /** Da chiamare dopo aver creato o aggiornato il profilo. */
  refreshAccount: () => void;
}

export function useAuth(): AuthState {
  const [session, setSession] = useState<Session | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [account, setAccount] = useState<Account | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) return;
    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setLoaded(true);
    });

    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setLoaded(true);
    });

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const userId = session?.user.id ?? null;

  useEffect(() => {
    if (!userId) return;
    let active = true;
    fetchAccount(userId).then((result) => {
      if (active) setAccount(result);
    });
    return () => {
      active = false;
    };
  }, [userId, version]);

  return {
    ready: !isSupabaseConfigured || loaded,
    available: isSupabaseConfigured,
    session,
    email: session?.user.email ?? null,
    account: userId ? account : null,
    refreshAccount: () => setVersion((value) => value + 1),
  };
}
