"use client";

import type { InputHTMLAttributes, TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
}

export function Input({ label, hint, className, id, ...props }: InputProps) {
  return (
    <label className="block" htmlFor={id}>
      {label ? (
        <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-faint">
          {label}
        </span>
      ) : null}
      <input
        id={id}
        className={cn(
          "h-12 w-full rounded-xl border border-line bg-surface-2 px-4 text-base text-fg placeholder:text-faint/70",
          "transition-colors focus:border-neon/70 focus:outline-none",
          className,
        )}
        {...props}
      />
      {hint ? <span className="mt-1.5 block text-xs text-faint">{hint}</span> : null}
    </label>
  );
}

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
}

export function Textarea({ label, className, id, ...props }: TextareaProps) {
  return (
    <label className="block" htmlFor={id}>
      {label ? (
        <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-faint">
          {label}
        </span>
      ) : null}
      <textarea
        id={id}
        className={cn(
          "min-h-28 w-full rounded-xl border border-line bg-surface-2 p-3 text-sm text-fg placeholder:text-faint/70",
          "transition-colors focus:border-neon/70 focus:outline-none",
          className,
        )}
        {...props}
      />
    </label>
  );
}
