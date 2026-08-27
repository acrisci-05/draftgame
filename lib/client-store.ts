"use client";

import { useCallback, useRef, useSyncExternalStore } from "react";

/**
 * Ponte fra i dati salvati sul dispositivo (localStorage) e React.
 * Ogni scrittura incrementa la versione: i componenti in ascolto rileggono il valore.
 */

let version = 0;
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  const onStorage = () => {
    version += 1;
    listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function notifyClientStore() {
  version += 1;
  listeners.forEach((listener) => listener());
}

const noopSubscribe = () => () => {};

/** true solo dopo l'idratazione: utile per i valori disponibili sul solo browser. */
export function useIsClient(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}

/**
 * Legge un valore dal dispositivo mantenendone stabile l'identità fra i render.
 * `read` deve essere una funzione stabile (modulo o useCallback).
 */
export function useClientValue<T>(read: () => T, serverValue: T): T {
  const cache = useRef<{ version: number; read: () => T; value: T } | null>(null);

  const getSnapshot = useCallback(() => {
    const current = cache.current;
    if (current && current.version === version && current.read === read) {
      return current.value;
    }
    const next = { version, read, value: read() };
    cache.current = next;
    return next.value;
  }, [read]);

  return useSyncExternalStore(subscribe, getSnapshot, () => serverValue);
}
