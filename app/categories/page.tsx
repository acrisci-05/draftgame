"use client";

import { ArrowLeft, Pencil, Play, Plus, SlidersHorizontal } from "lucide-react";
import { useRouter } from "next/navigation";
import { OFFICIAL_CATEGORIES, categoryName } from "@/lib/catalog";
import { useClientValue } from "@/lib/client-store";
import { useSettings } from "@/lib/settings";
import { ensureProfile, listCustomCategories, officialCategories, readConfig, saveSession } from "@/lib/storage";
import type { Category, Locale } from "@/lib/types";
import { roomCode } from "@/lib/utils";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Panel, PanelTitle } from "@/components/ui/Panel";
import { ItemCover } from "@/components/game/ItemCover";
import { TierStrip } from "@/components/game/TierChip";

const NO_CATEGORIES: Category[] = [];

export default function CategoriesPage() {
  const router = useRouter();
  const { locale, t } = useSettings();
  const custom = useClientValue<Category[]>(listCustomCategories, NO_CATEGORIES);
  const official = useClientValue<Category[]>(officialCategories, OFFICIAL_CATEGORIES);

  const playWith = (category: Category) => {
    const profile = ensureProfile();
    const code = roomCode();
    saveSession({
      code,
      mode: "local",
      playerId: profile.id,
      isHost: true,
      name: profile.name || "Player",
      emoji: profile.emoji,
      categoryId: category.id,
      config: readConfig(),
    });
    router.push(`/room/${code}`);
  };

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-4 py-6 safe-bottom">
      <header className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => router.push("/")}
          className="flex items-center gap-1.5 text-sm text-faint transition-colors hover:text-fg"
        >
          <ArrowLeft className="size-4" />
          {t("common.home")}
        </button>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => router.push("/studio")}>
            <SlidersHorizontal className="size-4" />
            {t("studio.open")}
          </Button>
          <Button size="sm" onClick={() => router.push("/categories/new")}>
            <Plus className="size-4" />
            {t("categories.new")}
          </Button>
        </div>
      </header>

      <div>
        <h1 className="text-3xl font-black tracking-tight">{t("categories.title")}</h1>
        <p className="mt-1 text-sm text-faint">{t("categories.subtitle")}</p>
      </div>

      <Panel>
        <PanelTitle>{t("categories.mine")}</PanelTitle>
        {custom.length === 0 ? (
          <p className="text-sm text-faint">{t("categories.none")}</p>
        ) : (
          <div className="flex flex-col gap-2">
            {custom.map((category) => (
              <CategoryRow
                key={category.id}
                category={category}
                locale={locale}
                onPlay={() => playWith(category)}
                onEdit={() => router.push(`/categories/edit/${category.id}`)}
              />
            ))}
          </div>
        )}
      </Panel>

      <Panel>
        <PanelTitle>{t("categories.official")}</PanelTitle>
        <div className="flex flex-col gap-2">
          {official.map((category) => (
            <CategoryRow
              key={category.id}
              category={category}
              locale={locale}
              onPlay={() => playWith(category)}
            />
          ))}
        </div>
      </Panel>
    </main>
  );
}

function CategoryRow({
  category,
  locale,
  onPlay,
  onEdit,
}: {
  category: Category;
  locale: Locale;
  onPlay: () => void;
  onEdit?: () => void;
}) {
  const { t } = useSettings();

  return (
    <div className="rounded-xl border border-line bg-surface-2 p-3">
      <div className="flex items-center gap-3">
        <span className="text-2xl">{category.emoji}</span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-bold">{categoryName(category, locale)}</p>
          <p className="text-xs text-faint">
            {category.items.length} {t("common.items")}
          </p>
        </div>
        {category.shareId ? <Badge tone="violet">{t("categories.shared")}</Badge> : null}
      </div>

      <TierStrip items={category.items} className="mt-2.5" />

      <div className="no-scrollbar mt-2.5 flex gap-1 overflow-x-auto">
        {category.items.slice(0, 8).map((item) => (
          <ItemCover key={item.id} item={item} size="xs" />
        ))}
      </div>

      <div className="mt-3 flex gap-2">
        <Button size="sm" onClick={onPlay}>
          <Play className="size-4" />
          {t("categories.play")}
        </Button>
        {onEdit ? (
          <Button size="sm" variant="outline" onClick={onEdit}>
            <Pencil className="size-4" />
            {t("categories.edit")}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
