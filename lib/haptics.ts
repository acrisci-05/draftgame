"use client";

/** Vibrazione breve sui dispositivi che la supportano. Silenziosa altrove. */
export function vibrate(pattern: number | number[] = 18) {
  if (typeof navigator === "undefined") return;
  const vibrator = navigator as Navigator & { vibrate?: (pattern: number | number[]) => boolean };
  try {
    vibrator.vibrate?.(pattern);
  } catch {
    /* alcuni browser bloccano la vibrazione senza interazione: si ignora */
  }
}

export const HAPTIC_BID = 18;
export const HAPTIC_WIN = [24, 40, 24];
export const HAPTIC_PASS = 10;
