"use client";

import { notFound, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { OFFICIAL_CATEGORIES } from "@/lib/catalog";
import { DEFAULT_CONFIG } from "@/lib/game";
import type { GameState, Player, RosterEntry } from "@/lib/types";
import { TikTokCard } from "@/components/game/TikTokCard";

/**
 * Anteprima della card finale, solo in sviluppo.
 *
 * Serve a controllare che il layout regga da 1 a 5 giocatori senza dover
 * giocare una partita intera: `/card-preview?players=8&slots=6&pledge=...`.
 * In produzione la pagina non esiste.
 */
export default function CardPreviewPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <Suspense fallback={null}>
      <Preview />
    </Suspense>
  );
}

function Preview() {
  const params = useSearchParams();
  const playerCount = Math.min(8, Math.max(1, Number(params.get("players") ?? 4)));
  const slots = Math.min(10, Math.max(1, Number(params.get("slots") ?? 5)));
  const pledge = params.get("pledge") ?? "Chi perde offre la pizza";

  const category = OFFICIAL_CATEGORIES[0];
  const names = ["Antonio", "Marco", "Giulia", "Sara", "Luca", "Elena", "Paolo", "Chiara"];

  const players: Player[] = Array.from({ length: playerCount }, (_, index) => {
    // Gli elementi si riusano a giro: con cinque giocatori da cinque lotti
    // servirebbero quaranta elementi e la lista ne ha trenta.
    const roster: RosterEntry[] = Array.from({ length: slots }, (_, position) => {
      const item = category.items[(index * slots + position) % category.items.length];
      return {
        itemId: `${item.id}-${index}`,
        name: item.name,
        tier: item.tier,
        price: item.tier + (position % 3),
        image: item.image,
        emoji: item.emoji,
      };
    });
    const spent = roster.reduce((total, entry) => total + entry.price, 0);
    return {
      id: `p${index}`,
      name: names[index],
      emoji: ["flame", "zap", "crown", "shield", "gamepad", "skull", "trophy", "ghost"][index],
      budget: Math.max(0, 20 - spent),
      roster,
    };
  });

  const state: GameState = {
    code: "PREV1",
    mode: "local",
    phase: "ended",
    hostId: "p0",
    config: { ...DEFAULT_CONFIG, slots, pledge },
    category,
    items: category.items,
    queue: [],
    currentItemId: null,
    lotKind: "item",
    lotPrice: 0,
    currentBid: 0,
    highBidderId: null,
    passed: [],
    deadline: 0,
    players,
    discards: [],
    lastResult: null,
    history: [],
    feed: [],
    lotNumber: playerCount * slots,
    sniped: false,
    updatedAt: 0,
  };

  return (
    <main className="mx-auto w-full max-w-md px-4 py-6">
      <p className="mb-3 text-sm text-faint">
        Anteprima card · {playerCount} giocatori · {slots} elementi a testa
      </p>
      <TikTokCard state={state} voteUrl={null} />
    </main>
  );
}
