import { firstFreeAvatar, isAvatarId } from "./avatars";
import { firstFreeColor, isPlayerColor } from "./colors";
import { clamp } from "./utils";
import type {
  AuctionResult,
  Reaction,
  CatalogItem,
  Category,
  FeedEntry,
  FeedKind,
  GameState,
  Player,
  RoomConfig,
  RoomMode,
} from "./types";

/**
 * Secondi a disposizione su ogni lotto.
 *
 * Vale sia quando il lotto viene estratto sia dopo ogni rilancio: un'offerta
 * rimette il cronometro al massimo, non a una frazione. Una sola costante per
 * tutte e due le cose, cosi' non possono piu' andare in disaccordo.
 */
export const LOT_TIMER_DURATION = 15;

/** Le durate che l'host puo' scegliere in lobby. */
export const LOT_TIMER_CHOICES = [10, 15, 20] as const;

/** Quanto dura un lotto in questa stanza. Le partite vecchie non lo dicono. */
export function lotSeconds(state: GameState): number {
  const chosen = state.config.lotSeconds;
  return typeof chosen === "number" && chosen > 0 ? chosen : LOT_TIMER_DURATION;
}
/** Durata della schermata di aggiudicazione prima del prossimo lotto. */
export const RESULT_SECONDS = 4;
export const MIN_PLAYERS = 2;
/**
 * Quanti si sta al massimo in una stanza.
 *
 * Cinque, non otto, per una ragione aritmetica: le categorie contengono trenta
 * elementi, e cinque giocatori con cinque slot a testa ne consumano venticinque,
 * lasciandone cinque per gli scarti. A otto giocatori con cinque slot ne
 * servirebbero quaranta e la partita finirebbe con le liste a meta'.
 */
export const MAX_PLAYERS = 5;
export const MIN_SLOTS = 3;
export const MAX_SLOTS = 10;
export const MIN_BUDGET = 5;
export const MAX_BUDGET = 500;
export const OPENING_BID = 1;
/** Un rilancio dentro questa finestra è considerato "in extremis". */
export const SNIPE_WINDOW_SECONDS = 3;
export const RAISE_STEPS = [1, 2, 5] as const;
export const BUDGET_PRESETS = [10, 20, 50, 100];
/** Ogni quanti lotti compare una Mystery Box, quando è attiva. */
export const MYSTERY_EVERY = 5;
export const FEED_LIMIT = 24;

/* ------------------------------------------------------------------ */
/* Reazioni                                                            */
/* ------------------------------------------------------------------ */

/**
 * Le cinque faccine, e sono cinque apposta.
 *
 * Bastano a dire tutto quello che si dice a un tavolo d'asta -- quanto stai
 * spendendo, quanto sei ridicolo, quanto e' bello questo lotto, quanto ti
 * dispiace, e quel gesto che non ha bisogno di traduzione -- e sono poche
 * abbastanza da scegliersi senza guardare, con il pollice, mentre il timer
 * corre.
 */
export const REACTIONS = ["💸", "🤡", "🔥", "😭", "🤌"] as const;

export type ReactionEmoji = (typeof REACTIONS)[number];

export function isReaction(value: string): value is ReactionEmoji {
  return (REACTIONS as readonly string[]).includes(value);
}

/**
 * Quanto resta a schermo una reazione. E' anche la sua durata nello stato:
 * finita l'animazione non c'e' motivo di continuare a portarsela dietro.
 */
export const REACTION_TTL_MS = 2200;

/**
 * Quanto si aspetta fra una reazione e l'altra, per persona.
 *
 * E' il freno che rende la cosa simpatica invece che fastidiosa. Senza, la
 * prima persona che scopre il pulsante ci tamburella sopra e la partita diventa
 * illeggibile: il freno sta nel riduttore e non nel pulsante, perche' nel
 * pulsante basterebbe un tocco piu' veloce dell'animazione per aggirarlo.
 */
export const REACTION_COOLDOWN_MS = 2500;

/** Quante ne restano a schermo insieme, comunque vada. */
const REACTION_LIMIT = 8;

/** Le reazioni ancora vive a questo istante. */
export function liveReactions(state: GameState, now: number): Reaction[] {
  return (state.reactions ?? []).filter((r) => now - r.at < REACTION_TTL_MS);
}

/** Se questo giocatore puo' mandarne una adesso, o deve ancora aspettare. */
export function canReact(state: GameState, playerId: string, now: number): boolean {
  if (state.phase !== "auction" && state.phase !== "result") return false;
  if (!playerById(state, playerId)) return false;
  const ultima = (state.reactions ?? [])
    .filter((r) => r.playerId === playerId)
    .reduce((piuRecente, r) => Math.max(piuRecente, r.at), 0);
  return now - ultima >= REACTION_COOLDOWN_MS;
}

/** Gli avatar sono icone SVG: qui circola solo il loro identificativo. */
export { AVATAR_IDS, DEFAULT_AVATAR, firstFreeAvatar, randomAvatar, resolveAvatar } from "./avatars";
export { PLAYER_COLORS, DEFAULT_COLOR, colorLook, firstFreeColor } from "./colors";

/** Colori già usati nella stanza: gli altri giocatori non possono prenderli. */
export function takenColors(state: GameState, exceptPlayerId?: string): string[] {
  return state.players
    .filter((player) => player.id !== exceptPlayerId)
    .map((player) => player.color ?? "");
}

/** Avatar già usati nella stanza: gli altri giocatori non possono prenderli. */
export function takenAvatars(state: GameState, exceptPlayerId?: string): string[] {
  return state.players
    .filter((player) => player.id !== exceptPlayerId)
    .map((player) => player.emoji);
}

export const DEFAULT_CONFIG: RoomConfig = {
  budget: 20,
  currency: "EUR",
  // Tre e non due: in due il voto finisce sempre alla pari, perche' nessuno
  // puo' votare se stesso, e a decidere restano solo i crediti. Da tre in su
  // il voto conta davvero.
  maxPlayers: 3,
  slots: 5,
  blindDraft: false,
  mysteryBox: false,
  dutchDraft: false,
  allowDiscards: true,
  lotSeconds: LOT_TIMER_DURATION,
};

/** Costo fisso della Mystery Box, proporzionato al budget di partenza. */
export function mysteryPrice(budget: number): number {
  return Math.max(2, Math.round(budget * 0.15));
}

/* ------------------------------------------------------------------ */
/* Asta al ribasso (Dutch Draft)                                       */
/* ------------------------------------------------------------------ */

/**
 * Il prezzo di partenza, come quota del budget iniziale.
 *
 * Non e' un numero fisso, per la stessa ragione per cui non lo e' quello della
 * Mystery Box: il budget lo sceglie chi ospita, e un prezzo fisso sarebbe
 * un'inezia su un budget da 100 e irraggiungibile su uno da 10.
 *
 * Sessanta per cento perche' deve essere alto ma pagabile fin dal primo
 * istante: se partisse sopra il tetto di spesa, i primi secondi di ogni lotto
 * sarebbero tempo morto col pulsante spento per tutti, e la modalita'
 * sembrerebbe rotta invece che tesa.
 */
export const DUTCH_OPENING_SHARE = 0.6;

/**
 * Il pavimento del prezzo: un credito, lo stesso da cui parte l'asta normale.
 *
 * Zero no: un lotto gratis non toglierebbe niente a nessuno, e la riserva --
 * un credito per ogni slot ancora vuoto -- esiste proprio perche' ogni
 * elemento di una rosa sia costato qualcosa.
 */
