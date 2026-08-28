"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createGame, reducer, type GameAction } from "./game";
import type { TranslationKey } from "./i18n";
import {
  createTransport,
  transportKind,
  type RoomMessage,
  type RoomTransport,
  type TransportKind,
  type TransportStatus,
} from "./multiplayer";
import type { Category, GameState, RoomConfig, RoomMode } from "./types";

export type RoomStatus = TransportStatus;

interface SelfPlayer {
  id: string;
  name: string;
  emoji: string;
}

interface UseRoomArgs {
  code: string;
  mode: RoomMode;
  isHost: boolean;
  self: SelfPlayer;
  /** Catalogo iniziale, usato solo dal dispositivo che ospita la stanza. */
  category: Category | null;
  /** Regole scelte in configurazione, usate solo da chi ospita la stanza. */
  config?: RoomConfig;
}

export interface RoomApi {
  state: GameState | null;
  status: RoomStatus;
  /** Chiave di traduzione dell'errore, non un testo già formato. */
  error: TranslationKey | null;
  online: string[];
  isHost: boolean;
  /** Come viaggiano i dati: database in cloud oppure solo su questo browser. */
  transport: TransportKind;
  dispatch: (action: GameAction) => void;
  /** Orologio allineato al dispositivo che ospita la stanza. */
  now: () => number;
}

const TICK_MS = 250;
const HELLO_RETRY_MS = 1500;

export function useRoom({ code, mode, isHost, self, category, config }: UseRoomArgs): RoomApi {
  const [state, setState] = useState<GameState | null>(null);
  const [status, setStatus] = useState<RoomStatus>("connecting");
  const [error, setError] = useState<TranslationKey | null>(null);
  const [online, setOnline] = useState<string[]>([]);

  const stateRef = useRef<GameState | null>(null);
  const transportRef = useRef<RoomTransport | null>(null);
  const offsetRef = useRef(0);
  const selfRef = useRef(self);
  const categoryRef = useRef(category);
  const configRef = useRef(config);
  const isHostRef = useRef(isHost);

  useEffect(() => {
    selfRef.current = self;
    categoryRef.current = category;
    configRef.current = config;
    isHostRef.current = isHost;
  }, [self, category, config, isHost]);

  const broadcastState = useCallback((next: GameState) => {
    transportRef.current?.send({ type: "state", state: next, now: Date.now() });
  }, []);

  const commit = useCallback(
    (next: GameState) => {
      if (next === stateRef.current) return;
      stateRef.current = next;
      setState(next);
      if (isHostRef.current) broadcastState(next);
    },
    [broadcastState],
  );

  const dispatch = useCallback(
    (action: GameAction) => {
      if (isHostRef.current) {
        const current = stateRef.current;
        if (!current) return;
        commit(reducer(current, action));
        return;
      }
      transportRef.current?.send({ type: "intent", action });
    },
    [commit],
  );

  /* Creazione dello stato iniziale sul dispositivo che ospita la stanza. */
  useEffect(() => {
    if (!isHost || stateRef.current) return;
    const cat = categoryRef.current;
    if (!cat) return;
    const base = createGame({
      code,
      mode,
      hostId: selfRef.current.id,
      category: cat,
      config: configRef.current,
    });
    const withHost = reducer(base, { type: "add_player", player: selfRef.current });
    stateRef.current = withHost;
    setState(withHost);
  }, [code, mode, isHost, category]);

  /* Canale della stanza: database in cloud oppure BroadcastChannel locale. */
  useEffect(() => {
    // In locale non serve alcun canale: lo stato vive solo su questo dispositivo.
    if (mode !== "online") return;

    const me = selfRef.current;

    const handleMessage = (message: RoomMessage) => {
      const host = isHostRef.current;

      if (message.type === "state") {
        if (host) return;
        offsetRef.current = message.now - Date.now();
        stateRef.current = message.state;
        setState(message.state);
        setStatus("live");
        return;
      }

      if (!host) return;
      const current = stateRef.current;
      if (!current) return;

      if (message.type === "hello") {
        const next = reducer(current, { type: "add_player", player: message.player });
        stateRef.current = next;
        setState(next);
        // Si ritrasmette sempre: chi entra deve ricevere lo stato anche se era già in lista.
        broadcastState(next);
        return;
      }

      commit(reducer(current, message.action));
    };

    const transport = createTransport(code, me, isHost, {
      onMessage: handleMessage,
      onStatus: (next) => {
        setStatus(next);
        setError(next === "error" ? "room.errConnection" : null);
      },
      onPresence: setOnline,
      onLeave: (id) => {
        if (!isHostRef.current) return;
        const current = stateRef.current;
        if (!current || current.phase !== "lobby" || id === current.hostId) return;
        commit(reducer(current, { type: "remove_player", playerId: id }));
      },
    });

    transportRef.current = transport;

    return () => {
      transportRef.current = null;
      transport.close();
    };
  }, [code, mode, isHost, broadcastState, commit]);

  /* Chi entra continua a presentarsi finché non riceve il primo stato. */
  useEffect(() => {
    if (mode !== "online" || isHost || status !== "waiting") return;
    const timer = setInterval(() => {
      transportRef.current?.send({ type: "hello", player: selfRef.current });
    }, HELLO_RETRY_MS);
    return () => clearInterval(timer);
  }, [mode, isHost, status]);

  /* Il timer dell'asta gira sul dispositivo che ospita la stanza. */
  useEffect(() => {
    if (!isHost) return;
    const timer = setInterval(() => {
      const current = stateRef.current;
      if (!current) return;
      if (current.phase !== "auction" && current.phase !== "result") return;
      commit(reducer(current, { type: "tick", now: Date.now() }));
    }, TICK_MS);
    return () => clearInterval(timer);
  }, [isHost, commit]);

  const now = useCallback(() => Date.now() + offsetRef.current, []);

  return {
    state,
    status: mode === "local" ? "live" : status,
    error,
    online,
    isHost,
    transport: transportKind(),
    dispatch,
    now,
  };
}
