"use client";

import { useEffect, useRef, useState } from "react";
import {
  OPENING_BID,
  SNIPE_WINDOW_SECONDS,
  canBid,
  canClaim,
  canCompete,
  canPass,
  canReact,
  canTakeDutch,
  canVote,
  currentItem,
  dutchOpening,
  dutchPriceAt,
  isDutchLot,
  lotSeconds,
  hasVoted,
  isMysteryLot,
  maxBid,
  minimumBid,
  liveReactions,
  playerById,
  rosterFull,
  slotsLeft,
  type GameAction,
  type ReactionEmoji,
} from "./game";
import type { GameState, Player, Tier } from "./types";

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

/* ------------------------------------------------------------------ */
/* Quanto vale il lotto, e quando conviene lasciarlo andare             */
/* ------------------------------------------------------------------ */

/**
 * Le cinque fasce lette in tre gradini.
 *
 * Al bot non serve la scala fine: gli serve sapere se questo lotto e' roba per
 * cui vale la pena litigare, roba normale, o riempitivo. Top da solo in cima
 * perche' e' l'unico che giustifica di sfondare la quota; Elite e Standard
 * stanno insieme perche' si giocano allo stesso modo -- si prendono se il
 * prezzo resta ragionevole; le due fasce Base si chiamano Base tutte e due
 * anche nell'interfaccia, e qui valgono uguale.
 */
export type LotAppeal = "top" | "middle" | "base";

export function lotAppeal(tier: Tier): LotAppeal {
  if (tier >= 5) return "top";
  if (tier >= 3) return "middle";
  return "base";
}

/**
 * Quanto spesso il bot molla un lotto Base che qualcuno ha gia' aperto.
 *
 * Tre volte su quattro, non sempre: un avversario che sui lotti Base si ritira
 * *sempre* diventa un orologio -- basta offrire un credito su ogni cosa verde
 * per prendersela, e chi gioca lo capisce al quarto lotto. La quarta volta che
 * resta a contendere e' quella che rende le altre tre una scelta.
 */
export const BASE_PASS_CHANCE = 0.75;

/* ------------------------------------------------------------------ */
/* Asta al ribasso                                                      */
/* ------------------------------------------------------------------ */

/**
 * A che punto della discesa il bot si decide, secondo quanto gli piace il lotto.
 *
 * E' una quota del prezzo di partenza, non una cifra: il prezzo di apertura
 * dipende dal budget della stanza, e una soglia fissa sarebbe avidissima su un
 * budget da 100 e impossibile su uno da 10.
 *
 * I numeri dicono come gioca: su un lotto Top si muove presto e paga caro,
 * perche' aspettare vuol dire vederselo portare via; su un riempitivo aspetta
 * quasi il fondo, e se qualcuno lo vuole prima se lo tenga. Fermarsi a 0.18 e
 * non a zero e' voluto -- un bot che aspetta sempre il pavimento e' un
 * orologio, e chi gioca imparerebbe in tre lotti che basta prendere un istante
 * prima di lui.
 */
export const DUTCH_TARGET_SHARE: Readonly<Record<LotAppeal, number>> = {
  top: 0.62,
  middle: 0.38,
  base: 0.18,
};

/**
 * Quante volte la propria quota per posto il bot e' disposto a spendere.
 *
 * La quota -- crediti diviso posti da riempire -- e' la spesa sostenibile, non
 * quella giusta: un draft si vince pagando troppo la roba buona e risparmiando
 * sul riempitivo, e un avversario che non sfora mai la sua parte gioca tutti i
 * lotti allo stesso modo.
 *
 * Era il guasto: con venti crediti e cinque posti la quota e' quattro, e il
 * tetto rigido riportava a quattro anche le soglie delle prime tre fasce.
 * Leggendario e mediocre finivano allo stesso prezzo, e il resto lo si vedeva
 * comprato sempre a due -- che e' esattamente cio' che si notava giocandoci.
 *
 * Sforare non e' un rischio: il tetto vero resta `maxBid`, che tiene da parte
 * un credito per ogni posto ancora vuoto. Il peggio che puo' capitare e' che il
 * bot spenda presto e poi si accontenti, che e' una scelta di gioco -- e la
 * quota si riduce da sola man mano che i crediti calano.
 */
export const DUTCH_SPEND_MULTIPLIER: Readonly<Record<LotAppeal, number>> = {
  top: 2,
  middle: 1.2,
  base: 0.55,
};

