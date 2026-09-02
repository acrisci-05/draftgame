"use client";

import { motion } from "framer-motion";
import { Check, Copy, Gamepad2, Home, Loader2, TriangleAlert, Trophy } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { rosterValue } from "@/lib/game";
import { useSettings } from "@/lib/settings";
import { useAuth } from "@/lib/auth";
import { ensureProfile, readVote, saveVote } from "@/lib/storage";
import { showToast } from "@/lib/toast";
import { VoteFailure, castVote, fetchResult, fetchVotes, isSupabaseConfigured } from "@/lib/supabase";
import type { VoteResultPayload, VoteTally } from "@/lib/types";
import { TIER_STYLES, cn, copyText, money } from "@/lib/utils";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Panel, PanelTitle } from "@/components/ui/Panel";
import { FistBump } from "@/components/game/FistBump";

/** L'identificativo del bot, ripetuto qui per non tirarsi dietro il suo motore. */
const BOT_ID = "bot-pickasso";

export function VoteClient({ resultId }: { resultId: string }) {
  const router = useRouter();
  const { t } = useSettings();
  const { account } = useAuth();
  const [result, setResult] = useState<VoteResultPayload | null>(null);
  const [tally, setTally] = useState<VoteTally[]>([]);
  const [votedId, setVotedId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [batticinque, setBatticinque] = useState(false);
  const [appenaVotato, setAppenaVotato] = useState<string | null>(null);
  const missing = failed || !isSupabaseConfigured;

  /*
   * Ho giocato questa partita?
   *
   * La chiave con cui si vota e' l'identificativo del dispositivo, ed e' lo
   * stesso che il giocatore si porta dentro la stanza: se compare fra i
   * giocatori salvati nel risultato, chi guarda ha giocato. Non serve nessun
   * contrassegno da mettere via, e funziona anche per chi ha giocato da ospite
   * -- che e' proprio il caso in cui non c'e' un account da controllare.
   */
  /*
   * Si legge una volta sola, al montaggio: il profilo del dispositivo esiste
   * gia' o viene creato adesso, e da li' in poi non cambia piu'. Un effetto
   * che lo riscrive nello stato sarebbe un giro in piu' per un valore fermo.
   */
  const [ioSono] = useState<string | null>(() =>
    typeof window === "undefined" ? null : ensureProfile().id,
  );
  const sonoGiocatore = Boolean(ioSono && result?.players.some((p) => p.id === ioSono));

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
    // Due giri di sicurezza: qui e nel database. Questo evita di mandare una
    // richiesta che verrebbe respinta; quello la respinge davvero.
    if (sonoGiocatore) return;
    setBusyId(playerId);
    try {
      await castVote(resultId, playerId, ensureProfile().id, {
        name: account && !account.local ? account.nickname : undefined,
        accountId: account && !account.local ? account.id : undefined,
      });
      saveVote(resultId, playerId);
      setAppenaVotato(playerId);
      setBatticinque(true);
      await loadVotes();
    } catch (cause) {
      const motivo = cause instanceof VoteFailure ? cause.reason : "unknown";
      showToast(
        t(
          motivo === "self"
            ? "vote.errSelf"
            : motivo === "already"
              ? "vote.errAlready"
              : "vote.errUnknown",
        ),
        "error",
      );
      // Se il voto c'era gia', tanto vale mostrarlo invece di far ritentare.
      if (motivo === "already") setVotedId(readVote(resultId));
    } finally {
      setBusyId(null);
    }
  };

  /* Finita la scena, il voto si considera dato e le rose spariscono. */
  const chiudiScena = () => {
    setBatticinque(false);
    if (appenaVotato) setVotedId(appenaVotato);
  };

  const copiaLink = async () => {
    if (typeof window === "undefined") return;
    if (await copyText(window.location.href)) showToast(t("vote.linkCopied"), "success");
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
  const haVotato = Boolean(votedId);

  /*
   * Le rose si vedono finche' non si e' votato.
   *
   * Dopo, restano solo le percentuali: rileggerle non serve -- la scelta e'
   * fatta e non si cambia -- e lasciarle li' invita a chiedersi se si e'
   * sbagliato, che e' esattamente il pensiero che il voto unico toglie di mezzo.
   */
  const mostraRose = !haVotato && !sonoGiocatore;

  /** Il bot non e' un avversario come gli altri, e chi vota deve saperlo. */
  const eIlBot = (playerId: string) => result.practice === true && playerId === BOT_ID;

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-4 py-8 safe-bottom">
      <FistBump show={batticinque} onDone={chiudiScena} />

      <header className="rounded-3xl border border-line bg-surface grid-noise p-6 text-center">
        <span className="text-4xl">{result.categoryEmoji}</span>
        <h1 className="mt-2 text-2xl font-black tracking-tight">
          {result.practice ? t("vote.titleBot") : t("vote.title")}
        </h1>
        <p className="mt-1 text-sm text-muted">{result.categoryName}</p>
        <p className="mt-3 text-xs uppercase tracking-[0.2em] text-faint">
          {votedPlayer
            ? t("vote.voted", { player: votedPlayer.name })
            : result.practice
              ? t("vote.subtitleBot")
              : t("vote.subtitle")}
        </p>
      </header>

      {/*
        Chi ha giocato non vota la propria partita.

        Il voto l'ha gia' dato dentro la stanza, alla fine dell'asta: questo
        link e' per gli amici. Invece di spegnere i pulsanti e lasciarlo li' a
        chiedersi perche', gli si dice cosa fare -- copiare il link e mandarlo.
      */}
      {sonoGiocatore ? (
        <div className="rounded-2xl border border-violet/40 bg-violet/10 p-4 text-center">
          <p className="font-black text-violet">{t("vote.playerTitle")}</p>
          <p className="mt-1.5 text-sm leading-relaxed text-muted">{t("vote.playerBody")}</p>
          <Button className="mt-3 w-full" onClick={copiaLink}>
            <Copy className="size-4" />
            {t("vote.playerCopy")}
          </Button>
        </div>
      ) : null}

      {haVotato && !sonoGiocatore ? (
        <div className="rounded-2xl border border-neon/40 bg-neon/10 p-4 text-center">
          <p className="font-black text-neon">{t("vote.liveTitle")}</p>
          <p className="mt-1 text-xs text-muted">{t("vote.liveBody")}</p>
        </div>
      ) : null}

      <Panel>
        <PanelTitle
          icon={<Trophy className="size-3.5" />}
          action={<span className="text-xs text-faint">{t("vote.total", { n: total })}</span>}
        >
          {mostraRose ? t("results.rosters") : t("vote.liveTitle")}
        </PanelTitle>

        <div className="flex flex-col gap-3">
          {result.players.map((player, index) => {
            const picked = player.id === votedId;
            const voti = votesFor(player.id);
            const quota = total > 0 ? Math.round((voti / total) * 100) : 0;
            const bot = eIlBot(player.id);
            const nome = bot ? t("vote.botName") : player.name;

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
                <div className="flex items-center justify-between gap-2">
                  <span className="flex min-w-0 items-center gap-2 font-bold">
                    <Avatar id={player.emoji} size="sm" />
                    <span className="truncate">{nome}</span>
                    {bot ? (
                      <Badge tone="violet">
                        <Gamepad2 className="size-3" />
                        {t("vote.botTag")}
                      </Badge>
                    ) : null}
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <Badge tone="neutral">
                      {t("results.spent", {
                        amount: money(rosterValue(player), result.currency),
                      })}
                    </Badge>
                    <Badge tone="neon">{t("vote.count", { n: voti })}</Badge>
                  </span>
                </div>

                {mostraRose ? (
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
                ) : (
                  /* A voto dato restano le percentuali, che si aggiornano da sole. */
                  <div className="mt-2.5">
                    <div className="flex items-baseline justify-between text-xs">
                      <span className="font-mono text-lg font-black text-neon">{quota}%</span>
                      {picked ? (
                        <span className="flex items-center gap-1 font-bold text-neon">
                          <Check className="size-3.5" />
                          {t("vote.yours")}
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-surface">
                      <motion.div
                        className={cn("h-full rounded-full", picked ? "bg-neon" : "bg-violet")}
                        animate={{ width: `${quota}%` }}
                        transition={{ type: "spring", stiffness: 160, damping: 24 }}
                      />
                    </div>
                  </div>
                )}

                {mostraRose ? (
                  <Button
                    size="sm"
                    className="mt-3 w-full"
                    disabled={busyId !== null}
                    onClick={() => vote(player.id)}
                  >
                    {busyId === player.id ? <Loader2 className="size-4 animate-spin" /> : null}
                    {t("vote.button", { player: nome })}
                  </Button>
                ) : null}
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
