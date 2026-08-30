"use client";

import { motion } from "framer-motion";
import { ChevronRight, Sparkles, Trophy, UserPlus, Users } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { openPanel } from "@/lib/panels";
import { useT } from "@/lib/settings";
import type { TranslationKey } from "@/lib/i18n";
import { isSupabaseConfigured } from "@/lib/supabase";
import { Modal } from "./Modal";

/**
 * Perché conviene avere un profilo.
 *
 * Si gioca benissimo da ospiti, quindi questa non è una porta chiusa ma un
 * invito: tre cose che si sbloccano, e un pulsante che porta dritto alla
 * registrazione. Non compare a chi un profilo ce l'ha già, né dove il database
 * non è collegato: lì quelle funzioni non ci sono e prometterle sarebbe falso.
 */

const CARDS: { key: string; icon: typeof Users; title: TranslationKey; body: TranslationKey }[] = [
  { key: "mates", icon: Users, title: "picker.mates", body: "picker.matesBody" },
  { key: "stats", icon: Trophy, title: "picker.stats", body: "picker.statsBody" },
  { key: "card", icon: Sparkles, title: "picker.card", body: "picker.cardBody" },
];

function Cards() {
  const t = useT();
  return (
    <div className="flex flex-col gap-2.5">
      {CARDS.map(({ key, icon: Icon, title, body }, index) => (
        <motion.div
          key={key}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.06 }}
          className="flex gap-3 rounded-2xl border border-line bg-surface-2 p-3.5"
        >
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-neon/15 text-neon">
            <Icon className="size-5" />
          </span>
          <span className="min-w-0">
            <span className="block font-bold">{t(title)}</span>
            <span className="mt-0.5 block text-sm leading-relaxed text-muted">{t(body)}</span>
          </span>
        </motion.div>
      ))}
    </div>
  );
}

function JoinButton() {
  const t = useT();
  return (
    <button
      type="button"
      onClick={() => openPanel("register")}
      className="flex h-13 items-center justify-center gap-2 rounded-2xl bg-neon py-3.5 text-base font-black text-ink shadow-lg transition-opacity hover:opacity-90"
    >
      <UserPlus className="size-5" />
      {t("picker.cta")}
    </button>
  );
}

/** Versione a finestra, aperta dal menu o dalla card in home. */
export function PickerBenefitsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT();
  return (
    <Modal open={open} title={t("picker.title")} onClose={onClose}>
      <div className="flex flex-col gap-4">
        <p className="text-sm leading-relaxed text-muted">{t("picker.subtitle")}</p>
        <Cards />
        <JoinButton />
        <p className="text-center text-[11px] text-faint">{t("picker.free")}</p>
      </div>
    </Modal>
  );
}

/**
 * Versione compatta per la home: una riga che invita ad aprire la finestra.
 * Sparisce da sola appena il profilo esiste.
 */
export function PickerBanner() {
  const t = useT();
  const { account, ready } = useAuth();

  if (!isSupabaseConfigured || !ready || account) return null;

  return (
    <button
      type="button"
      onClick={() => openPanel("picker")}
      className="flex w-full items-center gap-3 rounded-2xl border border-violet/40 bg-violet/10 p-4 text-start transition-colors hover:border-violet"
    >
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-violet/20 text-violet">
        <Sparkles className="size-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-black">{t("picker.title")}</span>
        <span className="block truncate text-sm text-muted">{t("picker.bannerHint")}</span>
      </span>
      <ChevronRight className="size-5 shrink-0 text-violet" />
    </button>
  );
}
