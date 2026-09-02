"use client";

import {
  Check,
  Circle,
  Code,
  Crown,
  KeyRound,
  Loader2,
  LogIn,
  LogOut,
  Rocket,
  Smartphone,
  Target,
  Trophy,
  UserPlus,
  Users,
  Pencil,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  AuthFailure,
  MIN_PASSWORD,
  PASSWORD_SPECIALS,
  createAccount,
  isNicknameAvailable,
  isStrongPassword,
  isValidEmail,
  normalizeNickname,
  passwordChecks,
  requestPasswordReset,
  saveLocalAccount,
  signInWithPassword,
  signOut,
  signUpWithPassword,
  useAuth,
  type AuthError,
  type PasswordChecks,
  enabledProviders,
  markGreeting,
  signInWithProvider,
  type OAuthProvider,
} from "@/lib/auth";
import { DEFAULT_AVATAR } from "@/lib/avatars";
import { fetchHistory, fetchStats, type PastMatch } from "@/lib/history";
import {
  NO_PROGRESS,
  levelFor,
  trophiesFor,
  winRate,
  type PlayerProgress,
  type Trophy as TrophyData,
  type TrophyId,
} from "@/lib/levels";
import { listPickmates } from "@/lib/pickmates";
import { setPresenceVisibility } from "@/lib/presence";
import type { TranslationKey } from "@/lib/i18n";
import { useT } from "@/lib/settings";
import type { CurrencyCode } from "@/lib/types";
import { cn, money } from "@/lib/utils";
import { AppleGlyph, FacebookGlyph, GoogleGlyph } from "./BrandGlyphs";
import { Avatar, AvatarPicker } from "./Avatar";
import { Button } from "./Button";
import { Input } from "./Input";
import { LevelBar } from "./LevelBar";
import { EditProfile } from "./EditProfile";
import { Modal } from "./Modal";
import { Rewards } from "./Rewards";
import { Switch } from "./Switch";

const ERROR_KEYS: Record<AuthError, TranslationKey> = {
  "nickname-taken": "auth.errNicknameTaken",
  "nickname-invalid": "auth.errNicknameInvalid",
  "email-invalid": "auth.errEmailInvalid",
  "password-short": "auth.errPasswordShort",
  "password-weak": "auth.errPasswordWeak",
  "password-leaked": "auth.errPasswordLeaked",
  "wrong-credentials": "auth.errWrongCredentials",
  "email-taken": "auth.errEmailTaken",
  "email-unconfirmed": "auth.errEmailUnconfirmed",
  "confirm-email": "auth.confirmSent",
  "too-many": "auth.errTooMany",
  "signup-closed": "auth.errSignupClosed",
  offline: "auth.errOffline",
  unknown: "auth.errUnknown",
};

export function AuthModal({
  open,
  onClose,
  initialTab = "in",
}: {
  open: boolean;
  onClose: () => void;
  /** "up" per aprirsi direttamente sulla registrazione. */
  initialTab?: Tab;
}) {
  const t = useT();
  const auth = useAuth();

  return (
    <Modal open={open} title={t(auth.account ? "auth.myProfile" : "auth.title")} onClose={onClose}>
      <AuthPanel
        onDone={onClose}
        initialTab={initialTab}
        key={`${auth.account?.id ?? auth.session?.user.id ?? "anon"}:${initialTab}`}
      />
    </Modal>
  );
}

export function AuthPanel({
  onDone,
  initialTab = "in",
}: {
  onDone?: () => void;
  initialTab?: Tab;
}) {
  const { mode, session, email, account, refreshAccount } = useAuth();

  /* Profilo già pronto. */
  if (account) {
    return <AccountCard onDone={onDone} />;
  }

  /* Sessione attiva ma nickname ancora da scegliere. */
  if (mode === "supabase" && session) {
    return <NicknameForm userId={session.user.id} email={email} onSaved={refreshAccount} onDone={onDone} />;
  }

  /* Senza database non esiste un accesso vero: si offre il profilo locale. */
  if (mode === "local") {
    return <LocalProfileForm onDone={onDone} />;
  }

  return <CredentialsForm onDone={onDone} initialTab={initialTab} />;
}

/* ------------------------------------------------------------------ */

