"use client";

import { motion } from "framer-motion";
import { Gavel, Heart, LayoutGrid, LogIn, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useClientValue } from "@/lib/client-store";
import { APP_FULL_NAME, APP_TAGLINE, APP_VERSION } from "@/lib/config";
import { DEFAULT_AVATAR } from "@/lib/avatars";
import { openPanel } from "@/lib/panels";
import { useSettings } from "@/lib/settings";
import { useAuth } from "@/lib/auth";
import { ensureProfile, readProfile, saveProfile, saveSession } from "@/lib/storage";
import type { Profile } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { AvatarPicker } from "@/components/ui/Avatar";
import { Input } from "@/components/ui/Input";
import { JoinModal } from "@/components/ui/JoinModal";
import { LogoMark, LogoWordmark } from "@/components/ui/Logo";
import { PickerBanner } from "@/components/ui/PickerBenefits";
import { SupportModal } from "@/components/ui/SupportModal";

const HOW_KEYS = ["home.how1", "home.how2", "home.how3", "home.how4"] as const;

export default function HomePage() {
  const router = useRouter();
  const { t } = useSettings();
  const stored = useClientValue<Profile | null>(readProfile, null);
  const [nameDraft, setNameDraft] = useState<string | null>(null);
  const [emojiDraft, setEmojiDraft] = useState<string | null>(null);
  const [joinOpen, setJoinOpen] = useState(false);
  const [supportOpen, setSupportOpen] = useState(false);

  /*
   * Chi ha un profilo entra in partita con quel nome: il campo qui sotto parte
   * gia' compilato col nickname e l'avatar scelti in fase di registrazione,
   * invece di chiederli una seconda volta. Resta modificabile: il nome in
   * partita puo' essere diverso da quello dell'account.
   */
  const { account } = useAuth();
  const name = nameDraft ?? stored?.name ?? account?.nickname ?? "";
  const emoji = emojiDraft ?? stored?.emoji ?? account?.emoji ?? DEFAULT_AVATAR;

  const persistProfile = (): Profile => {
    const profile = { ...ensureProfile(), name: name.trim() || "Player", emoji };
    saveProfile(profile);
    return profile;
  };

  const goToCreate = () => {
    persistProfile();
    router.push("/create");
  };

  const joinRoom = (code: string) => {
    const profile = persistProfile();
    saveSession({
      code,
      mode: "online",
      playerId: profile.id,
      isHost: false,
      name: profile.name,
      emoji: profile.emoji,
    });
    router.push(`/room/${code}`);
  };

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-6 safe-bottom">
      <motion.section
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="overflow-hidden rounded-3xl border border-line bg-surface grid-noise"
      >
        <div className="flex flex-col items-center gap-4 px-5 pt-8 text-center">
          <LogoMark size={104} />
          <div>
            <h1 className="text-5xl font-black leading-none tracking-tight sm:text-6xl">
              <LogoWordmark />
            </h1>
            <p className="mt-2 text-[11px] font-bold uppercase tracking-[0.32em] text-violet">
              {APP_TAGLINE}
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-violet/40 bg-violet/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-violet">
            <Gavel className="size-3" /> {t("home.badge")}
          </span>
          <p className="max-w-md text-sm text-muted">{t("home.subtitle")}</p>
        </div>

        <div className="mt-6 border-t border-line p-5">
          <Input
            label={t("home.profile")}
            value={name}
            maxLength={16}
            placeholder={t("home.namePlaceholder")}
            onChange={(event) => setNameDraft(event.target.value)}
          />

          <div className="mt-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-faint">
              {t("home.avatar")}
            </p>
            <AvatarPicker value={emoji} onChange={setEmojiDraft} />
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <Button size="lg" className="w-full rounded-xl" onClick={goToCreate}>
              <Plus className="size-5" />
              {t("home.create")}
            </Button>
            <Button
              size="lg"
              variant="violet"
              className="w-full rounded-xl"
              onClick={() => setJoinOpen(true)}
            >
              <LogIn className="size-5" />
              {t("home.joinCta")}
            </Button>
          </div>

          <p className="mt-2.5 text-center text-xs text-faint">{t("home.createHint")}</p>
        </div>
      </motion.section>

      {/* Invito a farsi un profilo: compare solo a chi gioca da ospite. */}
      <PickerBanner />

      <section className="flex flex-col gap-3 text-sm text-muted">
        <div className="flex items-center gap-3">
          <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-faint">
            {t("home.howTitle")}
          </h2>
          <span className="h-px flex-1 bg-line" />
        </div>
        <ol className="grid gap-2 sm:grid-cols-2">
          {HOW_KEYS.map((key, index) => (
            <li key={key} className="flex gap-2">
              <span className="font-mono text-xs font-bold text-neon">{index + 1}</span>
              <span className="text-xs leading-relaxed">{t(key)}</span>
            </li>
          ))}
        </ol>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4 text-xs text-faint">
        <button
          type="button"
          onClick={() => router.push("/categories")}
          className="flex items-center gap-1.5 transition-colors hover:text-fg"
        >
          <LayoutGrid className="size-3.5" />
          {t("home.categories")}
        </button>
        <button
          type="button"
          onClick={() => openPanel("creator")}
          className="flex items-center gap-1.5 transition-colors hover:text-gold"
        >
          <span aria-hidden>👑</span>
          {t("nav.creator")}
        </button>
        <button
          type="button"
          onClick={() => setSupportOpen(true)}
          className="flex items-center gap-1.5 transition-colors hover:text-violet"
        >
          <Heart className="size-3.5" />
          {t("support.title")}
        </button>
      </div>

      <p className="text-center text-[11px] text-faint">
        {APP_FULL_NAME} · v{APP_VERSION}
      </p>

      <JoinModal open={joinOpen} onClose={() => setJoinOpen(false)} onJoin={joinRoom} />
      <SupportModal open={supportOpen} onClose={() => setSupportOpen(false)} />
    </main>
  );
}
