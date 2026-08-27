"use client";

import { ArrowLeft, Check, Download, Loader2, Play, TriangleAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { fetchSharedCategory } from "@/lib/supabase";
import { ensureProfile, saveCustomCategory, saveSession } from "@/lib/storage";
import type { Category } from "@/lib/types";
import { TIER_ORDER, TIER_STYLES, cn, roomCode, uid } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Panel, PanelTitle } from "@/components/ui/Panel";

export function SharedCategoryClient({ shareId }: { shareId: string }) {
  const router = useRouter();
  const [category, setCategory] = useState<Category | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [imported, setImported] = useState(false);

  useEffect(() => {
    let active = true;
    fetchSharedCategory(shareId)
      .then((result) => {
        if (active) setCategory(result);
      })
      .catch((cause: unknown) => {
        if (active) {
          setError(cause instanceof Error ? cause.message : "Categoria non trovata.");
        }
      });
    return () => {
      active = false;
    };
  }, [shareId]);

  const importCategory = (): Category | null => {
    if (!category) return null;
    const local: Category = { ...category, id: uid("cat"), source: "custom", shareId };
    saveCustomCategory(local);
    setImported(true);
    return local;
  };

  const playNow = () => {
    const local = importCategory();
    if (!local) return;
    const profile = ensureProfile();
    const code = roomCode();
    saveSession({
      code,
      mode: "local",
      playerId: profile.id,
      isHost: true,
      name: profile.name || "Player",
      emoji: profile.emoji,
      categoryId: local.id,
    });
    router.push(`/room/${code}`);
  };

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-4 py-6 safe-bottom">
      <button
        type="button"
        onClick={() => router.push("/categories")}
        className="flex items-center gap-1.5 self-start text-sm text-zinc-500 transition-colors hover:text-zinc-100"
      >
        <ArrowLeft className="size-4" />
        Categorie
      </button>

      {error ? (
        <p className="flex items-start gap-2 rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" />
          {error}
        </p>
      ) : !category ? (
        <div className="flex flex-1 items-center justify-center text-zinc-500">
          <Loader2 className="size-6 animate-spin" />
        </div>
      ) : (
        <>
          <div className="flex items-center gap-3">
            <span className="text-4xl">{category.emoji}</span>
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Categoria condivisa</p>
              <h1 className="text-2xl font-black tracking-tight">{category.name}</h1>
            </div>
          </div>

          {TIER_ORDER.map((tier) => (
            <Panel key={tier}>
              <PanelTitle>
                <span
                  className={cn(
                    "rounded-md border px-2 py-0.5 text-[11px] font-black",
                    TIER_STYLES[tier].chip,
                  )}
                >
                  ${tier}
                </span>
              </PanelTitle>
              <div className="flex flex-wrap gap-1.5">
                {category.items
                  .filter((item) => item.tier === tier)
                  .map((item) => (
                    <span
                      key={item.id}
                      className="rounded-lg border border-line bg-surface-2 px-2 py-1 text-sm"
                    >
                      {item.name}
                    </span>
                  ))}
              </div>
            </Panel>
          ))}

          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={importCategory}>
              {imported ? <Check className="size-4" /> : <Download className="size-4" />}
              {imported ? "Importata" : "Importa"}
            </Button>
            <Button onClick={playNow}>
              <Play className="size-4" />
              Gioca ora
            </Button>
          </div>
        </>
      )}
    </main>
  );
}
