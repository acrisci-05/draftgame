"use client";

import { Check, KeyRound, Loader2, LogIn, LogOut, Smartphone, UserPlus } from "lucide-react";
import { useEffect, useState } from "react";
import {
  AuthFailure,
  MIN_PASSWORD,
  createAccount,
  isNicknameAvailable,
  normalizeNickname,
  requestPasswordReset,
  saveLocalAccount,
  signInWithPassword,
  signOut,
  signUpWithPassword,
  useAuth,
  type AuthError,
} from "@/lib/auth";
import { DEFAULT_AVATAR } from "@/lib/avatars";
import type { TranslationKey } from "@/lib/i18n";
import { useT } from "@/lib/settings";
import { cn } from "@/lib/utils";
import { Avatar, AvatarPicker } from "./Avatar";
import { Button } from "./Button";
import { Input } from "./Input";
import { Modal } from "./Modal";

const ERROR_KEYS: Record<AuthError, TranslationKey> = {
  "nickname-taken": "auth.errNicknameTaken",
  "nickname-invalid": "auth.errNicknameInvalid",
  "email-invalid": "auth.errEmailInvalid",
  "password-short": "auth.errPasswordShort",
  "wrong-credentials": "auth.errWrongCredentials",
  "email-taken": "auth.errEmailTaken",
  "confirm-email": "auth.confirmSent",
  offline: "auth.errOffline",
  unknown: "auth.errUnknown",
};

export function AuthModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT();
  const auth = useAuth();

  return (
    <Modal open={open} title={t("auth.title")} onClose={onClose}>
      <AuthPanel onDone={onClose} key={auth.account?.id ?? auth.session?.user.id ?? "anon"} />
    </Modal>
  );
}

export function AuthPanel({ onDone }: { onDone?: () => void }) {
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

  return <CredentialsForm onDone={onDone} />;
}

/* ------------------------------------------------------------------ */

function AccountCard({ onDone }: { onDone?: () => void }) {
  const t = useT();
  const { account, email } = useAuth();
  if (!account) return null;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3 rounded-2xl border border-neon/40 bg-neon/10 p-4">
        <Avatar id={account.emoji} size="lg" selected />
        <span className="min-w-0">
          <span className="block truncate font-black">@{account.nickname}</span>
          <span className="block truncate text-xs text-muted">
            {email ?? t("auth.localProfile")}
          </span>
        </span>
      </div>

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

/* ------------------------------------------------------------------ */

type Tab = "in" | "up";

function CredentialsForm({ onDone }: { onDone?: () => void }) {
  const t = useT();
  const [tab, setTab] = useState<Tab>("in");
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
        onDone?.();
      } else {
        const { confirmationRequired } = await signUpWithPassword({
          email,
          password,
          nickname: cleanNick,
          emoji,
        });
        if (confirmationRequired) setNotice("auth.confirmSent");
        else onDone?.();
      }
    } catch (cause) {
      fail(cause instanceof AuthFailure ? cause.reason : "unknown");
    } finally {
      setBusy(false);
    }
  };

  const forgot = async () => {
    if (!email.includes("@")) return fail("email-invalid");
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

  const ready =
    email.includes("@") &&
    password.length >= MIN_PASSWORD &&
    (tab === "in" || (cleanNick.length >= 3 && nickFree !== false));

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

      <Input
        label={t("auth.password")}
        hint={tab === "up" ? t("auth.passwordHint", { n: MIN_PASSWORD }) : undefined}
        type="password"
        autoComplete={tab === "in" ? "current-password" : "new-password"}
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && ready) void submit();
        }}
      />

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
