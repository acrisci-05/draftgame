"use client";

import { KeyRound, LockOpen, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { isAdminConfigured, lockAdmin, unlockAdmin, useAdmin } from "@/lib/admin";
import { useT } from "@/lib/settings";
import { Button } from "./Button";
import { Input } from "./Input";
import { Modal } from "./Modal";

export function AdminModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT();
  const isAdmin = useAdmin();
  const [key, setKey] = useState("");
  const [error, setError] = useState(false);

  const unlock = () => {
    if (unlockAdmin(key)) {
      setKey("");
      setError(false);
      onClose();
      return;
    }
    setError(true);
  };

  return (
    <Modal open={open} title={t("admin.title")} onClose={onClose}>
      {isAdmin ? (
        <div className="flex flex-col gap-4">
          <p className="flex items-center gap-2 rounded-xl border border-neon/40 bg-neon/10 p-3 text-sm font-semibold text-neon">
            <ShieldCheck className="size-5 shrink-0" />
            {t("admin.active")}
          </p>
          <Button
            variant="danger"
            onClick={() => {
              lockAdmin();
              onClose();
            }}
          >
            {t("admin.lock")}
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-muted">{t("admin.hint")}</p>

          <Input
            label={t("admin.key")}
            type="password"
            value={key}
            autoComplete="off"
            onChange={(event) => {
              setKey(event.target.value);
              setError(false);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") unlock();
            }}
          />

          {error ? <p className="text-sm text-red-500">{t("admin.invalid")}</p> : null}
          {!isAdminConfigured ? (
            <p className="text-xs text-faint">{t("admin.devNote")}</p>
          ) : null}

          <Button onClick={unlock} disabled={!key.trim()}>
            <LockOpen className="size-4" />
            {t("admin.unlock")}
          </Button>
        </div>
      )}
    </Modal>
  );
}

export function AdminLocked({ onOpen }: { onOpen: () => void }) {
  const t = useT();

  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-line bg-surface p-8 text-center">
      <KeyRound className="size-8 text-faint" />
      <p className="text-sm text-muted">{t("admin.locked")}</p>
      <Button variant="outline" onClick={onOpen}>
        <LockOpen className="size-4" />
        {t("admin.unlock")}
      </Button>
    </div>
  );
}
