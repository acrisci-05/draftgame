"use client";

import { LANGUAGES } from "@/lib/i18n";
import { useSettings } from "@/lib/settings";
import type { Locale } from "@/lib/types";
import { cn } from "@/lib/utils";

interface LanguagePickerProps {
  /** Chiamata dopo la scelta: utile per chiudere il menu che contiene il selettore. */
  onPicked?: (locale: Locale) => void;
  className?: string;
}

/** Pillole con bandiera e nome nella lingua stessa: il glow resta solo sull'attiva. */
export function LanguagePicker({ onPicked, className }: LanguagePickerProps) {
  const { locale, setLocale } = useSettings();

  return (
    <div className={cn("flex flex-wrap gap-1.5", className)}>
      {LANGUAGES.map((language) => {
        const selected = language.code === locale;
        return (
          <button
            key={language.code}
            type="button"
            lang={language.code}
            aria-pressed={selected}
            onClick={() => {
              setLocale(language.code);
              onPicked?.(language.code);
            }}
            className={cn(
              "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-all",
              selected
                ? "border-neon/70 bg-neon/15 font-bold text-neon glow-neon"
                : "border-line bg-surface-2 text-muted hover:border-neon/40 hover:text-fg",
            )}
          >
            <span className="text-base leading-none">{language.flag}</span>
            <span className="truncate">{language.label}</span>
          </button>
        );
      })}
    </div>
  );
}
