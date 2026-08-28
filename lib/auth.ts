"use client";

import type { Session } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import { DEFAULT_AVATAR } from "./avatars";
import { notifyClientStore, useClientValue, useIsClient } from "./client-store";
import { getSupabase, isSupabaseConfigured } from "./supabase";
import { uid } from "./utils";

/**
 * Accesso al profilo, con due modalità automatiche:
 *
 * - `supabase`: quando ci sono le chiavi in .env.local. Accesso via email, nessuna
 *   password da gestire, profilo condiviso fra dispositivi.
 * - `local`: senza chiavi. Il profilo (nickname e avatar) vive su questo dispositivo:
 *   basta per giocare, personalizzarsi e mandare suggerimenti, senza bloccare nulla.
 */

export type AuthMode = "supabase" | "local";

export function authMode(): AuthMode {
  return isSupabaseConfigured ? "supabase" : "local";
}

export interface Account {
  id: string;
  nickname: string;
  emoji: string;
  /** true quando il profilo esiste solo su questo dispositivo. */
  local?: boolean;
}

function requireClient() {
  const supabase = getSupabase();
  if (!supabase) throw new Error("database-not-configured");
  return supabase;
}

/* ---------------------------------------------------------------- */
/* Profilo locale                                                    */
/* ---------------------------------------------------------------- */

const LOCAL_ACCOUNT_KEY = "pp:account";

export function normalizeNickname(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 20);
}

export function readLocalAccount(): Account | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(LOCAL_ACCOUNT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Account;
    return parsed?.nickname ? { ...parsed, local: true } : null;
  } catch {
    return null;
  }
}

export function saveLocalAccount(nickname: string, emoji: string): Account {
  const account: Account = {
    id: readLocalAccount()?.id ?? uid("acc"),
    nickname: normalizeNickname(nickname),
    emoji: emoji || DEFAULT_AVATAR,
    local: true,
  };
  try {
    window.localStorage.setItem(LOCAL_ACCOUNT_KEY, JSON.stringify(account));
  } catch {
    /* senza storage il profilo dura quanto la sessione */
  }
  notifyClientStore();
  return account;
}

export function clearLocalAccount() {
  try {
    window.localStorage.removeItem(LOCAL_ACCOUNT_KEY);
  } catch {
    /* niente da ripulire */
  }
  notifyClientStore();
}

/* ---------------------------------------------------------------- */
/* Accesso via email (con database)                                  */
/* ---------------------------------------------------------------- */

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
  if (supabase) await supabase.auth.signOut();
  clearLocalAccount();
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
  const { data, error } = await supabase
    .from(PROFILES_TABLE)
    .upsert({ id: userId, nickname: normalizeNickname(nickname), emoji })
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
    .eq("nickname", normalizeNickname(nickname))
    .maybeSingle();
  if (error || !data) return null;
  const row = data as ProfileRow;
  return { id: row.id, nickname: row.nickname, emoji: row.emoji };
}

/* ---------------------------------------------------------------- */
/* Stato dell'accesso                                                */
/* ---------------------------------------------------------------- */

export interface AuthState {
  /** true quando lo stato è stato caricato. */
  ready: boolean;
  mode: AuthMode;
  session: Session | null;
  email: string | null;
  account: Account | null;
  /** Da chiamare dopo aver creato o aggiornato il profilo. */
  refreshAccount: () => void;
}

export function useAuth(): AuthState {
  const isClient = useIsClient();
  const [session, setSession] = useState<Session | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [remoteAccount, setRemoteAccount] = useState<Account | null>(null);
  const [version, setVersion] = useState(0);
  const localAccount = useClientValue<Account | null>(readLocalAccount, null);
  const mode = authMode();

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
      if (active) setRemoteAccount(result);
    });
    return () => {
      active = false;
    };
  }, [userId, version]);

  return {
    ready: mode === "local" ? isClient : loaded,
    mode,
    session,
    email: session?.user.email ?? null,
    account: mode === "supabase" ? (userId ? remoteAccount : null) : localAccount,
    refreshAccount: () => setVersion((value) => value + 1),
  };
}
