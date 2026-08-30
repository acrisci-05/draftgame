"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check, LayoutGrid, Play, Share2, UserPlus, Users, X } from "lucide-react";
import { useState } from "react";
import { playSfx } from "@/lib/audio";
import { categoryName } from "@/lib/catalog";
import { useIsClient } from "@/lib/client-store";
import { MIN_PLAYERS, type GameAction } from "@/lib/game";
import { useSettings } from "@/lib/settings";
import { saveConfig } from "@/lib/storage";
import type { Category, GameState, RoomConfig } from "@/lib/types";
import { copyText, money, uid } from "@/lib/utils";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Panel, PanelTitle } from "@/components/ui/Panel";
import { QrCode } from "@/components/ui/QrCode";
import { RoomCode } from "@/components/ui/RoomCode";
import { CategoryPicker } from "./CategoryPicker";
import { LobbyConfig } from "./LobbyConfig";

interface LobbyProps {
  state: GameState;
  isHost: boolean;
  selfId: string;
  dispatch: (action: GameAction) => void;
}

export function Lobby({ state, isHost, selfId, dispatch }: LobbyProps) {
  const { locale, sound, t } = useSettings();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [newPlayer, setNewPlayer] = useState("");
  const [copied, setCopied] = useState(false);

  const isLocal = state.mode === "local";
  const canStart = isHost && state.players.length >= MIN_PLAYERS && state.items.length > 0;
  const isClient = useIsClient();
  const joinUrl = isClient ? `${window.location.origin}/room/${state.code}` : null;

  const shareRoom = async () => {
    const url = `${window.location.origin}/room/${state.code}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: "Pick & Pay", text: state.code, url });
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

  const updateConfig = (patch: Partial<RoomConfig>) => {
    dispatch({ type: "set_config", config: patch });
    saveConfig({ ...state.config, ...patch });
  };

  const start = () => {
    playSfx("start", sound);
    dispatch({ type: "start", now: Date.now() });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-3xl border border-line bg-surface grid-noise p-5">
        <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-center sm:text-start">
            <p className="text-xs uppercase tracking-[0.24em] text-faint">
              {isLocal ? t("lobby.localRoom") : t("lobby.roomCode")}
            </p>
            <RoomCode code={state.code} size="lg" className="mt-2" />
            {isLocal ? (
              <p className="mt-3 text-sm text-faint">{t("lobby.localHint")}</p>
            ) : (
              <Button variant="outline" size="sm" className="mt-4" onClick={shareRoom}>
                {copied ? <Check className="size-4" /> : <Share2 className="size-4" />}
                {copied ? t("common.copied") : t("lobby.invite")}
              </Button>
            )}
          </div>

          {!isLocal && joinUrl ? (
            <div className="flex flex-col items-center gap-1.5">
              <QrCode value={joinUrl} size={116} />
              <span className="max-w-[9rem] text-center text-[10px] leading-tight text-faint">
                {t("lobby.qrHint")}
              </span>
            </div>
          ) : null}
        </div>
      </div>

      <Panel>
        <PanelTitle
          icon={<LayoutGrid className="size-3.5" />}
          action={
            isHost ? (
              <Button variant="ghost" size="sm" onClick={() => setPickerOpen(true)}>
                {t("common.change")}
              </Button>
            ) : null
          }
        >
          {t("common.category")}
        </PanelTitle>
        <div className="flex items-center gap-3">
          <span className="text-3xl">{state.category.emoji}</span>
          <div>
            <p className="font-bold">{categoryName(state.category, locale)}</p>
            <p className="text-xs text-faint">
              {state.items.length} {t("common.items")}
            </p>
          </div>
        </div>
      </Panel>

      {isHost ? (
        <LobbyConfig config={state.config} onChange={updateConfig} />
      ) : (
        <Panel>
          <PanelTitle>{t("lobby.settings")}</PanelTitle>
          <div className="flex flex-wrap gap-1.5">
            <Badge tone="neon">{money(state.config.budget, state.config.currency)}</Badge>
            <Badge>
              {state.config.slots} {t("common.items")}
            </Badge>
            <Badge>
              {t("common.players")} {state.config.maxPlayers}
            </Badge>
            {state.config.blindDraft ? <Badge tone="violet">{t("lobby.blind")}</Badge> : null}
            {state.config.mysteryBox ? <Badge tone="violet">{t("lobby.mystery")}</Badge> : null}
          </div>
        </Panel>
      )}

      <Panel>
        <PanelTitle
          icon={<Users className="size-3.5" />}
          action={
            <span className="text-xs text-faint">
              {state.players.length}/{state.config.maxPlayers}
            </span>
          }
        >
          {t("common.players")}
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
                <Avatar id={player.emoji} size="sm" />
                <span className="min-w-0 flex-1 truncate font-semibold">{player.name}</span>
                {player.id === state.hostId ? <Badge tone="violet">{t("lobby.host")}</Badge> : null}
                {player.id === selfId && !isLocal ? (
                  <Badge tone="neon">{t("lobby.you")}</Badge>
                ) : null}
                <span className="font-mono text-sm text-faint">
                  {money(state.config.budget, state.config.currency)}
                </span>
                {isHost && isLocal && player.id !== state.hostId ? (
                  <button
                    type="button"
                    aria-label={`Remove ${player.name}`}
                    onClick={() => dispatch({ type: "remove_player", playerId: player.id })}
                    className="rounded-lg p-1 text-faint transition-colors hover:text-red-500"
                  >
                    <X className="size-4" />
                  </button>
                ) : null}
              </motion.div>
            ))}
          </AnimatePresence>

          {state.players.length === 0 ? (
            <p className="text-sm text-faint">{t("lobby.noPlayers")}</p>
          ) : null}
        </div>

        {isLocal && isHost && state.players.length < state.config.maxPlayers ? (
          <div className="mt-3 flex gap-2">
            <Input
              value={newPlayer}
              placeholder={t("lobby.addPlayer")}
              maxLength={16}
              onChange={(event) => setNewPlayer(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") addLocalPlayer();
              }}
              className="h-11"
            />
            <Button onClick={addLocalPlayer} className="shrink-0" aria-label={t("lobby.addPlayer")}>
              <UserPlus className="size-4" />
            </Button>
          </div>
        ) : null}

        {!isLocal && state.players.length < MIN_PLAYERS ? (
          <p className="mt-3 text-sm text-faint">
            {t("lobby.shareCode", { n: MIN_PLAYERS, code: state.code })}
          </p>
        ) : null}
      </Panel>

      <Panel className="text-sm text-muted">
        <PanelTitle>{t("lobby.rulesTitle")}</PanelTitle>
        <ul className="flex flex-col gap-1.5">
          <li>{t("lobby.rule1", { budget: money(state.config.budget, state.config.currency) })}</li>
          <li>{t("lobby.rule2")}</li>
          <li>{t("lobby.rule3")}</li>
          <li>{t("lobby.rule4")}</li>
          <li>{t("lobby.rule5", { slots: state.config.slots })}</li>
        </ul>
      </Panel>

      {isHost ? (
        <Button size="lg" disabled={!canStart} onClick={start}>
          <Play className="size-5" />
          {canStart ? t("lobby.start") : t("lobby.needPlayers", { n: MIN_PLAYERS })}
        </Button>
      ) : (
        <p className="rounded-2xl border border-line bg-surface p-4 text-center text-sm text-faint">
          {t("lobby.waitingHost")}
        </p>
      )}

      <Modal open={pickerOpen} title={t("common.category")} onClose={() => setPickerOpen(false)}>
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
