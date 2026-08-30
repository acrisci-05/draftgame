"use client";

import { ArrowLeft, Copy, Pencil, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAdmin } from "@/lib/admin";
import { OFFICIAL_CATEGORIES, categoryName, toRawCategory } from "@/lib/catalog";
import { useClientValue } from "@/lib/client-store";
import { useSettings } from "@/lib/settings";
import {
  allCategories,
  listCustomCategories,
  officialCategories,
  readOverrides,
} from "@/lib/storage";
import type { Category } from "@/lib/types";
import { copyText } from "@/lib/utils";
import { AdminLocked, AdminModal } from "@/components/ui/AdminModal";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Panel, PanelTitle } from "@/components/ui/Panel";
import { ListEditor } from "@/components/game/ListEditor";
import { ItemCount } from "@/components/game/ItemCount";

const NO_OVERRIDES: Record<string, Category> = {};
const NO_CATEGORIES: Category[] = [];

export default function StudioPage() {
  const router = useRouter();
  const { locale, t } = useSettings();
  const official = useClientValue<Category[]>(officialCategories, OFFICIAL_CATEGORIES);
  const custom = useClientValue<Category[]>(listCustomCategories, NO_CATEGORIES);
  const overrides = useClientValue<Record<string, Category>>(readOverrides, NO_OVERRIDES);
  const [editing, setEditing] = useState<Category | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);
  const isAdmin = useAdmin();
  const [adminOpen, setAdminOpen] = useState(false);

  const exportAll = async () => {
    const json = JSON.stringify(allCategories().filter((c) => c.source === "official").map(toRawCategory), null, 2);
    if (await copyText(json)) {
      setCopiedAll(true);
      setTimeout(() => setCopiedAll(false), 2500);
    }
  };

  const renderRow = (category: Category, isOfficial: boolean) => (
    <button
      key={category.id}
      type="button"
      onClick={() => setEditing(category)}
      className="flex w-full items-center gap-3 rounded-xl border border-line bg-surface-2 p-3 text-start transition-colors hover:border-neon/50"
    >
      <span className="text-2xl">{category.emoji}</span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate font-bold">{categoryName(category, locale)}</span>
          {isOfficial && overrides[category.id] ? (
            <Badge tone="gold">{t("studio.overridden")}</Badge>
          ) : null}
        </span>
        <span className="mt-1 block text-xs text-faint">
          {category.items.length} {t("common.items")}
        </span>
        <ItemCount count={category.items.length} className="mt-1.5" />
      </span>
      <Pencil className="size-4 shrink-0 text-faint" />
    </button>
  );

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-4 py-6 safe-bottom">
      <header className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => router.push("/categories")}
          className="flex items-center gap-1.5 text-sm text-faint transition-colors hover:text-fg"
        >
          <ArrowLeft className="size-4" />
          {t("categories.title")}
        </button>
        {isAdmin ? (
          <Button size="sm" variant="outline" onClick={exportAll}>
            <Copy className="size-4" />
            {copiedAll ? t("studio.exported") : t("studio.export")}
          </Button>
        ) : null}
      </header>

      <div>
        <h1 className="text-3xl font-black tracking-tight">{t("studio.title")}</h1>
        <p className="mt-1 text-sm text-muted">{t("studio.subtitle")}</p>
        <p className="mt-1 text-xs text-faint">{t("studio.exportHint")}</p>
      </div>

      {!isAdmin ? (
        <>
          <AdminLocked onOpen={() => setAdminOpen(true)} />
          <AdminModal open={adminOpen} onClose={() => setAdminOpen(false)} />
        </>
      ) : null}

      {isAdmin ? (
        <>
          <Panel>
        <PanelTitle
          action={
            <Button variant="ghost" size="sm" onClick={() => router.push("/categories/new")}>
              <Plus className="size-4" />
              {t("categories.new")}
            </Button>
          }
        >
          {t("studio.custom")}
        </PanelTitle>
        {custom.length === 0 ? (
          <p className="text-sm text-faint">{t("categories.none")}</p>
        ) : (
          <div className="flex flex-col gap-2">{custom.map((c) => renderRow(c, false))}</div>
        )}
      </Panel>

      <Panel>
        <PanelTitle>{t("studio.official")}</PanelTitle>
        <div className="flex flex-col gap-2">{official.map((c) => renderRow(c, true))}</div>
      </Panel>

      <Modal
        open={Boolean(editing)}
        title={editing ? categoryName(editing, locale) : ""}
        onClose={() => setEditing(null)}
      >
        {editing ? (
          <ListEditor
            key={editing.id}
            category={editing}
            official={editing.source === "official"}
            overridden={Boolean(overrides[editing.id])}
            onSaved={() => setEditing(null)}
          />
        ) : null}
          </Modal>
        </>
      ) : null}
    </main>
  );
}
