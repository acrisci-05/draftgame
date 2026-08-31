import type { TranslationKey } from "./i18n/it";

/**
 * Livelli, fasce e ricompense.
 *
 * Regole pure, senza database e senza interfaccia: si dà l'esperienza
 * accumulata e si ottiene a che punto è quel giocatore. Stanno qui da sole
 * perché sono la parte del profilo che vale la pena verificare con i test:
 * una soglia sbagliata si vede solo quando qualcuno resta bloccato a metà
 * strada senza capire perché.
 *
 * Quello che si sblocca è **soltanto estetico**. Nessuna ricompensa tocca i
 * crediti, il tempo o le regole dell'asta: chi gioca da un anno e chi si è
 * appena iscritto si siedono allo stesso tavolo con lo stesso budget.
 */

export interface PlayerProgress {
  /** Draft portati a termine da registrato. */
  played: number;
  /** Quante volte è arrivato primo. */
  won: number;
  /** Pickmates con l'amicizia accettata. */
  mates: number;
  /** Esperienza accumulata. Gli ospiti restano a zero. */
  xp: number;
}

export const NO_PROGRESS: PlayerProgress = { played: 0, won: 0, mates: 0, xp: 0 };

/* ------------------------------------------------------------------ */
/* Quanta esperienza dà una partita                                    */
/* ------------------------------------------------------------------ */

export const XP_MATCH = 50;
export const XP_WIN = 100;
export const XP_PER_VOTE = 10;
/** Tetto ai voti: una partita molto votata non vale quanto dieci partite. */
export const XP_VOTES_CAP = 100;
/** Prima partita del giorno insieme a un PickMate. Una volta al giorno. */
export const XP_SOCIAL = 100;

/* ------------------------------------------------------------------ */
/* Le fasce                                                            */
/* ------------------------------------------------------------------ */

export type TierId = "guest" | "rookie" | "trader" | "strategist" | "icon" | "whale";

export interface Tier {
  id: TierId;
  /** Primo livello della fascia. */
  from: number;
  /** Ultimo livello, Infinity per l'ultima fascia. */
  to: number;
  /** Esperienza a cui comincia la fascia. */
  startXp: number;
  /** Esperienza a cui comincia la fascia successiva. */
  endXp: number;
  name: TranslationKey;
  /** Quello che si sblocca arrivandoci. */
  perks: TranslationKey[];
  /**
   * Colore della cornice dell'avatar. Sono classi scritte per intero perché
   * Tailwind legge il codice come testo: una classe costruita a pezzi non
   * verrebbe mai generata.
   */
  ring: string;
  chip: string;
}

/**
 * L'ospite non è una fascia che si raggiunge: è il posto di chi non si è
 * iscritto. Sta qui per avere un solo elenco da mostrare.
 */
export const GUEST_TIER: Tier = {
  id: "guest",
  from: 0,
  to: 0,
  startXp: 0,
  endXp: 0,
  name: "tier.guest",
  perks: ["tier.guestPerk"],
  ring: "ring-zinc-600",
  chip: "border-zinc-600/50 bg-zinc-600/10 text-zinc-400",
};

export const TIERS: Tier[] = [
  {
    id: "rookie",
    from: 1,
    to: 5,
    startXp: 0,
    endXp: 500,
    name: "tier.rookie",
    perks: ["tier.rookiePerk1", "tier.rookiePerk2"],
    ring: "ring-amber-700",
    chip: "border-amber-700/50 bg-amber-700/10 text-amber-600",
  },
  {
    id: "trader",
    from: 6,
    to: 15,
    startXp: 500,
    endXp: 2000,
    name: "tier.trader",
    perks: ["tier.traderPerk1", "tier.traderPerk2"],
    ring: "ring-orange-400",
    chip: "border-orange-400/50 bg-orange-400/10 text-orange-400",
  },
  {
    id: "strategist",
    from: 16,
    to: 30,
    startXp: 2000,
    endXp: 6000,
    name: "tier.strategist",
    perks: ["tier.strategistPerk1", "tier.strategistPerk2"],
    ring: "ring-zinc-300",
    chip: "border-zinc-300/50 bg-zinc-300/10 text-zinc-300",
  },
  {
    id: "icon",
    from: 31,
    to: 50,
    startXp: 6000,
    endXp: 15000,
    name: "tier.icon",
    perks: ["tier.iconPerk1", "tier.iconPerk2"],
    ring: "ring-violet",
    chip: "border-violet/50 bg-violet/10 text-violet",
  },
  {
    id: "whale",
    from: 51,
    to: Infinity,
    startXp: 15000,
    endXp: Infinity,
    name: "tier.whale",
    perks: ["tier.whalePerk1", "tier.whalePerk2"],
    ring: "ring-gold",
    chip: "border-gold/50 bg-gold/10 text-gold",
  },
];

