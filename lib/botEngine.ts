"use client";

import { useEffect, useRef, useState } from "react";
import {
  SNIPE_WINDOW_SECONDS,
  canBid,
  canClaim,
  canPass,
  canReact,
  canVote,
  hasVoted,
  maxBid,
  minimumBid,
  liveReactions,
  playerById,
  slotsLeft,
  type GameAction,
  type ReactionEmoji,
} from "./game";
import type { GameState, Player } from "./types";

/**
 * Il Pick-asso Bot: l'avversario per giocare da soli.
 *
 * Non e' un giocatore vero e non finge di esserlo. Ragiona su una regola sola --
 * quanto posso spendere per ogni posto che mi resta da riempire -- e prende
 * tempo prima di rispondere, perche' un avversario che rilancia nello stesso
 * istante in cui compare il lotto non e' difficile: e' solo scomodo, toglie il
 * tempo di leggere l'elemento e trasforma l'asta in una gara di riflessi.
 */

/** Identificativo fisso del bot: uno solo per partita, sempre lo stesso. */
export const BOT_PLAYER_ID = "bot-pickasso";

/**
 * Il nome che compare in partita. Sedici caratteri esatti, che e' il limite del
 * riduttore: piu' lungo verrebbe tagliato a meta' dell'emoji.
 */
export const BOT_NAME = "Pick-asso Bot 🤖";

/** L'icona del bot, quando non l'ha gia' presa la persona che gioca. */
export const BOT_AVATAR = "bot";

export type BotActionKind = "bid" | "pass" | "hesitate" | "snipe";

/**
 * Il ritardo prima di ogni mossa, mai lo stesso due volte.
 *
 * Un'attesa fissa si riconosce dopo tre lotti e rompe l'illusione peggio di
 * qualunque risposta istantanea. Le tre fasce dicono anche qualcosa: il bot
 * tentenna quando il lotto gli costa caro e taglia corto quando rinuncia, cosi'
 * il tempo che passa e' gia' un indizio su cosa sta per fare.
 *
 * I tempi sono stati allungati dopo averlo visto giocare: rispondere in un
 * secondo e mezzo non sembrava un avversario svelto, sembrava una macchina. Ora
 * la risposta piu' rapida arriva dopo due secondi e la piu' lenta sfiora i sei,
 * che su un lotto da quindici secondi lascia comunque il tempo di rispondere.
 */
