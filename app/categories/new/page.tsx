"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { CategoryEditor } from "@/components/game/CategoryEditor";
import { useT } from "@/lib/settings";

export default function NewCategoryPage() {
  const router = useRouter();
  const t = useT();

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

      <div>
        <h1 className="text-3xl font-black tracking-tight">{t("editor.newTitle")}</h1>
        <p className="mt-1 text-sm text-faint">{t("editor.subtitle")}</p>
      </div>

      <CategoryEditor />
    </main>
  );
}
