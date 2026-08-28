"use client";

import { ArrowLeft, LayoutGrid, Play, Smartphone, Wifi } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { DEFAULT_CATEGORY, categoryName } from "@/lib/catalog";
import { useClientValue } from "@/lib/client-store";
import { DEFAULT_CONFIG } from "@/lib/game";
import { useSettings } from "@/lib/settings";
import { ensureProfile, getCategory, readConfig, saveConfig, saveSession } from "@/lib/storage";
import { isSupabaseConfigured } from "@/lib/supabase";
import type { Category, RoomConfig, RoomMode } from "@/lib/types";
import { cn, roomCode } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Panel, PanelTitle } from "@/components/ui/Panel";
import { CategoryPicker } from "@/components/game/CategoryPicker";
import { LobbyConfig } from "@/components/game/LobbyConfig";
import { TierStrip } from "@/components/game/TierChip";

export default function CreatePage() {
  const router = useRouter();
  const { locale, t } = useSettings();

  const storedConfig = useClientValue<RoomConfig>(readConfig, DEFAULT_CONFIG);
  const [configDraft, setConfigDraft] = useState<RoomConfig | null>(null);
  const config = configDraft ?? storedConfig;

  const [mode, setMode] = useState<RoomMode>("local");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  const category: Category =
    (categoryId ? getCategory(categoryId) : undefined) ?? DEFAULT_CATEGORY;

  const patchConfig = (patch: Partial<RoomConfig>) => {
    const next = { ...config, ...patch };
    setConfigDraft(next);
    saveConfig(next);
  };

  const create = () => {
    const profile = ensureProfile();
    const code = roomCode();
    saveSession({
      code,
      mode,
      playerId: profile.id,
      isHost: true,
      name: profile.name || "Player",
      emoji: profile.emoji,
      categoryId: category.id,
      config,
    });
    router.push(`/room/${code}`);
  };

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-4 py-6 safe-bottom">
      <button
        type="button"
        onClick={() => router.push("/")}
        className="flex items-center gap-1.5 self-start text-sm text-faint transition-colors hover:text-fg"
      >
        <ArrowLeft className="size-4" />
        {t("common.home")}
      </button>

      <div>
        <h1 className="text-3xl font-black tracking-tight">{t("create.title")}</h1>
        <p className="mt-1 text-sm text-muted">{t("create.subtitle")}</p>
      </div>

      <Panel>
        <PanelTitle>{t("create.mode")}</PanelTitle>
        <div className="grid gap-2 sm:grid-cols-2">
          <ModeCard
            active={mode === "local"}
            icon={<Smartphone className="size-5" />}
            title={t("create.local")}
            hint={t("create.localHint")}
            onClick={() => setMode("local")}
          />
          <ModeCard
            active={mode === "online"}
            icon={<Wifi className="size-5" />}
            title={t("create.online")}
            hint={t("create.onlineHint")}
            onClick={() => setMode("online")}
          />
        </div>
        {mode === "online" && !isSupabaseConfigured ? (
          <p className="mt-2 text-xs text-faint">{t("create.onlineLocalHint")}</p>
        ) : null}
      </Panel>

      <Panel>
        <PanelTitle
          icon={<LayoutGrid className="size-3.5" />}
          action={
            <Button variant="ghost" size="sm" onClick={() => setPickerOpen(true)}>
              {t("common.change")}
            </Button>
          }
        >
          {t("common.category")}
        </PanelTitle>
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          className="flex w-full items-center gap-3 rounded-xl border border-line bg-surface-2 p-3 text-start transition-colors hover:border-neon/40"
        >
          <span className="text-3xl">{category.emoji}</span>
          <span className="min-w-0 flex-1">
            <span className="block truncate font-bold">{categoryName(category, locale)}</span>
            <span className="mt-1 block text-xs text-faint">
              {category.items.length} {t("common.items")}
            </span>
            <TierStrip items={category.items} className="mt-1.5" />
          </span>
        </button>
      </Panel>

      <LobbyConfig config={config} onChange={patchConfig} />

      <Button size="lg" className="rounded-xl" onClick={create}>
        <Play className="size-5" />
        {t("create.submit")}
      </Button>

      <Modal open={pickerOpen} title={t("common.category")} onClose={() => setPickerOpen(false)}>
        <CategoryPicker
          selectedId={category.id}
          onSelect={(picked) => {
            setCategoryId(picked.id);
            setPickerOpen(false);
          }}
        />
      </Modal>
    </main>
  );
}

function ModeCard({
  active,
  icon,
  title,
  hint,
  disabled,
  onClick,
}: {
  active: boolean;
  icon: React.ReactNode;
  title: string;
  hint: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex items-center gap-3 rounded-xl border p-4 text-start transition-all",
        active
          ? "border-neon/70 bg-neon/10 text-neon glow-neon"
          : "border-line bg-surface-2 text-fg hover:border-neon/40",
        disabled && "cursor-not-allowed opacity-40",
      )}
    >
      <span className="shrink-0">{icon}</span>
      <span className="min-w-0">
        <span className="block font-bold">{title}</span>
        <span className="block text-xs text-faint">{hint}</span>
      </span>
    </button>
  );
}
