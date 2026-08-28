"use client";

import { motion } from "framer-motion";
import { ArrowLeft, Pencil, Play, Plus, Search, SlidersHorizontal } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { OFFICIAL_CATEGORIES, categoryName } from "@/lib/catalog";
import { useClientValue } from "@/lib/client-store";
import type { TranslationKey } from "@/lib/i18n";
import { useSettings } from "@/lib/settings";
import {
  ensureProfile,
  listCustomCategories,
  officialCategories,
  readConfig,
  saveSession,
} from "@/lib/storage";
import type { Category, CategoryTheme, Locale } from "@/lib/types";
import { cn, roomCode, slugify } from "@/lib/utils";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ItemCover } from "@/components/game/ItemCover";
import { TierLegend, TierStrip } from "@/components/game/TierChip";

const NO_CATEGORIES: Category[] = [];

type Filter = "all" | CategoryTheme;

const FILTERS: { key: Filter; label: TranslationKey }[] = [
  { key: "all", label: "categories.filterAll" },
  { key: "sport", label: "categories.filterSport" },
  { key: "pop", label: "categories.filterPop" },
  { key: "gaming", label: "categories.filterGaming" },
  { key: "food", label: "categories.filterFood" },
  { key: "life", label: "categories.filterLife" },
];

export default function CategoriesPage() {
  const router = useRouter();
  const { locale, t } = useSettings();
  const custom = useClientValue<Category[]>(listCustomCategories, NO_CATEGORIES);
  const official = useClientValue<Category[]>(officialCategories, OFFICIAL_CATEGORIES);

  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const matches = useMemo(() => {
    const needle = slugify(query);
    return (category: Category) => {
      if (filter !== "all" && category.theme !== filter) return false;
      if (!needle) return true;
      if (slugify(categoryName(category, locale)).includes(needle)) return true;
      if (slugify(category.name).includes(needle)) return true;
      return category.items.some((item) => slugify(item.name).includes(needle));
    };
  }, [query, filter, locale]);

  const visibleCustom = custom.filter(matches);
  const visibleOfficial = official.filter(matches);
  const empty = visibleCustom.length === 0 && visibleOfficial.length === 0;

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
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-4 py-6 safe-bottom">
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

      <TierLegend />

      <div className="flex flex-col gap-2">
        <label className="relative block">
          <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-faint" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("categories.search")}
            aria-label={t("categories.search")}
            className="h-12 w-full rounded-xl border border-line bg-surface-2 ps-10 pe-4 text-base text-fg placeholder:text-faint/70 focus:border-neon/70 focus:outline-none"
          />
        </label>

        <div className="no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4">
          {FILTERS.map((option) => (
            <button
              key={option.key}
              type="button"
              onClick={() => setFilter(option.key)}
              aria-pressed={filter === option.key}
              className={cn(
                "shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-semibold transition-all",
                filter === option.key
                  ? "border-neon/70 bg-neon/15 text-neon glow-neon"
                  : "border-line bg-surface-2 text-muted hover:text-fg",
              )}
            >
              {t(option.label)}
            </button>
          ))}
        </div>
      </div>

      {empty ? (
        <p className="rounded-2xl border border-line bg-surface p-6 text-center text-sm text-faint">
          {t("categories.noResults")}
        </p>
      ) : null}

      {visibleCustom.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-xs font-bold uppercase tracking-[0.18em] text-faint">
            {t("categories.mine")}
          </h2>
          {visibleCustom.map((category) => (
            <CategoryCard
              key={category.id}
              category={category}
              locale={locale}
              onPlay={() => playWith(category)}
              onEdit={() => router.push(`/categories/edit/${category.id}`)}
            />
          ))}
        </section>
      ) : null}

      {visibleOfficial.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-xs font-bold uppercase tracking-[0.18em] text-faint">
            {t("categories.official")}
          </h2>
          {visibleOfficial.map((category) => (
            <CategoryCard
              key={category.id}
              category={category}
              locale={locale}
              onPlay={() => playWith(category)}
            />
          ))}
        </section>
      ) : null}
    </main>
  );
}

function CategoryCard({
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
  // Anteprima: i primi nomi della fascia più alta, quelli che tutti riconoscono.
  const preview = category.items
    .filter((item) => item.tier === 5)
    .slice(0, 4)
    .map((item) => item.name);

  return (
    <motion.div
      role="button"
      tabIndex={0}
      onClick={onPlay}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onPlay();
        }
      }}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.995 }}
      className="cursor-pointer rounded-2xl border border-line bg-surface p-3 transition-colors hover:border-neon/60 hover:shadow-lg focus-visible:border-neon focus-visible:outline-none"
    >
      <div className="flex items-center gap-3">
        <span className="grid size-12 shrink-0 place-items-center rounded-xl border border-line bg-surface-2 text-2xl">
          {category.emoji}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate font-bold">{categoryName(category, locale)}</p>
            {category.shareId ? <Badge tone="violet">{t("categories.shared")}</Badge> : null}
          </div>
          <p className="mt-0.5 truncate text-xs text-faint">
            {preview.join(" • ")}
            {preview.length > 0 ? "..." : null}
          </p>
        </div>

        <div className="flex shrink-0 gap-1.5">
          {onEdit ? (
            <Button
              size="sm"
              variant="outline"
              onClick={(event) => {
                event.stopPropagation();
                onEdit();
              }}
            >
              <Pencil className="size-4" />
            </Button>
          ) : null}
          <Button
            size="sm"
            onClick={(event) => {
              event.stopPropagation();
              onPlay();
            }}
          >
            <Play className="size-4" />
            {t("categories.play")}
          </Button>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between gap-3">
        <TierStrip items={category.items} interactive />
        <span className="no-scrollbar flex gap-1 overflow-x-auto">
          {category.items
            .filter((item) => item.tier === 5)
            .slice(0, 5)
            .map((item) => (
              <ItemCover key={item.id} item={item} size="xs" />
            ))}
        </span>
      </div>
    </motion.div>
  );
}
