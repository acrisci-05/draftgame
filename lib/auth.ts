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
  /**
   * true solo per il creatore del sito. Serve a mostrargli i suggerimenti
   * ricevuti; a difendere i dati sono comunque le regole del database, che
   * senza questo contrassegno rispondono con una lista vuota.
   */
  isAdmin?: boolean;
  /**
   * true se lo stato di attività è condiviso con i PickMates. Spegnendolo si
   * smette anche di vedere il loro: è una regola del database, non una scelta
   * dell'interfaccia.
   */
  showsPresence?: boolean;
  /** Esperienza accumulata. Gli ospiti e i profili locali restano a zero. */
  xp?: number;
  /** Titolo scelto fra quelli sbloccati, mostrato accanto al nickname. */
  title?: string | null;
  /** Ultimo cambio di nickname: da qui parte l'attesa di trenta giorni. */
  nicknameChangedAt?: string | null;
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

export type AuthError =
  | "nickname-taken"
  | "nickname-invalid"
  | "email-invalid"
  | "password-short"
  | "password-weak"
  | "wrong-credentials"
  | "email-taken"
  | "confirm-email"
  | "offline"
  | "unknown";

export class AuthFailure extends Error {
  constructor(readonly reason: AuthError) {
    super(reason);
    this.name = "AuthFailure";
  }
}

export const MIN_PASSWORD = 8;

/**
 * Requisiti della password, controllati mentre si scrive e di nuovo prima di
 * mandare la registrazione: una password debole non deve poter arrivare al
 * servizio di autenticazione.
 */
export const PASSWORD_SPECIALS = "!@#$%^&*";

export interface PasswordChecks {
  length: boolean;
  upper: boolean;
  digit: boolean;
  special: boolean;
}

export function passwordChecks(password: string): PasswordChecks {
  return {
    length: password.length >= MIN_PASSWORD,
    upper: /[A-Z]/.test(password),
    digit: /[0-9]/.test(password),
    special: /[!@#$%^&*]/.test(password),
  };
}

export function isStrongPassword(password: string): boolean {
  const checks = passwordChecks(password);
  return checks.length && checks.upper && checks.digit && checks.special;
}

const PENDING_PROFILE_KEY = "pp:pending-profile";

/** Nickname e avatar scelti in registrazione, in attesa della conferma via email. */
function savePendingProfile(nickname: string, emoji: string) {
  try {
    window.localStorage.setItem(PENDING_PROFILE_KEY, JSON.stringify({ nickname, emoji }));
  } catch {
    /* senza storage il nickname verrà richiesto al primo accesso */
  }
}

function readPendingProfile(): { nickname: string; emoji: string } | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(PENDING_PROFILE_KEY);
    return raw ? (JSON.parse(raw) as { nickname: string; emoji: string }) : null;
  } catch {
    return null;
  }
}

function clearPendingProfile() {
  try {
    window.localStorage.removeItem(PENDING_PROFILE_KEY);
  } catch {
    /* niente da ripulire */
  }
}

/* ------------------------------------------------------------------ */
/* Il saluto dopo l'accesso                                            */
/* ------------------------------------------------------------------ */

const GREETING_KEY = "pp:greeting";

export type Greeting = "in" | "up";

/**
 * Segna che c'e' un saluto da dare.
 *
 * Il nickname, al momento dell'accesso, non si conosce ancora: arriva col
 * profilo, un istante dopo. E con Google la pagina viene addirittura ricaricata.
 * Quindi non si mostra il saluto subito: si lascia un segnale, e chi vede
 * comparire il profilo lo raccoglie. Vale per la sola scheda aperta.
 */
export function markGreeting(kind: Greeting) {
  try {
    window.sessionStorage.setItem(GREETING_KEY, kind);
  } catch {
    /* senza storage si perde solo il saluto */
  }
}

