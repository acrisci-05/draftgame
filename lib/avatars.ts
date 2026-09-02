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
  /*
   * Aste, soldi e fortuna: sette icone a tema.
   *
   * In coda e non in mezzo, perche' l'ordine di questo elenco decide quale
   * avatar tocca a chi entra in stanza: infilarle prima avrebbe cambiato
   * l'icona di partenza a tutti quelli gia' seduti.
   */
  "gavel",
  "clover",
  "medal",
  "glasses",
  "alien",
  "palette",
  /*
   * Il secondo gruppo tematico: nottambuli, veloci, caotici e chi si difende.
   *
   * In coda come il primo, e per la stessa ragione: l'ordine di questo elenco
   * decide quale avatar tocca a chi entra in stanza, e infilarli in mezzo lo
   * cambierebbe a tutti quelli gia' seduti.
   */
  "moon",
  "rabbit",
  "toilet",
  "magnet",
  "banana",
  "fish",
  "cactus",
  "goat",
  "chef",
] as const;

export type AvatarId = (typeof AVATAR_IDS)[number];

export const DEFAULT_AVATAR: AvatarId = "flame";

export function isAvatarId(value: string): value is AvatarId {
  return (AVATAR_IDS as readonly string[]).includes(value);
}

/**
 * Avatar tolti dall'elenco, e cosa mostrare a chi li aveva scelti.
 *
 * Togliere un'icona non e' come aggiungerla: chi l'aveva addosso se la porta
 * scritta nel profilo, e senza questa mappa si ritroverebbe la parola
 * "coins" stampata al posto del disegno -- il ripiego per i profili
 * antichi, salvati quando gli avatar erano ancora testo.
 *
 * Non si sceglie piu' dalla griglia, ma continua a vedersi: la moneta
 * diventa la gemma, che e' la cosa piu' vicina rimasta.
 */
const RETIRED: Readonly<Record<string, AvatarId>> = { coins: "gem" };

/** L'avatar da disegnare per un valore salvato, anche se non e' piu' in elenco. */
export function resolveAvatar(value: string): AvatarId | null {
  if (isAvatarId(value)) return value;
  return RETIRED[value] ?? null;
}

/** Assegna un avatar diverso a ogni giocatore che entra. */
export function avatarForIndex(index: number): AvatarId {
  return AVATAR_IDS[index % AVATAR_IDS.length];
}

/**
 * Primo avatar ancora libero.
 * In una stanza due giocatori non possono avere la stessa icona: quando qualcuno
 * entra gli si dà il primo che nessuno ha preso, e se fossero finiti (non può
 * succedere con cinque giocatori e trentanove icone) si riparte dal primo.
 */
export function firstFreeAvatar(taken: readonly string[]): AvatarId {
  return AVATAR_IDS.find((id) => !taken.includes(id)) ?? AVATAR_IDS[0];
}

export function randomAvatar(): AvatarId {
  return AVATAR_IDS[Math.floor(Math.random() * AVATAR_IDS.length)];
}
