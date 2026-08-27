"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "violet" | "outline" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-neon text-ink font-bold hover:bg-neon-soft glow-neon disabled:bg-neon/30 disabled:text-ink/60 disabled:shadow-none",
  violet:
    "bg-violet text-white font-bold hover:bg-violet-soft glow-violet disabled:bg-violet/30 disabled:text-white/50 disabled:shadow-none",
  outline:
    "border border-line bg-surface text-zinc-100 hover:border-neon/60 hover:text-neon disabled:opacity-40",
  ghost: "text-zinc-400 hover:text-zinc-100 hover:bg-surface-2 disabled:opacity-40",
  danger: "bg-red-500/15 text-red-300 border border-red-500/40 hover:bg-red-500/25 disabled:opacity-40",
};

const SIZES: Record<Size, string> = {
  sm: "h-9 px-3 text-sm rounded-lg gap-1.5",
  md: "h-11 px-4 text-sm rounded-xl gap-2",
  lg: "h-14 px-6 text-base rounded-2xl gap-2.5",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  children: ReactNode;
}

export function Button({
  variant = "primary",
  size = "md",
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center whitespace-nowrap transition-all duration-150",
        "active:scale-[0.97] disabled:cursor-not-allowed disabled:active:scale-100",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neon",
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
