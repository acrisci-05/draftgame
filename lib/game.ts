import { firstFreeAvatar, isAvatarId } from "./avatars";
import type {
  AuctionResult,
  CatalogItem,
  Category,
  FeedEntry,
  FeedKind,
  GameState,
  Player,
  RoomConfig,
  RoomMode,
} from "./types";

/** Secondi a disposizione quando un nuovo lotto viene estratto. */
export const ITEM_SECONDS = 15;
/** Secondi a cui il timer viene riportato dopo ogni rilancio. */
export const RAISE_SECONDS = 10;
/** Durata della schermata di aggiudicazione prima del prossimo lotto. */
export const RESULT_SECONDS = 4;
export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 8;
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

/** Gli avatar sono icone SVG: qui circola solo il loro identificativo. */
export { AVATAR_IDS, DEFAULT_AVATAR, firstFreeAvatar, randomAvatar } from "./avatars";

/** Avatar già usati nella stanza: gli altri giocatori non possono prenderli. */
export function takenAvatars(state: GameState, exceptPlayerId?: string): string[] {
  return state.players
    .filter((player) => player.id !== exceptPlayerId)
    .map((player) => player.emoji);
}

export const DEFAULT_CONFIG: RoomConfig = {
  budget: 20,
  currency: "EUR",
  maxPlayers: 2,
  slots: 5,
  blindDraft: false,
  mysteryBox: false,
  allowDiscards: true,
};

/** Costo fisso della Mystery Box, proporzionato al budget di partenza. */
export function mysteryPrice(budget: number): number {
  return Math.max(2, Math.round(budget * 0.15));
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
}

export function createGame({ code, mode, hostId, category, config }: CreateGameArgs): GameState {
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
    updatedAt: Date.now(),
  };
}

/* ------------------------------------------------------------------ */
/* Selettori                                                          */
/* ------------------------------------------------------------------ */

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

export function activePlayers(state: GameState): Player[] {
  return state.players.filter((p) => canCompete(state, p));
}

export function canBid(state: GameState, playerId: string, amount: number): boolean {
  if (state.phase !== "auction" || isMysteryLot(state)) return false;
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
  const player = playerById(state, playerId);
  if (!player) return false;
  if (state.passed.includes(playerId)) return false;
  if (rosterFull(state, player)) return false;
  return maxBid(state, player) >= state.lotPrice;
}

