"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Bell, Check, DoorOpen, Swords, UserPlus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useNotifications, type AppNotification } from "@/lib/notifications";
import { tauntKey } from "@/lib/pickmates";
import { useT } from "@/lib/settings";
import { cn } from "@/lib/utils";
import { Avatar } from "./Avatar";
import { Button } from "./Button";
import { Modal } from "./Modal";

/**
 * Campanella delle notifiche: richieste di Pickmate e sfide in arrivo.
 * Compare solo a chi ha fatto l'accesso con il database attivo, perché è da lì
 * che arrivano gli avvisi dal vivo.
 */
/** Quanto resta a schermo l'avviso a comparsa. */
const TOAST_MS = 6000;

export function NotificationBell() {
  const t = useT();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const { items, count, enabled, accept, decline } = useNotifications();

  /**
   * Avviso a comparsa.
   *
   * La campanella sta nella barra in alto, che c'e' su ogni pagina: da qui
   * l'avviso puo' comparire mentre si sta facendo altro, senza aprire nulla.
   * Si tiene memoria di cosa si e' gia' mostrato, altrimenti ogni ricarica
   * dell'elenco lo rifarebbe comparire.
   */
  const seenRef = useRef<Set<string> | null>(null);
  const [toast, setToast] = useState<AppNotification | null>(null);

  useEffect(() => {
    // Al primo giro si segna tutto come gia' visto: quello che c'era prima di
    // aprire l'app non e' una novita'.
    if (seenRef.current === null) {
      seenRef.current = new Set(items.map((item) => item.id));
      return;
    }
    const fresh = items.find((item) => !seenRef.current?.has(item.id));
    for (const item of items) seenRef.current.add(item.id);
    if (fresh) setToast(fresh);
  }, [items]);

  // L'avviso si ritira da solo dopo qualche secondo.
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), TOAST_MS);
    return () => clearTimeout(timer);
  }, [toast]);

  const enterRoom = async (notification: AppNotification) => {
    await accept(notification);
    setOpen(false);
    setToast(null);
    if (notification.code) router.push(`/room/${notification.code}`);
  };

  if (!enabled) return null;

  return (
    <>
      <button
        type="button"
        aria-label={t("notify.title")}
        title={t("notify.title")}
        onClick={() => setOpen(true)}
        className={cn(
          "relative grid size-9 shrink-0 place-items-center rounded-full border border-line bg-surface-2 transition-colors hover:border-neon/50 hover:text-neon",
          count > 0 ? "border-neon/50 text-neon" : "text-fg",
        )}
      >
        <Bell className="size-4" />
        {count > 0 ? (
          <span className="absolute -end-0.5 -top-0.5 grid min-w-4 place-items-center rounded-full bg-neon px-1 text-[10px] font-black leading-4 text-ink">
            {count > 9 ? "9+" : count}
          </span>
        ) : null}
      </button>

      <Modal open={open} title={t("notify.title")} onClose={() => setOpen(false)}>
        {items.length === 0 ? (
          <p className="py-6 text-center text-sm text-faint">{t("notify.empty")}</p>
        ) : (
          <div className="flex flex-col gap-2">
            {items.map((notification) => (
              <div
                key={notification.id}
                className="rounded-2xl border border-line bg-surface-2 p-3"
              >
                <div className="flex items-center gap-2.5">
                  {notification.from ? (
                    <Avatar id={notification.from.emoji} size="sm" />
                  ) : (
                    <span className="grid size-9 place-items-center rounded-full bg-surface text-faint">
                      <Swords className="size-4" />
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5 text-sm font-black">
                      {notification.kind === "pickmate" ? (
                        <UserPlus className="size-3.5 shrink-0 text-neon" />
                      ) : (
                        <Swords className="size-3.5 shrink-0 text-violet" />
                      )}
                      {t(notification.kind === "pickmate" ? "notify.request" : "notify.challenge")}
                    </span>
                    <span className="block truncate text-xs text-muted">
                      @{notification.from?.nickname ?? "?"}
                      {notification.code ? ` · ${notification.code}` : ""}
                    </span>
                  </span>
                </div>

                {notification.kind === "challenge" ? (
                  <p className="mt-2 text-sm italic text-muted">
                    {t(tauntKey(notification.taunt ?? 1), {
                      name: `@${notification.from?.nickname ?? "?"}`,
                    })}
                  </p>
                ) : null}

                <div className="mt-3 flex gap-2">
                  {notification.kind === "pickmate" ? (
                    <>
                      <Button size="sm" onClick={() => accept(notification)}>
                        <Check className="size-4" />
                        {t("notify.accept")}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => decline(notification)}
                      >
                        <X className="size-4" />
                        {t("notify.refuse")}
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button size="sm" variant="violet" onClick={() => enterRoom(notification)}>
                        <DoorOpen className="size-4" />
                        {t("notify.enterRoom")}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => decline(notification)}
                      >
                        <X className="size-4" />
                        {t("notify.ignore")}
                      </Button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Modal>

      {/* Avviso in sovrimpressione: si tocca per aprire il pannello. */}
      <AnimatePresence>
        {toast && !open ? (
          <motion.button
            type="button"
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            onClick={() => {
              setToast(null);
              setOpen(true);
            }}
            className="fixed inset-x-3 top-3 z-[60] mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-neon/40 bg-surface/95 p-3 text-start shadow-xl backdrop-blur safe-top"
          >
            {toast.from ? (
              <Avatar id={toast.from.emoji} size="sm" />
            ) : (
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-surface-2 text-faint">
                <Swords className="size-4" />
              </span>
            )}
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1.5 text-sm font-black">
                {toast.kind === "pickmate" ? (
                  <UserPlus className="size-3.5 shrink-0 text-neon" />
                ) : (
                  <Swords className="size-3.5 shrink-0 text-violet" />
                )}
                {t(toast.kind === "pickmate" ? "notify.request" : "notify.challenge")}
              </span>
              <span className="block truncate text-xs text-muted">
                @{toast.from?.nickname ?? "?"}
                {toast.code ? ` · ${toast.code}` : ""}
              </span>
            </span>
            <span className="shrink-0 rounded-lg bg-neon/15 px-2 py-1 text-[11px] font-bold text-neon">
              {t("notify.open")}
            </span>
          </motion.button>
        ) : null}
      </AnimatePresence>
    </>
  );
}
