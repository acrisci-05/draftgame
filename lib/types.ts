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
  /**
   * Come vanno mostrate le immagini.
   *
   * Le foto stanno bene sul fondo scuro delle card. I loghi no: quasi tutti
   * sono disegnati in nero su sfondo trasparente, e su nero spariscono --
   * la Ford diventava un rettangolo vuoto. Con "logo" si mette dietro una
   * lastra chiara e si mostra l'immagine intera invece di ritagliarla,
   * perche' un marchio tagliato a meta' non si riconosce.
   */
  covers?: "photo" | "logo";
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
  /** Colore dell'alone nella lista giocatori. Assente sulle partite vecchie. */
  color?: string;
  /** Profilo collegato, quando chi gioca ha fatto l'accesso: serve per i Pickmates. */
  accountId?: string;
  /**
   * Il nickname fisso dell'account, senza chiocciola. Viaggia con il giocatore
   * perche' la card e la classifica mostrano in grande il nome scelto per la
   * partita e sotto, in piccolo, chi c'e' davvero dietro. Assente per gli
   * ospiti, che non hanno un account a cui attribuire niente.
   */
  handle?: string;
  budget: number;
  roster: RosterEntry[];
  /**
   * Quante volte ha lasciato perdere un lotto.
   *
   * Non serve a giocare: serve al titolo di fine partita, e si conta qui
   * perche' `passed` si svuota a ogni lotto e a fine partita non resterebbe
   * traccia di niente. Assente sulle partite cominciate prima che esistesse.
   */
  passes?: number;
}

/**
 * Una reazione lanciata durante l'asta.
 *
 * Vive dentro lo stato della partita e non in un canale a parte, per la stessa
 * ragione per cui ci vivono le offerte: e' l'unico posto che arriva a tutti i
 * dispositivi allo stesso modo, e l'unico che esiste anche quando si gioca
 * senza rete. Dura pochi secondi e poi viene buttata via.
 */
export interface Reaction {
  id: string;
  playerId: string;
  emoji: string;
  at: number;
}

/** Chi ha votato chi: la chiave è chi vota, il valore è la rosa votata. */
export type VoteMap = Record<string, string>;

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

/**
 * Le fasi della partita.
 * "voting" sta fra l'ultimo lotto e la premiazione: a decidere il vincitore
 * sono i giocatori, non un conteggio automatico.
 */
export type Phase = "lobby" | "auction" | "result" | "voting" | "ended";

export type LotKind = "item" | "mystery";

export interface RoomConfig {
  budget: number;
  currency: CurrencyCode;
  /** Numero massimo di giocatori ammessi nella stanza. */
  maxPlayers: number;
  /** Elementi che ogni giocatore deve portare a casa. */
  slots: number;
  /** Secondi a disposizione su ogni lotto. Assente sulle partite vecchie. */
  lotSeconds?: number;
  blindDraft: boolean;
  mysteryBox: boolean;
  /**
   * true: un lotto senza offerte finisce negli scarti.
   * false: ogni lotto viene comunque assegnato a chi ha ancora slot liberi.
   */
  allowDiscards: boolean;
  /**
   * La posta in palio, scritta dall'host prima di iniziare: "chi perde offre la
   * pizza". Finisce in evidenza sulla card di fine partita. Vuota = niente pegno.
   */
  pledge?: string;
}

export type FeedKind =
  | "bid"
  | "pass"
  | "won"
  | "discard"
  | "mystery"
  | "lot"
  | "start"
  | "auto"
  | "vote";

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
  /**
   * Della categoria viaggia solo l'essenziale: gli elementi stanno gia' in
   * `items`, e rimandare l'intera lista a ogni aggiornamento sarebbe spreco.
   */
  category: {
    id: string;
    name: string;
    nameEn?: string;
    emoji: string;
    /** Serve a disegnare i marchi su fondo chiaro: vedi Category.covers. */
    covers?: "photo" | "logo";
  };
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
  /** Voti della fase finale. Assente sulle partite iniziate prima del voto. */
  votes?: VoteMap;
  /**
   * true nelle partite contro il Pick-asso Bot.
   *
   * Serve a due cose che devono restare distinguibili da una partita vera: il
   * bot si muove solo dove questo e' acceso, e l'esperienza viene accreditata
   * ridotta. Assente sulle partite create prima che la modalita' esistesse, che
   * vale quanto false.
   */
  isPractice?: boolean;
  /**
   * Le reazioni ancora a schermo. Assente finché nessuno ne manda una.
   *
   * Le vecchie non si accumulano: a ogni nuova reazione, e a ogni battito
   * dell'orologio, quelle scadute escono. Senza, una partita lunga si porterebbe
   * dietro tutte le emoji della serata dentro ogni aggiornamento di stato.
   */
  reactions?: Reaction[];
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
  /** true se la stanza e' un uno contro uno contro il Pick-asso Bot. */
  practice?: boolean;
  /**
   * Quando si e' entrati in questa stanza. Serve a capire se vale la pena
   * riproporla dopo un ricarico: una stanza di ieri e' una partita finita.
   */
  openedAt?: number;
  /**
   * Quando la partita si e' conclusa. La sessione resta -- serve alla stanza
   * per sapere chi sei -- ma la home smette di riproporla.
   */
  finishedAt?: number;
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
