"use client";

import { Check, Inbox, Loader2, RotateCcw, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { useT } from "@/lib/settings";
import {
  deleteSuggestion,
  fetchSuggestions,
  isSupabaseConfigured,
  markSuggestion,
  type Suggestion,
} from "@/lib/supabase";
import { Badge } from "./Badge";
import { Panel, PanelTitle } from "./Panel";

/**
 * I suggerimenti ricevuti, dentro lo Studio.
 *
 * Compare solo a chi ha il contrassegno di creatore sul profilo. È comunque una
 * comodità dell'interfaccia: anche togliendo questa condizione a mano, il
 * database non consegnerebbe niente a nessun altro.
 */
export function SuggestionsPanel() {
  const t = useT();
  const { account } = useAuth();
  const [items, setItems] = useState<Suggestion[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  // Cambiarlo fa rileggere la lista: e' il modo di ricaricare dopo una modifica
  // senza chiamare la lettura direttamente dentro un gestore di eventi.
  const [reload, setReload] = useState(0);

  const isCreator = Boolean(account?.isAdmin) && isSupabaseConfigured;

  useEffect(() => {
    if (!isCreator) return;
    let active = true;
    fetchSuggestions().then((rows) => {
      if (active) setItems(rows);
    });
    return () => {
      active = false;
    };
  }, [isCreator, reload]);

  if (!isCreator) return null;

  const change = async (item: Suggestion, action: () => Promise<void>) => {
    setBusy(item.id);
    try {
      await action();
      setReload((n) => n + 1);
    } finally {
      setBusy(null);
    }
  };

  const toggle = (item: Suggestion) =>
    change(item, () => markSuggestion(item.id, item.handledAt === null));

  const remove = (item: Suggestion) => change(item, () => deleteSuggestion(item.id));

  const pending = items?.filter((item) => item.handledAt === null).length ?? 0;

  return (
    <Panel>
      <PanelTitle
        action={
          pending > 0 ? <Badge tone="gold">{t("suggestions.pending", { n: pending })}</Badge> : null
        }
      >
        {t("suggestions.title")}
      </PanelTitle>

      {items === null ? (
        <p className="flex items-center gap-2 text-sm text-faint">
          <Loader2 className="size-4 animate-spin" />
          {t("common.loading")}
        </p>
      ) : items.length === 0 ? (
        <p className="flex items-center gap-2 text-sm text-faint">
          <Inbox className="size-4" />
          {t("suggestions.empty")}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((item) => (
            <li
              key={item.id}
              className={`rounded-xl border p-3 transition-colors ${
                item.handledAt === null
                  ? "border-line bg-surface-2"
                  : "border-line/50 bg-surface-2/40 opacity-60"
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold">{item.name}</p>
                  {item.idea ? (
                    <p className="mt-1 text-sm break-words whitespace-pre-wrap text-muted">
                      {item.idea}
                    </p>
                  ) : null}
                  <p className="mt-1.5 text-xs text-faint">
                    {item.author ? `@${item.author}` : t("suggestions.unknownAuthor")}
                    {" · "}
                    {new Date(item.createdAt).toLocaleDateString()}
                  </p>
                </div>

                <div className="flex shrink-0 gap-1">
                  <button
                    type="button"
                    disabled={busy === item.id}
                    onClick={() => toggle(item)}
                    aria-label={
                      item.handledAt === null ? t("suggestions.markDone") : t("suggestions.reopen")
                    }
                    title={
                      item.handledAt === null ? t("suggestions.markDone") : t("suggestions.reopen")
                    }
                    className="grid size-9 place-items-center rounded-lg border border-line text-faint transition-colors hover:border-neon/50 hover:text-neon disabled:opacity-40"
                  >
                    {busy === item.id ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : item.handledAt === null ? (
                      <Check className="size-4" />
                    ) : (
                      <RotateCcw className="size-4" />
                    )}
                  </button>

                  <button
                    type="button"
                    disabled={busy === item.id}
                    onClick={() => remove(item)}
                    aria-label={t("suggestions.delete")}
                    title={t("suggestions.delete")}
                    className="grid size-9 place-items-center rounded-lg border border-line text-faint transition-colors hover:border-red-500/50 hover:text-red-500 disabled:opacity-40"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
