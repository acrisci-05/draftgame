"use client";

import {
  ArrowLeft,
  Bot,
  Home,
  Loader2,
  Plus,
  Radio,
  SearchX,
  Smartphone,
  TriangleAlert,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth";
import { BOT_AVATAR, BOT_NAME, BOT_PLAYER_ID, useBotEngine } from "@/lib/botEngine";
import { DEFAULT_CATEGORY } from "@/lib/catalog";
import { canStartMatch, playerById } from "@/lib/game";
import { useClientValue, useIsClient } from "@/lib/client-store";
import { DEFAULT_AVATAR } from "@/lib/avatars";
import { useRoom } from "@/lib/realtime";
import { useSettings } from "@/lib/settings";
import {
  ensureProfile,
  getCategory,
  getSession,
  readConfig,
  readProfile,
  saveProfile,
  saveSession,
  clearSession,
} from "@/lib/storage";
import type { Profile, RoomSession } from "@/lib/types";
import { cn, isRoomCode } from "@/lib/utils";
import { AvatarPicker } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { AuctionStage } from "./AuctionStage";
import { Lobby } from "./Lobby";
import { Results } from "./Results";
import { VotingStage } from "./VotingStage";

export function RoomClient({ code }: { code: string }) {
  const router = useRouter();
  const { t } = useSettings();
  const isClient = useIsClient();
  const { account } = useAuth();

  const readSession = useCallback(() => getSession(code), [code]);
  const session = useClientValue<RoomSession | null>(readSession, null);

  const category = useMemo(() => {
    if (!session?.isHost) return null;
    return (session.categoryId ? getCategory(session.categoryId) : undefined) ?? DEFAULT_CATEGORY;
  }, [session]);

  const config = useMemo(() => {
    if (!session?.isHost) return undefined;
    return session.config ?? readConfig();
  }, [session]);

  // La conferma di uscita: dichiarata qui in cima, prima delle uscite
  // anticipate, perche' i ganci vanno chiamati sempre nello stesso ordine.
  const [leaving, setLeaving] = useState(false);

  // Il profilo, quando c'è, viaggia con il giocatore: serve a ritrovarsi fra i
  // Pickmates dopo la partita.
  const accountId = account && !account.local ? account.id : undefined;
  // Il nickname fisso viaggia accanto al nome scelto per la partita: la card
  // mostra il secondo in grande e il primo in piccolo, per attribuire i voti.
  const handle = account && !account.local ? account.nickname : undefined;

  const self = useMemo(
    () => ({
      id: session?.playerId ?? "",
      name: session?.name ?? "",
      emoji: session?.emoji ?? DEFAULT_AVATAR,
      accountId,
      handle,
    }),
    [session?.playerId, session?.name, session?.emoji, accountId, handle],
  );

  const practice = Boolean(session?.practice);

  const room = useRoom({
    code,
    mode: session?.mode ?? "local",
    isHost: Boolean(session?.isHost),
    self,
    category,
    config,
    practice,
  });

  /*
   * L'avversario, e poi il fischio d'inizio.
   *
   * La sfida al bot si lancia da un pulsante solo: chi la preme non passa dalla
   * lobby, quindi il secondo giocatore lo iscrive qui l'app, e appena e' dentro
   * la partita parte da sola. Due passaggi separati e non uno, perche' il
   * riduttore accetta l'avvio solo quando i giocatori ci sono gia': si aggiunge
   * il bot, lo stato torna indietro con due giocatori, e il secondo giro fa
   * partire l'asta.
   */
  const stato = room.state;
  const botPresente = Boolean(stato && playerById(stato, BOT_PLAYER_ID));

  useEffect(() => {
    if (!practice || !stato || stato.phase !== "lobby") return;

    if (!botPresente) {
      room.dispatch({
        type: "add_player",
        player: { id: BOT_PLAYER_ID, name: BOT_NAME, emoji: BOT_AVATAR },
      });
      return;
    }

    // I lotti devono bastare per due: la lista arriva gia' scelta apposta, ma
    // chi torna su una vecchia stanza di prova potrebbe averne una che non
    // regge piu' le regole di adesso. In quel caso si resta in lobby, dove il
    // problema si vede ed e' rimediabile.
    if (!canStartMatch(stato.players.length, stato.items.length, stato.config.slots)) return;
    room.dispatch({ type: "start", now: Date.now() });
    // room.dispatch e' stabile: si dipende dai dati, non dall'oggetto.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [practice, botPresente, stato?.phase, stato?.players.length]);

  /*
   * Da qui in poi il bot gioca da solo: rilancia, passa e vota. Torna indietro
   * se sta aspettando il suo turno, che e' l'unica cosa che l'asta deve sapere
   * di lui: senza, i secondi di attesa sembrano un blocco.
   */
  const bot = useBotEngine({ state: stato, dispatch: room.dispatch, now: room.now });

  /*
   * Il profilo arriva dopo il montaggio, e la stanza si crea subito: senza
   * questo il proprio giocatore resterebbe senza identita' per tutta la
   * partita, e a fine gara non gli verrebbe accreditato niente -- ne' la
   * partita nello storico, ne' l'esperienza.
   */
  const mine = room.state?.players.find((player) => player.id === session?.playerId);
  const daCollegare = Boolean(accountId) && Boolean(mine) && mine?.accountId !== accountId;

  useEffect(() => {
    if (!daCollegare || !accountId || !session) return;
    room.dispatch({
      type: "link_account",
      playerId: session.playerId,
      accountId,
      handle,
    });
    // room.dispatch e' stabile: si dipende dai dati, non dall'oggetto.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [daCollegare, accountId, handle, session?.playerId]);

  if (!isClient) {
    return (
      <CenteredNotice icon={<Loader2 className="size-6 animate-spin" />} text={t("room.loading")} />
    );
  }

  /*
   * Indirizzo scritto male: un codice storto si riconosce dalla forma, senza
   * aspettare che la connessione vada in timeout. Meglio dirlo subito che
   * lasciare qualcuno davanti a una rotella che gira.
   */
  if (!isRoomCode(code)) {
    return <RoomNotFound code={code} />;
  }

  if (!session) {
    return <JoinRoom code={code} />;
  }

  const { state, status, error: errorKey, transport, dispatch, now, isHost } = room;


  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-4 py-4 safe-bottom">
      <header className="flex items-center justify-between gap-3">
        {/*
          Uscire a partita iniziata si conferma. A meta' asta il tocco
          sbagliato costa la serata: si riparte dal proprio posto solo se la
          stanza e' ancora aperta, e nel frattempo gli altri vanno avanti
          senza aspettare.
        */}
        <button
          type="button"
          onClick={() =>
            !state || state.phase === "lobby" || state.phase === "ended"
              ? router.push("/")
              : setLeaving(true)
          }
          className="flex items-center gap-1.5 text-sm text-faint transition-colors hover:text-fg"
        >
          <ArrowLeft className="size-4" />
          {t("room.exit")}
        </button>
        {/*
          Contro il bot si dice quello e basta: "locale" direbbe una cosa vera
          ma inutile, mentre sapere che l'avversario e' un programma cambia il
          senso di tutto quello che succede sotto.
        */}
        <Badge tone={practice ? "violet" : session.mode === "online" ? "neon" : "neutral"}>
          {practice ? (
            <>
              <Bot className="size-3" />
              {t("room.practice")}
            </>
          ) : session.mode === "online" ? (
            <>
              <Radio className={cn("size-3", status === "live" ? "text-neon" : "text-amber-400")} />
              {status === "live"
                ? // Il canale locale copre solo questo browser: va detto.
                  transport === "local"
                  ? t("room.localTransport")
                  : t("room.online")
                : status === "error"
                  ? t("room.offline")
                  : t("room.connecting")}
            </>
          ) : (
            <>
              <Smartphone className="size-3" />
              {t("room.local")}
            </>
          )}
        </Badge>
      </header>

      {errorKey ? (
        <p className="flex items-start gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-200">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" />
          {t(errorKey)}
        </p>
      ) : null}

      {!state ? (
        status === "error" ? (
          <RoomNotFound code={code} reason="unreachable" />
        ) : (
          <CenteredNotice
            icon={<Loader2 className="size-6 animate-spin" />}
            text={t("room.waitingState")}
          />
        )
      ) : state.phase === "lobby" ? (
        <Lobby state={state} isHost={isHost} selfId={self.id} dispatch={dispatch} />
      ) : state.phase === "voting" ? (
        <VotingStage state={state} selfId={self.id} now={now} dispatch={dispatch} />
      ) : state.phase === "ended" ? (
        <Results state={state} isHost={isHost} selfId={self.id} dispatch={dispatch} />
      ) : (
        <AuctionStage
          state={state}
          selfId={self.id}
          isHost={isHost}
          now={now}
          dispatch={dispatch}
          thinkingId={bot.thinking ? bot.botId : null}
        />
      )}

      <Modal open={leaving} title={t("room.leaveTitle")} onClose={() => setLeaving(false)}>
        <div className="flex flex-col gap-3">
          <p className="text-sm text-muted">{t("room.leaveBody")}</p>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setLeaving(false)}>
              {t("room.leaveStay")}
            </Button>
            <Button
              variant="danger"
              className="flex-1"
              onClick={() => {
                // Uscire apposta vuol dire non voler tornare: la home non deve
                // riproporre quella stanza.
                clearSession(code);
                router.push("/");
              }}
            >
              {t("room.leaveGo")}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function CenteredNotice({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-faint">
      {icon}
      <p className="text-sm">{text}</p>
    </div>
  );
}

function JoinRoom({ code }: { code: string }) {
  const { t } = useSettings();
  const stored = useClientValue<Profile | null>(readProfile, null);
  const [nameDraft, setNameDraft] = useState<string | null>(null);
  const [emojiDraft, setEmojiDraft] = useState<string | null>(null);

  const name = nameDraft ?? stored?.name ?? "";
  const emoji = emojiDraft ?? stored?.emoji ?? DEFAULT_AVATAR;

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
        <p className="text-xs uppercase tracking-[0.24em] text-faint">{t("room.join")}</p>
        <p className="mt-2 font-mono text-4xl font-black tracking-[0.35em] text-neon text-glow">
          {code}
        </p>
      </div>

      <Input
        label={t("room.yourName")}
        value={name}
        maxLength={16}
        placeholder={t("home.namePlaceholder")}
        onChange={(event) => setNameDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") join();
        }}
      />

      <div>
        <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-faint">
          {t("home.avatar")}
        </p>
        <AvatarPicker value={emoji} onChange={setEmojiDraft} />
      </div>

      <Button size="lg" onClick={join}>
        {t("room.join")}
      </Button>
    </div>
  );
}

/**
 * Stanza che non c'e'.
 *
 * Due casi diversi con la stessa via d'uscita: un codice scritto male, oppure
 * una stanza che non risponde piu' — chi la ospitava ha chiuso, o il codice e'
 * scaduto. In entrambi i casi la cosa utile e' un pulsante per tornare indietro,
 * non un messaggio d'errore e basta.
 */
function RoomNotFound({ code, reason = "invalid" }: { code: string; reason?: "invalid" | "unreachable" }) {
  const router = useRouter();
  const { t } = useSettings();

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-5 px-4 py-12 text-center">
      <span className="grid size-20 place-items-center rounded-3xl border border-amber-500/40 bg-amber-500/10">
        <SearchX className="size-9 text-amber-400" />
      </span>

      <div>
        <h1 className="text-2xl font-black tracking-tight text-balance">
          {t(reason === "invalid" ? "room.badCodeTitle" : "room.goneTitle")}
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted text-balance">
          {t(reason === "invalid" ? "room.badCodeBody" : "room.goneBody")}
        </p>
        {code ? (
          <p className="mt-3 font-mono text-lg font-black tracking-[0.3em] text-faint">{code}</p>
        ) : null}
      </div>

      <div className="flex w-full flex-col gap-2">
        <Button size="lg" onClick={() => router.push("/")}>
          <Home className="size-5" />
          {t("room.backHome")}
        </Button>
        <Button variant="outline" onClick={() => router.push("/create")}>
          <Plus className="size-4" />
          {t("home.create")}
        </Button>
      </div>
    </div>
  );
}
