"use client";

import { motion } from "framer-motion";
import {
  ArrowRight,
  Check,
  Crown,
  Home,
  Link2,
  Loader2,
  RotateCcw,
  Trash2,
  UserPlus,
  Users,
  Vote,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { playSfx } from "@/lib/audio";
import { useAuth } from "@/lib/auth";
import { categoryName } from "@/lib/catalog";
import { voteUrlFor } from "@/lib/config";
import confetti from "canvas-confetti";
import {
  END_TITLE_EMOJI,
  colorLook,
  endTitles,
  finalStandings,
  voteTally,
  itemById,
  playerById,
  rosterValue,
  type GameAction,
  type EndTitleId,
  type WinReason,
} from "@/lib/game";
import { BOT_PLAYER_ID } from "@/lib/botEngine";
import { HAPTIC_TAKE, vibrate } from "@/lib/haptics";
import { FistBump } from "./FistBump";
import { awardMatchXp, recordMatch } from "@/lib/history";
import { levelFor } from "@/lib/levels";
import { markSessionFinished } from "@/lib/storage";
import {
  countMatch,
  markPrompted,
  markRated,
  shouldAskRating,
} from "@/lib/rating-prompt";
import { RatingModal } from "@/components/ui/RatingModal";
import { GuestBadge, XpEarned } from "./XpEarned";
import { openPanel } from "@/lib/panels";
import { recordOpponent } from "@/lib/pickmates";
import type { TranslationKey } from "@/lib/i18n";
import { useSettings, useT } from "@/lib/settings";
import { isSupabaseConfigured, publishResult } from "@/lib/supabase";
import type { CatalogItem, GameState, Player } from "@/lib/types";
import { TIER_STYLES, cn, copyText, money } from "@/lib/utils";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Panel, PanelTitle } from "@/components/ui/Panel";
import { QrCode } from "@/components/ui/QrCode";
import { Confetti } from "./Confetti";
import { ItemCover } from "./ItemCover";
import { FriendShare } from "./FriendShare";
import { TikTokCard } from "./TikTokCard";

interface ResultsProps {
  state: GameState;
  isHost: boolean;
  /** Chi sta guardando su questo dispositivo: da lui dipende "la tua rosa". */
  selfId: string;
  dispatch: (action: GameAction) => void;
}

/**
 * Quello che il bot dice quando ti batte.
 *
 * Sono battute e vanno lette come tali: il bot non sa niente di te, sceglie a
 * caso fra queste, e il punto e' che perdere contro un programma faccia ridere
 * invece che infastidire. Per questo nessuna dice che hai giocato male sul
 * serio -- prendono in giro il portafoglio, non la persona -- e due su nove
 * sono un invito a rigiocare.
 */
const BOT_DEFEAT_QUOTES = [
  "Arte contemporanea: la tua sconfitta su tela. 🖌️",
  "I tuoi crediti hanno fatto le valigie! 🧳",
  "Snipato all'ultimo secondo! Brucia, eh? ⏱️🔥",
  "Tattica da 10, portafoglio da 2! 🤌",
  "Ottima mossa! Ti sfido di nuovo, campione.",
  "Ho visto la tua offerta e ho riso in circuiti! 🤖",
  "Venduto al signore col budget finito! Riprova! 🔨💸",
  "Tranquillo, il secondo posto ha il suo fascino! 🥈",
  "Non piangere, non ci rimanere male baby. 😭🔥",
  "Non mollare bro, insisti! 🔥",
] as const;

/** Come si chiama ogni targa nella lingua scelta. */
const TITLE_KEYS: Record<EndTitleId, TranslationKey> = {
  dominator: "results.titleDominator",
  spender: "results.titleSpender",
  tightwad: "results.titleTightwad",
  flopMaster: "results.titleFlopMaster",
};

/** Secondi dopo i quali la classifica si apre da sola, se non si tocca niente. */
const RECAP_SECONDS = 5;

