"use client";

import { HelpCircle } from "lucide-react";
import { useState } from "react";
import { coverContent } from "@/lib/covers";
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
  blurred?: boolean;
  mystery?: boolean;
  className?: string;
}

export function ItemCover({
  item,
  size = "md",
  blurred = false,
  mystery = false,
  className,
}: ItemCoverProps) {
  const [broken, setBroken] = useState(false);

  if (mystery || !item) {
    return (
      <div
        className={cn(
          "grid shrink-0 place-items-center border border-violet/50 bg-violet/15 text-violet",
          SIZES[size],
          className,
        )}
      >
        <HelpCircle className={FALLBACK_ICON[size]} />
      </div>
    );
  }

  const cover = coverContent(item);
  const showImage = Boolean(cover.image) && !broken;

  return (
    <div
      style={cover.style}
      className={cn(
        "relative shrink-0 overflow-hidden border border-white/10",
        SIZES[size],
        className,
      )}
    >
      {showImage ? (
        // Immagine remota: crossOrigin serve a poterla riesportare nella card PNG.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={cover.image}
          alt=""
          loading="lazy"
          crossOrigin="anonymous"
          referrerPolicy="no-referrer"
          onError={() => setBroken(true)}
          className={cn("size-full object-cover", blurred && "scale-110 blur-md")}
        />
      ) : (
        <div
          className={cn(
            "grid size-full place-items-center font-black text-white/90",
            blurred && "scale-110 blur-md",
          )}
        >
          {cover.emoji ?? cover.label}
        </div>
      )}
    </div>
  );
}
