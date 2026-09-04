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
  return value.trim().toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, MAX_NICKNAME);
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
  | "password-leaked"
  | "wrong-credentials"
  | "email-taken"
  | "email-unconfirmed"
  | "confirm-email"
  | "too-many"
  | "signup-closed"
  | "offline"
  | "unknown";

export class AuthFailure extends Error {
  constructor(readonly reason: AuthError) {
    super(reason);
    this.name = "AuthFailure";
  }
}

/**
 * Traduce l'errore del servizio di autenticazione in un motivo nostro.
 *
 * Senza questo passaggio ogni intoppo finiva in "Qualcosa non ha funzionato":
 * chi si iscriveva non capiva cosa cambiare, e da qui non si poteva nemmeno
 * sapere cosa fosse successo davvero. I due casi che capitano sul serio sono
 * la quota di email del progetto -- poche all'ora finche' non si collega un
 * servizio di posta proprio -- e la password che rispetta le quattro regole ma
 * compare in una fuga di dati nota, che il servizio rifiuta di sua iniziativa.
 */
function reasonFor(
  error: { message?: string; code?: string; status?: number },
  fallback: AuthError = "unknown",
): AuthError {
  switch (error.code) {
    case "over_email_send_rate_limit":
    case "over_request_rate_limit":
      return "too-many";
    case "weak_password":
      return "password-leaked";
    case "user_already_exists":
    case "email_exists":
    case "identity_already_exists":
      return "email-taken";
    case "email_address_invalid":
    case "email_address_not_authorized":
      return "email-invalid";
    case "email_not_confirmed":
      return "email-unconfirmed";
    case "invalid_credentials":
      return "wrong-credentials";
    case "signup_disabled":
    case "email_provider_disabled":
      return "signup-closed";
  }

  if (error.status === 429) return "too-many";

  /* Progetti non ancora aggiornati rispondono senza codice: resta il testo. */
  const message = error.message ?? "";
  if (/already registered|already exists/i.test(message)) return "email-taken";
  if (/rate limit|only request this|too many/i.test(message)) return "too-many";
  if (/pwned|leaked|easy to guess/i.test(message)) return "password-leaked";
  if (/not confirmed/i.test(message)) return "email-unconfirmed";
  if (/signups? not allowed|signup is disabled/i.test(message)) return "signup-closed";
  if (/invalid.{0,10}email|email.{0,10}invalid/i.test(message)) return "email-invalid";

  return fallback;
}

/**
 * Prepara l'errore da mostrare e, quando resta senza nome, lo scrive nella
 * console: e' l'unico modo per capire, a distanza, cosa ha visto chi si e'
 * fermato sul messaggio generico.
 */
function authFailure(
  where: string,
  error: { message?: string; code?: string; status?: number },
  fallback: AuthError = "unknown",
): AuthFailure {
  const reason = reasonFor(error, fallback);
  if (reason === "unknown") {
    console.warn(`[auth] ${where}:`, error.code ?? error.status ?? "?", error.message);
  }
  return new AuthFailure(reason);
}

/**
 * L'indirizzo, ripulito da quello che ci mettono le tastiere.
 *
 * Lo spazio in coda arriva dal completamento automatico e dal tocco lungo che
 * seleziona la parola piu' lo spazio dopo; la maiuscola iniziale la mette il
 * telefono da solo all'inizio del campo. Nessuna delle due e' un errore di chi
 * scrive, e nessuna delle due deve costargli l'accesso.
 */
export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

/**
 * La forma minima di un indirizzo: qualcosa, una chiocciola, qualcosa, un
 * punto, qualcosa -- senza spazi da nessuna parte.
 *
 * Volutamente permissiva. Un controllo severo qui non serve a niente, perche'
 * l'unica prova che un indirizzo esiste e' la mail di conferma che ci arriva:
 * serve solo a fermare gli errori evidenti prima di far fare un giro a vuoto.
 * Passano i domini lunghi, i punti, i trattini e il "+" degli alias.
 */
