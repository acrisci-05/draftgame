"use client";

import { Check, Link2, Loader2, Save, Trash2, TriangleAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  ITEMS_PER_TIER,
  buildItems,
  emptyTierDraft,
  itemsToTierDraft,
  validateCategory,
  type TierDraft,
} from "@/lib/catalog";
import { deleteCustomCategory, saveCustomCategory } from "@/lib/storage";
import { isSupabaseConfigured, publishCategory } from "@/lib/supabase";
import type { Category, Tier } from "@/lib/types";
import { TIER_ORDER, TIER_STYLES, cn, copyText, uid } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Panel, PanelTitle } from "@/components/ui/Panel";

const EMOJI_SUGGESTIONS = ["⚽", "🏀", "🎬", "🎮", "🍕", "🎤", "🦸", "🐉", "🚗", "👑", "🎧", "🧀"];

export function CategoryEditor({ initial }: { initial?: Category }) {
  const router = useRouter();
  const [name, setName] = useState(initial?.name ?? "");
  const [emoji, setEmoji] = useState(initial?.emoji ?? "🔥");
  const [tiers, setTiers] = useState<TierDraft>(() =>
    initial ? itemsToTierDraft(initial.items) : emptyTierDraft(),
  );
  const [errors, setErrors] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const [categoryId] = useState(() => initial?.id ?? uid("cat"));

  const setItem = (tier: Tier, index: number, value: string) => {
    setTiers((current) => {
      const next = [...current[tier]];
      next[index] = value;
      return { ...current, [tier]: next };
    });
  };

  const build = (): Category => ({
    id: categoryId,
    name: name.trim(),
    emoji: emoji.trim(),
    items: buildItems(categoryId, tiers),
    source: "custom",
    shareId: initial?.shareId,
    createdAt: initial?.createdAt ?? new Date().toISOString(),
  });

  const validate = (category: Category) => {
    const found = validateCategory(category.name, category.emoji, category.items);
    setErrors(found);
    return found.length === 0;
  };

  const save = () => {
    const category = build();
    if (!validate(category)) return null;
    saveCustomCategory(category);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    return category;
  };

  const publish = async () => {
    const category = save();
    if (!category) return;
    setPublishing(true);
    try {
      const shareId = await publishCategory(category);
      saveCustomCategory({ ...category, shareId });
      const url = `${window.location.origin}/categories/shared/${shareId}`;
      setShareUrl(url);
      setErrors([]);
    } catch (error) {
      setErrors([error instanceof Error ? error.message : "Pubblicazione non riuscita."]);
    } finally {
      setPublishing(false);
    }
  };

  const remove = () => {
    if (!initial) return;
    deleteCustomCategory(initial.id);
    router.push("/categories");
  };

  const filled = TIER_ORDER.reduce(
    (total, tier) => total + tiers[tier].filter((value) => value.trim()).length,
    0,
  );

  return (
    <div className="flex flex-col gap-4">
      <Panel>
        <PanelTitle>Identità della categoria</PanelTitle>
        <Input
          label="Nome"
          value={name}
          maxLength={40}
          placeholder="Es. Anime, Snack, Difensori"
          onChange={(event) => setName(event.target.value)}
        />
        <div className="mt-4">
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Icona
          </p>
          <div className="flex items-center gap-2">
            <input
              value={emoji}
              onChange={(event) => setEmoji(event.target.value.slice(0, 2))}
              className="size-12 shrink-0 rounded-xl border border-line bg-surface-2 text-center text-2xl focus:border-neon/70 focus:outline-none"
            />
            <div className="no-scrollbar flex gap-1.5 overflow-x-auto">
              {EMOJI_SUGGESTIONS.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setEmoji(option)}
                  className={cn(
                    "size-10 shrink-0 rounded-lg border text-lg transition-colors",
                    option === emoji ? "border-neon bg-neon/10" : "border-line bg-surface-2",
                  )}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>
        </div>
      </Panel>

      {TIER_ORDER.map((tier) => {
        const style = TIER_STYLES[tier];
        const count = tiers[tier].filter((value) => value.trim()).length;
        return (
          <Panel key={tier}>
            <PanelTitle
              action={
                <span
                  className={cn(
                    "text-xs font-bold",
                    count === ITEMS_PER_TIER ? "text-neon" : "text-zinc-500",
                  )}
                >
                  {count}/{ITEMS_PER_TIER}
                </span>
              }
            >
              <span
                className={cn(
                  "rounded-md border px-2 py-0.5 text-[11px] font-black",
                  style.chip,
                )}
              >
                ${tier}
              </span>
              <span className="ml-2 normal-case tracking-normal text-zinc-400">{style.label}</span>
            </PanelTitle>
            <div className="flex flex-col gap-2">
              {tiers[tier].slice(0, ITEMS_PER_TIER).map((value, index) => (
                <input
                  key={`${tier}-${index}`}
                  value={value}
                  maxLength={40}
                  placeholder={`Elemento da $${tier} #${index + 1}`}
                  onChange={(event) => setItem(tier, index, event.target.value)}
                  className="h-11 w-full rounded-xl border border-line bg-surface-2 px-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-neon/70 focus:outline-none"
                />
              ))}
            </div>
          </Panel>
        );
      })}

      {errors.length > 0 ? (
        <div className="flex gap-2 rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" />
          <ul className="flex flex-col gap-1">
            {errors.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {shareUrl ? (
        <div className="rounded-xl border border-neon/40 bg-neon/10 p-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-neon">
            Link di condivisione
          </p>
          <p className="mt-1 break-all font-mono text-xs text-zinc-300">{shareUrl}</p>
          <Button
            size="sm"
            variant="outline"
            className="mt-2"
            onClick={async () => {
              if (await copyText(shareUrl)) {
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }
            }}
          >
            {copied ? <Check className="size-4" /> : <Link2 className="size-4" />}
            {copied ? "Copiato" : "Copia link"}
          </Button>
        </div>
      ) : null}

      <div className="sticky bottom-0 flex flex-col gap-2 bg-ink/90 py-3 backdrop-blur safe-bottom">
        <p className="text-center text-xs text-zinc-500">{filled}/25 elementi compilati</p>
        <div className="grid grid-cols-2 gap-2">
          <Button onClick={save}>
            {saved ? <Check className="size-4" /> : <Save className="size-4" />}
            {saved ? "Salvata" : "Salva sul dispositivo"}
          </Button>
          <Button variant="violet" onClick={publish} disabled={publishing || !isSupabaseConfigured}>
            {publishing ? <Loader2 className="size-4 animate-spin" /> : <Link2 className="size-4" />}
            Pubblica link
          </Button>
        </div>
        {initial ? (
          <Button variant="danger" size="sm" onClick={remove}>
            <Trash2 className="size-4" />
            Elimina categoria
          </Button>
        ) : null}
      </div>
    </div>
  );
}