export function Results({ state, isHost, selfId, dispatch }: ResultsProps) {
  const router = useRouter();
  const { locale, sound, t } = useSettings();
  const { account, refreshAccount } = useAuth();
  const [voteUrl, setVoteUrl] = useState<string | null>(null);
  const [resultId, setResultId] = useState<string | null>(null);
  const [voteBusy, setVoteBusy] = useState(false);
  /*
   * Perche' il link non e' uscito, nelle parole del database.
   *
   * Non e' un messaggio per chi gioca -- chi gioca legge la riga sopra, in
   * italiano -- ma senza di esso un pulsante che non funziona resta una cosa
   * che non si puo' nemmeno raccontare: si legge, si copia, si riferisce.
   */
  const [voteError, setVoteError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  /*
   * I batti pugno dati, contati per giocatore.
   *
   * Restano su questo dispositivo: e' un saluto di fine partita, non un
   * punteggio, e non cambia niente di quello che e' successo. Farlo viaggiare
   * fino all'altro telefono richiederebbe un canale aperto dopo la fine
   * dell'asta, che adesso non c'e'.
   */
  const [bumps, setBumps] = useState<Record<string, number>>({});
  const [bumpScene, setBumpScene] = useState(false);

  const bumpTo = (playerId: string) => {
    vibrate(HAPTIC_TAKE);
    playSfx("fistbump", sound);
    setBumps((prev) => ({ ...prev, [playerId]: (prev[playerId] ?? 0) + 1 }));
    setBumpScene(true);
  };
  // Quanta esperienza ha dato questa partita: zero quando era gia' stata pagata.
  const [earnedXp, setEarnedXp] = useState(0);

  const currency = state.config.currency;
  const ordered = finalStandings(state);

  const me = playerById(state, selfId);
  /**
   * Il riepilogo personale ha senso solo quando ogni dispositivo ha il suo
   * giocatore: in una stanza locale sono tutti davanti allo stesso schermo e si
   * va dritti alla classifica.
   */
  const personal = state.mode === "online" && Boolean(me);
  // Le liste di marchi si mostrano su fondo chiaro: al buio sparirebbero.
  const marchi = state.category.covers === "logo";
  const [view, setView] = useState<"recap" | "mine" | "all">(personal ? "recap" : "all");

  // Il riepilogo si apre da solo sulla classifica: chi non tocca niente non resta bloccato.
  useEffect(() => {
    if (view !== "recap") return;
    const timer = setTimeout(() => setView("all"), RECAP_SECONDS * 1000);
    return () => clearTimeout(timer);
  }, [view]);

  const myAccountId = account && !account.local ? account.id : null;

  /*
   * Lo squillo di chiusura, una volta sola.
   *
   * Contro il bot, quando vince lui, e' un altro: le stesse note al contrario.
   * Suonare la fanfara della vittoria a chi ha appena perso e' il modo piu'
   * rapido di far sembrare che il gioco non si sia accorto di niente.
   */
  const perdutoColBot = state.isPractice === true && ordered[0]?.player.id === BOT_PLAYER_ID;
  useEffect(() => {
    playSfx(perdutoColBot ? "lose" : "win", sound);
  }, [sound, perdutoColBot]);

  /**
   * A partita finita gli avversari con un profilo finiscono fra i "recenti":
   * è la lista da cui si aggiungono i Pickmates con un tocco, e da cui esce il
   * conteggio delle sfide giocate insieme. Ognuno scrive solo le proprie righe.
   */
  useEffect(() => {
    if (!myAccountId) return;
    const opponents = state.players
      .map((player) => player.accountId)
      .filter((id): id is string => Boolean(id) && id !== myAccountId);
    for (const opponentId of new Set(opponents)) void recordOpponent(opponentId);
  }, [myAccountId, state.players]);

  /*
   * La partita finisce nello storico personale: da lì escono le statistiche del
   * profilo. Ognuno scrive la propria riga, con la posizione in classifica e
   * quanto ha speso; chi gioca da ospite non scrive niente.
   */
  useEffect(() => {
    if (!myAccountId) return;
    // La posizione e' quella decisa dal voto: chi vince qui si prende la
    // vittoria sul profilo, e il vincitore e' sempre uno solo.
    const ranking = finalStandings(state);
    const mine = ranking.findIndex((entry) => entry.player.accountId === myAccountId);
    if (mine < 0) return;
    const me = ranking[mine].player;
    void recordMatch(myAccountId, {
      code: state.code,
      category: state.category.name,
      players: state.players.length,
      position: mine + 1,
      spent: rosterValue(me),
      items: me.roster.length,
      currency: state.config.currency,
    });

    /*
     * L'esperienza. Il conto lo fa il database, qui si dice solo com'e'
     * andata; la stessa partita paga una volta sola, quindi riaprire questa
     * schermata non regala punti. Il bonus scatta se in stanza c'era almeno
     * un altro profilo registrato: e' il modo di premiare chi gioca con
     * qualcuno invece che da solo.
     */
    const withMate = state.players.some(
      (player) => player.accountId && player.accountId !== myAccountId,
    );
    const tally = voteTally(state);
    void awardMatchXp({
      code: state.code,
      won: mine === 0,
      votes: tally[me.id] ?? 0,
      withMate,
      // Contro il bot si prende una frazione: quanto, lo decide il database.
      practice: state.isPractice === true,
    }).then((earned) => {
      if (earned <= 0) return;
      setEarnedXp(earned);
      // Il profilo in memoria ha ancora i punti di prima: senza rileggerlo, il
      // riquadro direbbe quanto manca al livello successivo sbagliando di una
      // partita intera.
      refreshAccount();
    });
    // Una volta sola per partita: le dipendenze sono la stanza e chi sono io.
  }, [myAccountId, state, refreshAccount]);

  /*
   * La partita conta anche per chi gioca da ospite: il parere sull'app non
   * dipende dall'avere un profilo, e chiederlo dopo tre partite vale per
   * tutti allo stesso modo.
   */
  useEffect(() => {
    countMatch();
    /*
     * La partita e' finita: la home smette di riproporla.
     *
     * Si segna, non si cancella: la stanza legge la sessione per sapere chi
     * sei, e toglierla adesso farebbe sparire questa stessa schermata prima
     * che partita e punti vengano registrati.
     */
    markSessionFinished(state.code);
  }, [state.code]);

  /*
   * Il parere sull'app si chiede qui e non altrove: e' il momento in cui la
   * partita e' appena finita e si sta per uscire, cioe' l'unico in cui non si
   * interrompe niente. Chi risponde, o chi dice di no, prosegue subito dopo.
   */
  const [rating, setRating] = useState<(() => void) | null>(null);

  const leave = (dopo: () => void) => {
    if (shouldAskRating()) {
      markPrompted();
      setRating(() => dopo);
      return;
    }
    dopo();
  };

  const closeRating = (segna?: () => void) => {
    segna?.();
    const dopo = rating;
    setRating(null);
    dopo?.();
  };

  const titoli = endTitles(state);

  /*
   * I coriandoli partono dalla rosa che ha vinto, non dal soffitto.
   *
   * Un'esplosione a schermo intero e' bella e non dice niente: festeggia la
   * pagina. Partendo dal riquadro del primo classificato l'occhio ci va sopra
   * da solo, ed e' la stessa ragione per cui in televisione l'inquadratura si
   * stringe sul vincitore invece di allargarsi sullo stadio.
   *
   * La posizione si misura al momento del lancio -- la classifica entra con
   * un'animazione, e mezzo secondo prima quel riquadro era altrove.
   */
  const winnerCardRef = useRef<HTMLDivElement | null>(null);
  const giaFestaRef = useRef(false);
  /*
   * L'esperienza che si aveva prima di questa partita.
   *
   * Si legge una volta sola, al montaggio: qui l'assegnazione non e' ancora
   * partita, quindi il totale e' esattamente quello di prima. Ricavarla come
   * "totale di adesso meno quello guadagnato" sembrava equivalente e non lo e':
   * fra l'assegnazione e la rilettura del profilo passa un istante in cui il
   * totale e' ancora quello vecchio, e in quell'istante la sottrazione dava un
   * livello piu' basso del vero -- annunciando una salita mai avvenuta.
   *
   * Resta null per gli ospiti e per chi arriva qui col profilo non ancora
   * caricato: in quel caso la finestra non compare. Meglio saltare una festa
   * che farne una per un livello che non e' cambiato.
   */
  const [xpPrima] = useState<number | null>(() =>
    account && !account.local ? (account.xp ?? 0) : null,
  );

  /*
   * La battuta del bot, quando e' lui a vincere l'uno contro uno.
   *
   * Si pesca una volta sola, al montaggio, e non si tocca piu': una battuta che
   * si riscrive da sola mentre la stai leggendo non e' una battuta, e' un
   * guasto. Si estrae comunque, anche quando ha perso -- costa niente -- e si
   * mostra solo se serve.
   */
  const [battuta] = useState(
    () => BOT_DEFEAT_QUOTES[Math.floor(Math.random() * BOT_DEFEAT_QUOTES.length)],
  );

  /*
   * Il salto di livello.
   *
   * Si confronta il livello di adesso con quello di un attimo fa, cioe' con i
   * punti appena guadagnati tolti di mezzo. Non serve ricordarsi niente prima
   * della partita: il "prima" e' sempre ricavabile dal "dopo" meno quello che
   * questa partita ha pagato.
   */
  const xpTotali = (xpPrima ?? 0) + earnedXp;
  const salitoDiLivello =
    earnedXp > 0 && xpPrima !== null && levelFor(xpTotali).level > levelFor(xpPrima).level;
  const [levelUpVisto, setLevelUpVisto] = useState(false);

  useEffect(() => {
    if (view === "recap" || giaFestaRef.current) return;
    // Chi ha chiesto meno animazioni non vuole nemmeno questa.
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

    giaFestaRef.current = true;
    const lanci = [0, 220, 460];
    const timers = lanci.map((ritardo, i) =>
      window.setTimeout(() => {
        const box = winnerCardRef.current?.getBoundingClientRect();
        if (!box) return;
        confetti({
          particleCount: i === 0 ? 90 : 55,
          spread: 70 + i * 15,
          startVelocity: 38 - i * 4,
          decay: 0.92,
          scalar: 0.9,
          // Da coordinate dello schermo a frazioni di finestra, che e' l'unica
          // cosa che canvas-confetti capisce.
          origin: {
            x: (box.left + box.width / 2) / window.innerWidth,
            y: (box.top + box.height / 2) / window.innerHeight,
          },
          colors: ["#facc15", "#22c55e", "#a855f7", "#22d3ee", "#ffffff"],
          disableForReducedMotion: true,
        });
      }, ritardo),
    );

    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [view]);

  /*
   * L'invito a farsi un profilo si mostra solo a chi non ce l'ha e ha davvero
   * giocato questa partita: a uno spettatore non serve.
   */
  const showHook = !account && Boolean(me);
  const iWon = ordered[0]?.player.id === selfId;
  const discarded = state.discards
    .map((id) => itemById(state, id))
    .filter((item): item is CatalogItem => Boolean(item));

  const generateVote = async () => {
    setVoteBusy(true);
    setVoteError(null);
    try {
      const id = await publishResult({
        code: state.code,
        categoryName: categoryName(state.category, locale),
        categoryEmoji: state.category.emoji,
        currency,
        players: state.players,
        practice: state.isPractice === true,
      });
      setResultId(id);
      setVoteUrl(voteUrlFor(id));
    } catch (cause) {
      setVoteError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setVoteBusy(false);
    }
  };

  const copyVoteUrl = async () => {
    if (!voteUrl || !(await copyText(voteUrl))) return;
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  /* Fase 1: quello che interessa davvero a chi guarda, cioe' la propria rosa. */
  if (view === "recap" && me) {
    return (
      <div className="flex flex-1 flex-col justify-center gap-5 py-6">
        <Confetti />
        <div className="text-center">
          <p className="text-xs uppercase tracking-[0.24em] text-faint">{t("results.title")}</p>
          <h1 className="mt-1 text-3xl font-black tracking-tight">{t("results.mineTitle")}</h1>
          <p className="mt-2 text-sm text-muted">
            {t("results.mineHeadline", { n: me.roster.length, tot: state.config.slots })}
          </p>
        </div>

        <MyRoster player={me} currency={currency} logo={marchi} />

        {/*
          Quanto ha reso la partita, o cosa ci si perde a giocare da ospiti:
          e' il punto in cui la differenza fra le due cose si capisce da sola.
        */}
        {account && !account.local ? (
          <XpEarned earned={earnedXp} totalXp={account.xp ?? 0} />
        ) : (
          <GuestBadge />
        )}

        <div className="flex flex-col items-center gap-2">
          <motion.button
            type="button"
            onClick={() => setView("all")}
            animate={{ scale: [1, 1.03, 1] }}
            transition={{ duration: 1.6, repeat: Infinity }}
            className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-neon text-lg font-black text-ink shadow-lg transition-opacity hover:opacity-90"
          >
            {t("results.revealStandings")}
            <ArrowRight className="size-5" />
          </motion.button>
          <p className="text-xs text-faint">{t("results.autoOpen", { n: RECAP_SECONDS })}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Confetti />
      {/* La scena dei pugni che si scontrano, la stessa della pagina del voto. */}
      <FistBump show={bumpScene} onDone={() => setBumpScene(false)} />
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

      {/*
        Il gancio, a caldo.

        Chi gioca da ospite ha appena finito una partita: e' l'unico momento in
        cui un profilo ha un senso evidente, perche' c'e' qualcosa da salvare.
        Se ha vinto glielo si dice; altrimenti si punta sugli avversari da
        ritrovare. Compare una volta sola, in fondo alla premiazione, e non
        blocca niente: si gioca benissimo da ospiti.
      */}
      {showHook ? (
        <div className="rounded-2xl border border-gold/40 bg-gold/10 p-4 text-center">
          <p className="text-sm font-black text-gold">
            {iWon ? t("hook.wonTitle") : t("hook.matesTitle")}
          </p>
          <p className="mt-1 text-xs text-muted">
            {iWon ? t("hook.wonBody") : t("hook.matesBody")}
          </p>
          <Button className="mt-3 w-full" onClick={() => openPanel("register")}>
            <UserPlus className="size-4" />
            {t("hook.cta")}
          </Button>
        </div>
      ) : null}

      {/* Si passa da "la mia rosa" a "tutti" in qualsiasi momento. */}
      {personal && me ? (
        <div className="grid grid-cols-2 gap-1.5 rounded-2xl border border-line bg-surface p-1.5">
          <TabButton active={view === "mine"} onClick={() => setView("mine")}>
            <Avatar id={me.emoji} size="xs" />
            {t("results.tabMine")}
          </TabButton>
          <TabButton active={view === "all"} onClick={() => setView("all")}>
            <Users className="size-4" />
            {t("results.tabAll")}
          </TabButton>
        </div>
      ) : null}

      {view === "mine" && me ? (
        <Panel>
          <PanelTitle>{t("results.mineTitle")}</PanelTitle>
          <p className="mb-3 text-sm text-muted">
            {t("results.mineHeadline", { n: me.roster.length, tot: state.config.slots })}
          </p>
          <MyRoster player={me} currency={currency} logo={marchi} />
        </Panel>
      ) : (
        <>
      <Panel>
        <PanelTitle>{t("results.rosters")}</PanelTitle>
        <div className="flex flex-col gap-3">
          {ordered.map(({ player, votes, reason }, index) => (
            <motion.div
              key={player.id}
              ref={index === 0 ? winnerCardRef : undefined}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className={cn(
                "rounded-xl border p-3",
                index === 0
                  ? "border-gold/60 bg-gold/10 winner-glow"
                  : "border-line bg-surface-2",
              )}
            >
              {/* Il primo classificato si annuncia su una riga sua: in fondo
                  allo schermo di un telefono, accanto al nome, lo mangerebbe. */}
              {index === 0 ? (
                <p className="mb-1.5 flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-gold">
                  <Crown className="size-3" />
                  {t("results.winner")}
                  {/* Perche' ha vinto: i voti, oppure il criterio di spareggio. */}
                  <span className="ms-1 font-bold normal-case text-gold/80">
                    · {t(WIN_REASON_KEYS[reason])}
                  </span>
                </p>
              ) : null}
              {/*
                Nome e cifre su due righe: su un telefono stretto i badge
                schiacciavano il nome fino a farlo sparire.
              */}
              {/*
                Il colore scelto in lobby arriva fino a qui.
                Nella classifica finale i nomi stanno uno sull'altro e l'avatar
                e' piccolo: senza il colore, distinguere chi e' chi vuol dire
                leggere, e a fine partita si guarda -- non si legge.
              */}
              <div className="flex min-w-0 items-center gap-2 font-bold">
                <Avatar
                  id={player.emoji}
                  size="sm"
                  className={index === 0 ? undefined : colorLook(player.color).ring}
                />
                <span className={cn("truncate", index === 0 ? "" : colorLook(player.color).text)}>
                  {player.name}
                </span>
                {index === 0 ? (
                  <span aria-hidden className="shrink-0 text-base leading-none">
                    👑
                  </span>
                ) : null}
                {player.id === selfId ? (
                  <span className="shrink-0 rounded-full bg-neon/15 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-neon">
                    {t("lobby.you")}
                  </span>
                ) : null}
                {/*
                  Il batti pugno: solo verso gli altri.
                  Non c'e' contro se stessi perche' non vorrebbe dire niente, e
                  un pulsante che c'e' su ogni riga tranne la propria si capisce
                  senza spiegazioni.
                */}
                {player.id !== selfId ? (
                  <button
                    type="button"
                    onClick={() => bumpTo(player.id)}
                    aria-label={t("results.fistBump")}
                    title={t("results.fistBump")}
                    className={cn(
                      "ms-auto flex shrink-0 touch-manipulation select-none items-center gap-1",
                      "rounded-full border border-line bg-surface px-2.5 py-1 text-xs font-bold",
                      "transition-colors hover:border-neon/60 hover:text-neon active:scale-90",
                    )}
                    style={{ WebkitTapHighlightColor: "transparent" }}
                  >
                    <span aria-hidden>🤛</span>
                    {(bumps[player.id] ?? 0) > 0 ? (
                      <span className="font-mono tabular-nums text-neon">
                        {bumps[player.id]}
                      </span>
                    ) : null}
                  </button>
                ) : null}
              </div>

              {/*
                La battuta del bot, in un fumetto sopra la sua rosa. Solo quando
                ha vinto lui: quando perde non dice niente, perche' un
                programma che fa il gradasso dopo aver perso e' triste.
              */}
              {index === 0 && perdutoColBot ? (
                <motion.p
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                  className="mb-2 flex items-start gap-1.5 rounded-xl border border-violet/40 bg-violet/10 p-2.5 text-xs font-semibold leading-relaxed text-violet"
                >
                  <span aria-hidden className="shrink-0 text-sm">
                    🤌
                  </span>
                  {battuta}
                </motion.p>
              ) : null}

              {/*
                Le targhe ironiche. Sotto il nome e non accanto: su un telefono
                stretto accanto sparirebbe il nome, che e' la cosa che serve.
              */}
              {titoli[player.id]?.length ? (
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {titoli[player.id].map((id) => (
                    <span
                      key={id}
                      className="inline-flex items-center gap-1 rounded-full border border-violet/40 bg-violet/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-violet"
                    >
                      <span aria-hidden>{END_TITLE_EMOJI[id]}</span>
                      {t(TITLE_KEYS[id])}
                    </span>
                  ))}
                </div>
              ) : null}
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <Badge tone={votes > 0 ? "gold" : "neutral"}>
                  {votes === 0
                    ? t("vote.noVotes")
                    : votes === 1
                      ? t("vote.oneVote")
                      : t("vote.votesGot", { n: votes })}
                </Badge>
                <Badge tone="neutral">
                  {t("results.spent", { amount: money(rosterValue(player), currency) })}
                </Badge>
                <Badge tone="neon">
                  {t("results.left", { amount: money(player.budget, currency) })}
                </Badge>
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
            {/*
              L'invito prima del codice.
              Il QR e l'indirizzo dicono *come* si vota, non *perche'*: senza
              una riga che ingaggi, il riquadro chiede un favore senza
              spiegarlo, e il link resta li'.
            */}
            <p className="text-center text-sm font-semibold text-balance text-muted">
              {t("results.voteHook")}
            </p>
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
            {voteError ? (
              <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-3">
                <p className="text-sm font-bold text-red-500">{t("vote.error")}</p>
                <p className="mt-1 break-words font-mono text-[11px] leading-relaxed text-muted">
                  {voteError}
                </p>
              </div>
            ) : null}
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
        </>
      )}

      <div className="grid grid-cols-2 gap-2 pb-8">
        {isHost ? (
          <Button variant="outline" onClick={() => leave(() => dispatch({ type: "restart" }))}>
            <RotateCcw className="size-4" />
            {t("results.restart")}
          </Button>
        ) : (
          <span />
        )}
        <Button variant="ghost" onClick={() => leave(() => router.push("/"))}>
          <Home className="size-4" />
          {t("common.home")}
        </Button>
      </div>

      {/*
        Il salto di livello: una finestra sola, che si chiude e non torna.

        Arriva dopo i coriandoli e dopo la barra dell'esperienza, quando si e'
        gia' capito quanto si e' guadagnato: metterla prima vorrebbe dire
        annunciare un livello che il giocatore non ha ancora visto salire.
      */}
      <Modal
        open={salitoDiLivello && !levelUpVisto}
        title={t("level.up")}
        onClose={() => setLevelUpVisto(true)}
      >
        <div className="flex flex-col items-center gap-4 py-2 text-center">
          <motion.span
            initial={{ scale: 0.5, rotate: -12, opacity: 0 }}
            animate={{ scale: 1, rotate: 0, opacity: 1 }}
            transition={{ type: "spring", stiffness: 260, damping: 14 }}
            className={cn(
              "grid size-24 place-items-center rounded-full ring-4 ring-offset-4 ring-offset-surface",
              levelFor(xpTotali).tier.ring,
            )}
          >
            <span className="font-mono text-4xl font-black text-gold">
              {levelFor(xpTotali).level}
            </span>
          </motion.span>

          <p className="text-sm leading-relaxed text-muted">
            {t("level.upBody", {
              lv: levelFor(xpTotali).level,
              tier: t(levelFor(xpTotali).tier.name),
            })}
          </p>

          <Button size="lg" className="w-full" onClick={() => setLevelUpVisto(true)}>
            {t("level.upCta")}
          </Button>
        </div>
      </Modal>

      <RatingModal
        open={rating !== null}
        prompted
        onClose={() => closeRating()}
        onLater={() => closeRating()}
        onNever={() => closeRating(markRated)}
      />
    </div>
  );
}

/**
 * La rosa di un singolo giocatore: quanti lotti ha preso, quanto ha speso e
 * quanto gli e' rimasto. E' il riquadro della prima fase e della scheda
 * "la mia rosa", quindi vive per conto suo.
 */
function MyRoster({
  player,
  currency,
  logo = false,
}: {
  player: Player;
  currency: GameState["config"]["currency"];
  /** La lista e' fatta di marchi: vanno mostrati su fondo chiaro. */
  logo?: boolean;
}) {
  const t = useT();
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl border border-line bg-surface-2 p-3 text-center">
          <p className="text-[11px] uppercase tracking-wider text-faint">{t("results.mineSpent")}</p>
          <p className="font-mono text-2xl font-black">{money(rosterValue(player), currency)}</p>
        </div>
        <div className="rounded-xl border border-neon/40 bg-neon/10 p-3 text-center">
          <p className="text-[11px] uppercase tracking-wider text-faint">{t("results.mineLeft")}</p>
          <p className="font-mono text-2xl font-black text-neon">{money(player.budget, currency)}</p>
        </div>
      </div>

      {player.roster.length === 0 ? (
        <p className="rounded-xl border border-line bg-surface-2 p-4 text-center text-sm text-faint">
          {t("results.empty")}
        </p>
      ) : (
        <div className="flex flex-col gap-1.5">
          {player.roster.map((entry) => (
            <div
              key={entry.itemId}
              className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface-2 px-3 py-2"
            >
              <span className="flex min-w-0 items-center gap-2">
                <ItemCover item={entry} size="xs" logo={logo} />
                <span className="truncate text-sm font-semibold">{entry.name}</span>
              </span>
              <span className="shrink-0 font-mono text-sm font-black text-gold">
                {money(entry.price, currency)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex h-11 items-center justify-center gap-2 rounded-xl text-sm font-bold transition-colors",
        active ? "bg-neon/15 text-neon" : "text-muted hover:text-fg",
      )}
    >
      {children}
    </button>
  );
}

/**
 * Come ha vinto il primo.
 *
 * "votes" e' il caso normale: ha preso piu' voti di tutti. Gli altri tre sono i
 * criteri di spareggio, in ordine, e servono a garantire che un vincitore ci sia
 * sempre: la vittoria finisce sul profilo di una persona sola.
 */
const WIN_REASON_KEYS: Record<WinReason, TranslationKey> = {
  votes: "vote.winVotes",
  credits: "vote.winCredits",
  bestBuy: "vote.winBest",
  coin: "vote.winCoin",
};
