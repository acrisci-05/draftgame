"use client";

import { motion } from "framer-motion";
import { Check, Home, Link2, Loader2, RotateCcw, Trash2, Vote } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { categoryName } from "@/lib/catalog";
import { voteUrlFor } from "@/lib/config";
import { itemById, rosterValue, standings, type GameAction } from "@/lib/game";
import { useSettings } from "@/lib/settings";
import { isSupabaseConfigured, publishResult } from "@/lib/supabase";
import type { CatalogItem, GameState } from "@/lib/types";
import { TIER_STYLES, cn, copyText, money } from "@/lib/utils";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Panel, PanelTitle } from "@/components/ui/Panel";
import { QrCode } from "@/components/ui/QrCode";
import { FriendShare } from "./FriendShare";
import { TikTokCard } from "./TikTokCard";

interface ResultsProps {
  state: GameState;
  isHost: boolean;
  dispatch: (action: GameAction) => void;
}

export function Results({ state, isHost, dispatch }: ResultsProps) {
  const router = useRouter();
  const { locale, t } = useSettings();
  const [voteUrl, setVoteUrl] = useState<string | null>(null);
  const [resultId, setResultId] = useState<string | null>(null);
  const [voteBusy, setVoteBusy] = useState(false);
  const [voteError, setVoteError] = useState(false);
  const [copied, setCopied] = useState(false);

  const currency = state.config.currency;
  const ordered = standings(state);
  const discarded = state.discards
    .map((id) => itemById(state, id))
    .filter((item): item is CatalogItem => Boolean(item));

  const generateVote = async () => {
    setVoteBusy(true);
    setVoteError(false);
    try {
      const id = await publishResult({
        code: state.code,
        categoryName: categoryName(state.category, locale),
        categoryEmoji: state.category.emoji,
        currency,
        players: state.players,
      });
      setResultId(id);
      setVoteUrl(voteUrlFor(id));
    } catch {
      setVoteError(true);
    } finally {
      setVoteBusy(false);
    }
  };

  const copyVoteUrl = async () => {
    if (!voteUrl || !(await copyText(voteUrl))) return;
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="text-center">
        <p className="text-xs uppercase tracking-[0.24em] text-faint">{t("results.title")}</p>
        <h1 className="mt-1 text-3xl font-black tracking-tight">
          {state.category.emoji} {categoryName(state.category, locale)}
        </h1>
        <p className="mt-1 text-sm text-faint">
          {t("results.subtitle", {
            n: state.history.filter((entry) => entry.winnerId).length,
            code: state.code,
          })}
        </p>
      </div>

      <Panel>
        <PanelTitle>{t("results.rosters")}</PanelTitle>
        <div className="flex flex-col gap-3">
          {ordered.map((player, index) => (
            <motion.div
              key={player.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="rounded-xl border border-line bg-surface-2 p-3"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="flex min-w-0 items-center gap-2 font-bold">
                  <Avatar id={player.emoji} size="sm" />
                  <span className="truncate">{player.name}</span>
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  <Badge tone="neutral">
                    {t("results.spent", { amount: money(rosterValue(player), currency) })}
                  </Badge>
                  <Badge tone="neon">
                    {t("results.left", { amount: money(player.budget, currency) })}
                  </Badge>
                </span>
              </div>
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {player.roster.length === 0 ? (
                  <span className="text-sm text-faint">{t("results.empty")}</span>
                ) : (
                  player.roster.map((entry) => (
                    <span
                      key={entry.itemId}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-xs font-semibold",
                        TIER_STYLES[entry.tier].chip,
                      )}
                    >
                      {entry.name}
                      <span className="font-mono">{money(entry.price, currency)}</span>
                    </span>
                  ))
                )}
              </div>
            </motion.div>
          ))}
        </div>
      </Panel>

      <Panel>
        <PanelTitle icon={<Vote className="size-3.5" />}>{t("vote.panel")}</PanelTitle>
        {!isSupabaseConfigured ? (
          <p className="text-sm text-amber-500">{t("vote.offline")}</p>
        ) : voteUrl ? (
          <div className="flex flex-col items-center gap-3">
            <QrCode value={voteUrl} size={160} />
            <p className="break-all text-center font-mono text-xs text-muted">{voteUrl}</p>
            <Button variant="outline" size="sm" onClick={copyVoteUrl}>
              {copied ? <Check className="size-4" /> : <Link2 className="size-4" />}
              {copied ? t("common.copied") : t("common.copy")}
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <p className="text-sm text-muted">{t("vote.hint")}</p>
            {voteError ? <p className="text-sm text-red-500">{t("vote.error")}</p> : null}
            <Button variant="violet" disabled={voteBusy} onClick={generateVote}>
              {voteBusy ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Vote className="size-4" />
              )}
              {voteBusy ? t("vote.generating") : t("vote.generate")}
            </Button>
          </div>
        )}

        {isSupabaseConfigured ? <FriendShare resultId={resultId} /> : null}
      </Panel>

      <Panel>
        <PanelTitle>{t("results.card")}</PanelTitle>
        <TikTokCard state={state} voteUrl={voteUrl} />
      </Panel>

      {discarded.length > 0 ? (
        <Panel>
          <PanelTitle icon={<Trash2 className="size-3.5" />}>{t("results.discards")}</PanelTitle>
          <div className="flex flex-wrap gap-1.5">
            {discarded.map((item) => (
              <span
                key={item.id}
                className="rounded-lg border border-line bg-surface-2 px-2 py-1 text-xs text-faint"
              >
                {item.name}
              </span>
            ))}
          </div>
        </Panel>
      ) : null}

      <div className="grid grid-cols-2 gap-2 pb-8">
        {isHost ? (
          <Button variant="outline" onClick={() => dispatch({ type: "restart" })}>
            <RotateCcw className="size-4" />
            {t("results.restart")}
          </Button>
        ) : (
          <span />
        )}
        <Button variant="ghost" onClick={() => router.push("/")}>
          <Home className="size-4" />
          {t("common.home")}
        </Button>
      </div>
    </div>
  );
}
