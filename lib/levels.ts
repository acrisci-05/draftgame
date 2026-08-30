import type { TranslationKey } from "./i18n/it";

/**
 * Livelli e trofei.
 *
 * Regole pure, senza database e senza interfaccia: prendono i numeri di un
 * giocatore e dicono a che punto è. Stanno qui da sole perché sono l'unica
 * parte del profilo che vale la pena verificare con i test.
 */

export interface PlayerProgress {
  /** Draft portati a termine da registrato. */
  played: number;
  /** Quante volte è arrivato primo. */
  won: number;
  /** Pickmates con l'amicizia accettata. */
  mates: number;
}

export const NO_PROGRESS: PlayerProgress = { played: 0, won: 0, mates: 0 };

export interface Level {
  /** 1, 2 o 3. */
  rank: number;
  name: TranslationKey;
  /** Draft che mancano al livello successivo, null quando è l'ultimo. */
  toNext: number | null;
}

/** Soglie dei livelli, in draft giocati. */
const LEVELS: { upTo: number; rank: number; name: TranslationKey }[] = [
  { upTo: 3, rank: 1, name: "level.1" },
  { upTo: 10, rank: 2, name: "level.2" },
  { upTo: Infinity, rank: 3, name: "level.3" },
];

export function levelFor(played: number): Level {
  const index = LEVELS.findIndex((step) => played <= step.upTo);
  const step = LEVELS[index];
  const next = LEVELS[index + 1];
  return {
    rank: step.rank,
    name: step.name,
    toNext: next ? step.upTo + 1 - played : null,
  };
}

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
