"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  Ban,
  Eye,
  EyeOff,
  Flame,
  Gavel,
  PackageOpen,
  Trash2,
  Trophy,
  Zap,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { playSfx } from "@/lib/audio";
import { categoryName } from "@/lib/catalog";
import {
  discardsLeft,
  flopBudget,
  colorLook,
  lotSeconds,
  currentItem,
  drawnCount,
  isMysteryLot,
  itemById,
  nextToAct,
  playerById,
  type GameAction,
} from "@/lib/game";
import { HAPTIC_BID, HAPTIC_PASS, HAPTIC_WIN, vibrate } from "@/lib/haptics";
import { useSettings } from "@/lib/settings";
import type { GameState } from "@/lib/types";
import { TIER_STYLES, cn, money } from "@/lib/utils";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { RoomCode } from "@/components/ui/RoomCode";
import { BidControls } from "./BidControls";
import { ItemCover } from "./ItemCover";
import { PlayerRail } from "./PlayerRail";
import { Timer } from "./Timer";

/** Finestra entro cui un secondo tocco identico viene ignorato. */
const DOUBLE_TAP_MS = 400;

interface AuctionStageProps {
  state: GameState;
  selfId: string;
  isHost: boolean;
  now: () => number;
  dispatch: (action: GameAction) => void;
  /** Chi sta ragionando: il bot, mentre aspetta il suo turno. */
  thinkingId?: string | null;
}

