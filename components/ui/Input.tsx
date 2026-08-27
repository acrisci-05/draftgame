"use client";

import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
}

export function Input({ label, hint, className, id, ...props }: InputProps) {
  return (
    <label className="block" htmlFor={id}>
      {label ? (
        <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-zinc-500">
          {label}
        </span>
      ) : null}
      <input
        id={id}
        className={cn(
          "h-12 w-full rounded-xl border border-line bg-surface px-4 text-base text-zinc-100 placeholder:text-zinc-600",
          "transition-colors focus:border-neon/70 focus:outline-none",
          className,
        )}
        {...props}
      />
      {hint ? <span className="mt-1.5 block text-xs text-zinc-500">{hint}</span> : null}
    </label>
  );
}
