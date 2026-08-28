"use client";

import { ArrowLeft, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { CategoryEditor } from "@/components/game/CategoryEditor";
import { useClientValue, useIsClient } from "@/lib/client-store";
import { useT } from "@/lib/settings";
import { listCustomCategories } from "@/lib/storage";
import type { Category } from "@/lib/types";

export function EditCategoryClient({ id }: { id: string }) {
  const router = useRouter();
  const t = useT();
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
        className="flex items-center gap-1.5 self-start text-sm text-faint transition-colors hover:text-fg"
      >
        <ArrowLeft className="size-4" />
        {t("common.categories")}
      </button>

      {!isClient ? (
        <div className="flex flex-1 items-center justify-center text-faint">
          <Loader2 className="size-6 animate-spin" />
        </div>
      ) : category === null ? (
        <p className="rounded-xl border border-line bg-surface p-4 text-sm text-muted">
          {t("categories.notFound")}
        </p>
      ) : (
        <>
          <h1 className="text-3xl font-black tracking-tight">{t("editor.editTitle")}</h1>
          <CategoryEditor initial={category} />
        </>
      )}
    </main>
  );
}
