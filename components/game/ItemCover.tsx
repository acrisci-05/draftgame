"use client";

import { HelpCircle } from "lucide-react";
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
  if (mystery || !item) {
    return (
      <div
        className={cn(
          "grid shrink-0 place-items-center border border-violet/50 bg-violet/15 text-violet",
          SIZES[size],
          className,
        )}
      >
        <HelpCircle
          className={
            size === "xl"
              ? "size-24"
              : size === "lg"
                ? "size-12"
                : size === "md"
                  ? "size-8"
                  : "size-5"
          }
        />
      </div>
    );
  }

  const cover = coverContent(item);

  return (
    <div
      style={cover.style}
      className={cn(
        "relative shrink-0 overflow-hidden border border-white/10",
        SIZES[size],
        className,
      )}
    >
      {cover.image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={cover.image}
          alt=""
          className={cn("size-full object-cover", blurred && "blur-md scale-110")}
        />
      ) : (
        <div
          className={cn(
            "grid size-full place-items-center font-black text-white/90",
            blurred && "blur-md scale-110",
          )}
        >
          {cover.emoji ?? cover.label}
        </div>
      )}
    </div>
  );
}