export function getBotDelay(actionType: BotActionKind): number {
  const ranges: Record<BotActionKind, [number, number]> = {
    pass: [2000, 3500], // Rinuncia: la piu' breve, ma non piu' istantanea.
    bid: [2500, 4500], // Rilancio standard.
    hesitate: [4000, 6000], // Il lotto gli costa: ci pensa su, e si vede.
    // Ultimi secondi: qui prendersela comoda vorrebbe dire regalare il lotto.
    // Una persona in quel momento smette di pensare e preme, e il bot pure.
    snipe: [800, 1200],
  };
  const [min, max] = ranges[actionType];
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Sopra quale quota del budget residuo il bot comincia a tentennare.
 *
 * Quaranta per cento e non cinquanta: la pausa lunga e' la cosa piu' visibile
 * che fa: alzare la soglia la rendeva rara, e una suspense che scatta una volta
 * ogni dieci lotti non e' suspense, e' un intoppo.
 */
const HESITATION_SHARE = 0.4;

/**
 * Quanto il bot puo' permettersi su un lotto solo.
 *
 * I crediti rimasti divisi per i posti ancora da riempire. E' la stessa somma
 * che farebbe una persona prudente: se restano dodici crediti e tre elementi da
 * prendere, oltre i quattro non si va, altrimenti gli ultimi due posti restano
 * vuoti. Sull'ultimo posto la soglia coincide con tutto quello che ha, perche'
 * non c'e' piu' niente da tenere da parte.
 */
export function affordableCeiling(state: GameState, bot: Player): number {
  const rimasti = slotsLeft(state, bot);
  if (rimasti <= 0) return 0;
  return Math.floor(bot.budget / rimasti);
}

/**
 * La quota di budget che il bot mette su un lotto solo.
 *
 * Fra un quarto e due quinti di quello che gli resta, tirata a sorte a ogni
 * lotto. La casualita' non e' un vezzo: con una frazione fissa il bot si
 * rilegge in tre lotti -- si capisce esattamente dove si fermera' e basta
 * offrire un credito in piu' ogni volta. Cosi' invece bisogna tentarlo.
 *
 * Il tiro si stringe verso l'alto quando restano pochi posti da riempire: sul
 * penultimo e sull'ultimo tenere da parte non serve piu' a niente.
 */
export const BID_SHARE_MIN = 0.25;
export const BID_SHARE_MAX = 0.4;

export function bidShare(slotsRemaining: number): number {
  const base = BID_SHARE_MIN + Math.random() * (BID_SHARE_MAX - BID_SHARE_MIN);
  // Con due posti o meno da coprire si puo' osare di piu': niente da risparmiare per dopo.
  return slotsRemaining <= 2 ? Math.min(1, base * 1.6) : base;
}

/** Il massimo che il bot spende su questo lotto: la quota, o la soglia se piu' bassa. */
export function maxBidFor(state: GameState, bot: Player, share: number): number {
  const perQuota = Math.floor(bot.budget * share);
  return Math.min(maxBid(state, bot), Math.max(perQuota, affordableCeiling(state, bot)));
}

export type BotMove =
  | { kind: "bid"; amount: number; delay: number }
  | { kind: "claim"; delay: number }
  | { kind: "pass"; delay: number }
  | { kind: "vote"; targetId: string; delay: number };

/**
 * Cosa fa il bot adesso, o null se non tocca a lui.
 *
 * E' una funzione pura: guarda lo stato e risponde. Chi la chiama decide
 * quando applicarla, ed e' li' che entra in gioco il ritardo.
 */
export function decideBotMove(
  state: GameState,
  botId: string = BOT_PLAYER_ID,
  options: { now?: number; share?: number } = {},
): BotMove | null {
  const bot = playerById(state, botId);
  if (!bot) return null;
  const now = options.now ?? Date.now();
  // La quota del lotto si tira una volta e si tiene per tutta la decisione: se
  // la si ritirasse a ogni passaggio il tetto ballerebbe dentro la stessa mossa.
  const share = options.share ?? bidShare(slotsLeft(state, bot));

  /*
   * Il voto finale.
   *
   * Il bot vota la rosa della persona che ha davanti. Non e' generosita': in
   * uno contro uno l'unica rosa votabile e' quella dell'altro, perche' la
   * propria non si vota mai. Serve a chiudere la fase -- senza il suo voto si
   * resterebbe fermi fino allo scadere del tempo -- e a far arrivare la
   * schermata finale con la card da condividere.
   */
  if (state.phase === "voting") {
    if (hasVoted(state, botId)) return null;
    const umano = state.players.find((player) => player.id !== botId);
    if (!umano || !canVote(state, botId, umano.id)) return null;
    return { kind: "vote", targetId: umano.id, delay: getBotDelay("bid") };
  }

  if (state.phase !== "auction") return null;

  const soglia = affordableCeiling(state, bot);

  /* La Mystery Box ha un prezzo solo: o lo si paga o si lascia. */
  if (state.lotKind === "mystery") {
    if (canClaim(state, botId) && state.lotPrice <= soglia) {
      const caro = state.lotPrice > bot.budget * HESITATION_SHARE;
      return { kind: "claim", delay: getBotDelay(caro ? "hesitate" : "bid") };
    }
    if (canPass(state, botId)) return { kind: "pass", delay: getBotDelay("pass") };
    return null;
  }

  /* Gia' in testa: si aspetta la risposta dell'altro, non si rilancia da soli. */
  if (state.highBidderId === botId) return null;

  const minimo = minimumBid(state);
  /*
   * Il tetto per questo lotto: la quota di budget tirata a sorte, e mai piu' di
   * quanto la regola del saldo consenta. Sopra questo numero il bot non rilancia
   * piu', per quanto gli piaccia il lotto.
   */
  const tetto = maxBidFor(state, bot, share);

  /* Ultimi secondi con un'offerta sul piatto: si risponde subito o si perde. */
  const scadenza = state.deadline - now;
  const allUltimo =
    Boolean(state.highBidderId) && scadenza > 0 && scadenza <= SNIPE_WINDOW_SECONDS * 1000;

  if (minimo > tetto) {
    /*
     * Non ci si arriva. Restano due modi di uscirne, e non sono equivalenti:
     * passare vuol dire lasciare il lotto alla persona, che se e' rimasta sola
     * se lo prende al prezzo di partenza. Se pero' i flop non sono finiti e non
     * siamo agli ultimi lotti, passare e' anche il modo di mandarlo negli
     * scarti -- il lotto non lo prende nessuno e i crediti dell'avversario
     * restano fermi. E' la stessa mossa, ma qui e' una scelta, non una resa.
     */
    if (canPass(state, botId)) return { kind: "pass", delay: getBotDelay("pass") };
    return null;
  }

  // Rilancio di uno o due, mai di piu': i salti grossi bruciano il budget su
  // un lotto solo e lasciano la lista a meta'.
  const passo = Math.random() < 0.5 ? 1 : 2;
  const amount = Math.min(minimo + passo - 1, tetto);
  if (!canBid(state, botId, amount)) {
    if (canPass(state, botId)) return { kind: "pass", delay: getBotDelay("pass") };
    return null;
  }

  if (allUltimo) return { kind: "bid", amount, delay: getBotDelay("snipe") };

  /*
   * Oltre i due quinti di quello che gli resta il bot ci pensa su. E' la mossa
   * che si legge meglio da fuori: l'attesa lunga dice "questo lotto gli
   * interessa e gli costa", ed e' l'unico momento in cui il ritmo dell'asta
   * cambia da solo.
   */
  const impegnativo = amount > bot.budget * HESITATION_SHARE;
  return { kind: "bid", amount, delay: getBotDelay(impegnativo ? "hesitate" : "bid") };
}


/* ------------------------------------------------------------------ */
/* Le risposte del bot                                                 */
/* ------------------------------------------------------------------ */

/**
 * Cosa risponde il bot a una faccina, e quando non risponde affatto.
 *
 * La regola che conta e' quella negativa: **non manda mai niente a caso**. Un
 * avversario che sputa emoji a intervalli regolari smette di essere divertente
 * al terzo lotto e diventa rumore -- e il rumore, in una partita fra amici, e'
 * la cosa che fa spegnere una funzione.
 *
 * Risponde solo se gli hanno parlato, e quello che risponde dipende da come sta
 * andando: la stessa provocazione vale una spallata quando e' in testa e un
 * pianto quando ha finito i crediti. E' tutta qui l'intelligenza -- guardare il
 * tabellone prima di rispondere -- ma basta a far sembrare che abbia capito.
 */
export function botReplyTo(
  emoji: string,
  state: GameState,
  botId: string = BOT_PLAYER_ID,
): ReactionEmoji | null {
  const bot = playerById(state, botId);
  if (!bot) return null;

  const inTesta = state.highBidderId === botId;
  const alVerde = maxBid(state, bot) < minimumBid(state);

  switch (emoji) {
    case "🤡":
      // Lo sfotto' colpisce solo chi e' in difficolta': se ha finito i crediti
      // se la prende, se sta vincendo risponde col gesto.
      if (alVerde) return "😭";
      return inTesta ? "🤌" : "🤡";
    case "💸":
      // "Stai spendendo troppo": vale come rimando solo se e' lui a farlo.
      return inTesta ? "🤌" : null;
    case "🔥":
      // Entusiasmo per il lotto: si sta al gioco, e si rilancia la posta.
      return Math.random() < 0.5 ? "💸" : "🤡";
    case "😭":
      return "🤌";
    default:
      return null;
  }
}

/**
 * Le reazioni che il bot manda di sua iniziativa, e solo su tre fatti precisi.
 *
 * Tre, non "ogni tanto": un colpo all'ultimo secondo, un lotto buttato via
 * dalla persona, e un lotto perso dopo averci messo mezzo budget. Sono i tre
 * momenti in cui a un tavolo vero qualcuno direbbe qualcosa, e in nessun altro.
 */
export function botSpontaneousReaction(
  state: GameState,
  previous: GameState | null,
  botId: string = BOT_PLAYER_ID,
): ReactionEmoji | null {
  if (!previous) return null;
  const bot = playerById(state, botId);
  if (!bot) return null;

  // Il colpo in extremis: il bot ha appena rilanciato negli ultimi secondi.
  if (
    state.phase === "auction" &&
    state.highBidderId === botId &&
    previous.highBidderId !== botId &&
    state.sniped
  ) {
    return "💸";
  }

  // Il lotto e' finito negli scarti perche' non lo voleva nessuno: la persona
  // ha appena chiamato flop, e il bot glielo fa notare.
  if (
    state.phase === "result" &&
    previous.phase === "auction" &&
    state.discards.length > previous.discards.length
  ) {
    return "🤡";
  }

  // Ha perso un lotto su cui aveva impegnato piu' di meta' budget.
  if (
    state.phase === "result" &&
    previous.phase === "auction" &&
    previous.highBidderId === botId &&
    state.lastResult?.winnerId &&
    state.lastResult.winnerId !== botId &&
    previous.currentBid > bot.budget / 2
  ) {
    return "😭";
  }

  return null;
}

/** L'ultima reazione arrivata da qualcun altro, se e' nuova. */
export function latestForeignReaction(
  state: GameState,
  now: number,
  botId: string = BOT_PLAYER_ID,
): { id: string; emoji: string } | null {
  const altrui = liveReactions(state, now).filter((r) => r.playerId !== botId);
  const ultima = altrui[altrui.length - 1];
  return ultima ? { id: ultima.id, emoji: ultima.emoji } : null;
}

/** La mossa tradotta nell'azione che capisce il riduttore. */
function toAction(move: BotMove, botId: string, now: number): GameAction {
  switch (move.kind) {
    case "bid":
      return { type: "bid", playerId: botId, amount: move.amount, now };
    case "claim":
      return { type: "claim", playerId: botId, now };
    case "pass":
      return { type: "pass", playerId: botId, now };
    case "vote":
      return { type: "vote", voterId: botId, targetId: move.targetId, now };
  }
}

/**
 * Quanto il bot resta fermo dopo che si e' mosso qualcun altro.
 *
 * Serve contro i tocchi rapidi: chi rilancia due volte di fila cambia la
 * situazione due volte in mezzo secondo, e senza questa pausa il bot
 * comincerebbe a rispondere alla prima mentre arriva la seconda. Mezzo secondo
 * su un'attesa che parte da due non si nota, e toglie di mezzo la corsa.
 */
export const GRACE_AFTER_CHANGE_MS = 500;

export interface BotStatus {
  /** true mentre il bot sta aspettando il suo turno: serve al badge a schermo. */
  thinking: boolean;
  /** Chi e' il bot, per sapere sotto quale avatar mettere il badge. */
  botId: string;
}

/**
 * Attacca il bot a una stanza in corso.
 *
 * Si sveglia a ogni cambio di situazione -- lotto nuovo, rilancio ricevuto,
 * qualcuno che passa -- aspetta il suo ritardo e poi si muove.
 *
 * ## Perche' la mossa si ricalcola due volte
 *
 * Al momento di programmare l'attesa la mossa serve solo a sapere quanto
 * aspettare. Quella vera si decide quando l'attesa scade, rileggendo lo stato
 * di allora: fra le due cose passano fino a sei secondi, e in sei secondi
 * l'asta cambia. Prima si mandava la mossa decisa all'inizio; se nel frattempo
 * era diventata impraticabile il riduttore la rifiutava in silenzio, il bot
 * restava fermo per tutto il lotto e da fuori sembrava bloccato.
 *
 * ## Perche' c'e' un lucchetto
 *
 * Un'attesa alla volta. Senza, un paio di cambi di situazione ravvicinati
 * lasciavano due attese in volo e il bot rilanciava due volte sullo stesso
 * lotto, oppure passava subito dopo aver rilanciato.
 *
 * Sta fermo se la stanza non e' una partita di prova o se il bot non c'e'.
 */
export function useBotEngine({
  state,
  dispatch,
  now,
  botId = BOT_PLAYER_ID,
}: {
  state: GameState | null;
  dispatch: (action: GameAction) => void;
  now: () => number;
  botId?: string;
}): BotStatus {
  /*
   * Lo stato di adesso, non quello di quando l'attesa e' partita.
   *
   * Il riferimento si aggiorna a ogni disegno, quindi quando l'attesa scade
   * contiene l'asta com'e' in quel momento. E' il punto di tutta la faccenda:
   * dentro il setTimeout non si guarda niente che venga da fuori.
   */
  const stateRef = useRef(state);
  const dispatchRef = useRef(dispatch);
  const nowRef = useRef(now);
  useEffect(() => {
    stateRef.current = state;
    dispatchRef.current = dispatch;
    nowRef.current = now;
  });

  /** Un'attesa alla volta: qui si segna che ce n'e' gia' una in volo. */
  const isBotThinkingRef = useRef(false);
  const [thinking, setThinking] = useState(false);

  const attivo = Boolean(state?.isPractice) && Boolean(state && playerById(state, botId));

  /*
   * L'impronta della situazione.
   *
   * Il bot deve ripensarci quando cambia qualcosa che lo riguarda, non a ogni
   * battito dell'orologio: senza questa stringa l'effetto ripartirebbe quattro
   * volte al secondo -- `updatedAt` cambia sempre -- e il ritardo non
   * arriverebbe mai a scadere.
   */
  const impronta = state
    ? [
        state.phase,
        state.lotNumber,
        state.lotKind,
        state.currentBid,
        state.highBidderId ?? "-",
        state.passed.length,
        Object.keys(state.votes ?? {}).length,
      ].join(":")
    : "";

  /* Le reazioni arrivate, per riconoscere quando ne compare una nuova. */
  const reazioni = (state?.reactions ?? []).map((r) => r.id).join(",");

  useEffect(() => {
    if (!attivo) return;

    // Serve solo a sapere quanto aspettare: quella buona si decide dopo.
    const previsione = decideBotMove(stateRef.current as GameState, botId, {
      now: nowRef.current(),
    });
    if (!previsione) {
      setThinking(false);
      return;
    }

    isBotThinkingRef.current = true;
    setThinking(true);

    const timer = window.setTimeout(() => {
      isBotThinkingRef.current = false;
      setThinking(false);

      /*
       * Da qui in giu' si guarda solo lo stato di adesso. Ogni motivo per
       * lasciar perdere e' un caso in cui muoversi farebbe danno o niente:
       * partita finita, bot uscito, fase cambiata, oppure il bot e' gia' lui
       * il migliore offerente e rilancerebbe contro se stesso.
       */
      const attuale = stateRef.current;
      if (!attuale || !attuale.isPractice) return;
      if (!playerById(attuale, botId)) return;
      if (attuale.phase !== "auction" && attuale.phase !== "voting") return;
      if (attuale.phase === "auction" && attuale.highBidderId === botId) return;

      // L'orologio della stanza, non quello di sistema: sul telefono che non
      // ospita la partita sono sfasati, e il conto degli ultimi secondi con
      // l'orologio sbagliato direbbe sempre la cosa sbagliata.
      const mossa = decideBotMove(attuale, botId, { now: nowRef.current() });
      if (!mossa) return;

      dispatchRef.current(toAction(mossa, botId, nowRef.current()));
    }, previsione.delay + GRACE_AFTER_CHANGE_MS);

    return () => {
      window.clearTimeout(timer);
      isBotThinkingRef.current = false;
      setThinking(false);
    };
    // Si dipende dall'impronta e non dall'oggetto stato -- vedi sopra -- e
    // dentro l'effetto lo stato si legge dal riferimento, non dalla chiusura:
    // per questo l'elenco e' completo davvero e non serve zittire nessuno.
  }, [attivo, impronta, botId]);

  /*
   * Le reazioni del bot: un effetto separato, e non e' pigrizia.
   *
   * Rispondere a una faccina non e' una mossa d'asta -- non cambia il lotto,
   * non consuma il suo turno -- e infilarla nella stessa attesa avrebbe voluto
   * dire o ritardare il rilancio per rispondere, o zittire il bot mentre
   * ragiona. Sono due cose che accadono in parallelo, come a un tavolo vero.
   */
  const rispostoA = useRef<string | null>(null);
  const precedenteRef = useRef<GameState | null>(null);

  useEffect(() => {
    if (!attivo) return;
    const attuale = stateRef.current;
    if (!attuale) return;

    const manda = (emoji: ReactionEmoji, ritardo: number) =>
      window.setTimeout(() => {
        const adesso = stateRef.current;
        if (!adesso || !canReact(adesso, botId, nowRef.current())) return;
        dispatchRef.current({
          type: "react",
          playerId: botId,
          emoji,
          now: nowRef.current(),
        });
      }, ritardo);

    const timers: number[] = [];

    /* Qualcuno gli ha parlato: si risponde una volta sola, e a tono. */
    const ultima = latestForeignReaction(attuale, nowRef.current(), botId);
    if (ultima && rispostoA.current !== ultima.id) {
      rispostoA.current = ultima.id;
      const risposta = botReplyTo(ultima.emoji, attuale, botId);
      // Un secondo o due: il tempo di leggerla, non di consultare un manuale.
      if (risposta) timers.push(manda(risposta, 1000 + Math.random() * 1000));
    }

    /* Oppure e' successo qualcosa che merita un commento. */
    const spontanea = botSpontaneousReaction(attuale, precedenteRef.current, botId);
    precedenteRef.current = attuale;
    if (spontanea) timers.push(manda(spontanea, 600 + Math.random() * 600));

    return () => timers.forEach((timer) => window.clearTimeout(timer));
    // Stessa impronta delle mosse, piu' le reazioni arrivate: lo stato si
    // legge dai riferimenti, quindi l'elenco e' completo davvero.
  }, [attivo, impronta, reazioni, botId]);

  return { thinking: thinking && attivo, botId };
}
