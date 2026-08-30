"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check, LayoutGrid, Pencil, Play, Share2, UserPlus, Users, X } from "lucide-react";
import { useState } from "react";
import { playSfx } from "@/lib/audio";
import { categoryName } from "@/lib/catalog";
import { useIsClient } from "@/lib/client-store";
import {
  MIN_PLAYERS,
  lotSeconds,
  PLAYER_COLORS,
  colorLook,
  playerById,
  takenAvatars,
  takenColors,
  type GameAction,
} from "@/lib/game";
import { useSettings } from "@/lib/settings";
import { saveConfig } from "@/lib/storage";
import type { Category, GameState, RoomConfig } from "@/lib/types";
import { cn, copyText, money, uid } from "@/lib/utils";
import { Avatar, AvatarPicker } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Panel, PanelTitle } from "@/components/ui/Panel";
import { WhatsappGlyph } from "@/components/ui/BrandGlyphs";
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
  const [qrOpen, setQrOpen] = useState(false);
  /** Giocatore a cui stiamo scegliendo l'avatar, se il pannello è aperto. */
  const [avatarFor, setAvatarFor] = useState<string | null>(null);

  const isLocal = state.mode === "local";
  const canStart = isHost && state.players.length >= MIN_PLAYERS && state.items.length > 0;
  const isClient = useIsClient();
  const joinUrl = isClient ? `${window.location.origin}/room/${state.code}` : null;

  /**
   * Il messaggio pronto per WhatsApp: codice ben visibile e link diretto, cosi'
   * chi lo riceve entra col tocco senza digitare niente.
   */
  const whatsappUrl = joinUrl
    ? `https://wa.me/?text=${encodeURIComponent(t("lobby.whatsappText", { code: state.code, url: joinUrl }))}`
    : "";

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
              <div className="mt-4 flex flex-wrap justify-center gap-2 sm:justify-start">
                <Button variant="outline" size="sm" onClick={shareRoom}>
                  {copied ? <Check className="size-4" /> : <Share2 className="size-4" />}
                  {copied ? t("common.copied") : t("lobby.invite")}
                </Button>
                {/*
                  Invito su WhatsApp: e' li' che si organizzano le partite. Il
                  messaggio parte gia' scritto, con codice e link; l'indirizzo
                  wa.me funziona sia sul telefono che sul computer.
                */}
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-9 items-center gap-1.5 rounded-xl bg-[#25D366] px-3 text-sm font-bold text-[#052e16] transition-opacity hover:opacity-90"
                >
                  <WhatsappGlyph className="size-4" />
                  WhatsApp
                </a>
              </div>
            )}
          </div>

          {!isLocal && joinUrl ? (
            // Un tocco lo ingrandisce: da lontano, o su schermi piccoli, si
            // inquadra molto meglio.
            <button
              type="button"
              onClick={() => setQrOpen(true)}
              aria-label={t("lobby.qrZoom")}
              className="flex flex-col items-center gap-1.5 rounded-2xl p-1 transition-transform hover:scale-105"
            >
              <QrCode value={joinUrl} size={116} />
              <span className="max-w-[9rem] text-center text-[10px] leading-tight text-faint">
                {t("lobby.qrHint")}
              </span>
            </button>
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
                className={cn(
                  "flex items-center gap-3 rounded-xl border p-2.5",
                  colorLook(player.color).soft,
                )}
              >
                {/* In locale l'host cambia l'avatar di chiunque, perché tutti
                    giocano dal suo schermo; online ognuno cambia il proprio. */}
                {(isLocal ? isHost : player.id === selfId) ? (
                  <button
                    type="button"
                    aria-label={t("lobby.changeAvatar")}
                    title={t("lobby.changeAvatar")}
                    onClick={() => setAvatarFor(player.id)}
                    className="relative rounded-full transition-transform hover:scale-105"
                  >
                    <Avatar
                      id={player.emoji}
                      size="sm"
                      className={colorLook(player.color).ring}
                    />
                    <span className="absolute -bottom-0.5 -end-0.5 grid size-4 place-items-center rounded-full border border-line bg-ink text-neon">
                      <Pencil className="size-2.5" />
                    </span>
                  </button>
                ) : (
                  <Avatar id={player.emoji} size="sm" className={colorLook(player.color).ring} />
                )}
                <span
                  className={cn("min-w-0 flex-1 truncate font-semibold", colorLook(player.color).text)}
                >
                  {player.name}
                </span>
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
          <li>{t("lobby.rule2", { n: lotSeconds(state) })}</li>
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

      <Modal
        open={avatarFor !== null}
        title={t("lobby.changeLook")}
        onClose={() => setAvatarFor(null)}
      >
        {avatarFor ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-muted">{t("lobby.avatarHint")}</p>
            <AvatarPicker
              value={playerById(state, avatarFor)?.emoji ?? ""}
              taken={takenAvatars(state, avatarFor)}
              onChange={(emoji) => dispatch({ type: "set_avatar", playerId: avatarFor, emoji })}
            />

            {/* Il colore dell'alone: si sceglie qui, insieme all'icona. */}
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-faint">
                {t("lobby.color")}
              </p>
              <div className="flex gap-2">
                {PLAYER_COLORS.map((color) => {
                  const used = takenColors(state, avatarFor).includes(color);
                  const active = playerById(state, avatarFor)?.color === color;
                  return (
                    <button
                      key={color}
                      type="button"
                      disabled={used}
                      aria-label={t(`color.${color}`)}
                      title={t(`color.${color}`)}
                      aria-pressed={active}
                      onClick={() => dispatch({ type: "set_color", playerId: avatarFor, color })}
                      className={cn(
                        "size-10 rounded-full transition-transform",
                        colorLook(color).dot,
                        active ? "scale-110 ring-2 ring-fg ring-offset-2 ring-offset-surface" : "",
                        used ? "cursor-not-allowed opacity-25" : "hover:scale-105",
                      )}
                    />
                  );
                })}
              </div>
              <p className="mt-2 text-xs text-faint">{t("lobby.colorHint")}</p>
            </div>

            <Button variant="outline" onClick={() => setAvatarFor(null)}>
              {t("common.close")}
            </Button>
          </div>
        ) : null}
      </Modal>

      <Modal open={qrOpen} title={t("lobby.qrZoom")} onClose={() => setQrOpen(false)}>
        {joinUrl ? (
          <div className="flex flex-col items-center gap-4">
            <QrCode value={joinUrl} size={260} />
            <RoomCode code={state.code} size="lg" />
            <p className="text-center text-sm text-muted">{t("lobby.qrHint")}</p>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
