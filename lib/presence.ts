"use client";

import { useEffect, useState } from "react";
import { PROFILES_TABLE } from "./auth";
import { getSupabase } from "./supabase";

/**
 * Chi dei tuoi PickMates è collegato in questo momento.
 *
 * Funziona a battito: finché la scheda è in primo piano il proprio stato viene
 * riscritto ogni tanto, e chi ha smesso di battere da più di un minuto risulta
 * offline. Non serve una connessione sempre aperta e non resta nessuno storico:
 * c'è una riga per persona, riscritta ogni volta.
 *
 * La reciprocità è nel database, non qui: chi spegne il proprio stato non
 * riceve quello degli altri nemmeno se manomette la pagina, perché la regola di
 * lettura pretende che anche il lettore sia visibile. Vedere senza farsi vedere
 * non è previsto.
 */

export const PRESENCE_TABLE = "presence";

/** Ogni quanto si riscrive la propria riga. */
const HEARTBEAT_MS = 30_000;
/** Ogni quanto si rilegge lo stato degli amici. */
const REFRESH_MS = 25_000;
/** Oltre questo silenzio una persona è considerata offline. */
const STALE_MS = 70_000;

export type PresenceState = "online" | "playing" | "offline";

interface PresenceRow {
  user_id: string;
  state: "online" | "playing";
  updated_at: string;
}

/** Lo stato di ogni PickMate, per identificativo. Chi manca è offline. */
export type PresenceMap = Record<string, PresenceState>;

/**
 * Dichiara la propria presenza finché la scheda è aperta e visibile.
 *
 * `playing` va passato quando si è dentro una partita: è l'unica differenza fra
 * il pallino verde e quello rosso.
 */
export function usePublishPresence(enabled: boolean, playing = false) {
  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase || !enabled) return;

    let alive = true;

    const beat = async () => {
      // Con la scheda in secondo piano si smette di battere: dopo un minuto
      // l'amico ci vede offline, che è la verità.
      if (!alive || document.visibilityState !== "visible") return;
      const { data } = await supabase.auth.getUser();
      const id = data.user?.id;
      if (!id) return;
      await supabase
        .from(PRESENCE_TABLE)
        .upsert({ user_id: id, state: playing ? "playing" : "online", updated_at: new Date().toISOString() });
    };

    void beat();
    const timer = setInterval(() => void beat(), HEARTBEAT_MS);
    document.addEventListener("visibilitychange", beat);

    return () => {
      alive = false;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", beat);
    };
  }, [enabled, playing]);
}

/**
 * Toglie la propria riga: si usa quando lo stato viene spento a mano, perché
 * smettere di scrivere lascerebbe l'ultimo stato visibile per un altro minuto.
 */
export async function clearPresence(): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;
  const { data } = await supabase.auth.getUser();
  const id = data.user?.id;
  if (!id) return;
  await supabase.from(PRESENCE_TABLE).delete().eq("user_id", id);
}

/**
 * Accende o spegne la condivisione del proprio stato.
 *
 * Spegnendola si cancella anche la riga già scritta: smettere e basta
 * lascerebbe l'ultimo stato visibile agli amici per un altro minuto.
 */
export async function setPresenceVisibility(visible: boolean): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;
  const { data } = await supabase.auth.getUser();
  const id = data.user?.id;
  if (!id) return;

  await supabase.from(PROFILES_TABLE).update({ shows_presence: visible }).eq("id", id);
  if (!visible) await clearPresence();
}

/**
 * Legge lo stato dei PickMates indicati. Chi non compare è offline.
 *
 * Torna null quando lo stato non è consultabile: database non ancora
 * aggiornato, oppure regola di lettura che nega l'accesso. Non è la stessa cosa
 * di "sono tutti offline", e chi disegna i pallini deve poterle distinguere:
 * un grigio al posto di un'informazione mancante sarebbe una bugia.
 */
export async function fetchPresence(ids: readonly string[]): Promise<PresenceMap | null> {
  const supabase = getSupabase();
  if (!supabase || ids.length === 0) return null;

  const { data, error } = await supabase
    .from(PRESENCE_TABLE)
    .select("user_id, state, updated_at")
    .in("user_id", [...ids]);
  if (error || !data) return null;

  const now = Date.now();
  const map: PresenceMap = {};
  for (const row of data as PresenceRow[]) {
    const age = now - new Date(row.updated_at).getTime();
    map[row.user_id] = age > STALE_MS ? "offline" : row.state;
  }
  return map;
}

/**
 * Lo stato dei PickMates, aggiornato da solo.
 *
 * Restituisce null finché non si sa niente: stato spento, database non ancora
 * pronto, o prima lettura non ancora tornata. In quei casi non si disegna
 * nessun pallino.
 */
export function usePresence(ids: readonly string[], enabled: boolean): PresenceMap | null {
  const [map, setMap] = useState<PresenceMap | null>(null);
  // La lista arriva nuova a ogni render: si confronta il contenuto, non l'array.
  const key = [...ids].sort().join(",");

  useEffect(() => {
    if (!enabled || key.length === 0) return;
    let active = true;

    const load = () => {
      void fetchPresence(key.split(",")).then((next) => {
        if (active) setMap(next);
      });
    };

    load();
    const timer = setInterval(load, REFRESH_MS);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [key, enabled]);

  // A stato spento non si mostra niente, anche se in memoria e' rimasta
  // l'ultima lettura fatta prima di spegnerlo.
  return enabled ? map : null;
}