export function AuctionStage({
  state,
  selfId,
  isHost,
  now,
  dispatch,
  thinkingId,
}: AuctionStageProps) {
  const { locale, sound, autoImages, t } = useSettings();
  const lastFeedRef = useRef<string | null>(null);

  const mystery = isMysteryLot(state);
  const item = currentItem(state);
  const leader = playerById(state, state.highBidderId);
  const self = playerById(state, selfId);
  const currency = state.config.currency;
  /*
   * Il cronometro parte sempre dalla stessa durata: quella scelta per la
   * stanza. Un rilancio la rimette al massimo, non a una frazione, quindi non
   * c'e' piu' un "prima" e un "dopo".
   */
  const totalSeconds = lotSeconds(state);
  const turnId = nextToAct(state);
  /*
   * In locale si tiene aperto un pannello di comandi alla volta: quello di chi
   * tocca, finche' non se ne apre un altro a mano. Il lotto che cambia riporta
   * l'apertura sul giocatore di turno.
   */
  const [openPanel, setOpenPanel] = useState<string | null>(null);
  const expandedId = openPanel ?? turnId;
  const inRace = state.players.filter(
    (p) => !state.passed.includes(p.id) && p.roster.length < state.config.slots,
  ).length;
  /** Asta al buio in corso: nome e immagine restano coperti per tutti. */
  const covered = state.config.blindDraft && state.phase === "auction" && !mystery;
  /**
   * Qualcuno ha già passato ma sul lotto non c'è ancora nessuna offerta: qui
   * conviene ricordare che passare non regala niente a nessuno.
   */
  /*
   * I flop: quanti se ne sono gia' bruciati e quanti ne concede questo tavolo.
   * Il tetto cambia con i giocatori -- sei in due, nove in tre, otto in
   * quattro, cinque in cinque -- quindi il contatore lo legge invece di
   * portarselo scritto dietro.
   */
  const flopRimasti = discardsLeft(state);
  const flopTetto = flopBudget(state.players.length);
  const scartiFiniti = flopRimasti === 0;

  const nobodyYet =
    state.phase === "auction" && !mystery && !state.highBidderId && state.passed.length > 0;
  const resultItem = state.lastResult ? itemById(state, state.lastResult.itemId) : undefined;
  /** Il lotto appena chiuso era al buio: merita lo svelamento. */
  const revealing =
    state.phase === "result" && state.config.blindDraft && !state.lastResult?.mystery;

  useEffect(() => {
    const latest = state.feed[0];
    if (!latest || lastFeedRef.current === latest.id) return;
    const first = lastFeedRef.current === null;
    lastFeedRef.current = latest.id;
    if (first) return;
    if (latest.kind === "bid") playSfx("bid", sound);
    else if (latest.kind === "pass") playSfx("pass", sound);
    else if (latest.kind === "won") {
      playSfx("win", sound);
      vibrate(HAPTIC_WIN);
    } else if (latest.kind === "mystery") playSfx("mystery", sound);
    else if (latest.kind === "discard") playSfx("timeup", sound);
  }, [state.feed, sound]);

  /**
   * Doppio tocco sullo stesso pulsante.
   *
   * Chi partecipa da un altro dispositivo non vede subito l'effetto della
   * propria offerta: passa dal dispositivo che ospita la stanza e torna
   * indietro. Nel frattempo un secondo tocco partirebbe uguale. Il motore
   * scarterebbe comunque il doppione (chi e' in testa non rilancia su se
   * stesso), ma e' inutile mandarlo: qui si blocca sul nascere, per la stessa
   * mossa dello stesso giocatore.
   */
  const lastSentRef = useRef<{ key: string; at: number } | null>(null);
  const once = useCallback((key: string) => {
    const at = Date.now();
    const last = lastSentRef.current;
    if (last && last.key === key && at - last.at < DOUBLE_TAP_MS) return false;
    lastSentRef.current = { key, at };
    return true;
  }, []);

  const bid = (playerId: string, amount: number) => {
    if (!once(`bid:${playerId}:${amount}`)) return;
    vibrate(HAPTIC_BID);
    dispatch({ type: "bid", playerId, amount, now: now() });
  };
  const pass = (playerId: string) => {
    if (!once(`pass:${playerId}`)) return;
    vibrate(HAPTIC_PASS);
    dispatch({ type: "pass", playerId, now: now() });
  };
  const claim = (playerId: string) => {
    if (!once(`claim:${playerId}`)) return;
    vibrate(HAPTIC_BID);
    dispatch({ type: "claim", playerId, now: now() });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="text-xl">{state.category.emoji}</span>
          <div className="min-w-0 leading-tight">
            <p className="truncate text-sm font-bold">{categoryName(state.category, locale)}</p>
            <p className="text-xs text-faint">
              {t("auction.lot", { current: drawnCount(state), total: state.items.length })}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          {/*
            I flop ancora possibili. E' una riserva di gruppo: quando finisce, i
            lotti che non vuole nessuno vengono assegnati d'ufficio, quindi
            conviene saperlo prima di passare per l'ennesima volta.

            Era nascosto sotto i 640px, cioe' su ogni telefono, ed e' il motivo
            per cui la riserva esaurita sembrava un guasto: i lotti smettevano
            di essere scartati e niente diceva perche'. Adesso si vede sempre.
          */}
          {state.config.allowDiscards ? (
            <span
              title={t(scartiFiniti ? "auction.discardsOut" : "auction.discardsLeft")}
              className={cn(
                "inline-flex items-center gap-1 rounded-full border px-2 py-1 font-mono text-[11px] font-bold",
                scartiFiniti
                  ? "border-red-500/50 bg-red-500/10 text-red-400"
                  : "border-line bg-surface-2 text-faint",
              )}
            >
              <span aria-hidden>🗑️</span>
              {state.discards.length}/{flopTetto}
            </span>
          ) : null}
          <RoomCode code={state.code} />
          {state.phase === "auction" && state.deadline ? (
            <Timer deadline={state.deadline} totalSeconds={totalSeconds} now={now} />
          ) : null}
        </div>
      </div>

      <div
        className={cn(
          "relative overflow-hidden rounded-3xl border bg-surface grid-noise p-5 transition-colors",
          // Al buio e sulla Mystery Box la fascia non si rivela: sarebbe un
          // indizio su quanto vale il lotto, e toglierebbe senso alle due
          // modalita'.
          item && !covered && !mystery ? TIER_STYLES[item.tier].frame : "border-line",
        )}
      >
        <div className="mx-auto flex max-w-[19rem] flex-col items-center gap-3 text-center">
          <AnimatePresence mode="wait">
            <motion.div
              key={mystery ? `mystery-${state.lotNumber}` : (item?.id ?? "empty")}
              initial={{ opacity: 0, scale: 0.88, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94 }}
              transition={{ type: "spring", stiffness: 240, damping: 22 }}
              className="w-full"
            >
              <ItemCover
                item={item ?? null}
                size="xl"
                mystery={mystery}
                covered={covered}
                auto={autoImages}
                hint={state.category.name}
                logo={state.category.covers === "logo"}
              />
            </motion.div>
          </AnimatePresence>

          <div className="flex flex-col items-center gap-1.5">
            {mystery ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-violet/40 bg-violet/10 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-violet">
                <PackageOpen className="size-3" /> {t("auction.mystery")}
              </span>
            ) : null}

            {/*
              La fascia del lotto. Dice quanto e' pregiato l'elemento, quindi
              quanto ci si puo' aspettare che gli altri rilancino: e' un
              suggerimento sul prezzo, non un punteggio. A vincere sono i voti.
            */}
            {item && !covered && !mystery ? (
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider",
                  TIER_STYLES[item.tier].chip,
                )}
              >
                <span aria-hidden>{TIER_STYLES[item.tier].badge}</span>
                {locale === "it" ? TIER_STYLES[item.tier].label : TIER_STYLES[item.tier].labelEn}
              </span>
            ) : null}

            {/* Al buio il nome non compare da nessuna parte finché il lotto non è
                aggiudicato: è tutto il senso della modalità. */}
            <h1 className="text-2xl leading-tight font-black tracking-tight text-balance sm:text-3xl">
              {mystery
                ? t("auction.mystery")
                : covered
                  ? `❓ ${t("auction.blindLot")}`
                  : (item?.name ?? "—")}
            </h1>

            {mystery ? (
              <p className="text-xs text-muted">{t("auction.mysteryHint")}</p>
            ) : covered ? (
              <p className="flex items-center gap-1.5 text-xs text-violet">
                <EyeOff className="size-3.5" />
                {t("auction.blind")}
              </p>
            ) : null}
          </div>
        </div>

        <div className="mt-5 flex items-end justify-between gap-4 border-t border-line pt-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-faint">
              {t("auction.currentBid")}
            </p>
            <motion.p
              key={`${state.currentBid}-${state.highBidderId ?? "none"}`}
              initial={{ scale: 1.18 }}
              animate={{ scale: 1 }}
              transition={{ duration: 0.3 }}
              className="font-mono text-4xl font-black"
            >
              {money(mystery ? state.lotPrice : state.currentBid, currency)}
            </motion.p>
          </div>
          <div className="text-end">
            {leader ? (
              <p className="flex items-center justify-end gap-1.5 text-sm font-bold text-neon text-glow">
                <Gavel className="size-4" />
                <Avatar id={leader.emoji} size="xs" />
                {leader.name}
              </p>
            ) : (
              <p className="flex items-center justify-end gap-1.5 text-sm text-faint">
                <Flame className="size-4" />
                {mystery ? t("auction.mysteryHint") : t("auction.noBid")}
              </p>
            )}
            <p className="text-xs text-faint">{t("auction.inRace", { n: inRace })}</p>
          </div>
        </div>

        <AnimatePresence>
          {state.sniped && state.phase === "auction" ? (
            <motion.p
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mt-3 flex items-center justify-center gap-1.5 rounded-full border border-amber-400/40 bg-amber-400/10 px-3 py-1.5 text-[11px] font-bold text-amber-500"
            >
              <Zap className="size-3.5" />
              {t("auction.antiSnipe", { n: totalSeconds })}
            </motion.p>
          ) : null}

          {nobodyYet ? (
            <motion.p
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mt-3 flex items-center justify-center gap-1.5 rounded-xl border border-line bg-surface-2 px-3 py-2 text-center text-[11px] font-bold text-balance text-muted"
            >
              <Ban className="size-3.5 shrink-0" />
              {state.config.allowDiscards && !scartiFiniti
                ? t("auction.nobodyYet")
                : t("auction.nobodyYetForced")}
            </motion.p>
          ) : null}
        </AnimatePresence>

        <AnimatePresence>
          {state.phase === "result" && state.lastResult ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-ink/95 p-6 text-center"
            >
              <motion.div
                initial={{ scale: 0.7, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 320, damping: 18 }}
                className="flex flex-col items-center gap-2"
              >
                {state.lastResult.winnerId ? (
                  <>
                    {/* Svelamento: la copertina si gira e mostra che cosa c'era
                        sotto. Con l'asta normale è una semplice comparsa. */}
                    <motion.div
                      key={`reveal-${state.lastResult.itemId}`}
                      initial={
                        revealing
                          ? { rotateY: 90, scale: 0.82, opacity: 0 }
                          : { opacity: 0, scale: 0.9 }
                      }
                      animate={{ rotateY: 0, scale: 1, opacity: 1 }}
                      transition={{ type: "spring", stiffness: 210, damping: 17, delay: 0.05 }}
                      style={{ transformPerspective: 900 }}
                    >
                      <ItemCover
                        item={resultItem ?? null}
                        size="lg"
                        auto={autoImages}
                        hint={state.category.name}
                        logo={state.category.covers === "logo"}
                      />
                    </motion.div>
                    <span className="flex items-center gap-1.5 text-xs uppercase tracking-[0.2em] text-faint">
                      {state.lastResult.mystery ? (
                        <PackageOpen className="size-3.5 text-violet" />
                      ) : revealing ? (
                        <Eye className="size-3.5 text-violet" />
                      ) : (
                        <Trophy className="size-3.5 text-neon" />
                      )}
                      {revealing ? t("auction.revealed") : t("auction.awarded")}
                    </span>
                    <motion.p
                      initial={revealing ? { opacity: 0, y: 8 } : false}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: revealing ? 0.32 : 0 }}
                      className="text-2xl font-black text-balance"
                    >
                      {state.lastResult.itemName}
                    </motion.p>
                    <p className="text-lg font-bold text-neon text-glow">
                      {state.lastResult.winnerName} · {money(state.lastResult.price, currency)}
                    </p>
                  </>
                ) : (
                  <>
                    <Trash2 className="size-9 text-faint" />
                    <p className="text-xs uppercase tracking-[0.2em] text-faint">
                      {t("auction.noOffers")}
                    </p>
                    <p className="text-2xl font-black text-balance">{state.lastResult.itemName}</p>
                    <p className="text-sm text-faint">
                      {state.lastResult.mystery
                        ? t("auction.mysteryLost")
                        : t("auction.toDiscards")}
                    </p>
                  </>
                )}
              </motion.div>
              {isHost ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-3"
                  onClick={() => dispatch({ type: "next", now: now() })}
                >
                  {t("auction.nextLot")} <ArrowRight className="size-4" />
                </Button>
              ) : null}
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>

      {turnId && state.mode === "local" ? (
        <p className="text-center text-xs font-bold uppercase tracking-[0.18em] text-violet">
          {t("auction.turnOf", { player: playerById(state, turnId)?.name ?? "" })}
        </p>
      ) : null}

      {state.mode === "local" ? (
        <>
          {/*
            La striscia con tutti: avatar, crediti e stato di ognuno in una
            riga sola. Con cinque giocatori serve, perche' cinque pannelli di
            comandi aperti insieme facevano una pagina alta quasi tremila
            pixel: per arrivare al proprio bisognava scorrere mentre il timer
            correva.
          */}
          <PlayerRail state={state} nextId={turnId} thinkingId={thinkingId} />

          <div className="flex flex-col gap-2">
            {state.players.map((player) => {
              const aperto = player.id === expandedId;
              if (aperto) {
                return (
                  <BidControls
                    key={player.id}
                    compact
                    state={state}
                    player={player}
                    highlight={player.id === turnId}
                    onBid={(amount) => bid(player.id, amount)}
                    onPass={() => pass(player.id)}
                    onClaim={() => claim(player.id)}
                  />
                );
              }

              /*
               * Chiuso resta una riga sola. Si apre al tocco: chiunque puo'
               * rilanciare quando vuole, non solo chi e' di turno, quindi i
               * comandi non si possono nascondere del tutto.
               */
              const passato = state.passed.includes(player.id);
              const pieno = player.roster.length >= state.config.slots;
              return (
                <button
                  key={player.id}
                  type="button"
                  onClick={() => setOpenPanel(player.id)}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-xl border border-line bg-surface-2 p-2.5 text-start transition-colors hover:border-neon/40",
                    (passato || pieno) && "opacity-50",
                  )}
                >
                  <Avatar
                    id={player.emoji}
                    size="xs"
                    className={colorLook(player.color).ring}
                  />
                  <span
                    className={cn(
                      "min-w-0 flex-1 truncate text-sm font-semibold",
                      colorLook(player.color).text,
                    )}
                  >
                    {player.name}
                  </span>
                  <span className="shrink-0 text-[10px] uppercase tracking-wider text-faint">
                    {passato
                      ? t("auction.passed")
                      : pieno
                        ? t("auction.full")
                        : t("auction.inPlay")}
                  </span>
                  <span className="shrink-0 font-mono text-sm font-bold text-neon">
                    {money(player.budget, currency)}
                  </span>
                </button>
              );
            })}
          </div>
        </>
      ) : (
        <>
          <PlayerRail state={state} selfId={selfId} nextId={turnId} thinkingId={thinkingId} />

          {self ? (
            <>
              {/* Su telefono i comandi restano fissi in basso, a portata di pollice. */}
              <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-ink/95 p-3 backdrop-blur safe-bottom sm:static sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
                <div className="mx-auto w-full max-w-2xl">
                  <BidControls
                    state={state}
                    player={self}
                    highlight={self.id === turnId}
                    onBid={(amount) => bid(self.id, amount)}
                    onPass={() => pass(self.id)}
                    onClaim={() => claim(self.id)}
                  />
                </div>
              </div>
              <div aria-hidden className="h-56 sm:hidden" />
            </>
          ) : (
            <p className="rounded-2xl border border-line bg-surface p-4 text-center text-sm text-faint">
              {t("auction.spectator")}
            </p>
          )}
        </>
      )}

      {isHost ? (
        <Button variant="ghost" size="sm" onClick={() => dispatch({ type: "end" })}>
          {t("auction.endGame")}
        </Button>
      ) : null}
    </div>
  );
}
