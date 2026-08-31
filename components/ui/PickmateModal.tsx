"use client";

import { Loader2, Swords, UserMinus } from "lucide-react";
import { useState } from "react";
import type { PresenceState } from "@/lib/presence";
import type { Pickmate } from "@/lib/pickmates";
import { useT } from "@/lib/settings";
import { Avatar } from "./Avatar";
import { Badge } from "./Badge";
import { Button } from "./Button";
import { Modal } from "./Modal";
import { PresenceDot } from "./PresenceDot";

/**
 * La scheda di un PickMate, con le due sole cose che ci si può fare: sfidarlo
 * o toglierlo dagli amici.
 *
 * Guardare la partita di qualcun altro non c'è: sarebbe una funzione a sé, con
 * i suoi problemi (chi può guardare cosa, e se chi gioca vuole essere guardato),
 * e mostrarla mezza fatta sarebbe peggio che non averla.
 *
 * La rimozione chiede conferma dentro il modal invece di aprire un secondo
 * avviso: il pulsante rosso cambia in "Confermi?" e aspetta un secondo tocco.
 */

export function PickmateModal({
  mate,
  presence,
  onClose,
  onChallenge,
  onRemove,
}: {
  mate: Pickmate | null;
  /** null quando lo stato non è consultabile: non si mostra nessun pallino. */
  presence: PresenceState | null;
  onClose: () => void;
  onChallenge: (mate: Pickmate) => Promise<void>;
  onRemove: (mate: Pickmate) => Promise<void>;
}) {
  const t = useT();
  const [busy, setBusy] = useState<"challenge" | "remove" | null>(null);
  const [confirming, setConfirming] = useState(false);

  if (!mate) return null;

  const playing = presence === "playing";

  const close = () => {
    setConfirming(false);
    setBusy(null);
    onClose();
  };

  const challenge = async () => {
    setBusy("challenge");
    try {
      await onChallenge(mate);
      close();
    } finally {
      setBusy(null);
    }
  };

  const remove = async () => {
    if (!confirming) {
      setConfirming(true);
      return;
    }
    setBusy("remove");
    try {
      await onRemove(mate);
      close();
    } finally {
      setBusy(null);
    }
  };

  return (
    <Modal open={Boolean(mate)} title={t("pickmates.profileTitle")} onClose={close}>
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3 rounded-2xl border border-line bg-surface-2 p-4">
          <Avatar id={mate.account.emoji} size="lg" />
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-2">
              <span className="truncate text-lg font-black">@{mate.account.nickname}</span>
              <PresenceDot state={presence} />
            </p>
            <p className="mt-0.5 text-xs text-faint">
              {mate.played === 0
                ? t("pickmates.playedNone")
                : mate.played === 1
                  ? t("pickmates.playedOne")
                  : t("pickmates.playedMany", { n: mate.played })}
            </p>
          </div>
          {playing ? <Badge tone="danger">{t("presence.playing")}</Badge> : null}
        </div>

        <div className="flex flex-col gap-2">
          <Button variant="primary" disabled={playing || busy !== null} onClick={challenge}>
            {busy === "challenge" ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Swords className="size-4" />
            )}
            {playing ? t("pickmates.busyNow") : t("pickmates.challenge")}
          </Button>

          {playing ? (
            <p className="text-center text-xs text-faint">{t("pickmates.busyHint")}</p>
          ) : (
            <p className="text-center text-xs text-faint">{t("pickmates.challengeHint")}</p>
          )}

          <button
            type="button"
            disabled={busy !== null}
            onClick={remove}
            className="mt-1 flex items-center justify-center gap-2 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-2.5 text-sm font-bold text-red-400 transition-colors hover:bg-red-500/20 disabled:opacity-50"
          >
            {busy === "remove" ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <UserMinus className="size-4" />
            )}
            {confirming ? t("pickmates.removeConfirm") : t("friends.remove")}
          </button>
        </div>
      </div>
    </Modal>
  );
}
