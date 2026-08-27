"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check, LayoutGrid, Play, Share2, UserPlus, Users, X } from "lucide-react";
import { useState } from "react";
import { MAX_PLAYERS, MIN_PLAYERS, START_BUDGET, type GameAction } from "@/lib/game";
import type { Category, GameState } from "@/lib/types";
import { TIER_ORDER, copyText, uid } from "@/lib/utils";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Panel, PanelTitle } from "@/components/ui/Panel";
import { CategoryPicker } from "./CategoryPicker";

interface LobbyProps {
  state: GameState;
  isHost: boolean;
  selfId: string;
  dispatch: (action: GameAction) => void;
}

export function Lobby({ state, isHost, selfId, dispatch }: LobbyProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [newPlayer, setNewPlayer] = useState("");
  const [copied, setCopied] = useState(false);

  const isLocal = state.mode === "local";
  const canStart = isHost && state.players.length >= MIN_PLAYERS && state.items.length > 0;

  const shareRoom = async () => {
    const url = `${window.location.origin}/room/${state.code}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: "$20 Draft Game", text: `Codice stanza: ${state.code}`, url });
        return;
      } catch {
        /* condivisione annullata: si continua con la copia negli appunti */
      }
    }
    if (await copyText(url)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const addLocalPlayer = () => {
    const name = newPlayer.trim();
    if (!name) return;
    dispatch({ type: "add_player", player: { id: uid("p"), name } });
    setNewPlayer("");
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-3xl border border-line bg-surface grid-noise p-5 text-center">
        <p className="text-xs uppercase tracking-[0.24em] text-zinc-500">
          {isLocal ? "Stanza locale" : "Codice stanza"}
        </p>
        <p className="mt-2 font-mono text-5xl font-black tracking-[0.35em] text-neon text-glow">
          {state.code}
        </p>
        {!isLocal ? (
          <Button variant="outline" size="sm" className="mt-4" onClick={shareRoom}>
            {copied ? <Check className="size-4" /> : <Share2 className="size-4" />}
            {copied ? "Link copiato" : "Invita i giocatori"}
          </Button>
        ) : (
          <p className="mt-3 text-sm text-zinc-500">
            Tutti giocano da questo dispositivo, a turno sullo stesso schermo.
          </p>
        )}
      </div>

      <Panel>
        <PanelTitle
          icon={<LayoutGrid className="size-3.5" />}
          action={
            isHost ? (
              <Button variant="ghost" size="sm" onClick={() => setPickerOpen(true)}>
                Cambia
              </Button>
            ) : null
          }
        >
          Categoria
        </PanelTitle>
        <div className="flex items-center gap-3">
          <span className="text-3xl">{state.category.emoji}</span>
          <div>
            <p className="font-bold">{state.category.name}</p>
            <p className="text-xs text-zinc-500">
              {state.items.length} elementi ·{" "}
              {TIER_ORDER.map((tier) => state.items.filter((i) => i.tier === tier).length).join("/")}{" "}
              per fascia
            </p>
          </div>
        </div>
      </Panel>

      <Panel>
        <PanelTitle
          icon={<Users className="size-3.5" />}
          action={
            <span className="text-xs text-zinc-500">
              {state.players.length}/{MAX_PLAYERS}
            </span>
          }
        >
          Giocatori
        </PanelTitle>

        <div className="flex flex-col gap-2">
          <AnimatePresence initial={false}>
            {state.players.map((player) => (
              <motion.div
                key={player.id}
                layout
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 12 }}
                className="flex items-center gap-3 rounded-xl border border-line bg-surface-2 p-2.5"
              >
                <span className="text-xl">{player.emoji}</span>
                <span className="min-w-0 flex-1 truncate font-semibold">{player.name}</span>
                {player.id === state.hostId ? <Badge tone="violet">host</Badge> : null}
                {player.id === selfId && !isLocal ? <Badge tone="neon">tu</Badge> : null}
                <span className="font-mono text-sm text-zinc-500">${START_BUDGET}</span>
                {isHost && isLocal && player.id !== state.hostId ? (
                  <button
                    type="button"
                    aria-label={`Rimuovi ${player.name}`}
                    onClick={() => dispatch({ type: "remove_player", playerId: player.id })}
                    className="rounded-lg p-1 text-zinc-600 transition-colors hover:text-red-400"
                  >
                    <X className="size-4" />
                  </button>
                ) : null}
              </motion.div>
            ))}
          </AnimatePresence>

          {state.players.length === 0 ? (
            <p className="text-sm text-zinc-500">Nessun giocatore in stanza.</p>
          ) : null}
        </div>

        {isLocal && isHost && state.players.length < MAX_PLAYERS ? (
          <div className="mt-3 flex gap-2">
            <Input
              value={newPlayer}
              placeholder="Nome giocatore"
              maxLength={16}
              onChange={(event) => setNewPlayer(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") addLocalPlayer();
              }}
              className="h-11"
            />
            <Button onClick={addLocalPlayer} className="shrink-0" aria-label="Aggiungi giocatore">
              <UserPlus className="size-4" />
            </Button>
          </div>
        ) : null}

        {!isLocal && state.players.length < MIN_PLAYERS ? (
          <p className="mt-3 text-sm text-zinc-500">
            Servono almeno {MIN_PLAYERS} giocatori: condividi il codice {state.code}.
          </p>
        ) : null}
      </Panel>

      <Panel className="text-sm text-zinc-400">
        <PanelTitle>Regole</PanelTitle>
        <ul className="flex flex-col gap-1.5">
          <li>Ogni giocatore parte con ${START_BUDGET}.</li>
          <li>Gli elementi escono a caso: 15 secondi a lotto, 10 dopo ogni rilancio.</li>
          <li>Rilanci da +$1, +$2, +$5 solo se il saldo li copre.</li>
          <li>Chi passa esce dal lotto corrente; l&apos;ultimo rimasto se lo aggiudica.</li>
        </ul>
      </Panel>

      {isHost ? (
        <Button
          size="lg"
          disabled={!canStart}
          onClick={() => dispatch({ type: "start", now: Date.now() })}
        >
          <Play className="size-5" />
          {canStart ? "Avvia il draft" : `Servono almeno ${MIN_PLAYERS} giocatori`}
        </Button>
      ) : (
        <p className="rounded-2xl border border-line bg-surface p-4 text-center text-sm text-zinc-500">
          In attesa che l&apos;host avvii il draft...
        </p>
      )}

      <Modal open={pickerOpen} title="Scegli la categoria" onClose={() => setPickerOpen(false)}>
        <CategoryPicker
          selectedId={state.category.id}
          onSelect={(category: Category) => {
            dispatch({ type: "set_category", category });
            setPickerOpen(false);
          }}
        />
      </Modal>
    </div>
  );
}