export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(value: string): boolean {
  return EMAIL_PATTERN.test(normalizeEmail(value));
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
 * Manda al servizio scelto e torna indietro dov'eri.
 *
 * Prima si tornava sempre sulla pagina dei Pickmates, perche' e' li' che l'app
 * chiede nickname e avatar a chi entra per la prima volta. Funzionava, ma
 * spediva altrove anche chi aveva solo premuto "accedi" dalla home per creare
 * una partita: si tornava dentro e ci si ritrovava sulla pagina degli amici.
 *
 * Adesso si torna alla pagina da cui si e' partiti, e il profilo mancante lo
 * chiede la barra in alto -- che c'e' su ogni pagina -- appena si accorge che
 * c'e' una sessione senza nickname.
 *
 * L'indirizzo deve comunque essere fra quelli consentiti nel pannello Supabase.
 */
export async function signInWithProvider(provider: OAuthProvider): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) throw new AuthFailure("offline");

  markGreeting("in");
  const { error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo:
        typeof window === "undefined"
          ? undefined
          : `${window.location.origin}${window.location.pathname}`,
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

/* ------------------------------------------------------------------ */
/* L'username di chi entra con Google (o con un altro profilo)         */
/* ------------------------------------------------------------------ */

/**
 * I limiti veri, quelli scritti nel database: `nickname ~ '^[a-z0-9_]{3,20}$'`.
 * Stanno qui perche' il nome proposto in automatico deve nascere gia' dentro
 * quei limiti: un suggerimento che il database rifiuta e' peggio di nessun
 * suggerimento, perche' l'errore arriva dopo il tocco su "salva".
 */
export const MIN_NICKNAME = 3;
export const MAX_NICKNAME = 20;

/** Quando dal nome non resta niente di utilizzabile. */
const FALLBACK_BASE = "picker";

/**
 * Da un nome qualsiasi a un nickname che il database accetta.
 *
 * Chi entra con Google non sceglie niente: il servizio consegna un nome vero
 * ("Mario Rossi") o un indirizzo ("luca.bianchi90@gmail.com"), e finche' non
 * li si tratta restano quello -- un nome con lo spazio in mezzo che il vincolo
 * rifiuta, o un'email intera esposta in chiaro sulla card condivisa.
 *
 * Le tre regole, in ordine, e ognuna per una ragione sua:
 *
 * 1. Gli accenti si scompongono e si buttano via i segni: "Nicolò" diventa
 *    "nicolo" e non "nicol", che e' quello che succede togliendo la lettera
 *    accentata insieme al resto.
 * 2. Gli apostrofi spariscono *prima* del resto: "D'Angelo" e' "dangelo", non
 *    "d_angelo" -- nel nome quell'apostrofo non separa due parole, le lega.
 * 3. Tutto il resto -- spazi, punti, trattini, il "+" degli alias, gli emoji --
 *    diventa un underscore, e i doppioni si fondono in uno solo.
 *
 * Il taglio a venti caratteri viene per ultimo, e dopo il taglio si ripulisce
 * di nuovo la coda: un nome lungo tagliato a meta' di una parola lasciava
 * l'underscore appeso in fondo.
 *
 * "Mario Rossi"            -> "mario_rossi"
 * "luca.bianchi90"         -> "luca_bianchi90"
 * "  José   Álvarez-Díaz " -> "jose_alvarez_diaz"
 * "田中"                    -> "" (niente da salvare: decide chi chiama)
 */
export function sanitizeUsername(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/['\u2019\u00b4`]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, MAX_NICKNAME)
    .replace(/_+$/g, "");
}

/** Quello che si sa di chi ha appena fatto l'accesso. */
export interface OAuthProfile {
  email?: string | null;
  /** `user_metadata` della sessione: cosa contiene lo decide il servizio. */
  metadata?: Record<string, unknown> | null;
}

/**
 * Dove cercare il nome, in ordine di preferenza.
 *
 * Google riempie `full_name` e `name`, GitHub `user_name`, altri
 * `preferred_username`. Nessuno di questi e' garantito: sono campi liberi che
 * ogni servizio popola come gli pare, ed e' per questo che si prova tutta la
 * fila invece di fidarsi del primo.
 */
const NAME_FIELDS = ["full_name", "name", "preferred_username", "user_name", "nickname"] as const;

/** I nomi possibili, gia' puliti, senza i vuoti e senza ripetizioni. */
export function usernameCandidates(profile: OAuthProfile): string[] {
  const metadata = profile.metadata ?? {};
  const grezzi: string[] = [];

  for (const campo of NAME_FIELDS) {
    const valore = metadata[campo];
    if (typeof valore === "string" && valore.trim()) grezzi.push(valore);
  }

  /*
   * L'email come ultima risorsa, e solo la parte prima della chiocciola.
   *
   * L'indirizzo intero non deve diventare un nickname: il nickname si legge
   * sulla card che si condivide fuori dal gioco, e regalare l'indirizzo di
   * posta a chiunque guardi un video non e' una scelta che uno ha fatto.
   */
  const email = profile.email ?? (typeof metadata.email === "string" ? metadata.email : "");
  const locale = (email ?? "").split("@")[0] ?? "";
  if (locale.trim()) grezzi.push(locale);

  return [...new Set(grezzi.map(sanitizeUsername).filter(Boolean))];
}

/**
 * Il nome da cui partire.
 *
 * Si preferisce il primo candidato che sta gia' in piedi da solo -- almeno tre
 * caratteri -- perche' uno che si chiama "Bo" ma scrive da "bo.rossi@..." e'
 * meglio servito da "bo_rossi" che da "bo" piu' tre cifre a caso. Se non ce
 * n'e' nessuno buono si tiene comunque il primo, che le cifre lo allungheranno;
 * se non ce n'e' proprio nessuno -- succede coi nomi in alfabeti che qui non
 * sopravvivono alla pulizia -- si riparte dalla parola del gioco.
 */
export function usernameBase(profile: OAuthProfile): string {
  const candidati = usernameCandidates(profile);
  return candidati.find((nome) => nome.length >= MIN_NICKNAME) ?? candidati[0] ?? FALLBACK_BASE;
}

function randomDigits(count: number): string {
  let cifre = "";
  for (let i = 0; i < count; i += 1) cifre += Math.floor(Math.random() * 10);
  return cifre;
}

/**
 * Lo stesso nome con delle cifre in coda: "mario" -> "mario_738".
 *
 * Serve quando il nome e' troppo corto o quando qualcuno ce l'ha gia'. Il
 * tronco si accorcia quanto basta a far stare le cifre dentro i venti
 * caratteri: allungare un nome gia' al limite lo farebbe solo rifiutare.
 */
export function withRandomDigits(base: string, count: number): string {
  const cifre = randomDigits(count);
  const spazio = MAX_NICKNAME - cifre.length - 1;
  const tronco = (base || FALLBACK_BASE).slice(0, spazio).replace(/_+$/, "");
  return `${tronco || FALLBACK_BASE.slice(0, spazio)}_${cifre}`;
}

/**
 * I nomi da provare, in ordine: prima quello pulito, poi le varianti con le
 * cifre. Sta fuori dalla funzione che interroga il database perche' cosi' si
 * puo' mettere alla prova senza database.
 */
export function usernameAttempts(profile: OAuthProfile): string[] {
  const base = usernameBase(profile);
  const tentativi = base.length >= MIN_NICKNAME ? [base] : [];
  for (const cifre of [3, 3, 4, 4]) tentativi.push(withRandomDigits(base, cifre));
  return tentativi;
}

/**
 * Il nickname da proporre a chi entra la prima volta: pulito e libero.
 *
 * Si prova il nome vero, e solo se e' gia' di qualcun altro si passa alle
 * cifre. Non e' una prenotazione: fra questo controllo e il salvataggio
 * qualcuno puo' arrivare prima, ed e' il vincolo di unicita' del database ad
 * avere l'ultima parola. Qui si tratta solo di non mettere davanti agli occhi
 * un nome che si sa gia' occupato.
 */
export async function suggestUsername(profile: OAuthProfile): Promise<string> {
  const tentativi = usernameAttempts(profile);
  for (const tentativo of tentativi) {
    if (await isNicknameAvailable(tentativo)) return tentativo;
  }
  return tentativi[tentativi.length - 1];
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
  // L'indirizzo si ripulisce prima di guardarlo: spazi e maiuscole messe dalla
  // tastiera del telefono non devono costare la registrazione.
  const email = normalizeEmail(input.email);
  if (nickname.length < 3) throw new AuthFailure("nickname-invalid");
  if (!isStrongPassword(input.password)) throw new AuthFailure("password-weak");
  if (!isValidEmail(email)) throw new AuthFailure("email-invalid");
  if (!(await isNicknameAvailable(nickname))) throw new AuthFailure("nickname-taken");

  const { data, error } = await supabase.auth.signUp({
    email,
    password: input.password,
    options: {
      /*
       * Dove riportare chi clicca il link di conferma.
       *
       * Senza, Supabase usa l'indirizzo fisso configurato nel pannello, che di
       * base e' localhost: sul telefono di chi si iscrive e' una pagina morta.
       * Prendendo l'indirizzo da cui e' partita la registrazione funziona sia
       * dal computer di casa, sia da un collegamento temporaneo, sia dal sito
       * pubblicato, senza doverlo cambiare ogni volta.
       *
       * L'indirizzo deve comunque essere fra quelli consentiti nel pannello
       * Supabase: e' una difesa contro chi provasse a far tornare la conferma
       * su un sito suo.
       */
      emailRedirectTo:
        typeof window === "undefined" ? undefined : `${window.location.origin}/pickmates`,
    },
  });

  if (error) throw authFailure("registrazione", error);

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
    email: normalizeEmail(email),
    password,
  });
  // Le credenziali sbagliate sono il caso comune, ma non l'unico: chi non ha
  // ancora confermato l'indirizzo, o ha provato troppe volte di fila, deve
  // leggere quello, non "email o password non corretti".
  if (error) throw authFailure("accesso", error, "wrong-credentials");
}