/** Ritira il saluto in sospeso, una volta sola. */
export function consumeGreeting(): Greeting | null {
  try {
    const value = window.sessionStorage.getItem(GREETING_KEY);
    if (value !== "in" && value !== "up") return null;
    window.sessionStorage.removeItem(GREETING_KEY);
    return value;
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* Accesso con un profilo che si ha già (Google, Apple, Facebook...)   */
/* ------------------------------------------------------------------ */

/**
 * I servizi con cui si può entrare senza creare una password.
 *
 * Quali siano davvero disponibili non lo decide il codice: lo decide il
 * pannello del database, dove ognuno va acceso con le sue credenziali. L'app lo
 * chiede all'avvio e mostra solo i pulsanti che funzionano davvero, così
 * accenderne uno nuovo non richiede di toccare il codice.
 */
export const OAUTH_PROVIDERS = ["google", "apple", "facebook", "github"] as const;

export type OAuthProvider = (typeof OAUTH_PROVIDERS)[number];

let providersCache: Promise<OAuthProvider[]> | null = null;

/** Quali accessi rapidi sono accesi sul progetto. Lista vuota se nessuno. */
export function enabledProviders(): Promise<OAuthProvider[]> {
  if (providersCache) return providersCache;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !key) return Promise.resolve([]);

  providersCache = fetch(`${url.replace(/\/$/, "")}/auth/v1/settings`, {
    headers: { apikey: key },
  })
    .then((response) => (response.ok ? response.json() : null))
    .then((settings: { external?: Record<string, boolean> } | null) => {
      const external = settings?.external ?? {};
      return OAUTH_PROVIDERS.filter((provider) => external[provider] === true);
    })
    .catch(() => []);

  return providersCache;
}

/**
 * Manda al servizio scelto e torna indietro sulla pagina dei Pickmates.
 *
 * Al ritorno la sessione c'è già ma il profilo di gioco no: l'app chiede
 * nickname e avatar, che restano l'unica cosa da scegliere.
 */
export async function signInWithProvider(provider: OAuthProvider): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) throw new AuthFailure("offline");

  markGreeting("in");
  const { error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo:
        typeof window === "undefined" ? undefined : `${window.location.origin}/pickmates`,
    },
  });
  if (error) throw new AuthFailure("unknown");
}

/** true se il nickname è libero. Il vincolo vero resta quello del database. */
export async function isNicknameAvailable(nickname: string): Promise<boolean> {
  const clean = normalizeNickname(nickname);
  if (clean.length < 3) return false;
  const existing = await findAccountByNickname(clean);
  return existing === null;
}

/**
 * Registrazione con email e password.
 * La password viaggia verso il servizio di autenticazione, che la conserva
 * cifrata: l'app non la salva né la vede mai in chiaro.
 */
export async function signUpWithPassword(input: {
  email: string;
  password: string;
  nickname: string;
  emoji: string;
}): Promise<{ confirmationRequired: boolean }> {
  const supabase = getSupabase();
  if (!supabase) throw new AuthFailure("offline");

  const nickname = normalizeNickname(input.nickname);
  if (nickname.length < 3) throw new AuthFailure("nickname-invalid");
  if (!isStrongPassword(input.password)) throw new AuthFailure("password-weak");
  if (!input.email.includes("@")) throw new AuthFailure("email-invalid");
  if (!(await isNicknameAvailable(nickname))) throw new AuthFailure("nickname-taken");

  const { data, error } = await supabase.auth.signUp({
    email: input.email.trim(),
    password: input.password,
  });

  if (error) {
    if (/already/i.test(error.message)) throw new AuthFailure("email-taken");
    throw new AuthFailure("unknown");
  }

  // Con la conferma via email attiva la sessione arriva solo dopo il clic sul link.
  if (!data.session) {
    savePendingProfile(nickname, input.emoji);
    return { confirmationRequired: true };
  }

  await createAccount(data.user!.id, nickname, input.emoji);
  return { confirmationRequired: false };
}

export async function signInWithPassword(email: string, password: string): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) throw new AuthFailure("offline");

  const { error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  });
  if (error) throw new AuthFailure("wrong-credentials");
}

/** Manda il link per reimpostare la password. */
export async function requestPasswordReset(email: string): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) throw new AuthFailure("offline");
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
    redirectTo: typeof window === "undefined" ? undefined : `${window.location.origin}/pickmates`,
  });
  if (error) throw new AuthFailure("unknown");
}

export async function signInWithEmail(email: string): Promise<void> {
  const supabase = requireClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: email.trim(),
    options: {
      shouldCreateUser: true,
      emailRedirectTo:
        typeof window === "undefined" ? undefined : `${window.location.origin}/pickmates`,
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
  is_admin?: boolean;
  shows_presence?: boolean;
  xp?: number;
  equipped_title?: string | null;
  nickname_changed_at?: string | null;
}

export async function fetchAccount(userId: string): Promise<Account | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from(PROFILES_TABLE)
    // Tutte le colonne, non un elenco: cosi' il profilo si legge anche prima che
    // la migrazione aggiunga is_admin, invece di far sembrare disconnesso chi ha
    // un database non ancora aggiornato.
    .select("*")
    .eq("id", userId)
    .maybeSingle();
  if (error || !data) return null;
  const row = data as ProfileRow;
  return {
    id: row.id,
    nickname: row.nickname,
    emoji: row.emoji,
    isAdmin: row.is_admin === true,
    // Assente sul database non ancora aggiornato: si considera acceso, che è
    // il valore predefinito della colonna.
    showsPresence: row.shows_presence !== false,
    xp: typeof row.xp === "number" ? row.xp : 0,
    title: row.equipped_title ?? null,
    nicknameChangedAt: row.nickname_changed_at ?? null,
  };
}

