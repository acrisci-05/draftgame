"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check, Download, PlusSquare, Share, X } from "lucide-react";
import { useState } from "react";
import type { TranslationKey } from "@/lib/i18n";
import { dismissInstall, useInstallState, type Platform } from "@/lib/pwa";
import { useT } from "@/lib/settings";
import { cn } from "@/lib/utils";
import { Button } from "./Button";
import { LogoMark } from "./Logo";
import { Modal } from "./Modal";

type Tab = Exclude<Platform, "desktop">;

const STEPS: Record<Tab, TranslationKey[]> = {
  ios: ["install.ios1", "install.ios2", "install.ios3"],
  android: ["install.android1", "install.android2", "install.android3"],
};

/** Istruzioni per aggiungere il sito alla schermata Home, con selettore del dispositivo. */
export function InstallPwaModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT();
  const { platform, installed, promptInstall } = useInstallState();
  const [tab, setTab] = useState<Tab | null>(null);
  const active: Tab = tab ?? (platform === "android" ? "android" : "ios");

  return (
    <Modal open={open} title={t("install.title")} onClose={onClose}>
      <div className="flex flex-col gap-4">
        <p className="flex items-center gap-2 text-sm text-muted">
          <Share className="size-4 shrink-0 text-neon" />
          {t("install.subtitle")}
        </p>

        {installed ? (
          <p className="flex items-center gap-2 rounded-xl border border-neon/40 bg-neon/10 p-3 text-sm font-semibold text-neon">
            <Check className="size-4 shrink-0" />
            {t("install.done")}
          </p>
        ) : null}

        <div className="flex gap-1 rounded-full border border-line bg-surface-2 p-1">
          {(["ios", "android"] as Tab[]).map((key) => (
            <button
              key={key}
              type="button"
              aria-pressed={active === key}
              onClick={() => setTab(key)}
              className={cn(
                "flex-1 rounded-full px-3 py-2 text-sm font-bold transition-colors",
                active === key ? "bg-neon text-ink" : "text-muted hover:text-fg",
              )}
            >
              {t(key === "ios" ? "install.ios" : "install.android")}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.ol
            key={active}
            initial={{ opacity: 0, x: active === "ios" ? -8 : 8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="flex list-none flex-col gap-2 p-0"
          >
            {STEPS[active].map((key, index) => (
              <li
                key={key}
                className="flex items-start gap-3 rounded-2xl border border-white/5 bg-zinc-900 p-3.5 text-zinc-100"
              >
                <span className="grid size-8 shrink-0 place-items-center rounded-full bg-neon font-black text-ink">
                  {index + 1}
                </span>
                <span className="min-w-0">
                  <span className="block text-[11px] font-bold uppercase tracking-wider text-zinc-500">
                    {t("install.step", { n: index + 1 })}
                  </span>
                  <span className="mt-0.5 flex items-center gap-1.5 text-sm">
                    {index === 0 && active === "ios" ? (
                      <Share className="size-4 shrink-0 text-neon" />
                    ) : null}
                    {index === 1 ? <PlusSquare className="size-4 shrink-0 text-neon" /> : null}
                    {t(key)}
                  </span>
                </span>
              </li>
            ))}
          </motion.ol>
        </AnimatePresence>

        {promptInstall ? (
          <Button onClick={() => void promptInstall().then(onClose)}>
            <Download className="size-4" />
            {t("install.now")}
          </Button>
        ) : null}

        <Button
          variant="ghost"
          onClick={() => {
            dismissInstall();
            onClose();
          }}
        >
          {t("install.later")}
        </Button>
      </div>
    </Modal>
  );
}

/** Striscia in basso su telefono: invita a installare e apre le istruzioni. */
export function PwaInstallBanner() {
  const t = useT();
  const { ready, mobile, installed, dismissed } = useInstallState();
  const [open, setOpen] = useState(false);

  const visible = ready && mobile && !installed && !dismissed;

  return (
    <>
      <AnimatePresence>
        {visible ? (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 28 }}
            className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-zinc-950/95 p-3 backdrop-blur safe-bottom sm:hidden"
          >
            <div className="mx-auto flex w-full max-w-2xl items-center gap-3">
              {/*
                Il logo, non un'icona qualunque: un banner che invita a
                installare "qualcosa" viene scacciato, uno che mostra la cosa
                che stai gia' usando si capisce in un colpo d'occhio.
              */}
              <LogoMark size={44} className="shrink-0" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-bold text-zinc-100">
                  {t("install.title")}
                </span>
                <span className="block truncate text-xs text-zinc-400">{t("install.banner")}</span>
              </span>
              <Button size="sm" className="shrink-0" onClick={() => setOpen(true)}>
                {t("install.now")}
              </Button>
              <button
                type="button"
                aria-label={t("install.later")}
                onClick={dismissInstall}
                className="shrink-0 rounded-lg p-1.5 text-zinc-500 transition-colors hover:text-zinc-100"
              >
                <X className="size-4" />
              </button>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <InstallPwaModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