/**
 * Il tempo che il bot ci mette a premere quando il prezzo e' quello giusto.
 *
 * Piu' largo dello scatto in extremis dell'asta normale: al ribasso non c'e' un
 * cronometro che sta per scadere, c'e' una decisione da prendere, e una
 * risposta sempre uguale a un decimo di secondo si riconosce dopo due lotti.
 * Dentro questa finestra ci sta anche la sconfitta: se una persona preme prima,
 * il lotto e' suo e il bot resta a mani vuote -- come capiterebbe fra due
 * persone.
 */
export const DUTCH_REACTION_MS: readonly [number, number] = [800, 2200];

export function dutchReactionDelay(roll: number = Math.random()): number {
  const [min, max] = DUTCH_REACTION_MS;
  return Math.round(min + roll * (max - min));
}

/** Sopra questa quota di scarto il bot tira via qualche istante in piu'. */
export const DUTCH_JITTER = 0.08;

/**
 * Il prezzo a cui questo bot prenderebbe il lotto in corso.
 *
 * Torna null quando il lotto non lo interessa a nessun prezzo, o quando
 * nemmeno il pavimento gli e' accessibile.
 */
export function dutchTargetPrice(
  state: GameState,
  bot: Player,
  roll: number = Math.random(),
): number | null {
  const item = currentItem(state);
  /*
   * Della box non si sa cosa c'e' dentro: la si tratta come un lotto normale.
   * Sparare alto su una scatola chiusa sarebbe generosita' verso l'avversario,
   * aspettare il fondo vorrebbe dire non prenderne mai una.
   */
  const appeal: LotAppeal = isMysteryLot(state) ? "middle" : item ? lotAppeal(item.tier) : "middle";
  const apertura = dutchOpening(state.config.budget);
  const scarto = (roll * 2 - 1) * DUTCH_JITTER;
  const quota = Math.min(0.95, Math.max(0.05, DUTCH_TARGET_SHARE[appeal] + scarto));
  const voluto = Math.round(apertura * quota);
  /*
   * Quanto e' disposto a spendere su *questo* lotto: la quota per posto
   * moltiplicata secondo quanto gli interessa. Il tetto vero e invalicabile
   * resta `maxBid`, che e' la riserva del motore -- quella non si tocca.
   */
  const disposto = Math.round(
    affordableCeiling(state, bot) * DUTCH_SPEND_MULTIPLIER[appeal],
  );
  const tetto = Math.min(maxBid(state, bot), Math.max(OPENING_BID, disposto));
  if (tetto < OPENING_BID) return null;
  return Math.max(OPENING_BID, Math.min(voluto, tetto));
}

/**
 * Fra quanti millisecondi il prezzo scendera' alla cifra voluta.
 *
 * Il bot non sta a guardare il prezzo quattro volte al secondo: sa quando la
 * discesa arrivera' dove gli serve e si sveglia in quel momento. Il tempo che
 * resta e' il tetto -- oltre la scadenza il lotto e' gia' chiuso.
 */
export function dutchWaitFor(state: GameState, target: number, now: number): number {
  const durata = lotSeconds(state) * 1000;
  const apertura = dutchOpening(state.config.budget);
  const corsa = apertura - OPENING_BID;
  if (corsa <= 0 || durata <= 0) return 0;
  const inizio = state.deadline - durata;
  // Istante in cui il prezzo tocca il valore voluto, secondo la stessa retta
  // che lo fa scendere in interfaccia.
  const quando = inizio + ((apertura - target) / corsa) * durata;
  /*
   * L'ultimo istante utile tiene conto della pausa che il motore aggiunge a
   * ogni attesa: senza questo margine un bot che punta al pavimento si
   * sveglierebbe mezzo secondo dopo la chiusura del lotto e non prenderebbe
   * mai niente al prezzo piu' basso.
   */
  const ultimo = state.deadline - now - GRACE_AFTER_CHANGE_MS - 100;
  return Math.max(0, Math.min(quando - now, Math.max(0, ultimo)));
}

/**
 * Sotto quale quota per posto i crediti si considerano stretti.
 *
 * Non e' una cifra assoluta -- due crediti sono tanti sull'ultimo posto e
 * niente quando ne restano quattro da coprire -- ma la quota per posto, cioe'
 * quanto il bot puo' mettere in media su ognuno di quelli che gli mancano.
 * Sotto i due, litigare su un lotto Base vuol dire spendere per uno il budget
 * che serviva a coprirne due.
 */
export const TIGHT_CEILING = 2;

export function isTightOnCredits(state: GameState, bot: Player): boolean {
  return affordableCeiling(state, bot) <= TIGHT_CEILING;
}

