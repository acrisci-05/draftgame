"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { CategoryEditor } from "@/components/game/CategoryEditor";

export default function NewCategoryPage() {
  const router = useRouter();

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

      <div>
        <h1 className="text-3xl font-black tracking-tight">Nuova categoria</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Cinque elementi per ogni fascia di prezzo: i $5 sono i favoriti, gli $1 le scelte di
          nicchia.
        </p>
      </div>

      <CategoryEditor />
    </main>
  );
}
