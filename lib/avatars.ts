/**
 * Avatar del profilo.
 * Sono identificativi testuali, non emoji: le icone vere sono componenti SVG
 * (vedi components/ui/Avatar.tsx), così non esiste alcun rischio di caratteri
 * corrotti fra dispositivi, sistemi operativi e file di dati.
 */

export const AVATAR_IDS = [
  "flame",
  "zap",
  "crown",
  "shield",
  "gamepad",
  "skull",
  "trophy",
  "ghost",
  "gem",
  "rocket",
  "bomb",
  "swords",
  "dice",
  "target",
  "bot",
  "brain",
  "star",
  "heart",
  "cat",
  "dog",
  "pizza",
  "popcorn",
  "music",
  "snowflake",
] as const;

export type AvatarId = (typeof AVATAR_IDS)[number];

export const DEFAULT_AVATAR: AvatarId = "flame";

export function isAvatarId(value: string): value is AvatarId {
  return (AVATAR_IDS as readonly string[]).includes(value);
}

/** Assegna un avatar diverso a ogni giocatore che entra. */
export function avatarForIndex(index: number): AvatarId {
  return AVATAR_IDS[index % AVATAR_IDS.length];
}

/**
 * Primo avatar ancora libero.
 * In una stanza due giocatori non possono avere la stessa icona: quando qualcuno
 * entra gli si dà il primo che nessuno ha preso, e se fossero finiti (non può
 * succedere con cinque giocatori e ventiquattro icone) si riparte dal primo.
 */
export function firstFreeAvatar(taken: readonly string[]): AvatarId {
  return AVATAR_IDS.find((id) => !taken.includes(id)) ?? AVATAR_IDS[0];
}

export function randomAvatar(): AvatarId {
  return AVATAR_IDS[Math.floor(Math.random() * AVATAR_IDS.length)];
}
