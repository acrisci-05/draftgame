import type { Locale } from "../types";
import { it, type Dictionary, type PartialDictionary, type TranslationKey } from "./it";
import { en } from "./en";
import { fr } from "./fr";
import { es } from "./es";
import { de } from "./de";
import { pt } from "./pt";
import { ru } from "./ru";
import { zh } from "./zh";
import { ja } from "./ja";
import { ar } from "./ar";

export type { Dictionary, PartialDictionary, TranslationKey };

export interface LanguageOption {
  code: Locale;
  /** Nome della lingua nella lingua stessa. */
  label: string;
  flag: string;
  dir: "ltr" | "rtl";
}

/** Ordine mostrato nel selettore: la lingua di partenza è la prima. */
export const LANGUAGES: LanguageOption[] = [
  { code: "it", label: "Italiano", flag: "🇮🇹", dir: "ltr" },
  { code: "en", label: "English", flag: "🇬🇧", dir: "ltr" },
  { code: "fr", label: "Français", flag: "🇫🇷", dir: "ltr" },
  { code: "es", label: "Español", flag: "🇪🇸", dir: "ltr" },
  { code: "de", label: "Deutsch", flag: "🇩🇪", dir: "ltr" },
  { code: "pt", label: "Português", flag: "🇵🇹", dir: "ltr" },
  { code: "ru", label: "Русский", flag: "🇷🇺", dir: "ltr" },
  { code: "zh", label: "中文", flag: "🇨🇳", dir: "ltr" },
  { code: "ja", label: "日本語", flag: "🇯🇵", dir: "ltr" },
  { code: "ar", label: "العربية", flag: "🇸🇦", dir: "rtl" },
];

export const LOCALES: Locale[] = LANGUAGES.map((language) => language.code);

export const DEFAULT_LOCALE: Locale = "it";

/** L'italiano è la lingua sorgente ed è sempre completo; le altre possono essere parziali. */
const DICTIONARIES: Record<Locale, PartialDictionary> = { it, en, fr, es, de, pt, ru, zh, ja, ar };

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && LOCALES.includes(value as Locale);
}

export function languageOption(locale: Locale): LanguageOption {
  return LANGUAGES.find((language) => language.code === locale) ?? LANGUAGES[0];
}

export function localeDir(locale: Locale): "ltr" | "rtl" {
  return languageOption(locale).dir;
}

/** Lingua del browser, usata solo se non c'è ancora una preferenza salvata. */
export function detectLocale(candidates: readonly string[]): Locale | null {
  for (const candidate of candidates) {
    const base = candidate.toLowerCase().split("-")[0];
    if (isLocale(base)) return base;
  }
  return null;
}

export type TranslateParams = Record<string, string | number>;

export function translate(
  locale: Locale,
  key: TranslationKey,
  params?: TranslateParams,
): string {
  const dictionary = DICTIONARIES[locale] ?? DICTIONARIES[DEFAULT_LOCALE];
  // Catena di ripiego: lingua scelta, poi inglese, poi italiano.
  const template = dictionary[key] ?? DICTIONARIES.en[key] ?? (it as Dictionary)[key] ?? key;
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match,
  );
}
