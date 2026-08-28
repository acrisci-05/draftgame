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

export function randomAvatar(): AvatarId {
  return AVATAR_IDS[Math.floor(Math.random() * AVATAR_IDS.length)];
}