export const DUTCH_FLOOR = OPENING_BID;

/** Da quanto parte il prezzo in questa stanza. */
export function dutchOpening(budget: number): number {
  return Math.max(DUTCH_FLOOR + 1, Math.round(budget * DUTCH_OPENING_SHARE));
}

/** Se il lotto in corso si gioca al ribasso. */
export function isDutchLot(state: GameState): boolean {
  return Boolean(state.config.dutchDraft) && state.phase === "auction";
}

/**
 * Quando e' cominciato il lotto al ribasso.
 *
 * Si ricava dalla scadenza invece di tenere un campo in piu': nell'asta al
 * ribasso non ci sono turni, quindi il cronometro parte una volta sola e non
 * viene piu' rimesso a posto. Un timestamp separato sarebbe un secondo valore
 * da tenere allineato su tutti i dispositivi, e due valori che devono dire la
 * stessa cosa prima o poi si contraddicono.
 */
export function dutchStartedAt(state: GameState): number {
  return state.deadline - lotSeconds(state) * 1000;
}

/**
 * Il prezzo in un dato istante.
 *
 * Discesa lineare dal prezzo di partenza al pavimento nell'arco del lotto,
 * calcolata sul tempo trascorso e non contando i secondi a colpi di timer: ogni
 * dispositivo che conosce la scadenza arriva allo stesso numero, e non c'e'
 * niente che possa accumulare ritardo.
 */
export function dutchPriceAt(state: GameState, now: number): number {
  const durata = lotSeconds(state) * 1000;
  if (durata <= 0) return DUTCH_FLOOR;
  const apertura = dutchOpening(state.config.budget);
  const trascorso = clamp(now - dutchStartedAt(state), 0, durata);
  const quota = trascorso / durata;
  const prezzo = Math.round(apertura - quota * (apertura - DUTCH_FLOOR));
  return clamp(prezzo, DUTCH_FLOOR, apertura);
}

/**
 * Se questo giocatore puo' aggiudicarsi il lotto adesso.
 *
 * Niente controllo sul turno, ed e' il punto della modalita': il lotto e'
 * aperto a tutti insieme e vince chi si decide per primo.
 */
export function canTakeDutch(state: GameState, playerId: string, now: number): boolean {
  if (state.phase !== "auction" || !isDutchLot(state)) return false;
  const player = playerById(state, playerId);
  if (!player) return false;
  if (state.passed.includes(playerId)) return false;
  if (rosterFull(state, player)) return false;
  if (isMysteryLot(state) ? false : !state.currentItemId) return false;
  if (isMysteryLot(state) && state.queue.length === 0) return false;
  return maxBid(state, player) >= dutchPriceAt(state, now);
}

