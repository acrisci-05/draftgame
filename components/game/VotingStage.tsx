"use client";

import { motion } from "framer-motion";
import { Check, Trophy } from "lucide-react";
import { useT } from "@/lib/settings";
import {
  canVote,
  colorLook,
  hasVoted,
  pendingVoters,
  playerById,
  rosterValue,
  type GameAction,
} from "@/lib/game";
import type { GameState } from "@/lib/types";
import { TIER_STYLES, cn, money } from "@/lib/utils";
import { Avatar } from "@/components/ui/Avatar";
import { Panel, PanelTitle } from "@/components/ui/Panel";
import { Timer } from "./Timer";

interface VotingStageProps {
  state: GameState;
  /** Chi guarda su questo dispositivo. */
  selfId: string;
  now: () => number;
  dispatch: (action: GameAction) => void;
}

/**
 * Il voto finale.
 *
 * A dire chi ha fatto la rosa migliore sono i giocatori, non un conteggio di
 * fasce: il gioco è di gusto, e il gusto lo hanno le persone. Si vede la rosa di
 * tutti, si vota quella di un altro — mai la propria — e appena hanno votato
 * tutti si proclama. Chi non vota entro il tempo semplicemente non vota.
 *
 * In una stanza online ognuno vota dal proprio telefono. In locale, dove il
 * telefono è uno solo, si vota a turno: lo schermo dice di chi è la mano.
 */
export function VotingStage({ state, selfId, now, dispatch }: VotingStageProps) {
  const t = useT();
  const currency = state.config.currency;
  const isLocal = state.mode === "local";
  const waiting = pendingVoters(state);

  /*
   * Chi ha in mano il voto adesso. Online è sempre e solo chi guarda; in locale
   * è il primo che non ha ancora votato, e il telefono passa di mano.
   */
  const voter = isLocal ? waiting[0] : playerById(state, selfId);
  const done = voter ? hasVoted(state, voter.id) : true;

  return (
    <div className="flex flex-col gap-4">
      <div className="text-center">
        <p className="text-xs uppercase tracking-[0.24em] text-faint">{t("vote.phase")}</p>
        <h1 className="mt-1 text-3xl font-black tracking-tight text-balance">
          {t("vote.whoWins")}
        </h1>
        <p className="mt-2 text-sm text-muted text-balance">{t("vote.rules")}</p>
      </div>

      <div className="flex items-center justify-center gap-4">
        {state.deadline ? (
          <Timer deadline={state.deadline} totalSeconds={30} now={now} />
        ) : null}
        <p className="text-sm font-bold text-faint">
          {waiting.length > 0
            ? t("vote.waiting", { n: waiting.length })
            : t("vote.allVoted")}
        </p>
      </div>

      {/* In locale il telefono passa di mano: va detto di chi è il turno. */}
      {isLocal && voter ? (
        <p className="flex items-center justify-center gap-2 rounded-2xl border border-violet/40 bg-violet/10 p-3 text-center text-sm font-bold text-violet">
          <Avatar id={voter.emoji} size="xs" />
          {t("vote.turnOf", { player: voter.name })}
        </p>
      ) : null}

      <Panel>
        <PanelTitle>{t("results.rosters")}</PanelTitle>
        <div className="flex flex-col gap-3">
          {state.players.map((player, index) => {
            const isSelf = voter ? player.id === voter.id : false;
            const votable = voter ? canVote(state, voter.id, player.id) : false;

            return (
              <motion.div
                key={player.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className={cn("rounded-xl border p-3", colorLook(player.color).soft)}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="flex min-w-0 items-center gap-2 font-bold">
                    <Avatar
                      id={player.emoji}
                      size="sm"
                      className={colorLook(player.color).ring}
                    />
                    <span className={cn("truncate", colorLook(player.color).text)}>
                      {player.name}
                    </span>
                    {isSelf ? (
                      <span className="shrink-0 rounded-full bg-surface-2 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-faint">
                        {t("lobby.you")}
                      </span>
                    ) : null}
                  </span>
                  <span className="shrink-0 font-mono text-sm text-faint">
                    {money(rosterValue(player), currency)}
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

                {/* Il pulsante compare solo sotto le rose degli altri. */}
                {isSelf ? (
                  <p className="mt-3 text-center text-xs text-faint">{t("vote.notYours")}</p>
                ) : (
                  <button
                    type="button"
                    disabled={!votable}
                    onClick={() =>
                      voter &&
                      dispatch({
                        type: "vote",
                        voterId: voter.id,
                        targetId: player.id,
                        now: now(),
                      })
                    }
                    className={cn(
                      "mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-xl font-bold transition-colors",
                      votable
                        ? "bg-gold/20 text-gold hover:bg-gold/30"
                        : "cursor-not-allowed bg-surface-2 text-faint",
                    )}
                  >
                    <Trophy className="size-4" />
                    {t("vote.castVote")}
                  </button>
                )}
              </motion.div>
            );
          })}
        </div>
      </Panel>

      {done && !isLocal ? (
        <p className="flex items-center justify-center gap-2 rounded-2xl border border-neon/40 bg-neon/10 p-4 text-center text-sm font-bold text-neon">
          <Check className="size-4" />
          {t("vote.done")}
        </p>
      ) : null}
    </div>
  );
}