/** Manda il link per reimpostare la password. */
export async function requestPasswordReset(email: string): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) throw new AuthFailure("offline");
  if (!isValidEmail(email)) throw new AuthFailure("email-invalid");
  const { error } = await supabase.auth.resetPasswordForEmail(normalizeEmail(email), {
    redirectTo: typeof window === "undefined" ? undefined : `${window.location.origin}/pickmates`,
  });
  if (error) throw authFailure("reimposta password", error);
}

export async function signInWithEmail(email: string): Promise<void> {
  const supabase = requireClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: normalizeEmail(email),
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
    email: normalizeEmail(email),
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
  /**
   * true quando si sa **davvero** se un profilo c'è o no.
   *
   * Non è la stessa cosa di `ready`, ed è una differenza che costa cara: la
   * sessione si legge subito, il profilo un istante dopo. In quell'istante
   * uno che ha l'account risulta "collegato ma senza profilo", che è lo
   * stesso stato di chi si è appena iscritto con Google e deve ancora
   * scegliere il nickname. Chi reagisce a quello stato senza aspettare
   * questo campo interrompe la partita di tutti a ogni ricarico.
   */
  accountReady: boolean;
  mode: AuthMode;
  session: Session | null;
  email: string | null;
  account: Account | null;
  /** Da chiamare dopo aver creato o aggiornato il profilo. */
  refreshAccount: () => void;
}

