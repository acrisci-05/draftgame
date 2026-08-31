"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createGame, nextHost, reducer, type GameAction } from "./game";
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
  /** Profilo di chi ha fatto l'accesso, per ritrovarsi fra i Pickmates. */
  accountId?: string;
  /** Nickname fisso dell'account: la card lo mostra sotto il nome di partita. */
  handle?: string;
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
/**
 * Quanto si aspetta prima di dare per perso chi ospita la stanza. Un buco di
 * rete di due secondi non deve far cambiare host: la soglia sta sopra il tempo
 * di un rientro dall'app in secondo piano.
 */
const HOST_GRACE_MS = 6000;

export function useRoom({ code, mode, isHost, self, category, config }: UseRoomArgs): RoomApi {
  const [state, setState] = useState<GameState | null>(null);
  const [status, setStatus] = useState<RoomStatus>("connecting");
  const [error, setError] = useState<TranslationKey | null>(null);
  const [online, setOnline] = useState<string[]>([]);
  /**
   * Chi comanda adesso.
   *
   * Di norma e' chi ha creato la stanza, e quel dato arriva dalla sessione
   * salvata sul dispositivo: si legge dopo il montaggio, quindi non si puo'
   * congelare al primo render. Qui si tiene solo lo scostamento: null vuol dire
   * "vale quello che dice la sessione", true/false che il ruolo e' cambiato in
   * corsa (qualcuno ha preso il posto dell'host, o l'host si e' fatto da parte).
   */
  const [roleOverride, setRoleOverride] = useState<boolean | null>(null);
  const hosting = roleOverride ?? isHost;

  const stateRef = useRef<GameState | null>(null);
  const transportRef = useRef<RoomTransport | null>(null);
  const offsetRef = useRef(0);
  const selfRef = useRef(self);
  const categoryRef = useRef(category);
  const configRef = useRef(config);
  const isHostRef = useRef(false);
  const presenceRef = useRef<string[]>([]);
  const takeoverRef = useRef<number | null>(null);

  useEffect(() => {
    selfRef.current = self;
    categoryRef.current = category;
    configRef.current = config;
    // Il ruolo va tenuto anche in un riferimento: i canali lo leggono dentro
    // funzioni create una volta sola, dove lo stato sarebbe quello vecchio.
    isHostRef.current = hosting;
  }, [self, category, config, hosting]);

  /** Cambia ruolo in un colpo solo: il riferimento serve subito, lo stato al render dopo. */
  const setRole = useCallback((next: boolean) => {
    isHostRef.current = next;
    setRoleOverride(next);
  }, []);

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

  /**
   * Sorveglianza di chi ospita la stanza.
   *
   * Se il suo dispositivo sparisce dalla presenza, la partita si fermerebbe:
   * nessuno farebbe girare il timer ne' applicherebbe le offerte. Passata la
   * finestra di tolleranza, il posto lo prende il primo giocatore rimasto
   * **nell'ordine della lista**: e' lo stesso ordine su tutti i dispositivi,
   * quindi il successore lo calcolano tutti allo stesso modo e uno solo si
   * riconosce come tale.
   */
  const watchHost = useCallback(
    (ids: string[]) => {
      const clear = () => {
        if (takeoverRef.current !== null) {
          window.clearTimeout(takeoverRef.current);
          takeoverRef.current = null;
        }
      };

      const current = stateRef.current;
      if (!current || isHostRef.current) {
        clear();
        return;
      }
      if (ids.includes(current.hostId)) {
        clear();
        return;
      }
      if (takeoverRef.current !== null) return;

      takeoverRef.current = window.setTimeout(() => {
        takeoverRef.current = null;
        const now = stateRef.current;
        const present = presenceRef.current;
        const me = selfRef.current;
        if (!now || isHostRef.current) return;

        if (nextHost(now, present) !== me.id) return;

        setRole(true);
        const next = reducer(now, { type: "set_host", playerId: me.id });
        stateRef.current = next;
        setState(next);
        transportRef.current?.send({ type: "state", state: next, now: Date.now() });
      }, HOST_GRACE_MS);
    },
    [setRole],
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
        if (host) {
          // Il proprio stato ritorna indietro: si ignora.
          if (message.state.hostId === me.id) return;
          // Qualcun altro ha preso la stanza mentre si era irraggiungibili:
          // comanda chi risulta host nello stato appena arrivato.
          setRole(false);
        }
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
      onPresence: (ids) => {
        presenceRef.current = ids;
        setOnline(ids);
        watchHost(ids);
      },
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
  }, [code, mode, isHost, broadcastState, commit, setRole, watchHost]);

  /* Chi entra continua a presentarsi finché non riceve il primo stato. */
  useEffect(() => {
    if (mode !== "online" || hosting || status !== "waiting") return;
    const timer = setInterval(() => {
      transportRef.current?.send({ type: "hello", player: selfRef.current });
    }, HELLO_RETRY_MS);
    return () => clearInterval(timer);
  }, [mode, hosting, status]);

  /* Il timer dell'asta gira sul dispositivo che ospita la stanza adesso. */
  useEffect(() => {
    if (!hosting) return;
    const timer = setInterval(() => {
      const current = stateRef.current;
      if (!current) return;
      if (current.phase !== "auction" && current.phase !== "result") return;
      commit(reducer(current, { type: "tick", now: Date.now() }));
    }, TICK_MS);
    return () => clearInterval(timer);
  }, [hosting, commit]);

  /**
   * Rientro dall'app in secondo piano, o rete che torna.
   *
   * Su telefono il browser congela le schede nascoste: al ritorno lo stato in
   * mano puo' essere vecchio di parecchi lotti. Chi ospita ritrasmette lo stato
   * buono, chi partecipa si ripresenta e se lo fa rimandare. Cosi' crediti,
   * lotti e timer tornano allineati senza ricaricare la pagina.
   */
  useEffect(() => {
    if (mode !== "online") return;

    const resync = () => {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
      const transport = transportRef.current;
      if (!transport) return;
      if (isHostRef.current) {
        const current = stateRef.current;
        if (current) transport.send({ type: "state", state: current, now: Date.now() });
        return;
      }
      transport.send({ type: "hello", player: selfRef.current });
    };

    document.addEventListener("visibilitychange", resync);
    window.addEventListener("focus", resync);
    window.addEventListener("online", resync);
    return () => {
      document.removeEventListener("visibilitychange", resync);
      window.removeEventListener("focus", resync);
      window.removeEventListener("online", resync);
    };
  }, [mode]);

  /* Timer di attesa da chiudere se il componente sparisce. */
  useEffect(() => {
    return () => {
      if (takeoverRef.current !== null) window.clearTimeout(takeoverRef.current);
    };
  }, []);

  const now = useCallback(() => Date.now() + offsetRef.current, []);

  return {
    state,
    status: mode === "local" ? "live" : status,
    error,
    online,
    isHost: hosting,
    transport: transportKind(),
    dispatch,
    now,
  };
}
