"use client";

import { Check, Loader2 } from "lucide-react";
import { useState } from "react";
import {
  nicknameAvailableFrom,
  normalizeNickname,
  renameProfile,
  updateAvatar,
  useAuth,
  type RenameResult,
} from "@/lib/auth";
import type { TranslationKey } from "@/lib/i18n";
import { useT } from "@/lib/settings";
import { AvatarPicker } from "./Avatar";
import { Button } from "./Button";
import { Input } from "./Input";
import { Modal } from "./Modal";

/**
 * Cambiare nickname e avatar.
 *
 * Le due cose hanno regole diverse e va detto: l'avatar si cambia quando si
 * vuole, il nickname una volta ogni trenta giorni. Il motivo non è capriccio —
 * il nickname è l'indirizzo con cui gli amici ti trovano e la firma che resta
 * sulle card già condivise, quindi cambiarlo ogni giorno lascerebbe in giro
 * card attribuite a un nome che nel frattempo è di qualcun altro.
 *
 * L'attesa la fa rispettare il database. Qui si mostra solo prima, per non far
 * scoprire il divieto premendo salva.
 */

const ERRORI: Record<Exclude<RenameResult, "ok">, TranslationKey> = {
  taken: "auth.errNicknameTaken",
  invalid: "auth.errNicknameInvalid",
  "too-soon": "profile.renameTooSoon",
  "not-signed-in": "auth.errUnknown",
  error: "auth.errUnknown",
};

export function EditProfile({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT();
  const { account, refreshAccount } = useAuth();

  const [nickname, setNickname] = useState<string | null>(null);
  const [emoji, setEmoji] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<TranslationKey | null>(null);
  const [done, setDone] = useState(false);

  if (!account) return null;

  const nickDraft = nickname ?? account.nickname;
  const emojiDraft = emoji ?? account.emoji;
  const bloccatoFino = nicknameAvailableFrom(account.nicknameChangedAt);
  const nickCambiato = normalizeNickname(nickDraft) !== account.nickname;

  const save = async () => {
    setBusy(true);
    setError(null);
    setDone(false);
    try {
      if (emojiDraft !== account.emoji) await updateAvatar(emojiDraft);

      if (nickCambiato) {
        const esito = await renameProfile(nickDraft);
        if (esito !== "ok") {
          setError(ERRORI[esito]);
          return;
        }
      }

      setDone(true);
      refreshAccount();
    } finally {
      setBusy(false);
    }
  };

  const close = () => {
    setNickname(null);
    setEmoji(null);
    setError(null);
    setDone(false);
    onClose();
  };

  return (
    <Modal open={open} title={t("profile.edit")} onClose={close}>
      <div className="flex flex-col gap-4">
        <div>
          <p className="mb-2 text-xs font-semibold tracking-wider text-faint uppercase">
            {t("home.avatar")}
          </p>
          <AvatarPicker value={emojiDraft} onChange={setEmoji} />
          <p className="mt-1.5 text-xs text-faint">{t("profile.avatarFree")}</p>
        </div>

        <div>
          <Input
            label={t("auth.nickname")}
            value={nickDraft}
            maxLength={20}
            disabled={Boolean(bloccatoFino)}
            onChange={(event) => setNickname(normalizeNickname(event.target.value))}
          />
          <p
            className={cnHint(Boolean(bloccatoFino))}
          >
            {bloccatoFino
              ? t("profile.renameLocked", { date: bloccatoFino.toLocaleDateString() })
              : t("profile.renameFree")}
          </p>
        </div>

        {error ? <p className="text-sm text-red-500">{t(error)}</p> : null}
        {done ? <p className="text-sm text-neon">{t("profile.saved")}</p> : null}

        <Button onClick={save} disabled={busy}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
          {t("auth.save")}
        </Button>
      </div>
    </Modal>
  );
}

/** Ambra quando il cambio è bloccato, grigio quando è libero. */
function cnHint(bloccato: boolean): string {
  return bloccato ? "mt-1.5 text-xs text-amber-400" : "mt-1.5 text-xs text-faint";
}