/**
 * L'offerta sfonda la riserva del regolamento?
 *
 * La regola del gioco e' che si tiene un credito per ogni posto che
 * resterebbe vuoto: `maxBid` la calcola, e sopra quel numero il riduttore
 * rifiuterebbe l'offerta comunque. Qui serve a nominarla: quando e' lei a
 * fermare il bot, il bot non sta scegliendo di passare, e' costretto.
 */
export function violatesReserve(state: GameState, bot: Player, amount: number): boolean {
  return amount > maxBid(state, bot);
}

/**
 * I lotti che restano bastano appena a riempire la lista?
 *
 * E' la valvola che tiene in piedi tutto il resto. Un bot che fa lo
 * schizzinoso sui lotti Base e' un avversario migliore solo finche' il mazzo e'
 * lungo: sul fondo, dove le occasioni sono contate, la stessa prudenza
 * diventerebbe una lista a meta' e dei crediti che non servono piu' a niente.
 * Da qui in poi si prende quello che passa.
 *
 * Il conto tiene dentro chi altro deve ancora servirsi: i lotti non sono tutti
 * per il bot, e in due se ne aggiudica sui due che escono all'incirca uno.
 */
export function lotsRunningShort(state: GameState, bot: Player): boolean {
  const rimasti = (state.queue?.length ?? 0) + (state.currentItemId ? 1 : 0);
  const daServire = Math.max(1, state.players.filter((p) => !rosterFull(state, p)).length);
  return rimasti <= slotsLeft(state, bot) * daServire;
}

/**
 * Questo lotto si lascia perdere.
 *
 * Il bot non passava mai. Non per una scelta: semplicemente non c'era nessuna
 * strada che portasse li' se non "non me lo posso permettere", e siccome la
 * soglia per posto e' quasi sempre piu' alta del prezzo di un lotto Base, si
 * ritrovava a comprare riempitivo a due e tre crediti fino a restare senza
 * niente per i lotti che contano. Da fuori sembrava avidita' cieca, ed era.
 *
 * L'ordine dei controlli e' la regola vera, piu' delle probabilita':
 *
 * 1. **Solo i lotti Base si lasciano.** Su Top ed Elite si combatte: e' li'
 *    che si vince, ed e' li' che il budget ha senso di finire.
 * 2. **Un posto per un credito non si rifiuta mai.** Se nessuno ha ancora
 *    aperto, il lotto costa il minimo: riempire uno slot a quel prezzo e' il
 *    miglior affare del tabellone, e rinunciarci vorrebbe dire finire la
 *    partita con la lista corta e i crediti in mano -- che e' esattamente il
 *    modo di perdere che questa funzione dovrebbe evitare.
 * 3. **Sul fondo del mazzo non si sceglie piu'** (vedi `lotsRunningShort`).
 * 4. **Coi crediti stretti si passa sempre**, senza tirare a sorte: qui non e'
 *    piu' una preferenza, e' aritmetica.
 * 5. Altrimenti si passa quasi sempre, ma non sempre.
 */
export function shouldSkipLot(
  state: GameState,
  bot: Player,
  options: { roll?: number } = {},
): boolean {
  if (isMysteryLot(state)) return false;
  const item = currentItem(state);
  if (!item || lotAppeal(item.tier) !== "base") return false;

  if (minimumBid(state) <= OPENING_BID) return false;
  if (lotsRunningShort(state, bot)) return false;
  if (isTightOnCredits(state, bot)) return true;

  return (options.roll ?? Math.random()) < BASE_PASS_CHANCE;
}