/**
 * Se si sa davvero come stanno le cose col profilo.
 *
 * Sta fuori dal gancio, in una funzione che si puo' provare, perche' e' una
 * regola che sembra ovvia e non lo e': fra il momento in cui si conosce la
 * sessione e quello in cui si conosce il profilo passa un istante, e in quello
 * istante uno che ha l'account risulta indistinguibile da uno che deve ancora
 * scegliersi il nickname.
 *
 * Chi reagisce a quello stato senza aspettare -- aprendo un pannello, per dire
 * -- lo fa addosso a chi sta giocando, a ogni ricarico di pagina.
 */
export function accountSettled(stato: {
  /** true quando si sa se una sessione c'e' o no. */
  sessionLoaded: boolean;
  hasSession: boolean;
  /** true quando il profilo e' stato cercato, che l'abbia trovato o no. */
  accountFetched: boolean;
}): boolean {
  if (!stato.sessionLoaded) return false;
  // Senza sessione non c'e' nessun profilo da aspettare: si sa gia' tutto.
  if (!stato.hasSession) return true;
  return stato.accountFetched;
}
export function useAuth(): AuthState {
  const isClient = useIsClient();
  const [session, setSession] = useState<Session | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [remoteAccount, setRemoteAccount] = useState<Account | null>(null);
  const [accountLoaded, setAccountLoaded] = useState(false);
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
        setAccountLoaded(true);
        clearPendingProfile();
        return;
      }

      // Primo accesso dopo la conferma via email: si crea il profilo scelto allora.
      const pending = readPendingProfile();
      if (!pending) {
        setRemoteAccount(null);
        setAccountLoaded(true);
        return;
      }
      try {
        const created = await createAccount(userId, pending.nickname, pending.emoji);
        if (!active) return;
        clearPendingProfile();
        setRemoteAccount(created);
        setAccountLoaded(true);
      } catch {
        // Nickname nel frattempo occupato: verrà richiesto di sceglierne un altro.
        clearPendingProfile();
        if (active) {
          setRemoteAccount(null);
          setAccountLoaded(true);
        }
      }
    });

    return () => {
      active = false;
    };
  }, [userId, version]);

  return {
    ready: mode === "local" ? isClient : loaded,
    accountReady:
      mode === "local"
        ? isClient
        : accountSettled({
            sessionLoaded: loaded,
            hasSession: Boolean(userId),
            accountFetched: accountLoaded,
          }),
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
