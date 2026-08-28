"use client";

import { Check, LogIn, LogOut, Mail, Loader2, Smartphone } from "lucide-react";
import { useState } from "react";
import {
  createAccount,
  normalizeNickname,
  saveLocalAccount,
  signInWithEmail,
  signOut,
  useAuth,
  verifyEmailCode,
} from "@/lib/auth";
import { DEFAULT_AVATAR } from "@/lib/avatars";
import { useT } from "@/lib/settings";
import { Avatar, AvatarPicker } from "./Avatar";
import { Button } from "./Button";
import { Input } from "./Input";
import { Modal } from "./Modal";

export function AuthModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT();
  const auth = useAuth();

  return (
    <Modal open={open} title={t("auth.title")} onClose={onClose}>
      <AuthPanel onDone={onClose} key={auth.account?.id ?? auth.session?.user.id ?? "anon"} />
    </Modal>
  );
}

/** Pannello riutilizzabile: registrazione, accesso, uscita. */
export function AuthPanel({ onDone }: { onDone?: () => void }) {
  const t = useT();
  const { mode, session, email, account, refreshAccount } = useAuth();

  const [address, setAddress] = useState("");
  const [code, setCode] = useState("");
  const [nickname, setNickname] = useState("");
  const [emoji, setEmoji] = useState<string>(DEFAULT_AVATAR);
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error" | "taken">("idle");

  const sendLink = async () => {
    if (!address.trim()) return;
    setStatus("sending");
    try {
      await signInWithEmail(address);
      setStatus("sent");
    } catch {
      setStatus("error");
    }
  };

  const useCode = async () => {
    if (!code.trim()) return;
    setStatus("sending");
    try {
      await verifyEmailCode(address, code);
      setStatus("idle");
      setCode("");
    } catch {
      setStatus("error");
    }
  };

  const saveProfile = async () => {
    if (normalizeNickname(nickname).length < 3) return;
    setStatus("sending");
    try {
      if (mode === "local") {
        saveLocalAccount(nickname, emoji);
      } else if (session) {
        await createAccount(session.user.id, nickname, emoji);
        refreshAccount();
      }
      setStatus("idle");
      onDone?.();
    } catch {
      setStatus("taken");
    }
  };

  /* Profilo già pronto: si mostra e si può uscire. */
  if (account) {
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

  /* Senza database: registrazione immediata sul dispositivo. */
  if (mode === "local") {
    return (
      <div className="flex flex-col gap-3">
        <p className="flex items-start gap-2 text-sm text-muted">
          <Smartphone className="mt-0.5 size-4 shrink-0 text-neon" />
          {t("auth.localHint")}
        </p>

        <Input
          label={t("auth.nickname")}
          hint={t("auth.nicknameHint")}
          value={nickname}
          maxLength={20}
          placeholder={t("auth.nicknamePlaceholder")}
          onChange={(event) => setNickname(normalizeNickname(event.target.value))}
          onKeyDown={(event) => {
            if (event.key === "Enter") void saveProfile();
          }}
        />

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-faint">
            {t("home.avatar")}
          </p>
          <AvatarPicker value={emoji} onChange={setEmoji} />
        </div>

        <Button onClick={saveProfile} disabled={normalizeNickname(nickname).length < 3}>
          <Check className="size-4" />
          {t("auth.createProfile")}
        </Button>
      </div>
    );
  }

  /* Con database, primo passo: arriva il link via email. */
  if (!session) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm text-muted">{t("auth.subtitle")}</p>

        <Input
          label={t("auth.email")}
          type="email"
          inputMode="email"
          autoComplete="email"
          value={address}
          onChange={(event) => setAddress(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") void sendLink();
          }}
        />

        {status === "sent" ? <p className="text-sm text-neon">{t("auth.sent")}</p> : null}
        {status === "error" ? <p className="text-sm text-red-500">{t("auth.error")}</p> : null}

        <Button onClick={sendLink} disabled={status === "sending" || !address.trim()}>
          {status === "sending" ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Mail className="size-4" />
          )}
          {t("auth.send")}
        </Button>

        {status === "sent" ? (
          <div className="flex flex-col gap-2 border-t border-line pt-3">
            <Input
              label={t("auth.code")}
              inputMode="numeric"
              value={code}
              maxLength={8}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
              className="text-center font-mono text-2xl tracking-[0.3em]"
            />
            <Button variant="outline" onClick={useCode} disabled={code.trim().length < 6}>
              <LogIn className="size-4" />
              {t("auth.verify")}
            </Button>
          </div>
        ) : null}
      </div>
    );
  }

  /* Con database, secondo passo: scelta del nickname pubblico. */
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

      {status === "taken" ? (
        <p className="text-sm text-red-500">{t("auth.nicknameTaken")}</p>
      ) : null}

      <Button
        onClick={saveProfile}
        disabled={normalizeNickname(nickname).length < 3 || status === "sending"}
      >
        {status === "sending" ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Check className="size-4" />
        )}
        {t("auth.save")}
      </Button>
    </div>
  );
}
