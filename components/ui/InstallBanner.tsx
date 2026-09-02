"use client";

import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { useInstallState } from "@/lib/pwa";
import { useT } from "@/lib/settings";
import { LogoMark } from "./Logo";

const DISMISSED_KEY = "pp:install-banner";

/**
 * L'invito a installare l'app, in fondo allo schermo.
 *
 * C'e' gia' una finestra che spiega l'installazione, ma bisogna andarsela a
 * cercare nel menu: chi non sa che l'app si puo' installare non apre il menu
 * per scoprirlo. Questo si fa vedere da solo.
 *
 * Sta in basso e non in alto per due ragioni: sopra coprirebbe la barra dei
 * comandi, e in basso e' dove arriva il pollice di chi vuole chiuderlo. Compare
 * dopo qualche secondo -- non nel mezzo del primo tocco -- e chi lo scaccia non
 * lo rivede piu'.
 */
export function InstallBanner() {
  const t = useT();
  const { ready, mobile, installed, promptInstall } = useInstallState();
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if (window.localStorage.getItem(DISMISSED_KEY)) return;
    } catch {
      /* senza storage si ripropone: e' un banner, non un danno */
    }
    // Qualche secondo di grazia: entrare in una pagina e trovarci subito un
    // riquadro da chiudere e' il modo migliore per farlo chiudere e basta.
    const timer = setTimeout(() => setHidden(false), 6000);
    return () => clearTimeout(timer);
  }, []);

  const chiudi = () => {
    setHidden(true);
    try {
      window.localStorage.setItem(DISMISSED_KEY, "1");
    } catch {
      /* niente da segnare */
    }
  };

  // Si mostra solo dove l'installazione esiste davvero: su desktop e dentro
  // l'app gia' installata sarebbe un invito a fare una cosa impossibile.
  const visibile = ready && mobile && !installed && !hidden && Boolean(promptInstall);

  return (
    <AnimatePresence>
      {visibile ? (
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 24 }}
          transition={{ type: "spring", stiffness: 300, damping: 28 }}
          className="fixed inset-x-3 bottom-3 z-50 mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-neon/40 bg-surface/95 p-3 shadow-2xl backdrop-blur safe-bottom"
        >
          <LogoMark size={44} className="shrink-0" />

          <p className="min-w-0 flex-1 text-xs leading-relaxed text-muted">
            {t("install.bannerBody")}
          </p>

          <button
            type="button"
            onClick={async () => {
              chiudi();
              await promptInstall?.();
            }}
            className="shrink-0 rounded-full bg-neon px-4 py-2 text-sm font-black text-ink transition-opacity hover:opacity-90"
          >
            {t("install.bannerCta")}
          </button>

          <button
            type="button"
            aria-label={t("common.close")}
            onClick={chiudi}
            className="shrink-0 self-start rounded-lg p-1 text-faint transition-colors hover:text-fg"
          >
            <X className="size-4" />
          </button>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
