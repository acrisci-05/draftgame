"use client";

import { useEffect, useState } from "react";
import { notifyClientStore, useClientValue, useIsClient } from "./client-store";

/** Rilevamento del dispositivo e stato dell'installazione sulla schermata Home. */

const DISMISSED_KEY = "pp:install-dismissed";

export type Platform = "ios" | "android" | "desktop";

export function detectPlatform(): Platform {
  if (typeof navigator === "undefined") return "desktop";
  const ua = navigator.userAgent;
  // Gli iPad recenti si presentano come Mac: si riconoscono dal touch.
  const isIpad = /Macintosh/.test(ua) && navigator.maxTouchPoints > 1;
  if (/iPad|iPhone|iPod/.test(ua) || isIpad) return "ios";
  if (/Android/.test(ua)) return "android";
  return "desktop";
}

/** true quando il sito gira già come app installata. */
export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const iosStandalone = (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return iosStandalone || window.matchMedia("(display-mode: standalone)").matches;
}

export function readDismissed(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(DISMISSED_KEY) === "1";
  } catch {
    return false;
  }
}

export function dismissInstall() {
  try {
    window.localStorage.setItem(DISMISSED_KEY, "1");
  } catch {
    /* senza storage il banner ricompare alla prossima visita */
  }
  notifyClientStore();
}

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export interface InstallState {
  ready: boolean;
  platform: Platform;
  mobile: boolean;
  installed: boolean;
  dismissed: boolean;
  /** Disponibile solo dove il browser offre l'installazione automatica. */
  promptInstall: (() => Promise<void>) | null;
}

export function useInstallState(): InstallState {
  const isClient = useIsClient();
  const dismissed = useClientValue(readDismissed, false);
  const [deferred, setDeferred] = useState<InstallPromptEvent | null>(null);

  useEffect(() => {
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setDeferred(event as InstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  const platform = isClient ? detectPlatform() : "desktop";

  return {
    ready: isClient,
    platform,
    mobile: platform !== "desktop",
    installed: isClient && isStandalone(),
    dismissed,
    promptInstall: deferred
      ? async () => {
          await deferred.prompt();
          await deferred.userChoice;
          setDeferred(null);
        }
      : null,
  };
}