function AccountCard({ onDone }: { onDone?: () => void }) {
  const t = useT();
  const router = useRouter();
  const { account, email, refreshAccount } = useAuth();
  const [progress, setProgress] = useState<PlayerProgress | null>(null);
  const [history, setHistory] = useState<PastMatch[] | null>(null);
  /*
   * Copia locale dell'interruttore: il giro fino al database e ritorno e'
   * abbastanza lungo da far sembrare che il tocco non abbia funzionato.
   */
  const [presenceDraft, setPresenceDraft] = useState<boolean | null>(null);
  const [editing, setEditing] = useState(false);

  const userId = account?.id ?? null;
  const showsPresence = presenceDraft ?? account?.showsPresence !== false;

  const togglePresence = (next: boolean) => {
    setPresenceDraft(next);
    void setPresenceVisibility(next).then(refreshAccount);
  };

  /* Statistiche e Pickmates: due letture, una sola attesa. */
  useEffect(() => {
    if (!userId) return;
    let active = true;
    Promise.all([fetchStats(userId), listPickmates(userId), fetchHistory(userId, 6)]).then(
      ([stats, mates, past]) => {
        if (!active) return;
        setProgress({
          played: stats.played,
          won: stats.won,
          mates: mates.filter((mate) => mate.status === "accepted").length,
          // L'esperienza vive sul profilo, non nello storico: e' l'unico
          // numero che il giocatore non puo' scriversi da solo.
          xp: account?.xp ?? 0,
        });
        setHistory(past);
      },
    );
    return () => {
      active = false;
    };
  }, [userId, account?.xp]);

  if (!account) return null;

  const numbers = progress ?? NO_PROGRESS;
  const level = levelFor(numbers.xp);
  const trophies = trophiesFor(numbers);

  return (
    <div className="flex flex-col gap-3">
      {/*
        Chi sei e a che punto sei. La cornice dell'avatar prende il colore
        della fascia: e' la ricompensa che si vede per prima, e cambia da sola
        salendo di livello senza doverla scegliere.
      */}
      <div className="rounded-2xl border border-neon/40 bg-neon/10 p-4">
        <div className="flex items-center gap-3">
          <span className={cn("rounded-full ring-2 ring-offset-2 ring-offset-ink", level.tier.ring)}>
            <Avatar id={account.emoji} size="lg" selected />
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-1.5">
              <span className="truncate font-black">@{account.nickname}</span>
              {level.tier.id === "whale" ? <Crown className="size-3.5 shrink-0 text-gold" /> : null}
              <button
                type="button"
                onClick={() => setEditing(true)}
                aria-label={t("profile.edit")}
                title={t("profile.edit")}
                className="ms-auto shrink-0 rounded-lg p-1 text-faint transition-colors hover:text-neon"
              >
                <Pencil className="size-3.5" />
              </button>
            </span>
            {account.title ? (
              <span className="mt-0.5 block truncate text-xs font-semibold text-gold">
                {account.title}
              </span>
            ) : null}
            <span className="mt-0.5 block truncate text-xs text-muted">
              {email ?? t("auth.localProfile")}
            </span>
          </span>
        </div>

        <LevelBar xp={numbers.xp} className="mt-3" />
      </div>

      {/* Le quattro cifre che contano. */}
      <div className="grid grid-cols-2 gap-2">
        <StatCard emoji="🎮" value={numbers.played} label={t("stats.played")} />
        <StatCard emoji="🏆" value={numbers.won} label={t("stats.won")} tone="gold" />
        <StatCard emoji="📈" value={`${winRate(numbers)}%`} label={t("stats.rate")} tone="neon" />
        <StatCard emoji="👥" value={numbers.mates} label={t("nav.pickmates")} tone="violet" />
      </div>

      {/*
        Lo stato di attivita'. La reciprocita' e' scritta nell'avviso perche' e'
        una conseguenza che sorprenderebbe: spegnendolo si smette anche di
        vedere gli altri, e chi non lo sa penserebbe a un guasto.
      */}
      <div className="rounded-2xl border border-line bg-surface-2 p-3">
        <Switch
          checked={showsPresence}
          onChange={togglePresence}
          label={t("presence.share")}
          hint={t("presence.shareHint")}
        />
      </div>

      <EditProfile open={editing} onClose={() => setEditing(false)} />

      <Rewards level={level} />

      {/* Trofei: spenti finche' non si sbloccano. */}
      <div className="rounded-2xl border border-line bg-surface-2 p-3">
        <p className="mb-2.5 text-[11px] font-bold uppercase tracking-wider text-faint">
          {t("trophy.title")}
        </p>
        <div className="grid grid-cols-3 gap-2">
          {trophies.map((trophy) => (
            <TrophyBadge key={trophy.id} trophy={trophy} />
          ))}
        </div>
      </div>

      {/*
        Le ultime partite. E' la parte che rende vera la frase "l'altra
        settimana ti ho battuto": i totali da soli non raccontano niente.
      */}
      {history && history.length > 0 ? (
        <div className="rounded-2xl border border-line bg-surface-2 p-3">
          <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-faint">
            {t("history.title")}
          </p>
          <div className="flex flex-col gap-1.5">
            {history.map((match) => (
              <div key={match.id} className="flex items-center gap-2 text-sm">
                <span
                  className={cn(
                    "grid size-6 shrink-0 place-items-center rounded-md font-mono text-[11px] font-black",
                    match.position === 1 ? "bg-gold/20 text-gold" : "bg-surface text-faint",
                  )}
                >
                  {match.position}
                </span>
                <span className="min-w-0 flex-1 truncate">{match.category}</span>
                <span className="shrink-0 font-mono text-xs text-faint">
                  {money(match.spent, match.currency as CurrencyCode)}
                </span>
                <span className="shrink-0 text-[11px] text-faint">
                  {formatDay(match.playedAt)}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* Chi non ha ancora giocato non ha statistiche da guardare: ha una partita da fare. */}
      {numbers.played === 0 ? (
        <div className="rounded-2xl border border-violet/40 bg-violet/10 p-4 text-center">
          <p className="text-sm font-bold">{t("profile.firstDraft")}</p>
          <p className="mt-1 text-xs text-muted">{t("profile.firstDraftHint")}</p>
          <Button
            variant="violet"
            className="mt-3 w-full"
            onClick={() => {
              onDone?.();
              router.push("/create");
            }}
          >
            <Rocket className="size-4" />
            {t("profile.firstDraftCta")}
          </Button>
        </div>
      ) : null}

      <Button
        variant="danger"
        onClick={async () => {
          await signOut();
          onDone?.();
        }}
      >
        <LogOut className="size-4" />
        {t("auth.signOut")}
      </Button>
    </div>
  );
}

/** Una cifra del profilo, con la sua icona. */
function StatCard({
  emoji,
  value,
  label,
  tone,
}: {
  emoji: string;
  value: number | string;
  label: string;
  tone?: "gold" | "neon" | "violet";
}) {
  return (
    <div className="rounded-2xl border border-line bg-surface-2 p-3">
      <span className="text-lg leading-none">{emoji}</span>
      <p
        className={cn(
          "mt-1 font-mono text-2xl font-black leading-none",
          tone === "gold"
            ? "text-gold"
            : tone === "neon"
              ? "text-neon"
              : tone === "violet"
                ? "text-violet"
                : "text-fg",
        )}
      >
        {value}
      </p>
      <p className="mt-1 text-[10px] uppercase tracking-wider text-faint">{label}</p>
    </div>
  );
}

/** Un trofeo: acceso quando e' stato conquistato, spento con il conto alla mano. */
function TrophyBadge({ trophy }: { trophy: TrophyData }) {
  const t = useT();
  const Icon = TROPHY_ICONS[trophy.id];
  return (
    <div
      title={t(trophy.hint)}
      className={cn(
        "flex flex-col items-center gap-1 rounded-xl border p-2 text-center transition-colors",
        trophy.unlocked
          ? "border-gold/50 bg-gold/10 text-gold"
          : "border-line bg-surface text-faint/60",
      )}
    >
      <Icon className={cn("size-6", trophy.unlocked ? "" : "opacity-50")} />
      <span className="text-[10px] font-bold leading-tight">{t(trophy.name)}</span>
      <span className="font-mono text-[10px] text-faint">
        {trophy.progress}/{trophy.target}
      </span>
    </div>
  );
}

const TROPHY_ICONS: Record<TrophyId, typeof Target> = {
  first: Target,
  win: Trophy,
  pack: Users,
};

/* ------------------------------------------------------------------ */

type Tab = "in" | "up";

function CredentialsForm({
  onDone,
  initialTab = "in",
}: {
  onDone?: () => void;
  initialTab?: Tab;
}) {
  const t = useT();
  const [tab, setTab] = useState<Tab>(initialTab);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nickname, setNickname] = useState("");
  const [emoji, setEmoji] = useState<string>(DEFAULT_AVATAR);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<TranslationKey | null>(null);
  const [notice, setNotice] = useState<TranslationKey | null>(null);
  const [nickFree, setNickFree] = useState<boolean | null>(null);

  const cleanNick = normalizeNickname(nickname);

  /* Controllo della disponibilità mentre si scrive. */
  useEffect(() => {
    if (tab !== "up" || cleanNick.length < 3) return;
    let active = true;
    const timer = setTimeout(() => {
      isNicknameAvailable(cleanNick).then((free) => {
        if (active) setNickFree(free);
      });
    }, 400);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [cleanNick, tab]);

  const fail = (reason: AuthError) => setError(ERROR_KEYS[reason]);

  const submit = async () => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      if (tab === "in") {
        await signInWithPassword(email, password);
        markGreeting("in");
        onDone?.();
      } else {
        const { confirmationRequired } = await signUpWithPassword({
          email,
          password,
          nickname: cleanNick,
          emoji,
        });
        if (confirmationRequired) {
          setNotice("auth.confirmSent");
        } else {
          markGreeting("up");
          onDone?.();
        }
      }
    } catch (cause) {
      fail(cause instanceof AuthFailure ? cause.reason : "unknown");
    } finally {
      setBusy(false);
    }
  };

  const forgot = async () => {
    if (!isValidEmail(email)) return fail("email-invalid");
    setBusy(true);
    setError(null);
    try {
      await requestPasswordReset(email);
      setNotice("auth.resetSent");
    } catch {
      fail("unknown");
    } finally {
      setBusy(false);
    }
  };

  // In accesso basta che la password ci sia: la giudica il servizio. In
  // registrazione devono essere soddisfatti tutti e quattro i requisiti.
  const ready =
    // Lo stesso controllo che fa il servizio, non una chiocciola qualunque:
    // altrimenti il pulsante si accende su un indirizzo che verra' rifiutato.
    isValidEmail(email) &&
    (tab === "in"
      ? password.length > 0
      : isStrongPassword(password) && cleanNick.length >= 3 && nickFree !== false);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-1 rounded-full border border-line bg-surface-2 p-1">
        {(["in", "up"] as Tab[]).map((key) => (
          <button
            key={key}
            type="button"
            aria-pressed={tab === key}
            onClick={() => {
              setTab(key);
              setError(null);
              setNotice(null);
            }}
            className={cn(
              "flex-1 rounded-full px-3 py-2 text-sm font-bold transition-colors",
              tab === key ? "bg-neon text-ink" : "text-muted hover:text-fg",
            )}
          >
            {t(key === "in" ? "auth.tabSignIn" : "auth.tabSignUp")}
          </button>
        ))}
      </div>

      <SocialButtons onError={() => setError(ERROR_KEYS.unknown)} />

      {tab === "up" ? (
        <>
          <div>
            <Input
              label={t("auth.nickname")}
              hint={t("auth.nicknameHint")}
              value={nickname}
              maxLength={20}
              placeholder={t("auth.nicknamePlaceholder")}
              onChange={(event) => {
                setNickname(normalizeNickname(event.target.value));
                setNickFree(null);
              }}
            />
            {cleanNick.length >= 3 ? (
              <p
                className={cn(
                  "mt-1 text-xs",
                  nickFree === null ? "text-faint" : nickFree ? "text-neon" : "text-red-500",
                )}
              >
                {nickFree === null
                  ? t("auth.nicknameChecking")
                  : nickFree
                    ? t("auth.nicknameFree")
                    : t("auth.errNicknameTaken")}
              </p>
            ) : null}
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-faint">
              {t("home.avatar")}
            </p>
            <AvatarPicker value={emoji} onChange={setEmoji} />
          </div>

          {/*
            Le due regole sono diverse e va detto adesso, non quando si prova a
            cambiare: l'avatar e' libero, il nickname aspetta trenta giorni.
          */}
          <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs leading-relaxed text-amber-400">
            {t("auth.identityNotice")}
          </p>
        </>
      ) : null}

      <Input
        label={t("auth.email")}
        type="email"
        inputMode="email"
        autoComplete="email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
      />

      <div>
        <Input
          label={t("auth.password")}
          type="password"
          autoComplete={tab === "in" ? "current-password" : "new-password"}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && ready) void submit();
          }}
        />
        {tab === "up" ? <PasswordRules password={password} /> : null}
      </div>

      {error ? (
        <p className="text-sm text-red-500">{t(error, { n: MIN_PASSWORD })}</p>
      ) : null}
      {notice ? <p className="text-sm text-neon">{t(notice)}</p> : null}

      <Button size="lg" onClick={submit} disabled={busy || !ready}>
        {busy ? (
          <Loader2 className="size-4 animate-spin" />
        ) : tab === "in" ? (
          <LogIn className="size-5" />
        ) : (
          <UserPlus className="size-5" />
        )}
        {t(tab === "in" ? "auth.signIn" : "auth.signUp")}
      </Button>

      {tab === "in" ? (
        <button
          type="button"
          onClick={forgot}
          className="flex items-center justify-center gap-1.5 text-xs text-faint transition-colors hover:text-fg"
        >
          <KeyRound className="size-3.5" />
          {t("auth.forgot")}
        </button>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */

/**
 * Le quattro condizioni della password, che si accendono di verde mentre si
 * scrive. Finché una resta grigia il pulsante "Registrati" non si attiva.
 */
function PasswordRules({ password }: { password: string }) {
  const t = useT();
  const checks = passwordChecks(password);
  const rules: { key: keyof PasswordChecks; label: string }[] = [
    { key: "length", label: t("auth.ruleLength", { n: MIN_PASSWORD }) },
    { key: "upper", label: t("auth.ruleUpper") },
    { key: "digit", label: t("auth.ruleDigit") },
    { key: "special", label: t("auth.ruleSpecial", { chars: PASSWORD_SPECIALS }) },
  ];

  return (
    <ul className="mt-2 grid gap-1.5 sm:grid-cols-2">
      {rules.map(({ key, label }) => {
        const done = checks[key];
        return (
          <li
            key={key}
            className={cn(
              "flex items-center gap-1.5 text-xs transition-colors",
              done ? "text-neon" : "text-faint",
            )}
          >
            {done ? (
              <Check className="size-3.5 shrink-0" />
            ) : (
              <Circle className="size-3.5 shrink-0" />
            )}
            {label}
          </li>
        );
      })}
    </ul>
  );
}

/* ------------------------------------------------------------------ */

function NicknameForm({
  userId,
  email,
  onSaved,
  onDone,
}: {
  userId: string;
  email: string | null;
  onSaved: () => void;
  onDone?: () => void;
}) {
  const t = useT();
  const [nickname, setNickname] = useState("");
  const [emoji, setEmoji] = useState<string>(DEFAULT_AVATAR);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<TranslationKey | null>(null);

  const clean = normalizeNickname(nickname);

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await createAccount(userId, clean, emoji);
      onSaved();
      onDone?.();
    } catch (cause) {
      setError(ERROR_KEYS[cause instanceof AuthFailure ? cause.reason : "unknown"]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted">{t("auth.signedAs", { email: email ?? "" })}</p>

      <Input
        label={t("auth.nickname")}
        hint={t("auth.nicknameHint")}
        value={nickname}
        maxLength={20}
        placeholder={t("auth.nicknamePlaceholder")}
        onChange={(event) => setNickname(normalizeNickname(event.target.value))}
      />

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-faint">
          {t("home.avatar")}
        </p>
        <AvatarPicker value={emoji} onChange={setEmoji} />
      </div>

      {error ? <p className="text-sm text-red-500">{t(error)}</p> : null}

      <Button size="lg" onClick={save} disabled={busy || clean.length < 3}>
        {busy ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-5" />}
        {t("auth.save")}
      </Button>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function LocalProfileForm({ onDone }: { onDone?: () => void }) {
  const t = useT();
  const [nickname, setNickname] = useState("");
  const [emoji, setEmoji] = useState<string>(DEFAULT_AVATAR);
  const [error, setError] = useState<TranslationKey | null>(null);

  const clean = normalizeNickname(nickname);

  const save = () => {
    if (clean.length < 3) {
      setError("auth.errNicknameInvalid");
      return;
    }
    saveLocalAccount(clean, emoji);
    onDone?.();
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl border border-line bg-surface-2 p-4">
        <p className="flex items-center gap-2 font-bold">
          <Smartphone className="size-4 shrink-0 text-neon" />
          {t("auth.noAccountTitle")}
        </p>
        <p className="mt-1.5 text-sm text-muted">{t("auth.noAccountHint")}</p>
      </div>

      <Input
        label={t("auth.nickname")}
        hint={t("auth.nicknameHint")}
        value={nickname}
        maxLength={20}
        placeholder={t("auth.nicknamePlaceholder")}
        onChange={(event) => {
          setNickname(normalizeNickname(event.target.value));
          setError(null);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") save();
        }}
      />

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-faint">
          {t("home.avatar")}
        </p>
        <AvatarPicker value={emoji} onChange={setEmoji} />
      </div>

      {error ? <p className="text-sm text-red-500">{t(error)}</p> : null}

      <Button size="lg" onClick={save}>
        <Check className="size-5" />
        {t("auth.playLocal")}
      </Button>
    </div>
  );
}

/* ------------------------------------------------------------------ */

/**
 * Entrare con un profilo che si ha gia': niente email da confermare, niente
 * password da inventare. Compaiono solo i servizi accesi sul progetto: se non
 * ce n'e' nessuno, questo blocco non esiste proprio.
 *
 * Dopo il rientro la sessione c'e' ma il profilo di gioco no, quindi il
 * pannello mostra da solo la scelta di nickname e avatar: e' l'unica cosa che
 * resta da fare.
 */
function SocialButtons({ onError }: { onError: () => void }) {
  const t = useT();
  const [providers, setProviders] = useState<OAuthProvider[] | null>(null);
  const [busy, setBusy] = useState<OAuthProvider | null>(null);

  useEffect(() => {
    let active = true;
    enabledProviders().then((list) => {
      if (active) setProviders(list);
    });
    return () => {
      active = false;
    };
  }, []);

  if (!providers || providers.length === 0) return null;

  const start = async (provider: OAuthProvider) => {
    setBusy(provider);
    try {
      await signInWithProvider(provider);
    } catch {
      setBusy(null);
      onError();
    }
  };

  return (
    <div className="flex flex-col gap-2">
      {providers.map((provider) => {
        const { label, icon, className } = PROVIDER_LOOK[provider];
        return (
          <button
            key={provider}
            type="button"
            disabled={busy !== null}
            onClick={() => start(provider)}
            className={cn(
              "flex h-12 items-center justify-center gap-2.5 rounded-xl font-bold transition-all disabled:opacity-60",
              className,
            )}
          >
            {busy === provider ? <Loader2 className="size-5 animate-spin" /> : icon}
            {t(label)}
          </button>
        );
      })}

      {/* Separatore fra l'accesso rapido e quello con email. */}
      <div className="my-1 flex items-center gap-3">
        <span className="h-px flex-1 bg-line" />
        <span className="text-[11px] font-bold uppercase tracking-wider text-faint">
          {t("auth.or")}
        </span>
        <span className="h-px flex-1 bg-line" />
      </div>
    </div>
  );
}

/** Aspetto di ogni servizio: colore ufficiale e simbolo. */
const PROVIDER_LOOK: Record<
  OAuthProvider,
  { label: TranslationKey; icon: React.ReactNode; className: string }
> = {
  google: {
    label: "auth.google",
    icon: <GoogleGlyph className="size-5" />,
    className: "bg-white text-[#1f1f1f] hover:bg-zinc-100",
  },
  apple: {
    label: "auth.apple",
    icon: <AppleGlyph className="size-5" />,
    className: "bg-black text-white ring-1 ring-white/20 hover:bg-zinc-900",
  },
  facebook: {
    label: "auth.facebook",
    icon: <FacebookGlyph className="size-5" />,
    className: "bg-[#1877F2] text-white hover:bg-[#0f5fd0]",
  },
  github: {
    label: "auth.github",
    icon: <Code className="size-5" />,
    className: "bg-surface-2 text-fg ring-1 ring-line hover:ring-neon/50",
  },
};

/** Giorno e mese, senza l'anno: serve a collocare, non a datare. */
function formatDay(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getDate()}/${date.getMonth() + 1}`;
}
