"use client";

import { LogIn } from "lucide-react";
import { useState } from "react";
import { useT } from "@/lib/settings";
import { ROOM_CODE_LENGTH } from "@/lib/utils";
import { Button } from "./Button";
import { Modal } from "./Modal";

interface JoinModalProps {
  open: boolean;
  onClose: () => void;
  onJoin: (code: string) => void;
}

/** Modal compatto: input centrato per il codice stanza e conferma. */
export function JoinModal({ open, onClose, onJoin }: JoinModalProps) {
  const t = useT();
  const [code, setCode] = useState("");

  const clean = code.trim().toUpperCase();
  const ready = clean.length === ROOM_CODE_LENGTH;

  const submit = () => {
    if (!ready) return;
    onJoin(clean);
    setCode("");
  };

  return (
    <Modal open={open} title={t("home.joinCta")} onClose={onClose}>
      <div className="flex flex-col items-center gap-4">
        <p className="text-center text-sm text-muted">{t("home.joinHint")}</p>

        <input
          value={code}
          autoFocus
          maxLength={ROOM_CODE_LENGTH}
          inputMode="text"
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          placeholder={t("home.codePlaceholder")}
          aria-label={t("home.joinCta")}
          onChange={(event) =>
            setCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))
          }
          onKeyDown={(event) => {
            if (event.key === "Enter") submit();
          }}
          className="h-20 w-full rounded-2xl border border-line bg-surface-2 text-center font-mono text-4xl font-black uppercase tracking-[0.4em] text-fg placeholder:text-faint/40 focus:border-neon/70 focus:outline-none"
        />

        <Button size="lg" className="w-full" disabled={!ready} onClick={submit}>
          <LogIn className="size-5" />
          {t("home.enter")}
        </Button>
      </div>
    </Modal>
  );
}
