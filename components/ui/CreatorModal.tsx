"use client";

import { Camera } from "lucide-react";
import { INSTAGRAM_URL } from "@/lib/config";
import { useT } from "@/lib/settings";
import { Modal } from "./Modal";

export function CreatorModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT();

  return (
    <Modal open={open} title={t("creator.title")} onClose={onClose}>
      <div className="flex flex-col gap-4">
        <div className="rounded-2xl border border-line bg-surface-2 p-4">
          <span className="mb-3 grid size-12 place-items-center rounded-xl bg-neon/15 text-2xl">
            👋
          </span>
          <p className="text-sm leading-relaxed text-muted">{t("creator.body")}</p>
        </div>

        <a
          href={INSTAGRAM_URL}
          target="_blank"
          rel="noreferrer noopener"
          className="flex h-12 items-center justify-center gap-2 rounded-xl bg-violet font-bold text-white transition-colors hover:bg-violet-soft"
        >
          <Camera className="size-5" />
          {t("creator.instagram")}
        </a>
      </div>
    </Modal>
  );
}
