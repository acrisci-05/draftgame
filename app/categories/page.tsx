"use client";

import { ArrowLeft, Pencil, Play, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { BUILTIN_CATEGORIES } from "@/lib/catalog";
import { useClientValue } from "@/lib/client-store";
import { ensureProfile, listCustomCategories, saveSession } from "@/lib/storage";
import type { Category } from "@/lib/types";
import { TIER_ORDER, TIER_STYLES, cn, roomCode } from "@/lib/utils";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Panel, PanelTitle } from "@/components/ui/Panel";

const NO_CATEGORIES: Category[] = [];

export default function CategoriesPage() {
  const router = useRouter();
  const custom = useClientValue<Category[]>(listCustomCategories, NO_CATEGORIES);

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
    });
    router.push(`/room/${code}`);
  };

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-4 py-6 safe-bottom">
      <header className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => router.push("/")}
          className="flex items-center gap-1.5 text-sm text-zinc-500 transition-colors hover:text-zinc-100"
        >
          <ArrowLeft className="size-4" />
          Home
        </button>
        <Button size="sm" onClick={() => router.push("/categories/new")}>
          <Plus className="size-4" />
          Nuova
        </Button>
      </header>

      <div>
        <h1 className="text-3xl font-black tracking-tight">Categorie</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Ogni tier list ha 25 elementi: 5 per ogni fascia da $5 a $1.
        </p>
      </div>

      <Panel>
        <PanelTitle>Le tue categorie</PanelTitle>
        {custom.length === 0 ? (
          <p className="text-sm text-zinc-500">
            Non hai ancora creato nulla. Con l&apos;editor costruisci una tier list in due minuti.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {custom.map((category) => (
              <CategoryRow
                key={category.id}
                category={category}
                onPlay={() => playWith(category)}
                onEdit={() => router.push(`/categories/edit/${category.id}`)}
              />
            ))}
          </div>
        )}
      </Panel>

      <Panel>
        <PanelTitle>Tier list incluse</PanelTitle>
        <div className="flex flex-col gap-2">
          {BUILTIN_CATEGORIES.map((category) => (
            <CategoryRow key={category.id} category={category} onPlay={() => playWith(category)} />
          ))}
        </div>
      </Panel>
    </main>
  );
}

function CategoryRow({
  category,
  onPlay,
  onEdit,
}: {
  category: Category;
  onPlay: () => void;
  onEdit?: () => void;
}) {
  return (
    <div className="rounded-xl border border-line bg-surface-2 p-3">
      <div className="flex items-center gap-3">
        <span className="text-2xl">{category.emoji}</span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-bold">{category.name}</p>
          <p className="text-xs text-zinc-500">{category.items.length} elementi</p>
        </div>
        {category.shareId ? <Badge tone="violet">condivisa</Badge> : null}
      </div>

      <div className="mt-2.5 flex flex-wrap gap-1">
        {TIER_ORDER.map((tier) => (
          <span
            key={tier}
            className={cn(
              "rounded-md border px-1.5 py-0.5 text-[10px] font-bold",
              TIER_STYLES[tier].chip,
            )}
          >
            ${tier} × {category.items.filter((item) => item.tier === tier).length}
          </span>
        ))}
      </div>

      <div className="mt-3 flex gap-2">
        <Button size="sm" onClick={onPlay}>
          <Play className="size-4" />
          Gioca
        </Button>
        {onEdit ? (
          <Button size="sm" variant="outline" onClick={onEdit}>
            <Pencil className="size-4" />
            Modifica
          </Button>
        ) : null}
      </div>
    </div>
  );
}
