"use client";

import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { usePublishPresence } from "@/lib/presence";

/**
 * Dichiara il proprio stato ai PickMates, da un punto solo di tutto il sito.
 *
 * Sta nel guscio di ogni pagina invece che dentro le singole schermate: due
 * componenti che scrivessero la stessa riga si sovrascriverebbero a vicenda, e
 * uscendo da una partita l'ultimo stato scritto potrebbe restare "in partita".
 *
 * Non disegna niente. Chi non ha fatto l'accesso, chi gioca solo su questo
 * dispositivo e chi ha spento lo stato non scrivono nulla.
 */
export function PresenceBeacon() {
  const { account } = useAuth();
  const pathname = usePathname();

  const signedIn = Boolean(account && !account.local);
  const sharing = signedIn && account?.showsPresence !== false;
  // Dentro una stanza il pallino diventa rosso: è l'unica differenza.
  const playing = pathname?.startsWith("/room/") ?? false;

  usePublishPresence(sharing, playing);
  return null;
}
