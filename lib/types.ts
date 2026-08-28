export type Tier = 1 | 2 | 3 | 4 | 5;

export type Locale = "it" | "en" | "fr" | "es" | "de" | "pt" | "ru" | "zh" | "ja" | "ar";

export type CurrencyCode = "EUR" | "USD" | "GBP" | "JPY";

export interface CatalogItem {
  id: string;
  name: string;
  tier: Tier;
  /** Immagine di copertina (URL). Se assente viene generata una cover con le iniziali. */
  image?: string;
  /** Emoji mostrata sulla cover generata. */
  emoji?: string;
}

export type CategorySource = "official" | "custom" | "shared";

/** Macro-tema usato dai filtri nella pagina delle categorie. */
export type CategoryTheme = "sport" | "pop" | "gaming" | "food" | "life";

export interface Category {
  id: string;
  name: string;
  /** Nome in inglese per le liste ufficiali. */
  nameEn?: string;
  emoji: string;
  theme?: CategoryTheme;
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
  image?: string;
  emoji?: string;
  /** true se l'elemento è arrivato da una Mystery Box. */
  mystery?: boolean;
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
  mystery?: boolean;
}

export type RoomMode = "local" | "online";

export type Phase = "lobby" | "auction" | "result" | "ended";

export type LotKind = "item" | "mystery";

export interface RoomConfig {
  budget: number;
  currency: CurrencyCode;
  /** Numero massimo di giocatori ammessi nella stanza. */
  maxPlayers: number;
  /** Elementi che ogni giocatore deve portare a casa. */
  slots: number;
  blindDraft: boolean;
  mysteryBox: boolean;
  /**
   * true: un lotto senza offerte finisce negli scarti.
   * false: ogni lotto viene comunque assegnato a chi ha ancora slot liberi.
   */
  allowDiscards: boolean;
}

export type FeedKind =
  | "bid"
  | "pass"
  | "won"
  | "discard"
  | "mystery"
  | "lot"
  | "start"
  | "auto";

export interface FeedEntry {
  id: string;
  kind: FeedKind;
  playerName?: string;
  playerEmoji?: string;
  itemName?: string;
  amount?: number;
  at: number;
}

export interface GameState {
  code: string;
  mode: RoomMode;
  hostId: string;
  phase: Phase;
  config: RoomConfig;
  category: { id: string; name: string; nameEn?: string; emoji: string };
  items: CatalogItem[];
  /** Id degli elementi non ancora estratti, in ordine casuale. */
  queue: string[];
  currentItemId: string | null;
  lotKind: LotKind;
  /** Prezzo fisso della Mystery Box in corso. */
  lotPrice: number;
  currentBid: number;
  highBidderId: string | null;
  passed: string[];
  /** Timestamp epoch in ms della scadenza del timer corrente. */
  deadline: number;
  players: Player[];
  discards: string[];
  lastResult: AuctionResult | null;
  history: AuctionResult[];
  feed: FeedEntry[];
  lotNumber: number;
  /** true quando l'ultimo rilancio è arrivato negli ultimi secondi del timer. */
  sniped: boolean;
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
  /** Regole scelte nella schermata di configurazione (solo per chi ospita). */
  config?: RoomConfig;
}

export interface Profile {
  id: string;
  name: string;
  emoji: string;
}

export interface VoteResultPayload {
  code: string;
  categoryName: string;
  categoryEmoji: string;
  currency: CurrencyCode;
  players: Player[];
}

export interface VoteTally {
  playerId: string;
  votes: number;
}
