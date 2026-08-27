"use client";

import { motion } from "framer-motion";
import { Gavel, LayoutGrid, LogIn, Smartphone, Wifi } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useClientValue } from "@/lib/client-store";
import { MAX_PLAYERS, MIN_PLAYERS, PLAYER_EMOJIS, START_BUDGET } from "@/lib/game";
import { ensureProfile, readProfile, saveProfile, saveSession } from "@/lib/storage";
import { isSupabaseConfigured } from "@/lib/supabase";
import type { Profile, RoomMode } from "@/lib/types";
import { cn, roomCode } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Panel, PanelTitle } from "@/components/ui/Panel";

export default function HomePage() {
  const router = useRouter();
  const stored = useClientValue<Profile | null>(readProfile, null);
  const [nameDraft, setNameDraft] = useState<string | null>(null);
  const [emojiDraft, setEmojiDraft] = useState<string | null>(null);
  const [joinCode, setJoinCode] = useState("");

  const name = nameDraft ?? stored?.name ?? "";
  const emoji = emojiDraft ?? stored?.emoji ?? PLAYER_EMOJIS[0];
  const setName = setNameDraft;
  const setEmoji = setEmojiDraft;

  const persistProfile = () => {
    const profile = { ...ensureProfile(), name: name.trim() || "Player", emoji };
    saveProfile(profile);
    return profile;
  };

  const createRoom = (mode: RoomMode) => {
    const profile = persistProfile();
    const code = roomCode();
    saveSession({
      code,
      mode,
      playerId: profile.id,
      isHost: true,
      name: profile.name,
      emoji: profile.emoji,
    });
    router.push(`/room/${code}`);
  };

  const joinRoom = () => {
    const code = joinCode.trim().toUpperCase();
    if (code.length < 4) return;
    const profile = persistProfile();
    saveSession({
      code,
      mode: "online",
      playerId: profile.id,
      isHost: false,
      name: profile.name,
      emoji: profile.emoji,
    });
    router.push(`/room/${code}`);
  };

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-5 px-4 py-8 safe-bottom">
      <motion.header
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-3xl border border-line bg-surface grid-noise p-6 text-center"
      >
        <span className="inline-flex items-center gap-1.5 rounded-full border border-violet/40 bg-violet/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-violet-soft">
          <Gavel className="size-3" /> asta live
        </span>
        <h1 className="mt-4 text-5xl font-black leading-none tracking-tight sm:text-6xl">
          <span className="text-neon text-glow">$20</span> DRAFT
        </h1>
        <p className="mx-auto mt-3 max-w-sm text-sm text-zinc-400">
          Da {MIN_PLAYERS} a {MAX_PLAYERS} giocatori, ${START_BUDGET} a testa. Gli elementi escono a
          caso, si rilancia a tempo e alla fine esce la card verticale da postare.
        </p>
      </motion.header>

      <Panel>
        <PanelTitle>Il tuo profilo</PanelTitle>
        <Input
          value={name}
          maxLength={16}
          placeholder="Nome giocatore"
          onChange={(event) => setName(event.target.value)}
        />
        <div className="mt-3 flex flex-wrap gap-2">
          {PLAYER_EMOJIS.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setEmoji(option)}
              className={cn(
                "size-11 rounded-xl border text-xl transition-colors",
                option === emoji ? "border-neon bg-neon/10" : "border-line bg-surface-2",
              )}
            >
              {option}
            </button>
          ))}
        </div>
      </Panel>

      <div className="grid gap-3 sm:grid-cols-2">
        <Button size="lg" onClick={() => createRoom("local")}>
          <Smartphone className="size-5" />
          Partita locale
        </Button>
        <Button
          size="lg"
          variant="violet"
          disabled={!isSupabaseConfigured}
          onClick={() => createRoom("online")}
        >
          <Wifi className="size-5" />
          Crea stanza online
        </Button>
      </div>

      {!isSupabaseConfigured ? (
        <p className="-mt-2 text-center text-xs text-zinc-500">
          Le stanze online si attivano aggiungendo le chiavi Supabase in <code>.env.local</code>.
        </p>
      ) : null}

      <Panel>
        <PanelTitle icon={<LogIn className="size-3.5" />}>Entra con un codice</PanelTitle>
        <div className="flex gap-2">
          <Input
            value={joinCode}
            maxLength={6}
            placeholder="ABCD"
            autoCapitalize="characters"
            onChange={(event) => setJoinCode(event.target.value.toUpperCase())}
            onKeyDown={(event) => {
              if (event.key === "Enter") joinRoom();
            }}
            className="font-mono text-2xl tracking-[0.3em] uppercase"
          />
          <Button
            variant="outline"
            className="h-12 shrink-0 px-5"
            disabled={joinCode.trim().length < 4}
            onClick={joinRoom}
          >
            Entra
          </Button>
        </div>
      </Panel>

      <Button variant="outline" onClick={() => router.push("/categories")}>
        <LayoutGrid className="size-4" />
        Categorie e tier list
      </Button>

      <Panel className="text-sm text-zinc-400">
        <PanelTitle>Come funziona</PanelTitle>
        <ol className="flex flex-col gap-2">
          <li>
            <span className="font-bold text-zinc-200">1.</span> Scegli la categoria: 25 elementi
            divisi in fasce da $5 a $1.
          </li>
          <li>
            <span className="font-bold text-zinc-200">2.</span> Ogni elemento parte da $1: rilanci
            +$1, +$2, +$5 finché il budget regge.
          </li>
          <li>
            <span className="font-bold text-zinc-200">3.</span> Timer a zero o tutti gli altri hanno
            passato: il lotto è aggiudicato.
          </li>
          <li>
            <span className="font-bold text-zinc-200">4.</span> A fine partita scarichi la card 9:16
            con i roster e i budget residui.
          </li>
        </ol>
      </Panel>
    </main>
  );
}
