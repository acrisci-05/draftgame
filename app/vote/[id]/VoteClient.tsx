"use client";

import { motion } from "framer-motion";
import { Check, Home, Loader2, TriangleAlert, Trophy } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { rosterValue } from "@/lib/game";
import { useSettings } from "@/lib/settings";
import { ensureProfile, readVote, saveVote } from "@/lib/storage";
import { castVote, fetchResult, fetchVotes, isSupabaseConfigured } from "@/lib/supabase";
import type { VoteResultPayload, VoteTally } from "@/lib/types";
import { TIER_STYLES, cn, money } from "@/lib/utils";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Panel, PanelTitle } from "@/components/ui/Panel";

export function VoteClient({ resultId }: { resultId: string }) {
  const router = useRouter();
  const { t } = useSettings();
  const [result, setResult] = useState<VoteResultPayload | null>(null);
  const [tally, setTally] = useState<VoteTally[]>([]);
  const [votedId, setVotedId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const missing = failed || !isSupabaseConfigured;

  const loadVotes = useCallback(async () => {
    try {
      setTally(await fetchVotes(resultId));
    } catch {
      /* i conteggi restano quelli già mostrati */
    }
  }, [resultId]);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    let active = true;
    fetchResult(resultId)
      .then((payload) => {
        if (!active) return;
        setResult(payload);
        setVotedId(readVote(resultId));
        void loadVotes();
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
    };
  }, [resultId, loadVotes]);

  const vote = async (playerId: string) => {
    setBusyId(playerId);
    try {
      await castVote(resultId, playerId, ensureProfile().id);
      saveVote(resultId, playerId);
      setVotedId(playerId);
      await loadVotes();
    } catch {
      /* niente da fare: il voto resta disponibile per un nuovo tentativo */
    } finally {
      setBusyId(null);
    }
  };

  if (missing) {
    return (
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-4 px-4 py-10 text-center">
        <TriangleAlert className="size-8 text-amber-500" />
        <p className="text-sm text-muted">{t("vote.notFound")}</p>
        <Button variant="outline" onClick={() => router.push("/")}>
          <Home className="size-4" />
          {t("common.home")}
        </Button>
      </main>
    );
  }

  if (!result) {
    return (
      <main className="flex flex-1 items-center justify-center p-8 text-faint">
        <Loader2 className="size-6 animate-spin" />
      </main>
    );
  }

  const votesFor = (playerId: string) => tally.find((row) => row.playerId === playerId)?.votes ?? 0;
  const total = tally.reduce((sum, row) => sum + row.votes, 0);
  const votedPlayer = result.players.find((player) => player.id === votedId);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-4 py-8 safe-bottom">
      <header className="rounded-3xl border border-line bg-surface grid-noise p-6 text-center">
        <span className="text-4xl">{result.categoryEmoji}</span>
        <h1 className="mt-2 text-2xl font-black tracking-tight">{t("vote.title")}</h1>
        <p className="mt-1 text-sm text-muted">{result.categoryName}</p>
        <p className="mt-3 text-xs uppercase tracking-[0.2em] text-faint">
          {votedPlayer ? t("vote.voted", { player: votedPlayer.name }) : t("vote.subtitle")}
        </p>
      </header>

      <Panel>
        <PanelTitle
          icon={<Trophy className="size-3.5" />}
          action={<span className="text-xs text-faint">{t("vote.total", { n: total })}</span>}
        >
          {t("results.rosters")}
        </PanelTitle>

        <div className="flex flex-col gap-3">
          {result.players.map((player, index) => {
            const picked = player.id === votedId;
            return (
              <motion.div
                key={player.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className={cn(
                  "rounded-xl border p-3",
                  picked ? "border-neon/60 bg-neon/10" : "border-line bg-surface-2",
                )}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="flex min-w-0 items-center gap-2 font-bold">
                    <span className="text-lg">{player.emoji}</span>
                    <span className="truncate">{player.name}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <Badge tone="neutral">
                      {t("results.spent", {
                        amount: money(rosterValue(player), result.currency),
                      })}
                    </Badge>
                    <Badge tone="neon">{t("vote.count", { n: votesFor(player.id) })}</Badge>
                  </span>
                </div>

                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {player.roster.map((entry) => (
                    <span
                      key={entry.itemId}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-xs font-semibold",
                        TIER_STYLES[entry.tier].chip,
                      )}
                    >
                      {entry.name}
                      <span className="font-mono">{money(entry.price, result.currency)}</span>
                    </span>
                  ))}
                </div>

                <Button
                  size="sm"
                  variant={picked ? "outline" : "primary"}
                  className="mt-3 w-full"
                  disabled={busyId !== null}
                  onClick={() => vote(player.id)}
                >
                  {busyId === player.id ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : picked ? (
                    <Check className="size-4" />
                  ) : null}
                  {t("vote.button", { player: player.name })}
                </Button>
              </motion.div>
            );
          })}
        </div>
      </Panel>

      <Button variant="ghost" onClick={() => router.push("/")}>
        <Home className="size-4" />
        {t("common.home")}
      </Button>
    </main>
  );
}
