"use client";

import { Check, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAdmin } from "@/lib/admin";
import { OFFICIAL_CATEGORIES, categoryName } from "@/lib/catalog";
import { useClientValue } from "@/lib/client-store";
import { MIN_CATEGORY_ITEMS } from "@/lib/game";
import { useSettings } from "@/lib/settings";
import { allCategories } from "@/lib/storage";
import type { Category } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ItemCount } from "./ItemCount";

interface CategoryPickerProps {
  selectedId: string;
  onSelect: (category: Category) => void;
}

export function CategoryPicker({ selectedId, onSelect }: CategoryPickerProps) {
  const router = useRouter();
  const { locale, t } = useSettings();
  const categories = useClientValue<Category[]>(allCategories, OFFICIAL_CATEGORIES);
  const isAdmin = useAdmin();

  return (
    <div className="flex flex-col gap-2">
      {categories.map((category) => {
        const selected = category.id === selectedId;
        /*
         * Una lista troppo corta non regge una partita: i lotti finirebbero
         * prima che qualcuno completi la propria. Resta visibile ma spenta,
         * cosi' chi l'ha creata capisce che deve allungarla invece di
         * chiedersi dove sia finita.
         */
        const troppoCorta = category.items.length < MIN_CATEGORY_ITEMS;
        return (
          <button
            key={category.id}
            type="button"
            disabled={troppoCorta}
            onClick={() => onSelect(category)}
            className={cn(
              "flex items-center gap-3 rounded-xl border p-3 text-start transition-colors",
              selected ? "border-neon/60 bg-neon/10" : "border-line bg-surface-2 hover:border-neon/40",
              troppoCorta && "cursor-not-allowed opacity-40 hover:border-line",
            )}
          >
            <span className="text-2xl">{category.emoji}</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-bold">{categoryName(category, locale)}</span>
              <span className="mt-1 block text-xs text-faint">
                {category.items.length} {t("common.items")}
              </span>
              <ItemCount count={category.items.length} className="mt-1.5" />
              {troppoCorta ? (
                <span className="mt-1 block text-xs text-amber-400">
                  {t("categories.tooShort", { n: MIN_CATEGORY_ITEMS })}
                </span>
              ) : null}
            </span>
            {category.source === "official" ? (
              <Badge tone="violet">{t("categories.officialBadge")}</Badge>
            ) : null}
            {selected ? <Check className="size-5 shrink-0 text-neon" /> : null}
          </button>
        );
      })}

      {isAdmin ? (
        <Button variant="outline" onClick={() => router.push("/categories/new")}>
          <Plus className="size-4" />
          {t("editor.newTitle")}
        </Button>
      ) : null}
    </div>
  );
}
