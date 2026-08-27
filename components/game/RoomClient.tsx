"use client";

import { ArrowLeft, Loader2, Radio, Smartphone, TriangleAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { DEFAULT_CATEGORY } from "@/lib/catalog";
import { useClientValue, useIsClient } from "@/lib/client-store";
import { PLAYER_EMOJIS } from "@/lib/game";
import { useRoom } from "@/lib/realtime";
import {
  ensureProfile,
  getCategory,
  getSession,
  readProfile,
  saveProfile,
  saveSession,
} from "@/lib/storage";
import type { Profile, RoomSession } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { AuctionStage } from "./AuctionStage";
import { Lobby } from "./Lobby";
import { Results } from "./Results";

export function RoomClient({ code }: { code: string }) {
  const router = useRouter();
  const isClient = useIsClient();

  const readSession = useCallback(() => getSession(code), [code]);
  const session = useClientValue<RoomSession | null>(readSession, null);

  const category = useMemo(() => {
    if (!session?.isHost) return null;
    return (session.categoryId ? getCategory(session.categoryId) : undefined) ?? DEFAULT_CATEGORY;
  }, [session]);

  const self = useMemo(
    () => ({
      id: session?.playerId ?? "",
      name: session?.name ?? "",
      emoji: session?.emoji ?? PLAYER_EMOJIS[0],
    }),
    [session?.playerId, session?.name, session?.emoji],
  );

  const room = useRoom({
    code,
    mode: session?.mode ?? "local",
    isHost: Boolean(session?.isHost),
    self,
    category,
  });

  if (!isClient) {
    return (
      <CenteredNotice icon={<Loader2 className="size-6 animate-spin" />} text="Carico la stanza..." />
    );
  }

  if (!session) {
    return <JoinRoom code={code} />;
  }

  const { state, status, error, dispatch, now, isHost } = room;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-4 py-4 safe-bottom">
      <header className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => router.push("/")}
          className="flex items-center gap-1.5 text-sm text-zinc-500 transition-colors hover:text-zinc-100"
        >
          <ArrowLeft className="size-4" />
          Esci
        </button>
        <Badge tone={session.mode === "online" ? "neon" : "neutral"}>
          {session.mode === "online" ? (
            <>
              <Radio className={cn("size-3", status === "live" ? "text-neon" : "text-amber-400")} />
              {status === "live" ? "online" : status === "error" ? "offline" : "connessione..."}
            </>
          ) : (
            <>
              <Smartphone className="size-3" />
              locale
            </>
          )}
        </Badge>
      </header>

      {error ? (
        <p className="flex items-start gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-200">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" />
          {error}
        </p>
      ) : null}

      {!state ? (
        <CenteredNotice
          icon={<Loader2 className="size-6 animate-spin" />}
          text={
            status === "error"
              ? "Stanza non raggiungibile."
              : "In attesa dei dati della stanza dall'host..."
          }
        />
      ) : state.phase === "lobby" ? (
        <Lobby state={state} isHost={isHost} selfId={self.id} dispatch={dispatch} />
      ) : state.phase === "ended" ? (
        <Results state={state} isHost={isHost} dispatch={dispatch} />
      ) : (
        <AuctionStage state={state} selfId={self.id} isHost={isHost} now={now} dispatch={dispatch} />
      )}
    </div>
  );
}

function CenteredNotice({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-zinc-500">
      {icon}
      <p className="text-sm">{text}</p>
    </div>
  );
}

function JoinRoom({ code }: { code: string }) {
  const stored = useClientValue<Profile | null>(readProfile, null);
  const [nameDraft, setNameDraft] = useState<string | null>(null);
  const [emojiDraft, setEmojiDraft] = useState<string | null>(null);

  const name = nameDraft ?? stored?.name ?? "";
  const emoji = emojiDraft ?? stored?.emoji ?? PLAYER_EMOJIS[0];

  const join = () => {
    const player = { ...ensureProfile(), name: name.trim() || "Player", emoji };
    saveProfile(player);
    saveSession({
      code,
      mode: "online",
      playerId: player.id,
      isHost: false,
      name: player.name,
      emoji: player.emoji,
    });
  };

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-5 px-4 py-10">
      <div className="text-center">
        <p className="text-xs uppercase tracking-[0.24em] text-zinc-500">Entra nella stanza</p>
        <p className="mt-2 font-mono text-4xl font-black tracking-[0.35em] text-neon text-glow">
          {code}
        </p>
      </div>

      <Input
        label="Il tuo nome"
        value={name}
        maxLength={16}
        placeholder="Nome giocatore"
        onChange={(event) => setNameDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") join();
        }}
      />

      <div>
        <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-500">Avatar</p>
        <div className="flex flex-wrap gap-2">
          {PLAYER_EMOJIS.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setEmojiDraft(option)}
              className={cn(
                "size-11 rounded-xl border text-xl transition-colors",
                option === emoji ? "border-neon bg-neon/10" : "border-line bg-surface",
              )}
            >
              {option}
            </button>
          ))}
        </div>
      </div>

      <Button size="lg" onClick={join}>
        Entra nella stanza
      </Button>
    </div>
  );
}
