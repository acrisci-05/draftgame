"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createGame, reducer, type GameAction } from "./game";
import type { TranslationKey } from "./i18n";
import { getSupabase } from "./supabase";
import type { Category, GameState, RoomConfig, RoomMode } from "./types";

export type RoomStatus = "connecting" | "waiting" | "live" | "error";

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
  /** Chiave di traduzione dell'errore da mostrare, null se va tutto bene. */
  errorKey: TranslationKey | null;
  online: string[];
  isHost: boolean;
  dispatch: (action: GameAction) => void;
  /** Orologio allineato al dispositivo che ospita la stanza. */
  now: () => number;
}

const CHANNEL_PREFIX = "dg-room-";
const TICK_MS = 250;
const HELLO_RETRY_MS = 1500;


export function useRoom({ code, mode, isHost, self, category, config }: UseRoomArgs): RoomApi {
  const [state, setState] = useState<GameState | null>(null);
  const [channelStatus, setChannelStatus] = useState<RoomStatus>("connecting");
  const [channelError, setChannelError] = useState<TranslationKey | null>(null);
  const [online, setOnline] = useState<string[]>([]);
  const supabase = useMemo(() => getSupabase(), []);

  const stateRef = useRef<GameState | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const offsetRef = useRef(0);
  const selfRef = useRef(self);
  const categoryRef = useRef(category);
  const configRef = useRef(config);

  useEffect(() => {
    selfRef.current = self;
    categoryRef.current = category;
    configRef.current = config;
  }, [self, category, config]);

  const broadcastState = useCallback((next: GameState) => {
    channelRef.current?.send({
      type: "broadcast",
      event: "state",
      payload: { state: next, now: Date.now() },
    });
  }, []);

  const commit = useCallback(
    (next: GameState) => {
      if (next === stateRef.current) return;
      stateRef.current = next;
      setState(next);
      if (isHost) broadcastState(next);
    },
    [isHost, broadcastState],
  );

  const dispatch = useCallback(
    (action: GameAction) => {
      if (isHost) {
        const current = stateRef.current;
        if (!current) return;
        commit(reducer(current, action));
        return;
      }
      channelRef.current?.send({ type: "broadcast", event: "intent", payload: { action } });
    },
    [isHost, commit],
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

  /* Canale realtime (solo stanze online). */
  useEffect(() => {
    if (mode !== "online" || !supabase) return;

    const me = selfRef.current;
    const channel = supabase.channel(`${CHANNEL_PREFIX}${code}`, {
      config: { broadcast: { self: false }, presence: { key: me.id } },
    });
    channelRef.current = channel;

    channel.on("broadcast", { event: "state" }, ({ payload }) => {
      if (isHost) return;
      const incoming = payload.state as GameState;
      offsetRef.current = (payload.now as number) - Date.now();
      stateRef.current = incoming;
      setState(incoming);
      setChannelStatus("live");
    });

    channel.on("broadcast", { event: "hello" }, ({ payload }) => {
      if (!isHost) return;
      const current = stateRef.current;
      if (!current) return;
      const next = reducer(current, {
        type: "add_player",
        player: payload.player as SelfPlayer,
      });
      stateRef.current = next;
      setState(next);
      broadcastState(next);
    });

    channel.on("broadcast", { event: "intent" }, ({ payload }) => {
      if (!isHost) return;
      const current = stateRef.current;
      if (!current) return;
      commit(reducer(current, payload.action as GameAction));
    });

    channel.on("presence", { event: "sync" }, () => {
      setOnline(Object.keys(channel.presenceState()));
    });

    channel.on("presence", { event: "leave" }, ({ key }) => {
      if (!isHost) return;
      const current = stateRef.current;
      if (!current || current.phase !== "lobby" || key === current.hostId) return;
      commit(reducer(current, { type: "remove_player", playerId: key }));
    });

    channel.subscribe(async (subscription) => {
      if (subscription === "SUBSCRIBED") {
        await channel.track({ id: me.id, name: me.name });
        if (isHost) {
          setChannelStatus("live");
          if (stateRef.current) broadcastState(stateRef.current);
        } else {
          setChannelStatus("waiting");
          channel.send({ type: "broadcast", event: "hello", payload: { player: me } });
        }
        return;
      }
      if (subscription === "CHANNEL_ERROR" || subscription === "TIMED_OUT") {
        setChannelStatus("error");
        setChannelError("room.errConnection");
      }
    });

    return () => {
      channelRef.current = null;
      supabase.removeChannel(channel);
    };
  }, [code, mode, isHost, supabase, broadcastState, commit]);

  /* Chi entra continua a presentarsi finche' non riceve il primo stato. */
  useEffect(() => {
    if (mode !== "online" || isHost || channelStatus !== "waiting") return;
    const timer = setInterval(() => {
      channelRef.current?.send({
        type: "broadcast",
        event: "hello",
        payload: { player: selfRef.current },
      });
    }, HELLO_RETRY_MS);
    return () => clearInterval(timer);
  }, [mode, isHost, channelStatus]);

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

  const status: RoomStatus = mode !== "online" ? "live" : supabase ? channelStatus : "error";
  const errorKey = mode === "online" && !supabase ? "room.errKeys" : channelError;

  return { state, status, errorKey, online, isHost, dispatch, now };
}