/** Ogni quanta esperienza si sale di livello dentro l'ultima fascia. */
const WHALE_STEP = 1000;

/** L'esperienza necessaria per arrivare a un certo livello. */
export function xpForLevel(level: number): number {
  if (level <= 1) return 0;
  const tier = TIERS.find((t) => level >= t.from && level <= t.to) ?? TIERS[TIERS.length - 1];
  if (tier.id === "whale") return tier.startXp + (level - tier.from) * WHALE_STEP;
  const levels = tier.to - tier.from + 1;
  const step = (tier.endXp - tier.startXp) / levels;
  return Math.round(tier.startXp + (level - tier.from) * step);
}

export interface Level {
  /** 0 per gli ospiti, da 1 in su per chi è iscritto. */
  level: number;
  tier: Tier;
  /** Esperienza già presa dentro il livello in corso. */
  xpInto: number;
  /** Esperienza che serve per passare al livello dopo. */
  xpSpan: number;
  /** Da 0 a 1: quanto è pieno il livello in corso. */
  progress: number;
  /** Quanta esperienza manca al livello dopo. */
  toNext: number;
}

/** Il livello di un ospite: fuori dalla scala, e senza accumulo. */
export const GUEST_LEVEL: Level = {
  level: 0,
  tier: GUEST_TIER,
  xpInto: 0,
  xpSpan: 0,
  progress: 0,
  toNext: 0,
};

/** A che punto è chi ha accumulato questa esperienza. */
export function levelFor(xp: number): Level {
  const total = Math.max(0, Math.floor(xp));

  // Si sale finché la soglia del livello successivo è già stata superata.
  let level = 1;
  while (xpForLevel(level + 1) <= total) level += 1;

  const tier = TIERS.find((t) => level >= t.from && level <= t.to) ?? TIERS[TIERS.length - 1];
  const base = xpForLevel(level);
  const next = xpForLevel(level + 1);
  const xpSpan = next - base;

  return {
    level,
    tier,
    xpInto: total - base,
    xpSpan,
    progress: xpSpan > 0 ? (total - base) / xpSpan : 1,
    toNext: Math.max(0, next - total),
  };
}

/* ------------------------------------------------------------------ */
/* Quanta esperienza vale una partita finita                           */
/* ------------------------------------------------------------------ */

export interface MatchXp {
  match: number;
  win: number;
  votes: number;
  social: number;
  total: number;
}

/**
 * Il conto dell'esperienza di una partita, voce per voce.
 *
 * Diviso così invece che in un numero solo perché la schermata di fine
 * partita mostra da dove arriva ogni punto: un totale secco non spiega
 * niente e non invoglia a rigiocare.
 */
export function matchXp(input: {
  won: boolean;
  votes: number;
  /** Vero solo se in stanza c'era un PickMate e il bonus non è già stato preso oggi. */
  socialBonus: boolean;
}): MatchXp {
  const match = XP_MATCH;
  const win = input.won ? XP_WIN : 0;
  const votes = Math.min(Math.max(0, input.votes) * XP_PER_VOTE, XP_VOTES_CAP);
  const social = input.socialBonus ? XP_SOCIAL : 0;
  return { match, win, votes, social, total: match + win + votes + social };
}

/* ------------------------------------------------------------------ */
/* Trofei                                                             */
/* ------------------------------------------------------------------ */

export type TrophyId = "first" | "win" | "pack";

export interface Trophy {
  id: TrophyId;
  name: TranslationKey;
  hint: TranslationKey;
  unlocked: boolean;
  /** A che punto si è: utile per la barra sotto l'icona. */
  progress: number;
  target: number;
}

/** I tre trofei, con lo stato di ognuno. */
export function trophiesFor(progress: PlayerProgress): Trophy[] {
  const make = (
    id: TrophyId,
    name: TranslationKey,
    hint: TranslationKey,
    value: number,
    target: number,
  ): Trophy => ({
    id,
    name,
    hint,
    unlocked: value >= target,
    progress: Math.min(value, target),
    target,
  });

  return [
    make("first", "trophy.first", "trophy.firstHint", progress.played, 1),
    make("win", "trophy.win", "trophy.winHint", progress.won, 1),
    make("pack", "trophy.pack", "trophy.packHint", progress.mates, 3),
  ];
}

/** Percentuale di vittorie, arrotondata. 0 quando non si è ancora giocato. */
export function winRate(progress: PlayerProgress): number {
  if (progress.played === 0) return 0;
  return Math.round((progress.won / progress.played) * 100);
}
