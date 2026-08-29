"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth, type Account } from "./auth";
import {
  acceptPickmate,
  answerChallenge,
  listChallenges,
  listPickmates,
  removePickmate,
  type Challenge,
} from "./pickmates";
import { getSupabase } from "./supabase";

/**
 * Centro notifiche: richieste di amicizia e sfide in arrivo.
 *
 * Le due tabelle sono pubblicate sul canale realtime del database: quando
 * qualcuno ti invita o ti sfida, la riga appena scritta sveglia questo hook, che
 * ricarica l'elenco. Senza database non c'è nulla da ascoltare e la campanella
 * resta nascosta.
 */

export type NotificationKind = "pickmate" | "challenge";

export interface AppNotification {
  id: string;
  kind: NotificationKind;
  /** Chi l'ha mandata. */
  from: Account | null;
  /** Solo per le sfide: codice della stanza e numero della battuta. */
  code?: string;
  taunt?: number;
  createdAt: string;
}

export interface NotificationCenter {
  items: AppNotification[];
  count: number;
  /** false senza database o senza accesso: la campanella resta nascosta. */
  enabled: boolean;
  /** true quando l'ascolto dal vivo è attivo. */
  live: boolean;
  reload: () => void;
  accept: (notification: AppNotification) => Promise<void>;
  decline: (notification: AppNotification) => Promise<void>;
  ignore: (notification: AppNotification) => Promise<void>;
}

function fromChallenge(challenge: Challenge): AppNotification {
  return {
    id: `challenge:${challenge.id}`,
    kind: "challenge",
    from: challenge.from,
    code: challenge.code,
    taunt: challenge.taunt,
    createdAt: challenge.createdAt,
  };
}

/** L'id della riga sta dopo i due punti: "challenge:<uuid>", "pickmate:<uuid>". */
export function notificationTargetId(notification: AppNotification): string {
  return notification.id.slice(notification.id.indexOf(":") + 1);
}

export function useNotifications(): NotificationCenter {
  const { account } = useAuth();
  const userId = account?.local ? null : (account?.id ?? null);
  const [items, setItems] = useState<AppNotification[]>([]);
  const [live, setLive] = useState(false);
  const [version, setVersion] = useState(0);

  const reload = useCallback(() => setVersion((value) => value + 1), []);

  useEffect(() => {
    if (!userId) return;
    let active = true;

    Promise.all([listPickmates(userId), listChallenges(userId)]).then(([mates, challenges]) => {
      if (!active) return;
      const requests: AppNotification[] = mates
        .filter((mate) => mate.status === "pending" && mate.incoming)
        .map((mate) => ({
          id: `pickmate:${mate.account.id}`,
          kind: "pickmate" as const,
          from: mate.account,
          createdAt: "",
        }));
      setItems([...challenges.map(fromChallenge), ...requests]);
    });

    return () => {
      active = false;
    };
  }, [userId, version]);

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase || !userId) return;

    const channel = supabase
      .channel(`pp:notify:${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "pickmates", filter: `friend_id=eq.${userId}` },
        reload,
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "challenges", filter: `to_user=eq.${userId}` },
        reload,
      )
      .subscribe((status) => setLive(status === "SUBSCRIBED"));

    return () => {
      void supabase.removeChannel(channel);
      setLive(false);
    };
  }, [userId, reload]);

  const accept = useCallback(
    async (notification: AppNotification) => {
      if (!userId) return;
      if (notification.kind === "pickmate") {
        await acceptPickmate(userId, notificationTargetId(notification));
      } else {
        await answerChallenge(notificationTargetId(notification), "joined");
      }
      reload();
    },
    [userId, reload],
  );

  const decline = useCallback(
    async (notification: AppNotification) => {
      if (!userId) return;
      if (notification.kind === "pickmate") {
        await removePickmate(userId, notificationTargetId(notification));
      } else {
        await answerChallenge(notificationTargetId(notification), "ignored");
      }
      reload();
    },
    [userId, reload],
  );

  // Uscendo dall'accesso l'elenco caricato non vale più: si spegne qui, senza
  // ripulire lo stato dentro un effetto.
  const visible = userId ? items : [];

  return {
    items: visible,
    count: visible.length,
    enabled: userId !== null,
    live,
    reload,
    accept,
    decline,
    ignore: decline,
  };
}
