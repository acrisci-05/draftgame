"use client";

import { motion } from "framer-motion";
import { Gavel, Hand, Layers, PiggyBank, Target, Trash2, Trophy, Wallet, Zap } from "lucide-react";
import type { TranslationKey } from "@/lib/i18n";
import { useT } from "@/lib/settings";
import { Modal } from "./Modal";

const SECTIONS: { icon: typeof Gavel; title: TranslationKey; body: TranslationKey }[] = [
  { icon: Target, title: "rules.goal.title", body: "rules.goal.body" },
  { icon: Wallet, title: "rules.budget.title", body: "rules.budget.body" },
  { icon: Gavel, title: "rules.auction.title", body: "rules.auction.body" },
  { icon: Zap, title: "rules.snipe.title", body: "rules.snipe.body" },
  { icon: Trash2, title: "rules.nobid.title", body: "rules.nobid.body" },
  { icon: PiggyBank, title: "rules.reserve.title", body: "rules.reserve.body" },
  { icon: Hand, title: "rules.manage.title", body: "rules.manage.body" },
  { icon: Trophy, title: "rules.end.title", body: "rules.end.body" },
  { icon: Layers, title: "rules.modes.title", body: "rules.modes.body" },
];

export function RulesModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT();

  return (
    <Modal open={open} title={t("rules.title")} onClose={onClose}>
      <div className="flex flex-col gap-3">
        {SECTIONS.map(({ icon: Icon, title, body }, index) => (
          <motion.section
            key={title}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.04 }}
            className="flex gap-3 rounded-2xl border border-line bg-surface-2 p-4"
          >
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-neon/15 text-neon">
              <Icon className="size-5" />
            </span>
            <span className="min-w-0">
              <span className="block font-bold">{t(title)}</span>
              <span className="mt-1 block text-sm leading-relaxed text-muted">{t(body)}</span>
            </span>
          </motion.section>
        ))}
      </div>
    </Modal>
  );
}
