"use client";

import {
  Check,
  Copy,
  Database,
  ImageIcon,
  Loader2,
  RotateCcw,
  Save,
  Search,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { useState } from "react";
import {
  ITEMS_PER_TIER,
  buildItems,
  itemsToTierDraft,
  toRawCategory,
  validateCategory,
  type TierDraft,
} from "@/lib/catalog";
import { findImage, searchImages, type ImageCandidate } from "@/lib/images";
import { useSettings } from "@/lib/settings";
import { removeOverride, saveCustomCategory, saveOverride } from "@/lib/storage";
import type { Category, Tier } from "@/lib/types";
import { TIER_ORDER, cn, copyText } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Panel, PanelTitle } from "@/components/ui/Panel";
import { ItemCover } from "./ItemCover";
import { TierChip, tierNameKey } from "./TierChip";

interface ListEditorProps {
  category: Category;
  /** true quando la lista è ufficiale: le modifiche restano locali finché non esporti il JSON. */
  official: boolean;
  overridden?: boolean;
  onSaved?: () => void;
}

export function ListEditor({ category, official, overridden, onSaved }: ListEditorProps) {
  const { locale, t } = useSettings();
  const [searching, setSearching] = useState<string | null>(null);
  const [notFound, setNotFound] = useState<string[]>([]);
  const [picker, setPicker] = useState<{
    key: string;
    tier: Tier;
    index: number;
    items: ImageCandidate[];
  } | null>(null);
  const [name, setName] = useState(category.name);
  const [emoji, setEmoji] = useState(category.emoji);
  const [tiers, setTiers] = useState<TierDraft>(() => itemsToTierDraft(category.items));
  const [openImage, setOpenImage] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);

  const setRow = (tier: Tier, index: number, patch: Partial<TierDraft[Tier][number]>) => {
    setTiers((current) => {
      const rows = [...current[tier]];
      rows[index] = { ...rows[index], ...patch };
      return { ...current, [tier]: rows };
    });
  };

  /** Mostra i risultati e lascia scegliere: l'automatismo da solo sbaglia troppo. */
  const lookup = async (tier: Tier, index: number) => {
    const row = tiers[tier][index];
    if (!row?.name.trim()) return;
    const key = `${tier}-${index}`;
    setSearching(key);
    setPicker(null);
    const results = await searchImages(row.name, locale, name.trim(), 6);
    setSearching(null);
    if (results.length === 0) {
      setNotFound((current) => (current.includes(key) ? current : [...current, key]));
      return;
    }
    setNotFound((current) => current.filter((entry) => entry !== key));
    setPicker({ key, tier, index, items: results });
  };

  const lookupAll = async () => {
    setSearching("all");
    setNotFound([]);
    for (const tier of TIER_ORDER) {
      for (let index = 0; index < tiers[tier].length; index += 1) {
        const row = tiers[tier][index];
        if (!row.name.trim() || row.image.trim()) continue;
        const url = await findImage(row.name, locale, name.trim());
        if (url) setRow(tier, index, { image: url });
        await new Promise((resolve) => setTimeout(resolve, 120));
      }
    }
    setSearching(null);
  };

  const build = (): Category => ({
    ...category,
    name: name.trim(),
    emoji: emoji.trim(),
    items: buildItems(category.id, tiers),
  });

  const describe = (issue: ReturnType<typeof validateCategory>[number]) => {
    if (issue.key === "name") return t("editor.errName");
    if (issue.key === "emoji") return t("editor.errEmoji");
    return t("editor.errTier", {
      tier: issue.tier ?? "",
      required: ITEMS_PER_TIER,
      count: issue.count ?? 0,
    });
  };

  const save = () => {
    const next = build();
    const issues = validateCategory(next.name, next.emoji, next.items);
    setErrors(issues.map(describe));
    if (issues.length > 0) return;
    if (official) saveOverride(next);
    else saveCustomCategory(next);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    onSaved?.();
  };

  const exportJson = async () => {
    const json = JSON.stringify(toRawCategory(build()), null, 2);
    if (await copyText(json)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  /** Query pronta per l'SQL editor di Supabase: pubblica la lista per tutti. */
  const exportSql = async () => {
    const raw = toRawCategory(build());
    const quote = (value: string | undefined) =>
      value === undefined ? "null" : `'${value.replace(/'/g, "''")}'`;
    const sql = [
      "insert into public.official_lists (id, name, name_en, emoji, theme, tiers)",
      `values (${quote(raw.id)}, ${quote(raw.name)}, ${quote(raw.nameEn)}, ${quote(raw.emoji)}, ${quote(raw.theme)}, ${quote(JSON.stringify(raw.tiers))}::jsonb)`,
      "on conflict (id) do update set",
      "  name = excluded.name,",
      "  name_en = excluded.name_en,",
      "  emoji = excluded.emoji,",
      "  theme = excluded.theme,",
      "  tiers = excluded.tiers,",
      "  updated_at = now();",
    ].join("\n");
    if (await copyText(sql)) {
      setCopiedSql(true);
      setTimeout(() => setCopiedSql(false), 3000);
    }
  };

  const restore = () => {
    removeOverride(category.id);
    onSaved?.();
  };

  return (
    <div className="flex flex-col gap-4">
      <Panel>
        <PanelTitle>{t("editor.identity")}</PanelTitle>
        <div className="flex gap-2">
          <input
            value={emoji}
            aria-label={t("editor.icon")}
            onChange={(event) => setEmoji(event.target.value.slice(0, 3))}
            className="size-12 shrink-0 rounded-xl border border-line bg-surface-2 text-center text-2xl focus:border-neon/70 focus:outline-none"
          />
          <div className="flex-1">
            <Input
              value={name}
              maxLength={40}
              placeholder={t("editor.namePlaceholder")}
              onChange={(event) => setName(event.target.value)}
            />
          </div>
        </div>

        <Button
          variant="outline"
          className="mt-3 w-full"
          disabled={searching !== null}
          onClick={lookupAll}
        >
          {searching === "all" ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Search className="size-4" />
          )}
          {searching === "all" ? t("studio.searching") : t("studio.findAll")}
        </Button>
        <p className="mt-2 text-xs text-faint">{t("studio.imageSource")}</p>
      </Panel>

      {TIER_ORDER.map((tier) => {
        const filled = tiers[tier].filter((row) => row.name.trim()).length;
        return (
          <Panel key={tier}>
            <PanelTitle
              action={
                <span
                  className={cn(
                    "text-xs font-bold",
                    filled === ITEMS_PER_TIER ? "text-neon" : "text-faint",
                  )}
                >
                  {filled === ITEMS_PER_TIER ? <Check className="size-4" /> : `${filled}`}
                </span>
              }
            >
              <TierChip tier={tier} />
              <span className="ms-2 normal-case tracking-normal text-muted">
                {t(tierNameKey(tier))}
              </span>
            </PanelTitle>

            <div className="flex flex-col gap-2">
              {tiers[tier].slice(0, ITEMS_PER_TIER).map((row, index) => {
                const key = `${tier}-${index}`;
                return (
                  <div key={key} className="flex flex-col gap-1.5">
                    <div className="flex items-center gap-2">
                      <ItemCover
                        item={{
                          id: key,
                          name: row.name || "?",
                          tier,
                          emoji: row.emoji || undefined,
                          image: row.image || undefined,
                        }}
                        size="sm"
                      />
                      <input
                        value={row.emoji}
                        aria-label="emoji"
                        placeholder="🙂"
                        onChange={(event) => setRow(tier, index, { emoji: event.target.value.slice(0, 3) })}
                        className="size-11 shrink-0 rounded-xl border border-line bg-surface-2 text-center text-lg focus:border-neon/70 focus:outline-none"
                      />
                      <input
                        value={row.name}
                        maxLength={40}
                        placeholder={t("editor.itemPlaceholder", { price: tier, index: index + 1 })}
                        onChange={(event) => setRow(tier, index, { name: event.target.value })}
                        className="h-11 min-w-0 flex-1 rounded-xl border border-line bg-surface-2 px-3 text-sm text-fg placeholder:text-faint/70 focus:border-neon/70 focus:outline-none"
                      />
                      <button
                        type="button"
                        aria-label={t("studio.findImage")}
                        title={t("studio.findImage")}
                        disabled={searching !== null || !row.name.trim()}
                        onClick={() => lookup(tier, index)}
                        className="grid size-11 shrink-0 place-items-center rounded-xl border border-line bg-surface-2 text-faint transition-colors hover:text-neon disabled:opacity-40"
                      >
                        {searching === key ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <Search className="size-4" />
                        )}
                      </button>
                      <button
                        type="button"
                        aria-label="URL"
                        onClick={() => setOpenImage(openImage === key ? null : key)}
                        className={cn(
                          "grid size-11 shrink-0 place-items-center rounded-xl border transition-colors",
                          row.image
                            ? "border-neon/50 bg-neon/10 text-neon"
                            : "border-line bg-surface-2 text-faint hover:text-fg",
                        )}
                      >
                        <ImageIcon className="size-4" />
                      </button>
                      {/*
                        Svuota la riga: nome, icona e foto. Il posto resta,
                        perche' ogni fascia ne vuole sei: si libera per
                        rimpiazzare l'elemento con un altro.
                      */}
                      <button
                        type="button"
                        aria-label={t("studio.clearItem")}
                        title={t("studio.clearItem")}
                        disabled={!row.name && !row.image}
                        onClick={() => setRow(tier, index, { name: "", emoji: "", image: "" })}
                        className="grid size-11 shrink-0 place-items-center rounded-xl border border-line bg-surface-2 text-faint transition-colors hover:border-red-500/50 hover:text-red-500 disabled:opacity-40"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>

                    {notFound.includes(key) ? (
                      <p className="text-xs text-amber-500">{t("studio.imageNotFound")}</p>
                    ) : null}

                    {picker?.key === key ? (
                      <div className="rounded-xl border border-line bg-surface-2 p-2">
                        <p className="mb-2 text-xs font-semibold text-faint">
                          {t("studio.pickImage")}
                        </p>
                        <div className="grid grid-cols-3 gap-2">
                          {picker.items.map((candidate) => (
                            <button
                              key={candidate.url}
                              type="button"
                              onClick={() => {
                                setRow(tier, index, { image: candidate.url });
                                setPicker(null);
                              }}
                              className="flex flex-col gap-1 rounded-lg border border-line p-1 text-start transition-colors hover:border-neon"
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={candidate.url}
                                alt={candidate.title}
                                loading="lazy"
                                referrerPolicy="no-referrer"
                                className="h-16 w-full rounded object-cover"
                              />
                              <span className="truncate text-[10px] leading-tight text-muted">
                                {candidate.title}
                              </span>
                              {!candidate.relevant ? (
                                <span className="text-[9px] text-amber-500">
                                  {t("studio.notRelevant")}
                                </span>
                              ) : null}
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    {openImage === key ? (
                      <div className="flex gap-2">
                        <input
                          // Senza il valore il campo si apriva vuoto anche con
                          // una foto gia' impostata: sembrava che non si potesse
                          // correggere, si poteva solo riscrivere da capo.
                          value={row.image}
                          placeholder={t("editor.imagePlaceholder", {
                            optional: t("common.optional"),
                          })}
                          onChange={(event) => setRow(tier, index, { image: event.target.value })}
                          className="h-10 min-w-0 flex-1 rounded-xl border border-line bg-surface-2 px-3 text-xs text-fg placeholder:text-faint/70 focus:border-neon/70 focus:outline-none"
                        />
                        <button
                          type="button"
                          aria-label={t("studio.clearImage")}
                          title={t("studio.clearImage")}
                          disabled={!row.image}
                          onClick={() => setRow(tier, index, { image: "" })}
                          className="grid size-10 shrink-0 place-items-center rounded-xl border border-line bg-surface-2 text-faint transition-colors hover:text-red-500 disabled:opacity-40"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </Panel>
        );
      })}

      {errors.length > 0 ? (
        <div className="flex gap-2 rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-500">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" />
          <ul className="flex flex-col gap-1">
            {errors.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {copied ? (
        <p className="rounded-xl border border-neon/40 bg-neon/10 p-3 text-sm text-neon">
          {t("studio.exported")} — {t("studio.exportHint")}
        </p>
      ) : null}

      {copiedSql ? (
        <p className="rounded-xl border border-violet/40 bg-violet/10 p-3 text-sm text-violet">
          {t("admin.sqlCopied")}
        </p>
      ) : null}

      <div className="sticky bottom-0 flex flex-col gap-2 bg-ink/90 py-3 backdrop-blur safe-bottom">
        <div className="grid grid-cols-2 gap-2">
          <Button onClick={save}>
            {saved ? <Check className="size-4" /> : <Save className="size-4" />}
            {saved ? t("editor.saved") : t("common.save")}
          </Button>
          <Button variant="outline" onClick={exportJson}>
            {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
            {t("studio.export")}
          </Button>
        </div>
        <Button variant="violet" size="sm" onClick={exportSql}>
          {copiedSql ? <Check className="size-4" /> : <Database className="size-4" />}
          {t("admin.sql")}
        </Button>
        {official && overridden ? (
          <Button variant="danger" size="sm" onClick={restore}>
            <RotateCcw className="size-4" />
            {t("studio.restore")}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
