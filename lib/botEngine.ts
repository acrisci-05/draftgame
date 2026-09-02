"use client";

import { useEffect, useRef } from "react";
import {
  canBid,
  canClaim,
  canPass,
  canVote,
  hasVoted,
  maxBid,
  minimumBid,
  playerById,
  slotsLeft,
  type GameAction,
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

export type BotActionKind = "bid" | "pass" | "hesitate";

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
export function decideBotMove(state: GameState, botId: string = BOT_PLAYER_ID): BotMove | null {
  const bot = playerById(state, botId);
  if (!bot) return null;

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
  const tetto = Math.min(maxBid(state, bot), soglia);

  /*
   * Sopra la soglia sostenibile si rinuncia, e si rinuncia in fretta: tenere
   * la persona in attesa per poi passare e' il modo piu' sicuro di rendere
   * lenta una partita in cui non succede niente.
   */
  if (minimo > tetto) {
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

  /*
   * Oltre i due quinti di quello che gli resta il bot ci pensa su. E' la mossa
   * che si legge meglio da fuori: l'attesa lunga dice "questo lotto gli
   * interessa e gli costa", ed e' l'unico momento in cui il ritmo dell'asta
   * cambia da solo.
   */
  const impegnativo = amount > bot.budget * HESITATION_SHARE;
  return { kind: "bid", amount, delay: getBotDelay(impegnativo ? "hesitate" : "bid") };
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
 * Attacca il bot a una stanza in corso.
 *
 * Si sveglia a ogni cambio di situazione -- lotto nuovo, rilancio ricevuto,
 * qualcuno che passa -- decide cosa fare e lo fa dopo il suo ritardo. Se nel
 * frattempo la situazione cambia, l'attesa viene buttata e si ricomincia: cosi'
 * il bot non risponde mai a un'asta che non esiste piu'.
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
}) {
  // Le due funzioni arrivano nuove a ogni render: tenerle in un riferimento
  // evita che l'attesa venga annullata e rifatta di continuo, che vorrebbe dire
  // un bot che non arriva mai a muoversi.
  const dispatchRef = useRef(dispatch);
  const nowRef = useRef(now);
  useEffect(() => {
    dispatchRef.current = dispatch;
    nowRef.current = now;
  }, [dispatch, now]);

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

  useEffect(() => {
    if (!attivo || !state) return;

    const move = decideBotMove(state, botId);
    if (!move) return;

    const timer = window.setTimeout(() => {
      dispatchRef.current(toAction(move, botId, nowRef.current()));
    }, move.delay);

    return () => window.clearTimeout(timer);
    // Si dipende dall'impronta, non dall'oggetto stato: vedi sopra.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attivo, impronta, botId]);
}
