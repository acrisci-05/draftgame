"use client";

import {
  Bomb,
  Bot,
  Brain,
  Cat,
  Clover,
  Coins,
  Crown,
  Dices,
  Dog,
  Flame,
  Gamepad2,
  Gavel,
  Gem,
  Ghost,
  Glasses,
  Heart,
  Medal,
  Music,
  Palette,
  Pizza,
  Popcorn,
  Rocket,
  Shield,
  Skull,
  Snowflake,
  Star,
  Swords,
  Target,
  Trophy,
  Zap,
  createLucideIcon,
  type LucideIcon,
} from "lucide-react";
import { AVATAR_IDS, isAvatarId, type AvatarId } from "@/lib/avatars";
import { cn } from "@/lib/utils";

/**
 * L'alieno, disegnato a mano.
 *
 * E' l'unico dei sette nuovi che la libreria non ha: lucide-react non contiene
 * nessuna icona "alien". Invece di ripiegare su un razzo o un robot -- che ci
 * sono gia' entrambi in elenco -- lo si costruisce con lo stesso attrezzo che
 * la libreria usa per i suoi: stessa griglia 24x24, stesso tratto che segue lo
 * spessore chiesto, stesse estremita' arrotondate. Accanto agli altri non si
 * distingue, ed e' il punto.
 */
const Alien = createLucideIcon("Alien", [
  // Testa: larga in alto, che si stringe fino al mento.
  ["path", { d: "M12 21c-4.2-3-8-6.7-8-11.3C4 5.5 7.6 3 12 3s8 2.5 8 6.7c0 4.6-3.8 8.3-8 11.3Z", key: "alien-head" }],
  // Occhi a mandorla, inclinati verso il basso e verso l'interno.
  ["ellipse", { cx: "9", cy: "10.4", rx: "1.3", ry: "2", transform: "rotate(-28 9 10.4)", key: "alien-eye-left" }],
  ["ellipse", { cx: "15", cy: "10.4", rx: "1.3", ry: "2", transform: "rotate(28 15 10.4)", key: "alien-eye-right" }],
]);

const ICONS: Record<AvatarId, LucideIcon> = {
  flame: Flame,
  zap: Zap,
  crown: Crown,
  shield: Shield,
  gamepad: Gamepad2,
  skull: Skull,
  trophy: Trophy,
  ghost: Ghost,
  gem: Gem,
  rocket: Rocket,
  bomb: Bomb,
  swords: Swords,
  dice: Dices,
  target: Target,
  bot: Bot,
  brain: Brain,
  star: Star,
  heart: Heart,
  cat: Cat,
  dog: Dog,
  pizza: Pizza,
  popcorn: Popcorn,
  music: Music,
  snowflake: Snowflake,
  gavel: Gavel,
  coins: Coins,
  clover: Clover,
  medal: Medal,
  glasses: Glasses,
  alien: Alien,
  palette: Palette,
};

type AvatarSize = "xs" | "sm" | "md" | "lg";

const RING: Record<AvatarSize, string> = {
  xs: "size-7",
  sm: "size-9",
  md: "size-11",
  lg: "size-14",
};

const GLYPH: Record<AvatarSize, string> = {
  xs: "size-3.5",
  sm: "size-4",
  md: "size-5",
  lg: "size-7",
};

/** Solo l'icona, senza cerchio: utile dentro layout a misura fissa. */
export function AvatarGlyph({
  id,
  className,
  size,
  strokeWidth = 2.2,
}: {
  id: string;
  className?: string;
  /** Misura in pixel: serve dove il layout è a dimensioni fisse, come la card esportata. */
  size?: number;
  strokeWidth?: number;
}) {
  if (!isAvatarId(id)) {
    // Profili salvati prima del passaggio alle icone: si mostra il valore vecchio.
    return <span className={className}>{id}</span>;
  }
  const Icon = ICONS[id];
  return <Icon className={className} size={size} strokeWidth={strokeWidth} aria-hidden />;
}

/** Avatar in cerchio scuro, con bordo neon quando è quello scelto. */
export function Avatar({
  id,
  size = "md",
  selected = false,
  className,
}: {
  id: string;
  size?: AvatarSize;
  selected?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "grid shrink-0 place-items-center rounded-full bg-zinc-800 text-zinc-100",
        RING[size],
        selected ? "border-2 border-green-500 text-green-400 glow-neon" : "border border-white/10",
        className,
      )}
    >
      <AvatarGlyph id={id} className={GLYPH[size]} />
    </span>
  );
}

/**
 * Selettore: cerchi affiancati, quello attivo con bordo verde neon.
 * Gli avatar già presi da un altro giocatore restano visibili ma spenti, così
 * si capisce a colpo d'occhio quali sono ancora liberi.
 */
export function AvatarPicker({
  value,
  onChange,
  taken = [],
  className,
}: {
  value: string;
  onChange: (id: AvatarId) => void;
  /** Avatar di altri giocatori: non selezionabili. */
  taken?: readonly string[];
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {AVATAR_IDS.map((id) => {
        const used = id !== value && taken.includes(id);
        return (
          <button
            key={id}
            type="button"
            aria-label={id}
            aria-pressed={id === value}
            disabled={used}
            onClick={() => onChange(id)}
            className={cn(
              "rounded-full transition-transform focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neon",
              used ? "cursor-not-allowed opacity-30" : "hover:scale-105",
            )}
          >
            <Avatar id={id} selected={id === value} />
          </button>
        );
      })}
    </div>
  );
}
