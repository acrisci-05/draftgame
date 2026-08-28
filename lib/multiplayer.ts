"use client";

import type { RealtimeChannel } from "@supabase/supabase-js";
import type { GameAction } from "./game";
import { getSupabase } from "./supabase";
import type { GameState } from "./types";

/**
 * Trasporto delle stanze online.
 *
 * Due implementazioni con la stessa interfaccia:
 * - `supabase`: canale realtime, funziona fra dispositivi diversi ovunque;
 * - `local`: BroadcastChannel del browser, funziona fra schede e finestre dello
 *   stesso computer. Serve a provare subito una partita online senza database.
 *
 * Il modello è lo stesso in entrambi i casi: chi crea la stanza è l'autorità sullo
 * stato, gli altri mandano intenzioni e ricevono lo stato aggiornato.
 */

export interface RoomPeer {
  id: string;
  name: string;
  emoji: string;
}

export type RoomMessage =
  | { type: "state"; state: GameState; now: number }
  | { type: "hello"; player: RoomPeer }
  | { type: "intent"; action: GameAction };

export type TransportStatus = "connecting" | "waiting" | "live" | "error";

export type TransportKind = "supabase" | "local";

export interface TransportHandlers {
  onMessage: (message: RoomMessage) => void;
  onStatus: (status: TransportStatus) => void;
  onPresence?: (ids: string[]) => void;
  onLeave?: (id: string) => void;
}

export interface RoomTransport {
  kind: TransportKind;
  send: (message: RoomMessage) => void;
  close: () => void;
}

const CHANNEL_PREFIX = "pp-room-";
const STATE_PREFIX = "pp:room-state:";

/** Quale trasporto verrà usato con la configurazione attuale. */
export function transportKind(): TransportKind {
  return getSupabase() ? "supabase" : "local";
}

/* ------------------------------------------------------------------ */
/* Trasporto via database (fra dispositivi diversi)                    */
/* ------------------------------------------------------------------ */

function createSupabaseTransport(
  code: string,
  self: RoomPeer,
  isHost: boolean,
  handlers: TransportHandlers,
): RoomTransport | null {
  const supabase = getSupabase();
  if (!supabase) return null;

  const channel: RealtimeChannel = supabase.channel(`${CHANNEL_PREFIX}${code}`, {
    config: { broadcast: { self: false }, presence: { key: self.id } },
  });

  channel.on("broadcast", { event: "message" }, ({ payload }) => {
    handlers.onMessage(payload as RoomMessage);
  });

  channel.on("presence", { event: "sync" }, () => {
    handlers.onPresence?.(Object.keys(channel.presenceState()));
  });

  channel.on("presence", { event: "leave" }, ({ key }) => {
    handlers.onLeave?.(key as string);
  });

  handlers.onStatus("connecting");

  channel.subscribe(async (status) => {
    if (status === "SUBSCRIBED") {
      await channel.track({ id: self.id, name: self.name });
      handlers.onStatus(isHost ? "live" : "waiting");
      return;
    }
    if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
      handlers.onStatus("error");
    }
  });

  return {
    kind: "supabase",
    send: (message) => {
      void channel.send({ type: "broadcast", event: "message", payload: message });
    },
    close: () => {
      void supabase.removeChannel(channel);
    },
  };
}

/* ------------------------------------------------------------------ */
/* Trasporto locale (schede e finestre dello stesso browser)           */
/* ------------------------------------------------------------------ */

function readSavedState(code: string): { state: GameState; now: number } | null {
  try {
    const raw = window.localStorage.getItem(STATE_PREFIX + code);
    return raw ? (JSON.parse(raw) as { state: GameState; now: number }) : null;
  } catch {
    return null;
  }
}

function saveState(code: string, state: GameState, now: number) {
  try {
    window.localStorage.setItem(STATE_PREFIX + code, JSON.stringify({ state, now }));
  } catch {
    /* senza storage la stanza vive solo finché le schede restano aperte */
  }
}

function createLocalTransport(
  code: string,
  self: RoomPeer,
  isHost: boolean,
  handlers: TransportHandlers,
): RoomTransport {
  const channel = new BroadcastChannel(`${CHANNEL_PREFIX}${code}`);

  channel.onmessage = (event: MessageEvent<RoomMessage>) => {
    handlers.onMessage(event.data);
  };

  handlers.onStatus("connecting");

  // Chi entra recupera subito l'ultimo stato salvato dall'host, poi si presenta.
  window.setTimeout(() => {
    if (isHost) {
      handlers.onStatus("live");
      return;
    }
    const saved = readSavedState(code);
    if (saved) {
      handlers.onMessage({ type: "state", state: saved.state, now: saved.now });
      handlers.onStatus("live");
    } else {
      handlers.onStatus("waiting");
    }
    channel.postMessage({ type: "hello", player: self } satisfies RoomMessage);
  }, 0);

  return {
    kind: "local",
    send: (message) => {
      if (message.type === "state") saveState(code, message.state, message.now);
      channel.postMessage(message);
    },
    close: () => channel.close(),
  };
}

export function createTransport(
  code: string,
  self: RoomPeer,
  isHost: boolean,
  handlers: TransportHandlers,
): RoomTransport {
  return (
    createSupabaseTransport(code, self, isHost, handlers) ??
    createLocalTransport(code, self, isHost, handlers)
  );
}