/** Nickname pubblico: è l'indirizzo con cui gli amici ti aggiungono. */
export async function createAccount(
  userId: string,
  nickname: string,
  emoji: string,
): Promise<Account> {
  const supabase = requireClient();
  /*
   * Inserimento, non upsert.
   *
   * Il nickname non e' piu' una colonna modificabile a mano -- si cambia solo
   * dalla funzione che fa rispettare l'attesa di trenta giorni -- e un upsert
   * su un profilo gia' esistente proverebbe a riscriverlo, facendosi rifiutare
   * dal database. Qui si crea il profilo la prima volta e basta: chi ce l'ha
   * gia' passa da rename_profile.
   */
  const { data, error } = await supabase
    .from(PROFILES_TABLE)
    .insert({ id: userId, nickname: normalizeNickname(nickname), emoji })
    .select("id, nickname, emoji")
    .single();
  // 23505 è il codice del vincolo di unicità: il nickname è già di qualcun altro.
  if (error) throw new AuthFailure(error.code === "23505" ? "nickname-taken" : "unknown");
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

    fetchAccount(userId).then(async (result) => {
      if (!active) return;
      if (result) {
        setRemoteAccount(result);
        clearPendingProfile();
        return;
      }

      // Primo accesso dopo la conferma via email: si crea il profilo scelto allora.
      const pending = readPendingProfile();
      if (!pending) {
        setRemoteAccount(null);
        return;
      }
      try {
        const created = await createAccount(userId, pending.nickname, pending.emoji);
        if (!active) return;
        clearPendingProfile();
        setRemoteAccount(created);
      } catch {
        // Nickname nel frattempo occupato: verrà richiesto di sceglierne un altro.
        clearPendingProfile();
        if (active) setRemoteAccount(null);
      }
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

/* ---------------------------------------------------------------- */
/* Cambio del nickname                                               */
/* ---------------------------------------------------------------- */

export type RenameResult = "ok" | "taken" | "invalid" | "too-soon" | "not-signed-in" | "error";

/** Giorni di attesa fra un cambio di nickname e il successivo. */
export const NICKNAME_COOLDOWN_DAYS = 30;

/**
 * Quando si potra' cambiare di nuovo il nickname, o null se si puo' subito.
 *
 * Il conto vero lo tiene il database, che rifiuta comunque: questo serve solo
 * a dirlo prima invece di far scoprire il divieto premendo salva.
 */
export function nicknameAvailableFrom(changedAt: string | null | undefined): Date | null {
  if (!changedAt) return null;
  const quando = new Date(changedAt).getTime();
  if (Number.isNaN(quando)) return null;
  const libero = quando + NICKNAME_COOLDOWN_DAYS * 24 * 60 * 60 * 1000;
  return libero > Date.now() ? new Date(libero) : null;
}

/**
 * Cambia l'avatar del profilo.
 *
 * Nessuna attesa: l'avatar non e' un indirizzo, non ci si trova nessuno e non
 * resta scritto sulle card gia' condivise. Cambiarlo tutti i giorni non fa
 * danno a nessuno.
 */
export async function updateAvatar(emoji: string): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) return false;
  const { data } = await supabase.auth.getUser();
  const id = data.user?.id;
  if (!id) return false;
  const { error } = await supabase.from(PROFILES_TABLE).update({ emoji }).eq("id", id);
  return !error;
}

/**
 * Cambia il nickname globale, non più di una volta ogni trenta giorni.
 *
 * Il freno e il controllo di unicità stanno nel database: qui si chiede e si
 * riporta la risposta. Metterli nell'app vorrebbe dire poterli aggirare
 * cambiando la pagina, e il nickname è l'indirizzo con cui gli amici ti
 * trovano e la firma che resta sulle card già condivise.
 */
export async function renameProfile(nickname: string): Promise<RenameResult> {
  const supabase = getSupabase();
  if (!supabase) return "error";
  try {
    const { data, error } = await supabase.rpc("rename_profile", {
      new_nickname: nickname,
    });
    if (error) return "error";
    const attesi: readonly string[] = ["ok", "taken", "invalid", "too-soon", "not-signed-in"];
    const esito = String(data);
    return attesi.includes(esito) ? (esito as RenameResult) : "error";
  } catch {
    return "error";
  }
}
