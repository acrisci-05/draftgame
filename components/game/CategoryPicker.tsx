"use client";

import { Check, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAdmin } from "@/lib/admin";
import { OFFICIAL_CATEGORIES, categoryName } from "@/lib/catalog";
import { useClientValue } from "@/lib/client-store";
import { useSettings } from "@/lib/settings";
import { allCategories } from "@/lib/storage";
import type { Category } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { TierStrip } from "./TierChip";

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
        return (
          <button
            key={category.id}
            type="button"
            onClick={() => onSelect(category)}
            className={cn(
              "flex items-center gap-3 rounded-xl border p-3 text-start transition-colors",
              selected ? "border-neon/60 bg-neon/10" : "border-line bg-surface-2 hover:border-neon/40",
            )}
          >
            <span className="text-2xl">{category.emoji}</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-bold">{categoryName(category, locale)}</span>
              <span className="mt-1 block text-xs text-faint">
                {category.items.length} {t("common.items")}
              </span>
              <TierStrip items={category.items} className="mt-1.5" />
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
