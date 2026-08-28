"use client";

import { Check, Link2, Loader2, Save, Trash2, TriangleAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  ITEMS_PER_CATEGORY,
  ITEMS_PER_TIER,
  buildItems,
  emptyTierDraft,
  itemsToTierDraft,
  validateCategory,
  type CategoryIssue,
  type DraftItem,
  type TierDraft,
} from "@/lib/catalog";
import { useSettings } from "@/lib/settings";
import { deleteCustomCategory, saveCustomCategory } from "@/lib/storage";
import { isSupabaseConfigured, publishCategory } from "@/lib/supabase";
import type { Category, Tier } from "@/lib/types";
import { TIER_ORDER, TIER_STYLES, cn, copyText, uid } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Panel, PanelTitle } from "@/components/ui/Panel";
import { TierChip } from "./TierChip";

const EMOJI_SUGGESTIONS = ["⚽", "🏀", "🎬", "🎮", "🍕", "🎤", "🦸", "🐉", "🚗", "👑", "🎧", "🧀"];

export function CategoryEditor({ initial }: { initial?: Category }) {
  const router = useRouter();
  const { locale, t } = useSettings();
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

  const describe = (issue: CategoryIssue): string => {
    if (issue.key === "name") return t("editor.errName");
    if (issue.key === "emoji") return t("editor.errEmoji");
    return t("editor.errTier", {
      tier: issue.tier ?? 0,
      required: ITEMS_PER_TIER,
      count: issue.count ?? 0,
    });
  };

  const setItem = (tier: Tier, index: number, patch: Partial<DraftItem>) => {
    setTiers((current) => {
      const next = [...current[tier]];
      next[index] = { ...next[index], ...patch };
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
    setErrors(found.map(describe));
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
      setShareUrl(`${window.location.origin}/categories/shared/${shareId}`);
      setErrors([]);
    } catch {
      setErrors([t("editor.publishError")]);
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
    (total, tier) => total + tiers[tier].filter((row) => row.name.trim()).length,
    0,
  );

  return (
    <div className="flex flex-col gap-4">
      <Panel>
        <PanelTitle>{t("editor.identity")}</PanelTitle>
        <Input
          label={t("editor.name")}
          value={name}
          maxLength={40}
          placeholder={t("editor.namePlaceholder")}
          onChange={(event) => setName(event.target.value)}
        />
        <div className="mt-4">
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-faint">
            {t("editor.icon")}
          </p>
          <div className="flex items-center gap-2">
            <input
              value={emoji}
              aria-label={t("editor.icon")}
              onChange={(event) => setEmoji(event.target.value.slice(0, 2))}
              className="size-12 shrink-0 rounded-xl border border-line bg-surface-2 text-center text-2xl focus:border-neon/70 focus:outline-none"
            />
            <div className="no-scrollbar flex gap-1.5 overflow-x-auto">
              {EMOJI_SUGGESTIONS.map((option) => (
                <button
                  key={option}
                  type="button"
                  aria-label={option}
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
        const count = tiers[tier].filter((row) => row.name.trim()).length;
        return (
          <Panel key={tier}>
            <PanelTitle
              action={
                count === ITEMS_PER_TIER ? (
                  <Check className="size-4 text-neon" />
                ) : (
                  <span className="text-xs font-bold text-faint">{count}</span>
                )
              }
            >
              <TierChip tier={tier} />
              <span className="ms-2 normal-case tracking-normal text-muted">
                {locale === "it" ? style.label : style.labelEn}
              </span>
            </PanelTitle>
            <div className="flex flex-col gap-3">
              {tiers[tier].slice(0, ITEMS_PER_TIER).map((row, index) => (
                <div key={`${tier}-${index}`} className="flex flex-col gap-1.5">
                  <div className="flex items-center gap-2">
                    <input
                      value={row.emoji}
                      aria-label="emoji"
                      placeholder="🙂"
                      onChange={(event) =>
                        setItem(tier, index, { emoji: event.target.value.slice(0, 3) })
                      }
                      className="size-11 shrink-0 rounded-xl border border-line bg-surface-2 text-center text-lg focus:border-neon/70 focus:outline-none"
                    />
                    <input
                      value={row.name}
                      maxLength={40}
                      placeholder={t("editor.itemPlaceholder", { price: tier, index: index + 1 })}
                      onChange={(event) => setItem(tier, index, { name: event.target.value })}
                      className="h-11 min-w-0 flex-1 rounded-xl border border-line bg-surface-2 px-3 text-sm text-fg placeholder:text-faint/70 focus:border-neon/70 focus:outline-none"
                    />
                  </div>
                  {row.name.trim() ? (
                    <input
                      value={row.image}
                      inputMode="url"
                      placeholder={t("editor.imagePlaceholder", {
                        optional: t("common.optional"),
                      })}
                      onChange={(event) => setItem(tier, index, { image: event.target.value })}
                      className="h-9 w-full rounded-lg border border-line bg-surface px-3 text-xs text-muted placeholder:text-faint/70 focus:border-neon/70 focus:outline-none"
                    />
                  ) : null}
                </div>
              ))}
            </div>
          </Panel>
        );
      })}

      {errors.length > 0 ? (
        <div className="flex gap-2 rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-400">
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
            {t("editor.shareTitle")}
          </p>
          <p className="mt-1 break-all font-mono text-xs text-muted">{shareUrl}</p>
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
            {copied ? t("common.copied") : t("common.copy")}
          </Button>
        </div>
      ) : null}

      <div className="sticky bottom-0 flex flex-col gap-2 bg-ink/90 py-3 backdrop-blur safe-bottom">
        <p className="text-center text-xs text-faint">
          {t("editor.filled", { filled, total: ITEMS_PER_CATEGORY })}
        </p>
        <div className="grid grid-cols-2 gap-2">
          <Button onClick={save}>
            {saved ? <Check className="size-4" /> : <Save className="size-4" />}
            {saved ? t("editor.saved") : t("editor.saveLocal")}
          </Button>
          <Button variant="violet" onClick={publish} disabled={publishing || !isSupabaseConfigured}>
            {publishing ? <Loader2 className="size-4 animate-spin" /> : <Link2 className="size-4" />}
            {t("editor.publish")}
          </Button>
        </div>
        {initial ? (
          <Button variant="danger" size="sm" onClick={remove}>
            <Trash2 className="size-4" />
            {t("editor.delete")}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
