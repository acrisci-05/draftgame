"use client";

import { Code, Coffee, Crown, Lightbulb, Sparkles } from "lucide-react";
import {
  APP_VERSION,
  CHANGELOG,
  CREATOR_NAME,
  GITHUB_URL,
  INSTAGRAM_URL,
  KOFI_URL,
  X_URL,
} from "@/lib/config";
import { useT } from "@/lib/settings";
import { InstagramGlyph, XGlyph } from "./BrandGlyphs";
import { Modal } from "./Modal";

/**
 * Scheda dell'autore: chi c'è dietro il gioco, dove trovarlo, a che punto è il
 * progetto e come mandargli un'idea.
 */
export function CreatorModal({
  open,
  onClose,
  onFeedback,
  onSupport,
}: {
  open: boolean;
  onClose: () => void;
  /** Apre il modulo dei suggerimenti (li legge solo il creatore). */
  onFeedback?: () => void;
  /** Apre il pannello di sostegno interno quando non c'è un profilo Ko-fi. */
  onSupport?: () => void;
}) {
  const t = useT();

  return (
    <Modal open={open} title={t("creator.title")} onClose={onClose}>
      <div className="flex flex-col gap-4">
        {/* Intestazione: avatar con la corona, nome e qualifica. */}
        <div className="flex items-center gap-4 rounded-2xl border border-line bg-surface-2 p-4">
          <span className="relative shrink-0">
            <span className="grid size-16 place-items-center rounded-2xl bg-gradient-to-br from-neon/30 to-violet/40 text-2xl font-black text-fg">
              {CREATOR_NAME.charAt(0)}
            </span>
            <span className="absolute -bottom-1.5 -end-1.5 flex items-center gap-1 rounded-full border border-gold/50 bg-ink px-1.5 py-0.5 text-[10px] font-black text-gold">
              <Crown className="size-3" />
              {t("creator.badge")}
            </span>
          </span>
          <span className="min-w-0">
            <span className="block truncate text-xl font-black">{CREATOR_NAME}</span>
            <span className="block truncate text-sm text-muted">{t("creator.role")}</span>
          </span>
        </div>

        {/* Benvenuto e visione del progetto. */}
        <div className="rounded-2xl border border-line bg-surface-2 p-4">
          <p className="flex items-center gap-2 font-bold">
            <Sparkles className="size-4 shrink-0 text-neon" />
            {t("creator.welcome")}
          </p>
          <p className="mt-2 text-sm leading-relaxed text-muted">{t("creator.body")}</p>
        </div>

        {/* Instagram: il collegamento principale, con i colori del marchio. */}
        <a
          href={INSTAGRAM_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="flex h-12 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 via-pink-500 to-amber-500 font-bold text-white transition-all hover:opacity-90"
        >
          <InstagramGlyph className="size-5" />
          {t("creator.instagram")}
        </a>

        <div className="grid grid-cols-3 gap-2">
          {X_URL ? (
            <SocialLink href={X_URL} label="X">
              <XGlyph className="size-4" />
            </SocialLink>
          ) : null}
          <SocialLink href={GITHUB_URL} label="GitHub">
            <Code className="size-4" />
          </SocialLink>
          {KOFI_URL ? (
            <SocialLink href={KOFI_URL} label="Ko-fi">
              <Coffee className="size-4" />
            </SocialLink>
          ) : (
            <button
              type="button"
              onClick={() => {
                onClose();
                onSupport?.();
              }}
              className="flex h-11 items-center justify-center gap-1.5 rounded-xl border border-line bg-surface-2 text-sm font-semibold transition-colors hover:border-violet/60 hover:text-violet"
            >
              <Coffee className="size-4" />
              {t("creator.donate")}
            </button>
          )}
        </div>

        {/* Stato del progetto e ultime novità. */}
        <div className="rounded-2xl border border-line bg-surface-2 p-4">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-neon/40 bg-neon/10 px-2.5 py-1 text-[11px] font-black text-neon">
            v{APP_VERSION} · {t("creator.independent")}
          </span>
          <p className="mt-3 text-xs font-bold uppercase tracking-[0.18em] text-faint">
            {t("creator.changelog")}
          </p>
          <ul className="mt-2 flex flex-col gap-2">
            {CHANGELOG.map((release) => (
              <li key={release.version} className="flex gap-2 text-sm">
                <span className="shrink-0 font-mono text-xs font-bold text-neon">
                  v{release.version}
                </span>
                <span className="text-muted">{t(release.key)}</span>
              </li>
            ))}
          </ul>
        </div>

        <button
          type="button"
          onClick={() => {
            onClose();
            onFeedback?.();
          }}
          className="flex h-12 items-center justify-center gap-2 rounded-xl border border-neon/40 bg-neon/10 font-bold text-neon transition-colors hover:bg-neon/20"
        >
          <Lightbulb className="size-5" />
          {t("creator.sendIdea")}
        </button>
      </div>
    </Modal>
  );
}

function SocialLink({
  href,
  label,
  children,
}: {
  href: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex h-11 items-center justify-center gap-1.5 rounded-xl border border-line bg-surface-2 text-sm font-semibold transition-colors hover:border-neon/60 hover:text-neon"
    >
      {children}
      {label}
    </a>
  );
}
