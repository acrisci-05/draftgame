"use client";

import { ArrowLeft, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { CategoryEditor } from "@/components/game/CategoryEditor";
import { useClientValue, useIsClient } from "@/lib/client-store";
import { listCustomCategories } from "@/lib/storage";
import type { Category } from "@/lib/types";

export function EditCategoryClient({ id }: { id: string }) {
  const router = useRouter();
  const isClient = useIsClient();
  const readCategory = useCallback(
    () => listCustomCategories().find((item) => item.id === id) ?? null,
    [id],
  );
  const category = useClientValue<Category | null>(readCategory, null);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-4 py-6">
      <button
        type="button"
        onClick={() => router.push("/categories")}
        className="flex items-center gap-1.5 self-start text-sm text-zinc-500 transition-colors hover:text-zinc-100"
      >
        <ArrowLeft className="size-4" />
        Categorie
      </button>

      {!isClient ? (
        <div className="flex flex-1 items-center justify-center text-zinc-500">
          <Loader2 className="size-6 animate-spin" />
        </div>
      ) : category === null ? (
        <p className="rounded-xl border border-line bg-surface p-4 text-sm text-zinc-400">
          Categoria non trovata su questo dispositivo.
        </p>
      ) : (
        <>
          <h1 className="text-3xl font-black tracking-tight">Modifica categoria</h1>
          <CategoryEditor initial={category} />
        </>
      )}
    </main>
  );
}
