export type Tier = 1 | 2 | 3 | 4 | 5;

export interface CatalogItem {
  id: string;
  name: string;
  tier: Tier;
}

export type CategorySource = "builtin" | "custom" | "shared";

export interface Category {
  id: string;
  name: string;
  emoji: string;
  items: CatalogItem[];
  source: CategorySource;
  /** Id remoto usato per il link di condivisione. */
  shareId?: string;
  createdAt?: string;
}

export interface RosterEntry {
  itemId: string;
  name: string;
  tier: Tier;
  price: number;
}

export interface Player {
  id: string;
  name: string;
  emoji: string;
  budget: number;
  roster: RosterEntry[];
}

export interface AuctionResult {
  itemId: string;
  itemName: string;
  tier: Tier;
  winnerId: string | null;
  winnerName: string | null;
  price: number;
}

export type RoomMode = "local" | "online";

export type Phase = "lobby" | "auction" | "result" | "ended";

export interface GameState {
  code: string;
  mode: RoomMode;
  hostId: string;
  phase: Phase;
  category: { id: string; name: string; emoji: string };
  items: CatalogItem[];
  /** Id degli elementi non ancora estratti, in ordine casuale. */
  queue: string[];
  currentItemId: string | null;
  currentBid: number;
  highBidderId: string | null;
  passed: string[];
  /** Timestamp epoch in ms della scadenza del timer corrente. */
  deadline: number;
  players: Player[];
  discards: string[];
  lastResult: AuctionResult | null;
  history: AuctionResult[];
  updatedAt: number;
}

export interface RoomSession {
  code: string;
  mode: RoomMode;
  playerId: string;
  isHost: boolean;
  name: string;
  emoji: string;
  /** Categoria scelta prima di entrare in stanza (solo per chi ospita). */
  categoryId?: string;
}

export interface Profile {
  id: string;
  name: string;
  emoji: string;
}
