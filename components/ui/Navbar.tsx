"use client";

import {
  BookOpen,
  Camera,
  ChevronRight,
  Heart,
  Lightbulb,
  Menu,
  Moon,
  Sun,
  User,
  Volume2,
  VolumeX,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { INSTAGRAM_URL } from "@/lib/config";
import { primeAudio } from "@/lib/audio";
import { languageOption } from "@/lib/i18n";
import { useSettings } from "@/lib/settings";
import { cn } from "@/lib/utils";
import { Drawer } from "./Drawer";
import { CreatorModal } from "./CreatorModal";
import { LanguagePicker } from "./LanguagePicker";
import { Logo } from "./Logo";
import { Modal } from "./Modal";
import { RulesModal } from "./RulesModal";
import { SuggestModal } from "./SuggestModal";
import { SupportModal } from "./SupportModal";

type Panel = "rules" | "suggest" | "creator" | "support" | "language" | null;

/** Importo del badge rapido nel menu. */
const QUICK_DONATION = 2;

export function Navbar() {
  const { locale, theme, sound, toggleTheme, toggleSound, t } = useSettings();
  const [menuOpen, setMenuOpen] = useState(false);
  const [panel, setPanel] = useState<Panel>(null);

  const language = languageOption(locale);

  const openPanel = (next: Panel) => {
    setPanel(next);
    setMenuOpen(false);
  };

  const onSoundToggle = () => {
    primeAudio();
    toggleSound();
  };

  const entries: { key: Exclude<Panel, null>; icon: typeof BookOpen; label: string }[] = [
    { key: "rules", icon: BookOpen, label: t("nav.rules") },
    { key: "suggest", icon: Lightbulb, label: t("nav.suggest") },
    { key: "creator", icon: User, label: t("nav.creator") },
  ];

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-line bg-ink/85 backdrop-blur">
        <nav className="mx-auto flex w-full max-w-3xl items-center gap-2 px-4 py-2.5">
          <Link href="/" className="me-auto min-w-0">
            <Logo size={34} />
          </Link>

          <IconButton label={t("nav.language")} onClick={() => setPanel("language")}>
            <span className="text-base leading-none">{language.flag}</span>
          </IconButton>

          <IconButton label={t("nav.theme")} onClick={toggleTheme}>
            {theme === "dark" ? <Moon className="size-4" /> : <Sun className="size-4" />}
          </IconButton>

          <IconButton label={t("nav.sound")} onClick={onSoundToggle} active={sound}>
            {sound ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
          </IconButton>

          <IconButton label={t("nav.menu")} onClick={() => setMenuOpen(true)}>
            <Menu className="size-5" />
          </IconButton>
        </nav>
      </header>

      <Drawer open={menuOpen} title={t("nav.menu")} onClose={() => setMenuOpen(false)}>
        <div className="flex flex-col gap-2">
          {entries.map(({ key, icon: Icon, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => openPanel(key)}
              className="flex items-center gap-3 rounded-2xl border border-line bg-surface-2 p-4 text-start transition-colors hover:border-neon/50"
            >
              <Icon className="size-5 shrink-0 text-neon" />
              <span className="flex-1 font-semibold">{label}</span>
              <ChevronRight className="size-4 shrink-0 text-faint" />
            </button>
          ))}

          <Link
            href="/categories"
            onClick={() => setMenuOpen(false)}
            className="flex items-center gap-3 rounded-2xl border border-line bg-surface-2 p-4 text-start transition-colors hover:border-neon/50"
          >
            <BookOpen className="size-5 shrink-0 text-neon" />
            <span className="flex-1 font-semibold">{t("categories.title")}</span>
            <ChevronRight className="size-4 shrink-0 text-faint" />
          </Link>
        </div>

        <section className="rounded-2xl border border-violet/40 bg-violet/10 p-4">
          <p className="text-sm font-semibold text-fg">{t("support.oneLine")}</p>
          <button
            type="button"
            onClick={() => openPanel("support")}
            className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-full bg-violet font-bold text-white transition-colors hover:bg-violet-soft"
          >
            <Heart className="size-4" />
            {t("support.quick", { amount: `€${QUICK_DONATION}` })}
          </button>
        </section>

        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-faint">
            {t("nav.language")}
          </p>
          <LanguagePicker />
        </div>

        <a
          href={INSTAGRAM_URL}
          target="_blank"
          rel="noreferrer noopener"
          className="mt-auto flex items-center justify-center gap-2 rounded-full border border-violet/40 bg-violet/10 p-3 font-semibold text-violet transition-colors hover:bg-violet/20"
        >
          <Camera className="size-5" />
          {t("creator.instagram")}
        </a>
      </Drawer>

      <RulesModal open={panel === "rules"} onClose={() => setPanel(null)} />
      <SuggestModal open={panel === "suggest"} onClose={() => setPanel(null)} />
      <CreatorModal open={panel === "creator"} onClose={() => setPanel(null)} />
      <SupportModal open={panel === "support"} onClose={() => setPanel(null)} />

      <Modal open={panel === "language"} title={t("nav.language")} onClose={() => setPanel(null)}>
        <LanguagePicker onPicked={() => setPanel(null)} />
      </Modal>
    </>
  );
}

function IconButton({
  label,
  onClick,
  children,
  active,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cn(
        "grid size-9 shrink-0 place-items-center rounded-full border border-line bg-surface-2 transition-colors hover:border-neon/50 hover:text-neon",
        active === false ? "text-faint" : "text-fg",
      )}
    >
      {children}
    </button>
  );
}
