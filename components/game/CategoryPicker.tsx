"use client";

import { Check, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { BUILTIN_CATEGORIES } from "@/lib/catalog";
import { useClientValue } from "@/lib/client-store";
import { allCategories } from "@/lib/storage";
import type { Category } from "@/lib/types";
import { TIER_ORDER, cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";

interface CategoryPickerProps {
  selectedId: string;
  onSelect: (category: Category) => void;
}

export function CategoryPicker({ selectedId, onSelect }: CategoryPickerProps) {
  const router = useRouter();
  const categories = useClientValue<Category[]>(allCategories, BUILTIN_CATEGORIES);

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
              "flex items-center gap-3 rounded-xl border p-3 text-left transition-colors",
              selected
                ? "border-neon/60 bg-neon/10"
                : "border-line bg-surface-2 hover:border-zinc-600",
            )}
          >
            <span className="text-2xl">{category.emoji}</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-bold">{category.name}</span>
              <span className="block text-xs text-zinc-500">
                {category.items.length} elementi ·{" "}
                {TIER_ORDER.map((tier) => category.items.filter((i) => i.tier === tier).length).join(
                  "/",
                )}
                {category.source !== "builtin" ? " · personalizzata" : ""}
              </span>
            </span>
            {selected ? <Check className="size-5 shrink-0 text-neon" /> : null}
          </button>
        );
      })}

      <Button variant="outline" onClick={() => router.push("/categories/new")}>
        <Plus className="size-4" />
        Crea una categoria
      </Button>
    </div>
  );
}
