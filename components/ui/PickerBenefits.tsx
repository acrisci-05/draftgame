"use client";

import { motion } from "framer-motion";
import { ChevronRight, Medal, Sparkles, Trophy, UserPlus, Users } from "lucide-react";
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

/**
 * Il confronto, riga per riga.
 *
 * Ogni riga dice cosa succede da ospite e cosa cambia con un profilo. Sono
 * scritte solo cose che l'app fa davvero: niente "vedi quali amici sono online",
 * perche' quella presenza non esiste, e niente "storico delle vecchie partite"
 * finche' non c'e' un elenco da guardare — adesso c'e'.
 */
const ROWS: {
  key: string;
  icon: typeof Users;
  title: TranslationKey;
  guest: TranslationKey;
  member: TranslationKey;
}[] = [
  {
    key: "mates",
    icon: Users,
    title: "picker.mates",
    guest: "picker.matesGuest",
    member: "picker.matesMember",
  },
  {
    key: "stats",
    icon: Trophy,
    title: "picker.stats",
    guest: "picker.statsGuest",
    member: "picker.statsMember",
  },
  {
    key: "trophies",
    icon: Medal,
    title: "picker.trophies",
    guest: "picker.trophiesGuest",
    member: "picker.trophiesMember",
  },
  {
    key: "identity",
    icon: Sparkles,
    title: "picker.identity",
    guest: "picker.identityGuest",
    member: "picker.identityMember",
  },
];

function Cards() {
  const t = useT();
  return (
    <div className="flex flex-col gap-2.5">
      {ROWS.map(({ key, icon: Icon, title, guest, member }, index) => (
        <motion.div
          key={key}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.06 }}
          className="rounded-2xl border border-line bg-surface-2 p-3.5"
        >
          <p className="flex items-center gap-2 font-bold">
            <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-neon/15 text-neon">
              <Icon className="size-4" />
            </span>
            {t(title)}
          </p>

          {/* Prima com'e' adesso, poi cosa cambia: il confronto si legge da solo. */}
          <div className="mt-2.5 flex flex-col gap-1.5 text-sm">
            <p className="flex gap-2 text-muted">
              <span className="shrink-0 font-bold text-faint">{t("picker.asGuest")}</span>
              <span className="min-w-0">{t(guest)}</span>
            </p>
            <p className="flex gap-2">
              <span className="shrink-0 font-bold text-neon">{t("picker.asMember")}</span>
              <span className="min-w-0">{t(member)}</span>
            </p>
          </div>
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
