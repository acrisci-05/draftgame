"use client";

import { AnimatePresence, motion } from "framer-motion";
import { LogOut, UserRound, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { consumeGreeting, signOut, useAuth } from "@/lib/auth";
import { openPanel } from "@/lib/panels";
import { useT } from "@/lib/settings";
import { showToast } from "@/lib/toast";
import { Avatar } from "./Avatar";

/**
 * Chi sei, in barra.
 *
 * Da spento è un pulsante "Accedi" stretto; da acceso mostra avatar, pallino
 * verde e nickname, e al tocco apre le tre voci che servono davvero. Sul
 * telefono il nickname sparisce e resta il solo avatar: la barra ha già cinque
 * comandi e non deve andare a capo.
 */
export function AccountChip() {
  const t = useT();
  const router = useRouter();
  const { account, ready } = useAuth();
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  /*
   * Il saluto: si da' quando il profilo compare davvero, cosi' il nome e'
   * quello giusto. Funziona anche al rientro da Google, dove la pagina e' stata
   * ricaricata da capo, e non si ripete al secondo caricamento perche' il
   * segnale si consuma.
   */
  useEffect(() => {
    if (!account) return;
    const greeting = consumeGreeting();
    if (!greeting) return;
    showToast(
      t(greeting === "up" ? "auth.welcomeNew" : "auth.welcomeBack", { name: account.nickname }),
    );
  }, [account, t]);

  // Un tocco fuori chiude il menu, come ci si aspetta da una tendina.
  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (!boxRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  // Finché non si sa se c'è un profilo non si mostra niente: evita che il
  // pulsante "Accedi" lampeggi a chi è già dentro.
  if (!ready) return null;

  if (!account) {
    return (
      <button
        type="button"
        aria-label={t("nav.signIn")}
        onClick={() => openPanel("account")}
        className="flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-line bg-surface-2 px-3 text-sm font-bold transition-colors hover:border-neon/50 hover:text-neon"
      >
        <UserRound className="size-4" />
        <span className="hidden sm:inline">{t("nav.signIn")}</span>
      </button>
    );
  }

  const go = (path: string) => {
    setOpen(false);
    router.push(path);
  };

  return (
    <div ref={boxRef} className="relative shrink-0">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={account.nickname}
        onClick={() => setOpen((value) => !value)}
        className="flex h-9 items-center gap-2 rounded-full border border-neon/40 bg-neon/10 ps-1 pe-2.5 transition-colors hover:border-neon"
      >
        <span className="relative">
          <Avatar id={account.emoji} size="xs" />
          {/* Pallino di presenza: chi vede questo pallino ha la sessione attiva. */}
          <span className="absolute -bottom-0.5 -end-0.5 size-2.5 rounded-full border-2 border-ink bg-neon" />
        </span>
        <span className="hidden max-w-24 truncate text-sm font-bold text-neon sm:inline">
          {account.nickname}
        </span>
      </button>

      <AnimatePresence>
        {open ? (
          <motion.div
            role="menu"
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className="absolute end-0 top-11 z-50 w-56 overflow-hidden rounded-2xl border border-line bg-surface shadow-xl"
          >
            <div className="flex items-center gap-2.5 border-b border-line p-3">
              <Avatar id={account.emoji} size="sm" selected />
              <span className="min-w-0">
                <span className="block truncate text-sm font-black">@{account.nickname}</span>
                <span className="flex items-center gap-1 text-[11px] font-bold text-neon">
                  <span className="size-1.5 rounded-full bg-neon" />
                  {t("account.online")}
                </span>
              </span>
            </div>

            <MenuItem
              icon={<UserRound className="size-4" />}
              label={t("account.myProfile")}
              onClick={() => {
                setOpen(false);
                openPanel("account");
              }}
            />
            <MenuItem
              icon={<Users className="size-4" />}
              label={t("account.myPickmates")}
              onClick={() => go("/pickmates")}
            />
            <MenuItem
              icon={<LogOut className="size-4" />}
              label={t("auth.signOut")}
              tone="danger"
              onClick={async () => {
                setOpen(false);
                await signOut();
                showToast(t("auth.signedOut"), "info");
              }}
            />
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function MenuItem({
  icon,
  label,
  onClick,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  tone?: "danger";
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={
        tone === "danger"
          ? "flex w-full items-center gap-2.5 px-3 py-2.5 text-start text-sm font-semibold text-red-500 transition-colors hover:bg-red-500/10"
          : "flex w-full items-center gap-2.5 px-3 py-2.5 text-start text-sm font-semibold transition-colors hover:bg-surface-2"
      }
    >
      {icon}
      {label}
    </button>
  );
}