export function shuffle<T>(input: T[]): T[] {
  const out = [...input];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

interface CreateGameArgs {
  code: string;
  mode: RoomMode;
  hostId: string;
  category: Category;
  config?: Partial<RoomConfig>;
  /** true per un uno contro uno contro il Pick-asso Bot. */
  practice?: boolean;
}

export function createGame({
  code,
  mode,
  hostId,
  category,
  config,
  practice,
}: CreateGameArgs): GameState {
  const merged: RoomConfig = { ...DEFAULT_CONFIG, ...config };
  return {
    code,
    mode,
    hostId,
    phase: "lobby",
    config: merged,
    category: {
      id: category.id,
      name: category.name,
      nameEn: category.nameEn,
      emoji: category.emoji,
      covers: category.covers,
    },
    items: category.items,
    queue: [],
    currentItemId: null,
    lotKind: "item",
    lotPrice: 0,
    currentBid: OPENING_BID,
    highBidderId: null,
    passed: [],
    deadline: 0,
    players: [],
    discards: [],
    lastResult: null,
    history: [],
    feed: [],
    lotNumber: 0,
    sniped: false,
    // Si scrive solo quando e' vero: le partite normali restano identiche a
    // com'erano, senza un campo in piu' che viaggia a ogni aggiornamento.
    ...(practice ? { isPractice: true } : {}),
    updatedAt: Date.now(),
  };
}

/* ------------------------------------------------------------------ */
/* Selettori                                                          */
/* ------------------------------------------------------------------ */

/**
 * Il margine di lotti oltre quelli strettamente necessari.
 *
 * Senza, una categoria che ha esattamente i lotti per riempire le liste
 * costringerebbe ogni giocatore a prendersi tutto quello che passa: nessuno
 * potrebbe permettersi di lasciar perdere un elemento che non gli piace, e
 * l'asta smetterebbe di essere una scelta. Cinque bastano a dare respiro e
 * alimentano gli scarti.
 */
export const LOT_MARGIN = 5;

/** Sotto questa soglia una lista e' troppo corta per giocarci. */
export const MIN_CATEGORY_ITEMS = 20;

/**
 * Se una partita cosi' composta si puo' cominciare.
 *
 * E' la regola che evita la partita rovinata a meta': senza abbastanza lotti
 * il gioco parte lo stesso e finisce con tutte le liste incomplete, e chi
 * gioca non ha modo di capire cosa sia andato storto.
 */
export function canStartMatch(
  numPlayers: number,
  categoryTotalItems: number,
  targetRosterSlots: number,
): boolean {
  return categoryTotalItems >= numPlayers * targetRosterSlots + LOT_MARGIN;
}

/** Quanti lotti servono per questa combinazione, margine compreso. */
export function lotsNeeded(players: number, slots: number): number {
  return players * slots + LOT_MARGIN;
}

/**
 * Una lista a caso fra quelle con cui si puo' davvero giocare.
 *
 * Pesca dall'elenco che le viene passato -- quello che la schermata sta gia'
 * mostrando -- e non da una copia scritta qui: aggiungere una categoria al
 * sorgente, o pubblicarne una dal pannello, la rende sorteggiabile senza
 * toccare questo file.
 *
 * Le liste troppo corte restano fuori: sono spente anche nell'elenco, e un dado
 * che ogni tanto cade su un pulsante disattivato sarebbe solo un dado rotto.
 * Con `players` e `slots` si stringe ancora, alla misura di quella partita.
 * Torna null se non ne resta nessuna.
 */
export function randomPlayableCategory(
  list: readonly Category[],
  fit?: { players: number; slots: number },
): Category | null {
  const playable = list.filter((category) => {
    if (category.items.length < MIN_CATEGORY_ITEMS) return false;
    if (!fit) return true;
    return canStartMatch(fit.players, category.items.length, fit.slots);
  });
  if (playable.length === 0) return null;
  return playable[Math.floor(Math.random() * playable.length)];
}

/**
 * Quanti si puo' essere al massimo con questa lista e questi slot.
 *
 * Serve a spegnere le scelte impossibili invece di lasciarle prendere e poi
 * rifiutare: e' piu' onesto dire prima quanti ci si sta.
 */
export function maxPlayersFor(categoryTotalItems: number, slots: number): number {
  if (slots <= 0) return MAX_PLAYERS;
  const capienza = Math.floor((categoryTotalItems - LOT_MARGIN) / slots);
  return Math.max(0, Math.min(MAX_PLAYERS, capienza));
}

/** Se la categoria basta per come e' impostata la stanza. */
export function categoryFits(state: GameState): boolean {
  return canStartMatch(state.config.maxPlayers, state.items.length, state.config.slots);
}

export function playerById(state: GameState, id: string | null): Player | undefined {
  if (!id) return undefined;
  return state.players.find((p) => p.id === id);
}

export function itemById(state: GameState, id: string | null): CatalogItem | undefined {
  if (!id) return undefined;
  return state.items.find((i) => i.id === id);
}

export function currentItem(state: GameState): CatalogItem | undefined {
  return itemById(state, state.currentItemId);
}

export function isMysteryLot(state: GameState): boolean {
  return state.lotKind === "mystery";
}

export function rosterFull(state: GameState, player: Player): boolean {
  return player.roster.length >= state.config.slots;
}

/** Offerta minima accettabile in questo istante. */
export function minimumBid(state: GameState): number {
  /*
   * Al ribasso conta il pavimento, non il prezzo esposto adesso.
   *
   * Serve a chi legge "quanti sono ancora in corsa": il prezzo scende, e chi
   * in questo istante non arriva alla cifra a schermo potra' comunque
   * prendersi il lotto fra tre secondi. Misurarlo sul prezzo corrente lo
   * darebbe per eliminato mentre e' ancora in partita.
   */
  if (isDutchLot(state)) return DUTCH_FLOOR;
  if (isMysteryLot(state)) return state.lotPrice;
  return state.highBidderId ? state.currentBid + 1 : OPENING_BID;
}

/** Slot ancora da riempire per un giocatore. */
export function slotsLeft(state: GameState, player: Player): number {
  return Math.max(0, state.config.slots - player.roster.length);
}

/**
 * Offerta massima consentita: si tiene sempre da parte un credito per ogni slot
 * che resterebbe vuoto, così nessuno può arrivare a zero con la lista incompleta.
 */
export function maxBid(state: GameState, player: Player): number {
  const reserve = Math.max(0, slotsLeft(state, player) - 1);
  return Math.max(0, player.budget - reserve);
}

/** Le tre opzioni dei controlli di rilancio (+1, +2, +5). */
export function bidOptions(state: GameState): { step: number; amount: number }[] {
  return RAISE_STEPS.map((step) => ({
    step,
    amount: state.highBidderId ? state.currentBid + step : step,
  }));
}

/** Un giocatore è in corsa se ha slot liberi, non ha passato e copre l'offerta minima. */
export function canCompete(state: GameState, player: Player): boolean {
  if (player.id === state.highBidderId) return true;
  if (state.passed.includes(player.id)) return false;
  if (rosterFull(state, player)) return false;
  return maxBid(state, player) >= minimumBid(state);
}

/** Offerta "tutto quello che posso" per il pulsante rapido, null se non praticabile. */
export function maxBidOption(state: GameState, player: Player): number | null {
  const cap = maxBid(state, player);
  const min = minimumBid(state);
  return cap >= min ? cap : null;
}

/** Giocatori che devono ancora completare la lista. */
export function pendingPlayers(state: GameState): Player[] {
  return state.players.filter((p) => !rosterFull(state, p));
}

/**
 * Quanti flop si concede una stanza, secondo quanti sono al tavolo.
 *
 * Era un numero solo -- cinque, chiunque ci fosse -- e trattava male i tavoli
 * grandi: in due si consumano dieci lotti su trenta e cinque flop sono una
 * riserva larga, in cinque se ne consumano venticinque e la riserva finiva al
 * quinto. Da li' in poi i lotti che non voleva nessuno venivano assegnati
 * d'ufficio e dal tavolo sembrava un guasto -- la segnalazione arrivata dalle
 * stanze a tre, quattro e cinque era questa.
 *
 * I numeri non sono una formula: sono scelti tavolo per tavolo. Crescono da due
 * a tre, dove i lotti avanzano e si puo' essere schizzinosi, e si stringono da
 * quattro in su, dove ne avanzano pochi e ogni flop tolto e' un lotto che
 * qualcuno dovra' prendersi d'ufficio piu' avanti.
 */
export const FLOP_BUDGET: Readonly<Record<number, number>> = { 2: 6, 3: 9, 4: 8, 5: 5 };

/** Il tetto di flop per una stanza di questa misura. */
export function flopBudget(players: number): number {
  return FLOP_BUDGET[players] ?? 0;
}

/**
 * Quanti flop restano da qui alla fine.
 *
 * Due freni, e vale il piu' stretto: il tetto della stanza qui sopra, e la
 * capienza vera della lista -- non si puo' buttare un lotto se quelli che
 * restano servono tutti a riempire le rose. Il secondo entra in gioco solo con
 * impostazioni fuori dall'ordinario (dieci slot a testa su una lista da
 * trenta), ma senza si prometterebbe un flop che il mazzo non puo' pagare.
 */
export function discardsLeft(state: GameState): number {
  const restanti = flopBudget(state.players.length) - state.discards.length;
  const daRiempire = state.players.reduce((total, p) => total + slotsLeft(state, p), 0);
  // Il lotto in corso e' gia' uscito dalla coda: va contato a parte.
  const capienza = state.queue.length + (state.currentItemId ? 1 : 0) - daRiempire;
  return Math.max(0, Math.min(restanti, capienza));
}

/** Se il lotto in corso, quando non lo vuole nessuno, puo' finire negli scarti. */
export function canDiscardLot(state: GameState): boolean {
  return state.config.allowDiscards && discardsLeft(state) > 0;
}

export function activePlayers(state: GameState): Player[] {
  return state.players.filter((p) => canCompete(state, p));
}

/** L'identificativo del Pick-asso Bot, ripetuto qui per non creare un giro d'import. */
const BOT_ID = "bot-pickasso";

/**
 * Se tocca a questo giocatore.
 *
 * Le partite cominciate prima dei turni non portano il campo: li' vale la
 * vecchia regola, tutti possono agire sempre. Serve perche' un aggiornamento
 * pubblicato a meta' serata non deve bloccare una stanza gia' aperta.
 */
export function isMyTurn(state: GameState, playerId: string): boolean {
  if (state.turnId === undefined || state.turnId === null) return true;
  return state.turnId === playerId;
}

export function canBid(state: GameState, playerId: string, amount: number): boolean {
  if (state.phase !== "auction" || isMysteryLot(state)) return false;
  // Al ribasso non si rilancia: c'e' un prezzo solo e o lo si prende o no.
  if (isDutchLot(state)) return false;
  if (!isMyTurn(state, playerId)) return false;
  const player = playerById(state, playerId);
  if (!player) return false;
  if (state.passed.includes(playerId)) return false;
  if (state.highBidderId === playerId) return false;
  if (rosterFull(state, player)) return false;
  if (!Number.isInteger(amount) || amount < minimumBid(state)) return false;
  return amount <= maxBid(state, player);
}

export function canClaim(state: GameState, playerId: string): boolean {
  if (state.phase !== "auction" || !isMysteryLot(state)) return false;
  // La box al ribasso si prende con take_dutch: il prezzo dipende dall'istante.
  if (isDutchLot(state)) return false;
  if (!isMyTurn(state, playerId)) return false;
  const player = playerById(state, playerId);
  if (!player) return false;
  if (state.passed.includes(playerId)) return false;
  if (rosterFull(state, player)) return false;
  return maxBid(state, player) >= state.lotPrice;
}

export function canPass(state: GameState, playerId: string): boolean {
  if (state.phase !== "auction") return false;
  /*
   * Al ribasso non c'e' niente da passare: non essendoci turni, rinunciare
   * vorrebbe dire solo togliersi la possibilita' di ripensarci mentre il
   * prezzo scende. Chi non vuole il lotto sta fermo e basta.
   */
  if (isDutchLot(state)) return false;
  if (!isMyTurn(state, playerId)) return false;
  const player = playerById(state, playerId);
  if (!player) return false;
  if (state.highBidderId === playerId) return false;
  if (rosterFull(state, player)) return false;
  return !state.passed.includes(playerId);
}

/**
 * Chi prende il posto di chi ospita la stanza, se il suo dispositivo sparisce.
 *
 * Si sceglie il primo giocatore ancora presente **nell'ordine della lista**:
 * quell'ordine e' identico su tutti i dispositivi, quindi il successore lo
 * calcolano tutti allo stesso modo e uno solo si riconosce come tale. Torna
 * null se l'host c'e' ancora o se non e' rimasto nessun altro.
 */
export function nextHost(state: GameState, present: readonly string[]): string | null {
  if (present.includes(state.hostId)) return null;
  const heir = state.players.find(
    (player) => player.id !== state.hostId && present.includes(player.id),
  );
  return heir?.id ?? null;
}

/**
 * Chi apre le danze su questo lotto.
 *
 * Il primo lotto lo apre chi ospita la stanza; a ogni lotto il diritto di
 * aprire scorre al giocatore dopo, cosi' su una partita intera tocca a tutti
 * lo stesso numero di volte. Aprire conta: chi parla per primo decide se il
 * lotto vale la pena, chi parla per ultimo sa gia' cosa hanno fatto gli altri.
 *
 * Contro il bot non si ruota: apre sempre la persona. Un avversario che apre a
 * lotti alterni vorrebbe dire vedersi portare via meta' dei lotti prima ancora
 * di aver potuto dire qualcosa.
 */
export function openingTurn(state: GameState): string | null {
  const quanti = state.players.length;
  if (quanti === 0) return null;

  if (state.isPractice) {
    const persona = state.players.find((p) => p.id !== BOT_ID);
    if (persona && canCompete(state, persona)) return persona.id;
  }

  const hostIndex = Math.max(
    0,
    state.players.findIndex((p) => p.id === state.hostId),
  );
  const inizio = (hostIndex + Math.max(0, state.lotNumber - 1)) % quanti;
  for (let passo = 0; passo < quanti; passo += 1) {
    const candidato = state.players[(inizio + passo) % quanti];
    if (canCompete(state, candidato)) return candidato.id;
  }
  return null;
}

/**
 * A chi passa la mano dopo che ha agito il giocatore indicato.
 *
 * Si salta chi non e' piu' in corsa e si salta chi detiene l'offerta piu' alta:
 * nessuno rilancia contro se stesso. Torna null quando non resta nessuno, e a
 * quel punto il lotto e' deciso.
 */
export function nextTurn(state: GameState, afterId: string): string | null {
  const quanti = state.players.length;
  if (quanti === 0) return null;
  const da = Math.max(
    0,
    state.players.findIndex((p) => p.id === afterId),
  );
  for (let passo = 1; passo <= quanti; passo += 1) {
    const candidato = state.players[(da + passo) % quanti];
    if (candidato.id === state.highBidderId) continue;
    if (canCompete(state, candidato)) return candidato.id;
  }
  return null;
}

/** Suggerimento su chi dovrebbe agire adesso, per evitare clic sbagliati. */
export function nextToAct(state: GameState): string | null {
  if (state.phase !== "auction") return null;
  const eligible = state.players.filter(
    (p) => canCompete(state, p) && p.id !== state.highBidderId,
  );
  if (eligible.length === 0) return null;
  if (!state.highBidderId) return eligible[0].id;
  const leaderIndex = state.players.findIndex((p) => p.id === state.highBidderId);
  for (let step = 1; step <= state.players.length; step += 1) {
    const candidate = state.players[(leaderIndex + step) % state.players.length];
    if (eligible.some((p) => p.id === candidate.id)) return candidate.id;
  }
  return null;
}

export function rosterValue(player: Player): number {
  return player.roster.reduce((sum, entry) => sum + entry.price, 0);
}

export function tierPoints(player: Player): number {
  return player.roster.reduce((sum, entry) => sum + entry.tier, 0);
}

/**
 * Secondi per votare, prima che la fase si chiuda da sola.
 *
 * E' un tetto, non un'attesa: appena hanno votato tutti si passa oltre. Serve
 * largo perche' con cinque giocatori ci sono quattro rose da guardare, e trenta
 * secondi erano quattro secondi a rosa -- il tempo di scorrerle, non di
 * leggerle.
 */
export const VOTE_SECONDS = 90;

/** Quanti voti ha preso ciascuno. */
export function voteTally(state: GameState): Record<string, number> {
  const tally: Record<string, number> = {};
  for (const player of state.players) tally[player.id] = 0;
  for (const target of Object.values(state.votes ?? {})) {
    if (target in tally) tally[target] += 1;
  }
  return tally;
}

/** Chi ha ancora il voto in mano. */
export function pendingVoters(state: GameState): Player[] {
  const votes = state.votes ?? {};
  return state.players.filter((player) => !(player.id in votes));
}

export function hasVoted(state: GameState, playerId: string): boolean {
  return playerId in (state.votes ?? {});
}

/** Si vota la rosa di un altro, una volta sola. */
export function canVote(state: GameState, voterId: string, targetId: string): boolean {
  if (state.phase !== "voting") return false;
  if (voterId === targetId) return false;
  if (!playerById(state, voterId) || !playerById(state, targetId)) return false;
  return !hasVoted(state, voterId);
}

/** Il colpo piu' caro di una rosa: l'ultimo criterio prima del sorteggio. */
function bestBuy(player: Player): number {
  return player.roster.reduce((top, entry) => Math.max(top, entry.price), 0);
}

/** Perche' quel giocatore sta davanti a quello dopo di lui. */
export type WinReason = "votes" | "credits" | "bestBuy" | "coin";

export interface Standing {
  player: Player;
  votes: number;
  /** Come e' stato deciso il sorpasso su chi viene dopo. */
  reason: WinReason;
}

/**
 * La classifica finale.
 *
 * A decidere sono i voti degli avversari, non il valore dei lotti: e' un gioco
 * di gusto, non di aritmetica. Se due prendono gli stessi voti vince chi ha
 * speso meno, cioe' chi ha ottenuto lo stesso consenso con meno soldi; se anche
 * il budget e' pari, vince chi ha piazzato il colpo piu' caro. L'ultimo criterio
 * e' l'ordine di ingresso, uguale su tutti i dispositivi: serve solo perche' un
 * vincitore ci deve essere sempre, e la vittoria va segnata sul suo profilo.
 */
export function standings(state: GameState): Player[] {
  return finalStandings(state).map((entry) => entry.player);
}

/**
 * Il sorteggio dell'ultimo spareggio.
 *
 * Quando due giocatori sono pari su voti, crediti e acquisto piu' caro serve
 * un modo per separarli. L'ordine di ingresso sarebbe la cosa piu' semplice,
 * ma premia sempre chi ha creato la stanza o ha la connessione piu' svelta:
 * non e' merito di gioco, e si vede.
 *
 * Un sorteggio vero pero' non si puo' fare, perche' la classifica la calcola
 * ogni dispositivo per conto suo: due tiri di moneta diversi darebbero due
 * vincitori diversi sui due telefoni. Qui il numero si ricava dal codice della
 * stanza e dall'identificativo del giocatore, quindi esce identico ovunque ma
 * non ha niente a che vedere con chi e' entrato prima.
 */
function coinFlip(code: string, playerId: string): number {
  const seme = `${code}:${playerId}`;
  let hash = 2166136261;
  for (let i = 0; i < seme.length; i += 1) {
    hash ^= seme.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function finalStandings(state: GameState): Standing[] {
  const tally = voteTally(state);

  const sorted = [...state.players].sort((a, b) => {
    const byVotes = (tally[b.id] ?? 0) - (tally[a.id] ?? 0);
    if (byVotes !== 0) return byVotes;
    const byCredits = b.budget - a.budget;
    if (byCredits !== 0) return byCredits;
    const byBest = bestBuy(b) - bestBuy(a);
    if (byBest !== 0) return byBest;
    return coinFlip(state.code, a.id) - coinFlip(state.code, b.id);
  });

  return sorted.map((player, index) => {
    const next = sorted[index + 1];
    let reason: WinReason = "coin";
    if (next) {
      if ((tally[player.id] ?? 0) !== (tally[next.id] ?? 0)) reason = "votes";
      else if (player.budget !== next.budget) reason = "credits";
      else if (bestBuy(player) !== bestBuy(next)) reason = "bestBuy";
      else reason = "coin";
    }
    return { player, votes: tally[player.id] ?? 0, reason };
  });
}

/** Il vincitore, sempre uno solo. */
export function winnerOf(state: GameState): Standing | null {
  return finalStandings(state)[0] ?? null;
}

/* ------------------------------------------------------------------ */
/* I titoli di fine partita                                            */
/* ------------------------------------------------------------------ */

/**
 * Le targhe che si consegnano a premiazione finita.
 *
 * Non contano niente -- non danno punti, non cambiano la classifica -- e
 * servono proprio per quello: la classifica premia uno solo, e in una partita
 * in cinque gli altri quattro escono senza niente da raccontare. Un titolo da'
 * a ognuno un modo di essere stato qualcosa, fosse anche il piu' tirchio.
 */
export type EndTitleId = "dominator" | "spender" | "tightwad" | "flopMaster";

export const END_TITLE_EMOJI: Readonly<Record<EndTitleId, string>> = {
  dominator: "🏆",
  spender: "💸",
  tightwad: "🪙",
  flopMaster: "🎯",
};

/** Chi ha finito i crediti per primo, ripercorrendo gli acquisti in ordine. */
function firstToRunDry(state: GameState): string | null {
  const residuo = new Map(state.players.map((p) => [p.id, state.config.budget]));
  for (const risultato of state.history) {
    if (!risultato.winnerId) continue;
    const prima = residuo.get(risultato.winnerId);
    if (prima === undefined) continue;
    const dopo = prima - risultato.price;
    residuo.set(risultato.winnerId, dopo);
    // Sotto l'offerta minima non si puo' piu' comprare niente: e' finito qui.
    if (dopo < OPENING_BID) return risultato.winnerId;
  }
  return null;
}

/**
 * Il migliore per un certo conto, ma solo se e' uno solo.
 *
 * A parita' non si assegna niente: due "braccino corto" appaiati non fanno
 * ridere nessuno, e in una partita dove nessuno ha speso li prenderebbero
 * tutti.
 */
function soloVincitore(
  players: readonly Player[],
  valore: (p: Player) => number,
  minimo: number,
): string | null {
  let migliore: Player | null = null;
  let pari = false;
  for (const p of players) {
    if (valore(p) < minimo) continue;
    if (!migliore || valore(p) > valore(migliore)) {
      migliore = p;
      pari = false;
    } else if (valore(p) === valore(migliore)) {
      pari = true;
    }
  }
  return migliore && !pari ? migliore.id : null;
}

/** I titoli, per giocatore. Chi non ne ha preso nessuno non compare. */
export function endTitles(state: GameState): Record<string, EndTitleId[]> {
  const titoli: Record<string, EndTitleId[]> = {};
  const assegna = (playerId: string | null, id: EndTitleId) => {
    if (!playerId) return;
    (titoli[playerId] ??= []).push(id);
  };

  assegna(winnerOf(state)?.player.id ?? null, "dominator");
  assegna(firstToRunDry(state), "spender");
  assegna(soloVincitore(state.players, (p) => p.budget, 1), "tightwad");
  assegna(soloVincitore(state.players, (p) => p.passes ?? 0, 1), "flopMaster");

  return titoli;
}

export function drawnCount(state: GameState): number {
  return state.lotNumber;
}

export function totalSlots(state: GameState): number {
  return state.config.slots * state.players.length;
}

/* ------------------------------------------------------------------ */
/* Riduttore                                                          */
/* ------------------------------------------------------------------ */

export type GameAction =
  | {
      type: "add_player";
      player: { id: string; name: string; emoji?: string; accountId?: string; handle?: string };
    }
  | { type: "set_name"; playerId: string; name: string }
  | { type: "link_account"; playerId: string; accountId: string; handle?: string }
  | { type: "remove_player"; playerId: string }
  | { type: "set_avatar"; playerId: string; emoji: string }
  | { type: "set_color"; playerId: string; color: string }
  | { type: "set_host"; playerId: string }
  | { type: "set_category"; category: Category }
  | { type: "set_config"; config: Partial<RoomConfig> }
  | { type: "start"; now: number }
  | { type: "bid"; playerId: string; amount: number; now: number }
  | { type: "claim"; playerId: string; now: number }
  | { type: "take_dutch"; playerId: string; now: number }
  | { type: "pass"; playerId: string; now: number }
  | { type: "vote"; voterId: string; targetId: string; now: number }
  | { type: "react"; playerId: string; emoji: string; now: number }
  | { type: "next"; now: number }
  | { type: "tick"; now: number }
  | { type: "restart" }
  | { type: "end" };

function touch(state: GameState): GameState {
  return { ...state, updatedAt: Date.now() };
}

function feedEntry(kind: FeedKind, at: number, data: Partial<FeedEntry> = {}): FeedEntry {
  return {
    id: `${kind}-${at}-${Math.random().toString(36).slice(2, 7)}`,
    kind,
    at,
    ...data,
  };
}

function pushFeed(state: GameState, entry: FeedEntry): GameState {
  return { ...state, feed: [entry, ...state.feed].slice(0, FEED_LIMIT) };
}

function everyoneDone(state: GameState): boolean {
  const allFull = state.players.every((p) => rosterFull(state, p));
  const allBroke = state.players.every((p) => p.budget < OPENING_BID);
  return allFull || allBroke;
}

/**
 * Chiude l'asta e apre il voto.
 *
 * Con un solo giocatore non c'e' niente da votare: si va dritti in fondo.
 */
function closeAuction(state: GameState, now: number): GameState {
  const base = {
    ...state,
    currentItemId: null,
    highBidderId: null,
    passed: [],
  };
  if (state.players.length < 2) {
    return touch({ ...base, phase: "ended" as const, deadline: 0 });
  }
  return touch({
    ...base,
    phase: "voting" as const,
    votes: {},
    deadline: now + VOTE_SECONDS * 1000,
  });
}

/** Chiude il voto e proclama il vincitore. */
function closeVoting(state: GameState): GameState {
  return touch({ ...state, phase: "ended", deadline: 0 });
}

/** Estrae il prossimo lotto oppure chiude la partita. */
function draw(state: GameState, now: number): GameState {
  if (state.queue.length === 0 || everyoneDone(state)) {
    return closeAuction(state, now);
  }

  const lotNumber = state.lotNumber + 1;

  // Se resta un solo giocatore da completare e i lotti bastano appena, glieli assegniamo d'ufficio.
  const pending = pendingPlayers(state);
  if (pending.length === 1) {
    const player = pending[0];
    const needed = state.config.slots - player.roster.length;
    const [nextId, ...rest] = state.queue;
    const item = state.items.find((i) => i.id === nextId);
    if (state.queue.length <= needed && item && maxBid(state, player) >= OPENING_BID) {
      return award(
        {
          ...state,
          queue: rest,
          lotKind: "item",
          lotPrice: 0,
          currentItemId: nextId,
          currentBid: OPENING_BID,
          highBidderId: null,
          passed: [],
          sniped: false,
          lotNumber,
        },
        now,
        player,
        item,
        OPENING_BID,
        { forced: true },
      );
    }
  }

  const mystery = state.config.mysteryBox && lotNumber % MYSTERY_EVERY === 0;

  /*
   * Col ribasso acceso il prezzo di apertura e' sempre quello della discesa,
   * box comprese: una Mystery Box a prezzo fisso dentro una partita al ribasso
   * sarebbe l'unico lotto della serata che non scende, e da fuori sembrerebbe
   * un lotto rotto piu' che una regola.
   */
  const ribasso = Boolean(state.config.dutchDraft);
  const aperturaRibasso = dutchOpening(state.config.budget);

  if (mystery) {
    const price = ribasso ? aperturaRibasso : mysteryPrice(state.config.budget);
    return touch(
      pushFeed(
        apriTurno(
          {
            ...state,
            phase: "auction",
            lotKind: "mystery",
            lotPrice: price,
            currentItemId: null,
            currentBid: price,
            highBidderId: null,
            passed: [],
            lotNumber,
            sniped: false,
          },
          now,
        ),
        feedEntry("lot", now, { amount: price }),
      ),
    );
  }

  const [next, ...rest] = state.queue;
  const item = state.items.find((i) => i.id === next);
  return touch(
    pushFeed(
      apriTurno(
        {
          ...state,
          phase: "auction",
          lotKind: "item",
          lotPrice: ribasso ? aperturaRibasso : 0,
          queue: rest,
          currentItemId: next,
          currentBid: ribasso ? aperturaRibasso : OPENING_BID,
          highBidderId: null,
          passed: [],
          lotNumber,
          sniped: false,
        },
        now,
      ),
      feedEntry("lot", now, { itemName: item?.name }),
    ),
  );
}

/**
 * Apre il turno sul lotto appena estratto e fa partire il cronometro.
 *
 * Il tempo si conta per turno e non per lotto: ognuno ha i suoi secondi per
 * decidere, e chi lascia scadere il proprio passa d'ufficio. Un cronometro solo
 * per tutto il lotto avrebbe voluto dire che il primo a parlare se lo consumava
 * tutto e agli altri non restava niente.
 */
function apriTurno(state: GameState, now: number): GameState {
  /*
   * Al ribasso non si apre nessun turno.
   *
   * Il lotto e' aperto a tutti insieme e il cronometro e' uno solo per tutto il
   * lotto, perche' e' proprio lo scorrere del tempo a far scendere il prezzo:
   * darlo a un giocatore per volta vorrebbe dire che il primo si compra la
   * discesa intera e agli altri arriva un prezzo gia' al pavimento.
   *
   * turnId a null e' la stessa cosa che dice `isMyTurn` alle partite vecchie:
   * puo' agire chiunque. Qui e' voluto, non un residuo.
   */
  if (state.config.dutchDraft) {
    return { ...state, turnId: null, deadline: now + lotSeconds(state) * 1000 };
  }
  const turnId = openingTurn(state);
  return { ...state, turnId, deadline: now + lotSeconds(state) * 1000 };
}

/**
 * Passa la mano dopo un'azione, e chiude il lotto se non resta nessuno.
 *
 * Il cronometro riparte da capo a ogni mano: e' il turno ad avere un tempo, non
 * il lotto. Vale anche come freno al colpo all'ultimo istante, perche' dopo un
 * rilancio gli altri hanno comunque il loro giro intero per rispondere.
 */
function passaLaMano(state: GameState, afterId: string, now: number): GameState {
  const prossimo = nextTurn(state, afterId);
  if (!prossimo) return resolve({ ...state, turnId: null }, now);
  return touch({ ...state, turnId: prossimo, deadline: now + lotSeconds(state) * 1000 });
}

function award(
  state: GameState,
  now: number,
  winner: Player,
  item: CatalogItem,
  price: number,
  options: { mystery?: boolean; queue?: string[]; forced?: boolean } = {},
): GameState {
  const result: AuctionResult = {
    itemId: item.id,
    itemName: item.name,
    tier: item.tier,
    winnerId: winner.id,
    winnerName: winner.name,
    price,
    mystery: options.mystery,
  };

  const players = state.players.map((p) =>
    p.id === winner.id
      ? {
          ...p,
          budget: p.budget - price,
          roster: [
            ...p.roster,
            {
              itemId: item.id,
              name: item.name,
              tier: item.tier,
              price,
              image: item.image,
              emoji: item.emoji,
              mystery: options.mystery,
            },
          ],
        }
      : p,
  );

  return touch(
    pushFeed(
      {
        ...state,
        phase: "result",
        players,
        queue: options.queue ?? state.queue,
        lastResult: result,
        history: [...state.history, result],
        deadline: now + RESULT_SECONDS * 1000,
      },
      feedEntry(options.mystery ? "mystery" : options.forced ? "auto" : "won", now, {
        playerName: winner.name,
        playerEmoji: winner.emoji,
        itemName: item.name,
        amount: price,
      }),
    ),
  );
}

/**
 * Chiude il lotto corrente: vince chi detiene l'offerta più alta.
 *
 * Se un'offerta non c'è — tempo scaduto senza rilanci, oppure tutti hanno
 * passato — non vince nessuno: il lotto finisce negli scarti, e solo se l'host
 * li ha disattivati viene assegnato d'ufficio al prezzo base a chi ha la lista
 * più corta. Nessuno si ritrova un elemento in mano solo perché gli altri hanno
 * premuto "passa" per primi.
 */
function resolve(state: GameState, now: number): GameState {
  if (isMysteryLot(state)) {
    const result: AuctionResult = {
      itemId: `mystery-${state.lotNumber}`,
      itemName: "Mystery Box",
      tier: 1,
      winnerId: null,
      winnerName: null,
      price: 0,
      mystery: true,
    };
    return touch(
      pushFeed(
        {
          ...state,
          phase: "result",
          lastResult: result,
          deadline: now + RESULT_SECONDS * 1000,
        },
        feedEntry("discard", now, { itemName: "Mystery Box" }),
      ),
    );
  }

  const item = currentItem(state);
  if (!item) return state;

  const winner = playerById(state, state.highBidderId);
  if (winner) return award(state, now, winner, item, state.currentBid);

  /*
   * Gli scarti sono una riserva di gruppo, non infinita.
   *
   * Quando i lotti rimasti bastano appena a riempire le liste, un lotto che non
   * vuole nessuno viene assegnato d'ufficio a chi ha piu' spazio libero. Serve
   * a garantire che la partita finisca: se si potesse scartare all'infinito, un
   * tavolo poco interessato bruceriebbe il mazzo e resterebbe con le liste
   * vuote.
   *
   * Va a chi ha meno elementi -- non a sorte -- proprio perche' il punto e'
   * chiudere la partita: darlo a caso potrebbe riempire l'ultimo posto di chi
   * era quasi a posto, lasciando a secco chi ne ha ancora quattro da coprire,
   * cioe' ricreando il problema che questa regola esiste per togliere.
   */
  if (!canDiscardLot(state)) {
    const fallback = pendingPlayers(state)
      .filter((p) => maxBid(state, p) >= OPENING_BID)
      .sort((a, b) => a.roster.length - b.roster.length || b.budget - a.budget)[0];
    if (fallback) return award(state, now, fallback, item, OPENING_BID, { forced: true });
  }

  const result: AuctionResult = {
    itemId: item.id,
    itemName: item.name,
    tier: item.tier,
    winnerId: null,
    winnerName: null,
    price: 0,
  };

  return touch(
    pushFeed(
      {
        ...state,
        phase: "result",
        discards: [...state.discards, item.id],
        lastResult: result,
        history: [...state.history, result],
        deadline: now + RESULT_SECONDS * 1000,
      },
      feedEntry("discard", now, { itemName: item.name }),
    ),
  );
}

export function reducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case "add_player": {
      if (state.phase !== "lobby") return state;
      if (state.players.length >= state.config.maxPlayers) return state;
      if (state.players.some((p) => p.id === action.player.id)) return state;
      const index = state.players.length;
      // Due giocatori non possono avere lo stesso avatar: se quello richiesto è
      // già di qualcun altro, se ne assegna uno libero.
      const taken = state.players.map((p) => p.emoji);
      const wanted = action.player.emoji;
      const player: Player = {
        id: action.player.id,
        name: action.player.name.trim().slice(0, 16) || `Player ${index + 1}`,
        emoji: wanted && !taken.includes(wanted) ? wanted : firstFreeAvatar(taken),
        // Anche il colore parte diverso da quello degli altri.
        color: firstFreeColor(state.players.map((p) => p.color ?? "")),
        accountId: action.player.accountId,
        handle: action.player.handle,
        budget: state.config.budget,
        roster: [],
      };
      return touch({ ...state, players: [...state.players, player] });
    }

    /**
     * Passaggio di consegne: se chi ospita la stanza sparisce, la partita
     * andrebbe in stallo perche' nessuno fa girare il timer. Il primo giocatore
     * rimasto prende il posto, e da quel momento e' lui l'autorita' sullo stato.
     * Si accetta solo verso un giocatore presente e diverso da quello attuale.
     */
    case "set_host": {
      if (action.playerId === state.hostId) return state;
      if (!playerById(state, action.playerId)) return state;
      return touch({ ...state, hostId: action.playerId });
    }

    /** Colore dell'alone: si cambia dalla lobby, e due giocatori non lo condividono. */
    case "set_color": {
      if (state.phase !== "lobby") return state;
      if (!isPlayerColor(action.color)) return state;
      const target = playerById(state, action.playerId);
      if (!target || target.color === action.color) return state;
      if (state.players.some((p) => p.color === action.color)) return state;
      return touch({
        ...state,
        players: state.players.map((p) =>
          p.id === action.playerId ? { ...p, color: action.color } : p,
        ),
      });
    }

    /** Cambio avatar dalla lobby: l'icona deve essere ancora libera. */
    /*
     * Attacca il profilo a un giocatore gia' in stanza.
     *
     * Serve perche' la sessione si legge dal dispositivo dopo il montaggio: chi
     * apre la stanza viene iscritto un istante prima che si sappia chi e', e
     * senza questo resterebbe anonimo per tutta la partita. Anonimo vuol dire
     * che a fine partita non gli si accredita niente -- ne' la partita nello
     * storico, ne' l'esperienza -- e le statistiche del profilo restano a zero
     * anche giocando.
     *
     * E' senza effetto se il collegamento c'e' gia': altrimenti ogni ritocco
     * dello stato ne farebbe partire un altro, all'infinito.
     */
    case "link_account": {
      const player = playerById(state, action.playerId);
      if (!player) return state;
      if (player.accountId === action.accountId && player.handle === action.handle) return state;
      return touch({
        ...state,
        players: state.players.map((p) =>
          p.id === action.playerId
            ? { ...p, accountId: action.accountId, handle: action.handle }
            : p,
        ),
      });
    }

    case "set_name": {
      if (state.phase !== "lobby") return state;
      // Un nome vuoto o di soli spazi lascerebbe una riga anonima nella card.
      const name = action.name.trim().slice(0, 16);
      if (!name) return state;
      return touch({
        ...state,
        players: state.players.map((player) =>
          player.id === action.playerId ? { ...player, name } : player,
        ),
      });
    }

    case "set_avatar": {
      if (state.phase !== "lobby") return state;
      if (!isAvatarId(action.emoji)) return state;
      const target = playerById(state, action.playerId);
      if (!target || target.emoji === action.emoji) return state;
      if (state.players.some((p) => p.emoji === action.emoji)) return state;
      return touch({
        ...state,
        players: state.players.map((p) =>
          p.id === action.playerId ? { ...p, emoji: action.emoji } : p,
        ),
      });
    }

    case "remove_player": {
      if (state.phase !== "lobby") return state;
      if (!state.players.some((p) => p.id === action.playerId)) return state;
      return touch({
        ...state,
        players: state.players.filter((p) => p.id !== action.playerId),
      });
    }

    case "set_category": {
      if (state.phase !== "lobby") return state;
      return touch({
        ...state,
        category: {
          id: action.category.id,
          name: action.category.name,
          nameEn: action.category.nameEn,
          emoji: action.category.emoji,
          covers: action.category.covers,
        },
        items: action.category.items,
      });
    }

    case "set_config": {
      if (state.phase !== "lobby") return state;
      const config: RoomConfig = { ...state.config, ...action.config };
      config.budget = Math.round(Math.min(MAX_BUDGET, Math.max(MIN_BUDGET, config.budget)));
      config.slots = Math.round(Math.min(MAX_SLOTS, Math.max(MIN_SLOTS, config.slots)));
      config.maxPlayers = Math.round(
        Math.min(MAX_PLAYERS, Math.max(MIN_PLAYERS, config.maxPlayers)),
      );
      const players = state.players
        .slice(0, config.maxPlayers)
        .map((p) => ({ ...p, budget: config.budget }));
      return touch({ ...state, config, players });
    }

    case "start": {
      if (state.phase !== "lobby") return state;
      if (state.players.length < MIN_PLAYERS) return state;
      if (state.items.length === 0) return state;
      // I lotti devono bastare per chi c'e' davvero, non per il massimo
      // consentito: se sono in tre su una stanza da cinque, servono i loro.
      if (!canStartMatch(state.players.length, state.items.length, state.config.slots)) {
        return state;
      }
      return draw(
        {
          ...state,
          queue: shuffle(state.items.map((i) => i.id)),
          discards: [],
          history: [],
          lastResult: null,
          lotNumber: 0,
          sniped: false,
          feed: [feedEntry("start", action.now)],
          players: state.players.map((p) => ({
            ...p,
            budget: state.config.budget,
            roster: [],
            passes: 0,
          })),
        },
        action.now,
      );
    }

    case "bid": {
      if (!canBid(state, action.playerId, action.amount)) return state;
      const player = playerById(state, action.playerId);
      // Anti-sniping: ogni rilancio riporta il timer al massimo, quindi anche
      // un'offerta all'ultimo istante lascia agli altri il tempo di rispondere.
      const lastSecond = state.deadline - action.now <= SNIPE_WINDOW_SECONDS * 1000;
      const bidded = touch(
        pushFeed(
          {
            ...state,
            currentBid: action.amount,
            highBidderId: action.playerId,
            sniped: lastSecond,
          },
          feedEntry("bid", action.now, {
            playerName: player?.name,
            playerEmoji: player?.emoji,
            amount: action.amount,
          }),
        ),
      );
      // La mano passa a chi viene dopo, col suo tempo pieno per rispondere.
      return passaLaMano(bidded, action.playerId, action.now);
    }

    case "claim": {
      if (!canClaim(state, action.playerId)) return state;
      const player = playerById(state, action.playerId);
      if (!player || state.queue.length === 0) return state;
      const index = Math.floor(Math.random() * state.queue.length);
      const itemId = state.queue[index];
      const item = itemById(state, itemId);
      if (!item) return state;
      const queue = state.queue.filter((_, i) => i !== index);
      return award(state, action.now, player, item, state.lotPrice, { mystery: true, queue });
    }

    /**
     * Aggiudicazione al ribasso: se lo prende il primo che si decide.
     *
     * Il prezzo lo si calcola sull'istante del clic e non su quello in cui
     * l'azione arriva a destinazione: fra i due c'e' il viaggio in rete, e
     * farlo pagare a chi ha la connessione piu' lenta sarebbe una penalita' che
     * col gioco non c'entra niente. L'istante e' quello dell'orologio comune --
     * ogni dispositivo lo allinea su quello di chi ospita -- e viene comunque
     * riportato dentro la durata del lotto, cosi' nessun valore arrivato
     * sbagliato puo' comprare sotto il pavimento.
     */
    case "take_dutch": {
      if (!canTakeDutch(state, action.playerId, action.now)) return state;
      const player = playerById(state, action.playerId);
      if (!player) return state;
      const price = dutchPriceAt(state, action.now);

      if (isMysteryLot(state)) {
        if (state.queue.length === 0) return state;
        const index = Math.floor(Math.random() * state.queue.length);
        const itemId = state.queue[index];
        const item = itemById(state, itemId);
        if (!item) return state;
        const queue = state.queue.filter((_, i) => i !== index);
        return award(state, action.now, player, item, price, { mystery: true, queue });
      }

      const item = currentItem(state);
      if (!item) return state;
      return award(state, action.now, player, item, price);
    }

    case "pass": {
      if (!canPass(state, action.playerId)) return state;
      const player = playerById(state, action.playerId);
      const passed = touch(
        pushFeed(
          {
            ...state,
            passed: [...state.passed, action.playerId],
            // Il conto delle rinunce, che a fine partita diventa un titolo.
            players: state.players.map((p) =>
              p.id === action.playerId ? { ...p, passes: (p.passes ?? 0) + 1 } : p,
            ),
          },
          feedEntry("pass", action.now, {
            playerName: player?.name,
            playerEmoji: player?.emoji,
          }),
        ),
      );
      return passaLaMano(passed, action.playerId, action.now);
    }

    /**
     * Un voto: si sceglie la rosa di un altro, una volta sola. Quando hanno
     * votato tutti non c'e' motivo di aspettare lo scadere del tempo.
     */
    case "vote": {
      if (!canVote(state, action.voterId, action.targetId)) return state;
      const voter = playerById(state, action.voterId);
      const target = playerById(state, action.targetId);
      const voted = touch(
        pushFeed(
          { ...state, votes: { ...(state.votes ?? {}), [action.voterId]: action.targetId } },
          feedEntry("vote", action.now, {
            playerName: voter?.name,
            playerEmoji: voter?.emoji,
            itemName: target?.name,
          }),
        ),
      );
      return pendingVoters(voted).length === 0 ? closeVoting(voted) : voted;
    }

    /*
     * Una reazione. Non tocca niente della partita: non cambia crediti, non
     * cambia il timer, non conta per nessuna classifica. E' l'unica azione del
     * gioco che si puo' ignorare del tutto senza cambiare come finisce.
     */
    case "react": {
      if (!isReaction(action.emoji)) return state;
      if (!canReact(state, action.playerId, action.now)) return state;
      const vive = liveReactions(state, action.now);
      return touch({
        ...state,
        reactions: [
          ...vive,
          {
            id: `${action.playerId}-${action.now}`,
            playerId: action.playerId,
            emoji: action.emoji,
            at: action.now,
          },
        ].slice(-REACTION_LIMIT),
      });
    }

    case "next": {
      if (state.phase !== "result") return state;
      return draw(state, action.now);
    }

    case "tick": {
      /*
       * Le reazioni scadute se ne vanno da sole, prima di ogni altra cosa:
       * altrimenti resterebbero nello stato fino al lotto dopo, e chi entra in
       * quel momento le vedrebbe comparire tutte insieme.
       */
      if (state.reactions?.length) {
        const vive = liveReactions(state, action.now);
        if (vive.length !== state.reactions.length) {
          const ripulito = { ...state, reactions: vive };
          return reducer(ripulito, { ...action, now: action.now });
        }
      }
      if (!state.deadline || action.now < state.deadline) return state;
      /*
       * Tempo scaduto sul proprio turno: si passa d'ufficio e la mano va
       * avanti. Chiudere il lotto qui, come si faceva prima dei turni,
       * vorrebbe dire che chi ha la mano e si distrae toglie il giro a tutti
       * gli altri -- e con l'asta a turni sarebbe la regola sbagliata.
       */
      if (state.phase === "auction") {
        if (state.turnId) {
          const chi = state.turnId;
          const fuori = touch(
            pushFeed(
              { ...state, passed: [...state.passed, chi] },
              feedEntry("pass", action.now, {
                playerName: playerById(state, chi)?.name,
                playerEmoji: playerById(state, chi)?.emoji,
              }),
            ),
          );
          return passaLaMano(fuori, chi, action.now);
        }
        return resolve(state, action.now);
      }
      if (state.phase === "result") return draw(state, action.now);
      // Chi non ha votato entro il tempo non vota: si proclama lo stesso.
      if (state.phase === "voting") return closeVoting(state);
      return state;
    }

    case "restart": {
      return touch({
        ...state,
        phase: "lobby",
        queue: [],
        currentItemId: null,
        lotKind: "item",
        lotPrice: 0,
        currentBid: OPENING_BID,
        highBidderId: null,
        passed: [],
        deadline: 0,
        discards: [],
        lastResult: null,
        history: [],
        feed: [],
        lotNumber: 0,
        sniped: false,
        votes: {},
        players: state.players.map((p) => ({
          ...p,
          budget: state.config.budget,
          roster: [],
          passes: 0,
        })),
      });
    }

    case "end": {
      if (state.phase === "lobby" || state.phase === "ended") return state;
      // Anche chiudendo a mano si passa dal voto: il vincitore lo decidono
      // i giocatori, non chi ha in mano il pulsante.
      if (state.phase === "voting") return closeVoting(state);
      return closeAuction(state, Date.now());
    }

    default:
      return state;
  }
}
