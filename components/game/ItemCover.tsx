"use client";

import { HelpCircle } from "lucide-react";
import { coverContent } from "@/lib/covers";
import { useItemImage } from "@/lib/images";
import type { CatalogItem, RosterEntry } from "@/lib/types";
import { cn } from "@/lib/utils";

type CoverSize = "xs" | "sm" | "md" | "lg" | "xl";

const SIZES: Record<CoverSize, string> = {
  xs: "size-9 rounded-lg text-[11px]",
  sm: "size-12 rounded-xl text-sm",
  md: "size-20 rounded-2xl text-xl",
  lg: "size-28 rounded-2xl text-3xl",
  xl: "w-full aspect-square rounded-3xl text-7xl",
};

const FALLBACK_ICON: Record<CoverSize, string> = {
  xs: "size-5",
  sm: "size-6",
  md: "size-8",
  lg: "size-12",
  xl: "size-24",
};

interface ItemCoverProps {
  item: CatalogItem | RosterEntry | null;
  size?: CoverSize;
  /**
   * Asta al buio: l'elemento non si deve vedere né leggere. Non basta sfocare
   * l'immagine, perché indirizzo e testo alternativo resterebbero nella pagina:
   * qui non viene proprio disegnata.
   */
  covered?: boolean;
  mystery?: boolean;
  /** Cerca online una foto reale quando l'elemento non ne ha già una. */
  auto?: boolean;
  /** Nome della categoria: rende più precisa la ricerca automatica. */
  hint?: string;
  /**
   * L'immagine e' un marchio, non una foto.
   *
   * I loghi sono quasi sempre neri su sfondo trasparente: sul fondo scuro
   * delle card sparirebbero. Qui vanno su una lastra chiara e per intero,
   * senza ritaglio -- meta' di un marchio non e' riconoscibile.
   */
  logo?: boolean;
  className?: string;
}

export function ItemCover({
  item,
  size = "md",
  covered = false,
  mystery = false,
  auto = false,
  hint,
  logo = false,
  className,
}: ItemCoverProps) {
  const hide = mystery || covered || !item;
  // Con il lotto coperto non si cerca nemmeno la foto: nessuna richiesta, nessun
  // indirizzo che passi dalla pagina prima del tempo.
  const { src, onError } = useItemImage(item, hint, auto && !hide);

  if (hide) {
    return (
      <div
        aria-label="?"
        className={cn(
          "grid shrink-0 place-items-center border",
          mystery
            ? "border-violet/50 bg-violet/15 text-violet"
            : "border-line bg-zinc-950 text-zinc-600",
          SIZES[size],
          className,
        )}
      >
        <HelpCircle className={FALLBACK_ICON[size]} />
      </div>
    );
  }

  const cover = coverContent(item);
  const large = size === "xl";

  // La lastra chiara vale solo quando c'e' davvero un'immagine: senza, resta
  // il riquadro colorato con l'emoji, che sul chiaro si leggerebbe male.
  const plate = logo && Boolean(src);

  return (
    <div
      style={large || plate ? undefined : cover.style}
      className={cn(
        "relative shrink-0 overflow-hidden border",
        // Fondo scuro fisso dietro le foto: fa risaltare PNG e JPG ad alto contrasto.
        plate ? "border-white/15 bg-white" : large ? "border-line bg-zinc-950" : "border-white/10",
        SIZES[size],
        className,
      )}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={item.name}
          loading="lazy"
          crossOrigin="anonymous"
          referrerPolicy="no-referrer"
          onError={onError}
          className={cn(
            large
              ? "h-full w-full object-contain p-6 transition-all duration-300 hover:scale-105"
              : "size-full object-cover",
            large && !plate && "drop-shadow-2xl",
            // Un marchio non si ritaglia mai, nemmeno nelle miniature.
            plate && !large && "size-full object-contain p-1.5",
          )}
        />
      ) : (
        <div
          style={large ? cover.style : undefined}
          className="grid size-full place-items-center font-black text-white/90"
        >
          <span
            className={cn(
              large &&
                "grid size-28 place-items-center rounded-3xl border border-white/15 bg-black/30 backdrop-blur-sm",
            )}
          >
            {cover.emoji ?? cover.label}
          </span>
        </div>
      )}
    </div>
  );
}
