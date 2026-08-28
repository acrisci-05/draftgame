"use client";

import {
  Crown,
  Flame,
  Gamepad2,
  Gem,
  Ghost,
  Shield,
  Skull,
  Trophy,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { AVATAR_IDS, isAvatarId, type AvatarId } from "@/lib/avatars";
import { cn } from "@/lib/utils";

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

/** Selettore: cerchi affiancati, quello attivo con bordo verde neon. */
export function AvatarPicker({
  value,
  onChange,
  className,
}: {
  value: string;
  onChange: (id: AvatarId) => void;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {AVATAR_IDS.map((id) => (
        <button
          key={id}
          type="button"
          aria-label={id}
          aria-pressed={id === value}
          onClick={() => onChange(id)}
          className="rounded-full transition-transform hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neon"
        >
          <Avatar id={id} selected={id === value} />
        </button>
      ))}
    </div>
  );
}
