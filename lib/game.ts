import type {
  AuctionResult,
  CatalogItem,
  Category,
  GameState,
  Player,
  RoomMode,
} from "./types";

export const START_BUDGET = 20;
/** Secondi a disposizione quando un nuovo elemento viene estratto. */
export const ITEM_SECONDS = 15;
/** Secondi a cui il timer viene riportato dopo ogni rilancio. */
export const RAISE_SECONDS = 10;
/** Durata della schermata di aggiudicazione prima del prossimo elemento. */
export const RESULT_SECONDS = 4;
export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 8;
export const OPENING_BID = 1;
export const RAISE_STEPS = [1, 2, 5] as const;

export const PLAYER_EMOJIS = ["🔥", "⚡", "👑", "🐉", "🦈", "🎯", "🍀", "🛸"];

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
}

export function createGame({ code, mode, hostId, category }: CreateGameArgs): GameState {
  return {
    code,
    mode,
    hostId,
    phase: "lobby",
    category: { id: category.id, name: category.name, emoji: category.emoji },
    items: category.items,
    queue: [],
    currentItemId: null,
    currentBid: OPENING_BID,
    highBidderId: null,
    passed: [],
    deadline: 0,
    players: [],
    discards: [],
    lastResult: null,
    history: [],
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

/** Offerta minima accettabile in questo istante. */
export function minimumBid(state: GameState): number {
  return state.highBidderId ? state.currentBid + 1 : OPENING_BID;
}

/** Le tre opzioni dei controlli di rilancio (+$1, +$2, +$5). */
export function bidOptions(state: GameState): { step: number; amount: number }[] {
  return RAISE_STEPS.map((step) => ({
    step,
    amount: state.highBidderId ? state.currentBid + step : step,
  }));
}

/** Un giocatore è ancora in corsa se non ha passato e può coprire l'offerta minima. */
export function canCompete(state: GameState, player: Player): boolean {
  if (player.id === state.highBidderId) return true;
  if (state.passed.includes(player.id)) return false;
  return player.budget >= minimumBid(state);
}

export function activePlayers(state: GameState): Player[] {
  return state.players.filter((p) => canCompete(state, p));
}

export function canBid(state: GameState, playerId: string, amount: number): boolean {
  if (state.phase !== "auction") return false;
  const player = playerById(state, playerId);
  if (!player) return false;
  if (state.passed.includes(playerId)) return false;
  if (state.highBidderId === playerId) return false;
  if (!bidOptions(state).some((o) => o.amount === amount)) return false;
  return player.budget - amount >= 0;
}

export function canPass(state: GameState, playerId: string): boolean {
  if (state.phase !== "auction") return false;
  const player = playerById(state, playerId);
  if (!player) return false;
  if (state.highBidderId === playerId) return false;
  return !state.passed.includes(playerId);
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
  return state.items.length - state.queue.length - (state.currentItemId ? 1 : 0);
}

/* ------------------------------------------------------------------ */
/* Riduttore                                                          */
/* ------------------------------------------------------------------ */

export type GameAction =
  | { type: "add_player"; player: { id: string; name: string; emoji?: string } }
  | { type: "remove_player"; playerId: string }
  | { type: "set_category"; category: Category }
  | { type: "start"; now: number }
  | { type: "bid"; playerId: string; amount: number; now: number }
  | { type: "pass"; playerId: string; now: number }
  | { type: "next"; now: number }
  | { type: "tick"; now: number }
  | { type: "restart" }
  | { type: "end" };

function touch(state: GameState): GameState {
  return { ...state, updatedAt: Date.now() };
}

/** Estrae il prossimo elemento oppure chiude la partita. */
function draw(state: GameState, now: number): GameState {
  const everyoneBroke = state.players.every((p) => p.budget < OPENING_BID);
  if (state.queue.length === 0 || everyoneBroke) {
    return touch({
      ...state,
      phase: "ended",
      currentItemId: null,
      highBidderId: null,
      passed: [],
      deadline: 0,
    });
  }
  const [next, ...rest] = state.queue;
  return touch({
    ...state,
    phase: "auction",
    queue: rest,
    currentItemId: next,
    currentBid: OPENING_BID,
    highBidderId: null,
    passed: [],
    deadline: now + ITEM_SECONDS * 1000,
  });
}

/**
 * Aggiudica l'elemento corrente.
 * - `timeout`: vince chi detiene l'offerta più alta, altrimenti l'elemento va agli scarti.
 * - `lastman`: tutti tranne uno hanno passato, quindi il superstite si aggiudica il lotto.
 */
function resolve(state: GameState, now: number, reason: "timeout" | "lastman"): GameState {
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

  const result: AuctionResult = {
    itemId: item.id,
    itemName: item.name,
    tier: item.tier,
    winnerId: winner?.id ?? null,
    winnerName: winner?.name ?? null,
    price: winner ? price : 0,
  };

  const awarded = winner;
  const players = awarded
    ? state.players.map((p) =>
        p.id === awarded.id
          ? {
              ...p,
              budget: p.budget - price,
              roster: [...p.roster, { itemId: item.id, name: item.name, tier: item.tier, price }],
            }
          : p,
      )
    : state.players;

  return touch({
    ...state,
    phase: "result",
    players,
    discards: awarded ? state.discards : [...state.discards, item.id],
    lastResult: result,
    history: [...state.history, result],
    deadline: now + RESULT_SECONDS * 1000,
  });
}

/** L'asta si chiude anche quando resta un solo giocatore in corsa. */
function settleIfUncontested(state: GameState, now: number): GameState {
  if (state.phase !== "auction") return state;
  if (activePlayers(state).length <= 1) return resolve(state, now, "lastman");
  return state;
}

export function reducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case "add_player": {
      if (state.phase !== "lobby") return state;
      if (state.players.length >= MAX_PLAYERS) return state;
      if (state.players.some((p) => p.id === action.player.id)) return state;
      const index = state.players.length;
      const player: Player = {
        id: action.player.id,
        name: action.player.name.trim().slice(0, 16) || `Player ${index + 1}`,
        emoji: action.player.emoji || PLAYER_EMOJIS[index % PLAYER_EMOJIS.length],
        budget: START_BUDGET,
        roster: [],
      };
      return touch({ ...state, players: [...state.players, player] });
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
          emoji: action.category.emoji,
        },
        items: action.category.items,
      });
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
          players: state.players.map((p) => ({ ...p, budget: START_BUDGET, roster: [] })),
        },
        action.now,
      );
    }

    case "bid": {
      if (!canBid(state, action.playerId, action.amount)) return state;
      const bidded = touch({
        ...state,
        currentBid: action.amount,
        highBidderId: action.playerId,
        deadline: action.now + RAISE_SECONDS * 1000,
      });
      return settleIfUncontested(bidded, action.now);
    }

    case "pass": {
      if (!canPass(state, action.playerId)) return state;
      const passed = touch({ ...state, passed: [...state.passed, action.playerId] });
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
        currentBid: OPENING_BID,
        highBidderId: null,
        passed: [],
        deadline: 0,
        discards: [],
        lastResult: null,
        history: [],
        players: state.players.map((p) => ({ ...p, budget: START_BUDGET, roster: [] })),
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