export type BotMove =
  | { kind: "bid"; amount: number; delay: number }
  | { kind: "claim"; delay: number }
  | { kind: "take_dutch"; delay: number }
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
  options: { now?: number; share?: number; roll?: number } = {},
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

  /*
   * Asta al ribasso: si aspetta che il prezzo scenda a quello che vale.
   *
   * Il ritardo non e' un tempo di riflessione ma il momento esatto in cui la
   * discesa arriva alla cifra voluta, e quando l'attesa scade si ricontrolla
   * tutto: se nel frattempo il lotto se l'e' preso qualcun altro, quel
   * controllo trova la fase gia' cambiata e il bot non fa niente.
   *
   * Vale prima della Mystery Box perche' col ribasso acceso scende anche il
   * prezzo delle box, e trattarle come lotti a prezzo fisso vorrebbe dire
   * pagarle sempre il massimo.
   */
  if (isDutchLot(state)) {
    if (rosterFull(state, bot)) return null;
    const target = dutchTargetPrice(state, bot);
    if (target === null) return null;
    const attesa = dutchWaitFor(state, target, now);
    /*
     * Il prezzo e' gia' sceso dove serve: si prende, con lo scatto di chi
     * decide sul momento e non con la calma di chi sta ancora valutando.
     */
    if (attesa <= 0) {
      if (!canTakeDutch(state, botId, now)) return null;
      return { kind: "take_dutch", delay: dutchReactionDelay() };
    }
    /*
     * Ci si sveglia quando il prezzo sara' quello voluto.
     *
     * Il controllo e' solo sulla riserva del motore: la quota per posto qui non
     * c'entra piu' -- e' proprio quella che il bot ha deciso di sforare su un
     * lotto che gli interessa. Confrontarci la soglia, come si faceva prima,
     * annullava ogni volta la decisione appena presa e il bot restava fermo.
     */
    if (dutchPriceAt(state, now + attesa) > maxBid(state, bot)) return null;
    return { kind: "take_dutch", delay: attesa };
  }

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

  /*
   * Il guardrail del regolamento, prima di qualunque ragionamento.
   *
   * Un credito per ogni posto che resterebbe vuoto: se il minimo per restare
   * in gara sfonda la riserva, il bot non sta scegliendo di lasciar perdere,
   * e' costretto -- e nessun lotto, per quanto pregiato, vale la lista a meta'.
   */
  if (violatesReserve(state, bot, minimo)) {
    if (canPass(state, botId)) return { kind: "pass", delay: getBotDelay("pass") };
    return null;
  }

  if (minimo > tetto) {
    /*
     * Sotto la riserva, ma sopra la quota che si e' dato per questo lotto.
     * Restano due modi di uscirne, e non sono equivalenti: passare vuol dire
     * lasciare il lotto alla persona, che se e' rimasta sola se lo prende al
     * prezzo di partenza. Se pero' i flop non sono finiti e non siamo agli
     * ultimi lotti, passare e' anche il modo di mandarlo negli scarti -- il
     * lotto non lo prende nessuno e i crediti dell'avversario restano fermi.
     * E' la stessa mossa, ma qui e' una scelta, non una resa.
     */
    if (canPass(state, botId)) return { kind: "pass", delay: getBotDelay("pass") };
    return null;
  }

  /*
   * E qui la scelta vera: se lo puo' pagare ma non gli conviene, lo lascia.
   * E' l'unico punto in cui il bot rinuncia a qualcosa che potrebbe prendersi.
   */
  if (shouldSkipLot(state, bot, { roll: options.roll }) && canPass(state, botId)) {
    return { kind: "pass", delay: getBotDelay("pass") };
  }

  /*
   * Quanto offrire.
   *
   * Sopra il minimo si va solo per scavalcare qualcuno che puo' rispondere. Se
   * il piatto e' vuoto -- nessuno ha aperto, o l'avversario ha gia' passato e
   * non e' rimasto nessun altro in gara -- il lotto e' gia' del bot al prezzo
   * di partenza, e offrire due invece di uno e' un credito buttato per niente.
   * Rilanciava a due una volta su due anche cosi': su una partita intera sono
   * i crediti di un lotto Top regalati al nulla.
   */
  const contesa = state.players.some((p) => p.id !== botId && canCompete(state, p));
  const rilancioUtile = Boolean(state.highBidderId) && contesa;
  // Contro qualcuno: uno o due, mai di piu'. I salti grossi bruciano il budget
  // su un lotto solo e lasciano la lista a meta'.
  const passo = rilancioUtile ? (Math.random() < 0.5 ? 1 : 2) : 1;
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
      // "Stai spendendo troppo". Se e' vero -- sta vincendo -- se ne vanta;
      // se e' a secco se la prende; altrimenti rilancia la posta.
      if (alVerde) return "😭";
      return inTesta ? "🤌" : "🔥";
    case "🔥":
      // Entusiasmo per il lotto: si sta al gioco, e si rilancia la posta.
      return Math.random() < 0.5 ? "💸" : "🤡";
    case "😭":
      return "🤌";
    case "🤌":
      /*
       * Il gesto: "e allora?". E' la faccina che si manda per prima -- e per un
       * po' era anche l'unica a cui il bot non rispondeva, quindi chi provava a
       * provocarlo con quella si convinceva che la funzione non esistesse.
       */
      if (alVerde) return "😭";
      return inTesta ? "🔥" : "🤡";
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
    case "take_dutch":
      return { type: "take_dutch", playerId: botId, now };
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
