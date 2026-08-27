"use client";

import { motion } from "framer-motion";
import { Home, RotateCcw, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { itemById, rosterValue, standings, type GameAction } from "@/lib/game";
import type { CatalogItem, GameState } from "@/lib/types";
import { TIER_STYLES, cn } from "@/lib/utils";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Panel, PanelTitle } from "@/components/ui/Panel";
import { TikTokCard } from "./TikTokCard";

interface ResultsProps {
  state: GameState;
  isHost: boolean;
  dispatch: (action: GameAction) => void;
}

export function Results({ state, isHost, dispatch }: ResultsProps) {
  const router = useRouter();
  const ordered = standings(state);
  const discarded = state.discards
    .map((id) => itemById(state, id))
    .filter((item): item is CatalogItem => Boolean(item));

  return (
    <div className="flex flex-col gap-4">
      <div className="text-center">
        <p className="text-xs uppercase tracking-[0.24em] text-zinc-500">Draft completato</p>
        <h1 className="mt-1 text-3xl font-black tracking-tight">
          {state.category.emoji} {state.category.name}
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          {state.history.filter((h) => h.winnerId).length} lotti aggiudicati · stanza {state.code}
        </p>
      </div>

      <Panel>
        <PanelTitle>Roster finali</PanelTitle>
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
                  <span className="text-lg">{player.emoji}</span>
                  <span className="truncate">{player.name}</span>
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  <Badge tone="neutral">${rosterValue(player)} spesi</Badge>
                  <Badge tone="neon">${player.budget} rimasti</Badge>
                </span>
              </div>
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {player.roster.length === 0 ? (
                  <span className="text-sm text-zinc-600">Nessun acquisto</span>
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
                      <span className="font-mono">${entry.price}</span>
                    </span>
                  ))
                )}
              </div>
            </motion.div>
          ))}
        </div>
      </Panel>

      <Panel>
        <PanelTitle>Card per i social · 9:16</PanelTitle>
        <TikTokCard state={state} />
      </Panel>

      {discarded.length > 0 ? (
        <Panel>
          <PanelTitle icon={<Trash2 className="size-3.5" />}>Scarti</PanelTitle>
          <div className="flex flex-wrap gap-1.5">
            {discarded.map((item) => (
              <span
                key={item.id}
                className="rounded-lg border border-line bg-surface-2 px-2 py-1 text-xs text-zinc-500"
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
            Nuova partita
          </Button>
        ) : (
          <span />
        )}
        <Button variant="ghost" onClick={() => router.push("/")}>
          <Home className="size-4" />
          Home
        </Button>
      </div>
    </div>
  );
}
