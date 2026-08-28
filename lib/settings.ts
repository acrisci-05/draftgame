"use client";

import { useCallback } from "react";
import { notifyClientStore, useClientValue } from "./client-store";
import {
  DEFAULT_LOCALE,
  detectLocale,
  isLocale,
  localeDir,
  translate,
  type TranslateParams,
  type TranslationKey,
} from "./i18n";
import type { Locale } from "./types";

export type Theme = "dark" | "light";

export interface Settings {
  locale: Locale;
  theme: Theme;
  sound: boolean;
}

export const SETTINGS_KEY = "pp:settings";

export const DEFAULT_SETTINGS: Settings = {
  locale: DEFAULT_LOCALE,
  theme: "dark",
  sound: true,
};

/** Lingua del browser: usata solo finché l'utente non ne sceglie una. */
function browserLocale(): Locale {
  if (typeof navigator === "undefined") return DEFAULT_LOCALE;
  const candidates = navigator.languages?.length ? navigator.languages : [navigator.language];
  return detectLocale(candidates.filter(Boolean)) ?? DEFAULT_LOCALE;
}

export function readSettings(): Settings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS, locale: browserLocale() };
    const parsed = JSON.parse(raw) as Partial<Settings>;
    return {
      locale: isLocale(parsed.locale) ? parsed.locale : browserLocale(),
      theme: parsed.theme === "light" ? "light" : "dark",
      sound: parsed.sound !== false,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function writeSettings(patch: Partial<Settings>) {
  if (typeof window === "undefined") return;
  const next = { ...readSettings(), ...patch };
  try {
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
  } catch {
    /* storage non disponibile: le preferenze restano valide per la sessione */
  }
  applySettings(next);
  notifyClientStore();
}

/** Allinea l'elemento html a tema, lingua e direzione del testo. */
export function applySettings(settings: Settings) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.dataset.theme = settings.theme;
  root.lang = settings.locale;
  root.dir = localeDir(settings.locale);
}

export interface SettingsApi extends Settings {
  dir: "ltr" | "rtl";
  setLocale: (locale: Locale) => void;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  setSound: (sound: boolean) => void;
  toggleSound: () => void;
  t: (key: TranslationKey, params?: TranslateParams) => string;
}

export function useSettings(): SettingsApi {
  const settings = useClientValue(readSettings, DEFAULT_SETTINGS);

  const setLocale = useCallback((locale: Locale) => writeSettings({ locale }), []);
  const setTheme = useCallback((theme: Theme) => writeSettings({ theme }), []);
  const setSound = useCallback((sound: boolean) => writeSettings({ sound }), []);

  const toggleTheme = useCallback(
    () => writeSettings({ theme: readSettings().theme === "dark" ? "light" : "dark" }),
    [],
  );
  const toggleSound = useCallback(() => writeSettings({ sound: !readSettings().sound }), []);

  const t = useCallback(
    (key: TranslationKey, params?: TranslateParams) => translate(settings.locale, key, params),
    [settings.locale],
  );

  return {
    ...settings,
    dir: localeDir(settings.locale),
    setLocale,
    setTheme,
    toggleTheme,
    setSound,
    toggleSound,
    t,
  };
}

/** Solo la traduzione, per i componenti che non toccano le altre preferenze. */
export function useT() {
  return useSettings().t;
}
