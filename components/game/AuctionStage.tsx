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
import { useDutchPrice } from "@/lib/useDutchPrice";
import { categoryName } from "@/lib/catalog";
import {
  discardsLeft,
  flopBudget,
  colorLook,
  lotSeconds,
  currentItem,

  liveReactions,
  canReact,
  isDutchLot,
  isMysteryLot,
  itemById,
  nextToAct,
  playerById,
  type GameAction,
  type ReactionEmoji,
} from "@/lib/game";
import { HAPTIC_BID, HAPTIC_PASS, HAPTIC_WIN, vibrate } from "@/lib/haptics";
import { useAuth } from "@/lib/auth";
import { BOT_PLAYER_ID } from "@/lib/botEngine";
import { useSettings } from "@/lib/settings";
import type { GameState } from "@/lib/types";
import { TIER_STYLES, cn, money } from "@/lib/utils";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { RoomCode } from "@/components/ui/RoomCode";
import { BidControls } from "./BidControls";
import { ItemCover } from "./ItemCover";
import { PlayerRail } from "./PlayerRail";
import { ReactionButton } from "./Reactions";
import { FloatingTimer } from "./Timer";

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
  const { account } = useAuth();
  const lastFeedRef = useRef<string | null>(null);

  const mystery = isMysteryLot(state);
  const dutch = isDutchLot(state);
  /*
   * Il ribasso come regola della stanza, non come stato del lotto.
   *
   * `dutch` vale solo mentre l'asta e' aperta, ed e' giusto cosi' per le
   * azioni. Le scritte pero' restano a schermo anche durante l'aggiudicazione,
   * dietro il riquadro dell'esito: senza questa distinzione per quei quattro
   * secondi ricomparirebbe "offerta corrente" in una partita dove non si fanno
   * offerte.
   */
  const ribasso = Boolean(state.config.dutchDraft);
  const dutchPrice = useDutchPrice(state, now);
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
  /*
   * Di chi e' la mano.
   *
   * Adesso e' un fatto e non piu' un suggerimento: lo stato lo dice, e chi
   * non ce l'ha ha i pulsanti spenti. Le partite cominciate prima dei turni
   * non portano il campo, e li' si ricade sul vecchio calcolo -- che era
   * appunto un consiglio su chi dovrebbe muoversi.
   */
  /*
   * Al ribasso non tocca a nessuno: tocca a tutti.
   *
   * Il ripiego su `nextToAct` serve alle partite cominciate prima che i turni
   * esistessero, dove `turnId` manca e un suggerimento e' meglio di niente. Qui
   * invece il null e' una regola, e senza questa riga la fascia annuncerebbe
   * "tocca a" un giocatore a caso mentre il pulsante e' acceso per tutti.
   */
  const turnId = dutch ? null : (state.turnId ?? nextToAct(state));
  /*
   * In locale si tiene aperto un pannello di comandi alla volta: quello di chi
   * tocca, finche' non se ne apre un altro a mano. Il lotto che cambia riporta
   * l'apertura sul giocatore di turno.
   */
  const [openPanel, setOpenPanel] = useState<string | null>(null);
  const expandedId = openPanel ?? turnId;
  /*
   * Al ribasso, in locale, i comandi si aprono per tutti.
   *
   * Sullo stesso schermo l'asta al ribasso e' una gara a chi tocca per primo:
   * tenerne aperto uno solo -- come si fa a turni -- vorrebbe dire che gli
   * altri, per partecipare, devono prima aprire il proprio pannello mentre il
   * prezzo scende. E siccome senza turni non c'e' nessun pannello da aprire
   * d'ufficio, senza questa regola non se ne aprirebbe nemmeno uno.
   */
  const apriTutti = dutch && state.mode === "local";
  /*
   * Il telefono passa di mano solo fra persone.
   *
   * Una stanza locale disegna i comandi di tutti, perche' si gioca in tanti
   * sullo stesso schermo. Contro il bot i comandi erano due, e il secondo era
   * i suoi: bastava aprirlo per rilanciare e passare al posto dell'avversario.
   * Contro il bot c'e' una persona sola, e la sua interfaccia e' quella delle
   * stanze online.
   */
  const passaMano = state.mode === "local" && !state.isPractice;

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

  /*
   * Il portone: da qui non passa nessuno che non sia chi ha in mano il telefono.
   *
   * Sembra ridondante -- i comandi del bot non vengono nemmeno disegnati -- ed
   * e' voluto: e' esattamente la strada da cui e' arrivato il guasto. In una
   * stanza di prova ogni azione partita dall'interfaccia e' della persona, e
   * quella del bot arriva da un'altra parte (il suo motore, che chiama
   * dispatch per conto proprio). Se qui si presenta l'identificativo del bot,
   * o quello di chiunque altro, la mossa non parte: due controlli sono meglio
   * di uno quando il costo di sbagliare e' giocare al posto dell'avversario.
   */
  const attoreValido = (playerId: string): boolean => {
    if (playerId === BOT_PLAYER_ID) return false;
    if (state.isPractice && playerId !== selfId) return false;
    return true;
  };

  const bid = (playerId: string, amount: number) => {
    if (!attoreValido(playerId)) return;
    if (!once(`bid:${playerId}:${amount}`)) return;
    vibrate(HAPTIC_BID);
    dispatch({ type: "bid", playerId, amount, now: now() });
  };
  const pass = (playerId: string) => {
    if (!attoreValido(playerId)) return;
    if (!once(`pass:${playerId}`)) return;
    vibrate(HAPTIC_PASS);
    dispatch({ type: "pass", playerId, now: now() });
  };
  /*
   * Le reazioni sono per chi ha un profilo.
   *
   * Non e' un paywall -- e' gratis -- ma un nome sopra una faccina cambia
   * cosa vuol dire mandarla: un ospite e' anonimo e resta anonimo la partita
   * dopo, e la stessa emoji da un anonimo e da qualcuno che si ritrovera' fra
   * i PickMates non sono la stessa cosa.
   */
  const registrato = Boolean(account && !account.local);
  const reazioni = liveReactions(state, now());

  const react = (emoji: ReactionEmoji) => {
    if (!registrato || !selfId) return;
    dispatch({ type: "react", playerId: selfId, emoji, now: now() });
  };

  const claim = (playerId: string) => {
    if (!attoreValido(playerId)) return;
    if (!once(`claim:${playerId}`)) return;
    vibrate(HAPTIC_BID);
    dispatch({ type: "claim", playerId, now: now() });
  };

  /*
   * Il lotto su cui si e' gia' premuto "prendi ora".
   *
   * Si segna il numero del lotto e non un semplice si'/no: cosi' l'attesa si
   * spegne da sola quando ne esce uno nuovo, senza un effetto che azzeri la
   * bandiera al momento giusto -- e senza il rischio che un ritardo di rete
   * lasci il pulsante spento sul lotto dopo.
   */
  const [takingLot, setTakingLot] = useState<number | null>(null);
  const taking = takingLot === state.lotNumber && state.phase === "auction";

  const takeDutch = (playerId: string) => {
    if (!attoreValido(playerId)) return;
    if (!once(`dutch:${playerId}:${state.lotNumber}`)) return;
    vibrate(HAPTIC_BID);
    setTakingLot(state.lotNumber);
    dispatch({ type: "take_dutch", playerId, now: now() });
  };

  return (
    <div className="flex flex-col gap-4">
      {/*
        La barra di contesto: tre cose, tre posti fissi.

        Prima erano tutte in fila a destra e si spingevano fra loro: su un
        telefono stretto il nome della categoria finiva sotto i puntini e la
        clessidra mangiava meta' riga. Adesso a sinistra sta chi sei e a cosa
        stai giocando, in mezzo a che punto sei, a destra quanto puoi ancora
        permetterti di rinunciare. Il cronometro non e' piu' qui: e' sceso
        vicino ai pulsanti, dove si guarda davvero.
      */}
      {/*
        La barra di contesto, ridotta a due cose.

        Il conteggio dei lotti e' sparito: diceva "1 di 40" su una lista da
        quaranta elementi di cui se ne giocano venticinque, quindi il secondo
        numero non era la fine della partita e il primo non diceva quanto manca.
        Un numero che non risponde alla domanda per cui lo si guarda e' peggio
        di nessun numero.

        Restano la categoria -- che dice a cosa si sta giocando, ed e' la cosa
        che si dimentica -- e il codice della stanza, che serve per farsi
        raggiungere. I flop a destra, perche' cambiano durante la partita.
      */}
      <div className="flex w-full items-center justify-between gap-2 rounded-xl border border-line bg-surface/80 px-2 py-1.5 backdrop-blur">
        <p className="flex min-w-0 items-center gap-2 text-base font-extrabold tracking-wide">
          <span aria-hidden className="shrink-0 text-lg">
            {state.category.emoji}
          </span>
          <span className="truncate">{categoryName(state.category, locale)}</span>
        </p>

        <div className="flex shrink-0 items-center gap-2">
          <RoomCode code={state.code} />

          {/*
            I flop ancora possibili. E' una riserva di gruppo: quando finisce, i
            lotti che non vuole nessuno vengono assegnati d'ufficio, quindi
            conviene saperlo prima di passare per l'ennesima volta.
          */}
          {state.config.allowDiscards ? (
            <span
              title={t(scartiFiniti ? "auction.discardsOut" : "auction.discardsLeft")}
              className={cn(
                "inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-1 font-mono text-[11px] font-bold",
                scartiFiniti
                  ? "border-red-500/50 bg-red-500/10 text-red-400"
                  : "border-line bg-surface-2 text-faint",
              )}
            >
              <span aria-hidden>🎯</span>
              {state.discards.length}/{flopTetto}
            </span>
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

        <div className="mt-5 flex w-full items-center justify-between gap-2 border-t border-line pt-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-faint">
              {ribasso ? t("auction.dutchNow") : t("auction.currentBid")}
            </p>
            {ribasso ? (
              /*
               * Al ribasso la cifra cambia di continuo: niente animazione a
               * ogni credito perso, che a quattro scatti al secondo diventa un
               * tremolio. Cambia colore quando tocca il fondo, e tanto basta.
               */
              <p
                className={cn(
                  "font-mono text-4xl font-black tabular-nums",
                  dutchPrice.atFloor ? "text-gold" : "text-neon",
                )}
              >
                {/* Fuori dall'asta si mostra il prezzo di apertura: e' quello
                    da cui ripartira' il lotto successivo. */}
                {money(dutch ? dutchPrice.price : state.lotPrice, currency)}
              </p>
            ) : (
              <motion.p
                key={`${state.currentBid}-${state.highBidderId ?? "none"}`}
                initial={{ scale: 1.18 }}
                animate={{ scale: 1 }}
                transition={{ duration: 0.3 }}
                className="font-mono text-4xl font-black"
              >
                {money(mystery ? state.lotPrice : state.currentBid, currency)}
              </motion.p>
            )}
          </div>
          {/*
            La colonna di destra si restringe invece di spingere.

            Su un telefono stretto "Prezzo base, nessuna offerta" e "2 ancora
            in gara" finivano una sopra l'altra e sotto il gettone del
            cronometro. Con min-w-0 e il taglio, la frase si accorcia da sola
            e la cifra dell'offerta -- che e' la cosa che si guarda -- resta
            sempre intera.
          */}
          <div className="min-w-0 text-end">
            {leader ? (
              <p className="flex items-center justify-end gap-1.5 text-sm font-bold text-neon text-glow">
                <Gavel className="size-4 shrink-0" />
                <Avatar id={leader.emoji} size="xs" />
                <span className="truncate">{leader.name}</span>
              </p>
            ) : (
              <p className="flex items-center justify-end gap-1.5 text-xs text-faint">
                <Flame className="size-3.5 shrink-0" />
                <span className="truncate">
                  {ribasso
                    ? t("auction.dutchHint")
                    : mystery
                      ? t("auction.mysteryHint")
                      : t("auction.noBid")}
                </span>
              </p>
            )}
            <p className="truncate text-xs text-faint">
              {t("auction.inRace", { n: inRace })}
            </p>
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

      {/*
        Di chi e' la mano, detto sempre e non solo quando il telefono passa
        di mano: adesso e' una regola, non un consiglio, e chi ha i pulsanti
        spenti deve sapere perche' -- se no sembrano rotti.
      */}
      {turnId && state.phase === "auction" ? (
        <p className="text-center text-xs font-bold uppercase tracking-[0.18em] text-violet">
          {turnId === selfId && !passaMano
            ? t("auction.yourTurnNow")
            : t("auction.turnOf", { player: playerById(state, turnId)?.name ?? "" })}
        </p>
      ) : null}

      {passaMano ? (
        <>
          {/*
            La striscia con tutti: avatar, crediti e stato di ognuno in una
            riga sola. Con cinque giocatori serve, perche' cinque pannelli di
            comandi aperti insieme facevano una pagina alta quasi tremila
            pixel: per arrivare al proprio bisognava scorrere mentre il timer
            correva.
          */}
          <PlayerRail
            state={state}
            nextId={turnId}
            thinkingId={thinkingId}
            reactions={reazioni}
          />

          {/*
            Qui i pannelli sono tanti e la pagina e' alta: il gettone resta
            appiccicato in fondo mentre si scorre, se no per vedere i secondi
            bisognerebbe tornare in cima proprio mentre stanno finendo.
          */}
          {state.phase === "auction" && state.deadline ? (
            <div className="pointer-events-none sticky bottom-3 z-30 -mt-2 flex justify-end">
              <FloatingTimer deadline={state.deadline} now={now} />
            </div>
          ) : null}

          <div className="flex flex-col gap-2">
            {state.players.map((player) => {
              const aperto = apriTutti || player.id === expandedId;
              if (aperto) {
                return (
                  <BidControls
                    key={player.id}
                    compact
                    state={state}
                    player={player}
                    locked={Boolean(thinkingId)}
                    highlight={player.id === turnId}
                    onBid={(amount) => bid(player.id, amount)}
                    onPass={() => pass(player.id)}
                    onClaim={() => claim(player.id)}
                    onTakeDutch={() => takeDutch(player.id)}
                    now={now}
                    taking={taking}
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
          <PlayerRail
            state={state}
            selfId={selfId}
            nextId={turnId}
            thinkingId={thinkingId}
            reactions={reazioni}
          />

          {self ? (
            <>
              {/* Su telefono i comandi restano fissi in basso, a portata di pollice. */}
              <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-ink/95 p-3 backdrop-blur safe-bottom sm:static sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
                {/*
                  Su schermo largo la plancia sta in linea, e la riga che
                  galleggia sopra -- faccina a sinistra, cronometro a destra --
                  finiva sulle schede dei giocatori, coprendo i crediti del
                  primo. Il margine le apre lo spazio che su telefono ha gia',
                  dove la plancia e' ancorata in fondo e sopra c'e' il vuoto.
                */}
                <div className="relative mx-auto w-full max-w-2xl sm:mt-14">
                  {/*
                    La riga sopra i tasti: la faccina a sinistra, il cronometro
                    a destra, e in mezzo niente.

                    Nessuno dei due si prende una riga sua -- la plancia e' gia'
                    alta e ogni riga in piu' spinge i tasti sotto la piega -- e
                    la faccina non finisce in fila con i rilanci, dove prima o
                    poi qualcuno la premerebbe credendo di offrire.
                  */}
                  <ReactionButton
                    locked={!registrato}
                    canSend={canReact(state, self.id, now())}
                    onSend={react}
                    className="absolute -top-14 start-0 z-10"
                  />
                  {state.phase === "auction" && state.deadline ? (
                    <FloatingTimer
                      deadline={state.deadline}
                      now={now}
                      className="absolute -top-14 end-0 z-10"
                    />
                  ) : null}
                  <BidControls
                    state={state}
                    player={self}
                    locked={Boolean(thinkingId)}
                    highlight={self.id === turnId}
                    onBid={(amount) => bid(self.id, amount)}
                    onPass={() => pass(self.id)}
                    onClaim={() => claim(self.id)}
                    onTakeDutch={() => takeDutch(self.id)}
                    now={now}
                    taking={taking}
                  />

                </div>
              </div>
              {/*
                Il vuoto che la plancia fissa si prende in fondo alla pagina.
                Deve bastare per i tasti *e* per la riga che ci sta sopra: era
                corto di una trentina di pixel, ed e' per questo che il
                cronometro cadeva sulla scritta dell'offerta.
              */}
              <div aria-hidden className="h-64 sm:hidden" />
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