export function canPass(state: GameState, playerId: string): boolean {
  if (state.phase !== "auction") return false;
  const player = playerById(state, playerId);
  if (!player) return false;
  if (state.highBidderId === playerId) return false;
  if (rosterFull(state, player)) return false;
  return !state.passed.includes(playerId);
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

export function standings(state: GameState): Player[] {
  return [...state.players].sort((a, b) => {
    const diff = tierPoints(b) - tierPoints(a);
    if (diff !== 0) return diff;
    return b.roster.length - a.roster.length;
  });
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
  | { type: "add_player"; player: { id: string; name: string; emoji?: string; accountId?: string } }
  | { type: "remove_player"; playerId: string }
  | { type: "set_avatar"; playerId: string; emoji: string }
  | { type: "set_category"; category: Category }
  | { type: "set_config"; config: Partial<RoomConfig> }
  | { type: "start"; now: number }
  | { type: "bid"; playerId: string; amount: number; now: number }
  | { type: "claim"; playerId: string; now: number }
  | { type: "pass"; playerId: string; now: number }
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

/** Estrae il prossimo lotto oppure chiude la partita. */
function draw(state: GameState, now: number): GameState {
  if (state.queue.length === 0 || everyoneDone(state)) {
    return touch({
      ...state,
      phase: "ended",
      currentItemId: null,
      highBidderId: null,
      passed: [],
      deadline: 0,
    });
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

  if (mystery) {
    const price = mysteryPrice(state.config.budget);
    return touch(
      pushFeed(
        {
          ...state,
          phase: "auction",
          lotKind: "mystery",
          lotPrice: price,
          currentItemId: null,
          currentBid: price,
          highBidderId: null,
          passed: [],
          deadline: now + ITEM_SECONDS * 1000,
          lotNumber,
          sniped: false,
        },
        feedEntry("lot", now, { amount: price }),
      ),
    );
  }

  const [next, ...rest] = state.queue;
  const item = state.items.find((i) => i.id === next);
  return touch(
    pushFeed(
      {
        ...state,
        phase: "auction",
        lotKind: "item",
        lotPrice: 0,
        queue: rest,
        currentItemId: next,
        currentBid: OPENING_BID,
        highBidderId: null,
        passed: [],
        deadline: now + ITEM_SECONDS * 1000,
        lotNumber,
        sniped: false,
      },
      feedEntry("lot", now, { itemName: item?.name }),
    ),
  );
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
 * Aggiudica il lotto corrente.
 * - `timeout`: vince chi detiene l'offerta più alta, altrimenti il lotto va agli scarti.
 * - `lastman`: tutti tranne uno hanno passato, quindi il superstite si aggiudica il lotto.
 */
function resolve(state: GameState, now: number, reason: "timeout" | "lastman"): GameState {
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

  const holder = playerById(state, state.highBidderId);
  const survivors = activePlayers(state);
  let winner: Player | undefined = holder;
  let price = state.currentBid;

  if (!winner && reason === "lastman" && survivors.length === 1) {
    winner = survivors[0];
    price = OPENING_BID;
  }

  if (winner) return award(state, now, winner, item, price);

  // Con gli scarti disattivati il lotto va comunque a chi deve ancora completare la lista.
  if (!state.config.allowDiscards) {
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

/** L'asta si chiude anche quando resta un solo giocatore in corsa. */
function settleIfUncontested(state: GameState, now: number): GameState {
  if (state.phase !== "auction" || isMysteryLot(state)) return state;
  if (activePlayers(state).length <= 1) return resolve(state, now, "lastman");
  return state;
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
        accountId: action.player.accountId,
        budget: state.config.budget,
        roster: [],
      };
      return touch({ ...state, players: [...state.players, player] });
    }

    /** Cambio avatar dalla lobby: l'icona deve essere ancora libera. */
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
          players: state.players.map((p) => ({ ...p, budget: state.config.budget, roster: [] })),
        },
        action.now,
      );
    }

    case "bid": {
      if (!canBid(state, action.playerId, action.amount)) return state;
      const player = playerById(state, action.playerId);
      // Anti-sniping: ogni rilancio riporta il timer a RAISE_SECONDS, quindi anche
      // un'offerta all'ultimo istante lascia agli altri il tempo di rispondere.
      const lastSecond = state.deadline - action.now <= SNIPE_WINDOW_SECONDS * 1000;
      const bidded = touch(
        pushFeed(
          {
            ...state,
            currentBid: action.amount,
            highBidderId: action.playerId,
            deadline: action.now + RAISE_SECONDS * 1000,
            sniped: lastSecond,
          },
          feedEntry("bid", action.now, {
            playerName: player?.name,
            playerEmoji: player?.emoji,
            amount: action.amount,
          }),
        ),
      );
      return settleIfUncontested(bidded, action.now);
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

    case "pass": {
      if (!canPass(state, action.playerId)) return state;
      const player = playerById(state, action.playerId);
      const passed = touch(
        pushFeed(
          { ...state, passed: [...state.passed, action.playerId] },
          feedEntry("pass", action.now, {
            playerName: player?.name,
            playerEmoji: player?.emoji,
          }),
        ),
      );
      if (isMysteryLot(passed)) {
        const stillIn = passed.players.filter((p) => canClaim(passed, p.id));
        if (stillIn.length === 0) return resolve(passed, action.now, "timeout");
        return passed;
      }
      return settleIfUncontested(passed, action.now);
    }

    case "next": {
      if (state.phase !== "result") return state;
      return draw(state, action.now);
    }

    case "tick": {
      if (!state.deadline || action.now < state.deadline) return state;
      if (state.phase === "auction") return resolve(state, action.now, "timeout");
      if (state.phase === "result") return draw(state, action.now);
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
        players: state.players.map((p) => ({ ...p, budget: state.config.budget, roster: [] })),
      });
    }

    case "end": {
      if (state.phase === "lobby") return state;
      return touch({ ...state, phase: "ended", currentItemId: null, deadline: 0 });
    }

    default:
      return state;
  }
}
