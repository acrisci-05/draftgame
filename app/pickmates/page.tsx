"use client";

import {
  ArrowLeft,
  Check,
  Copy,
  Loader2,
  ShieldCheck,
  UserPlus,
  Users,
  Vote,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import {
  acceptPickmate,
  listPickmates,
  listSharedDrafts,
  removePickmate,
  saveSearchableEmail,
  sendChallenge,
  type Pickmate,
  type SharedDraft,
} from "@/lib/pickmates";
import { DEFAULT_CATEGORY } from "@/lib/catalog";
import { usePresence, type PresenceState } from "@/lib/presence";
import { ensureProfile, readConfig, saveSession } from "@/lib/storage";
import { useT } from "@/lib/settings";
import { showToast } from "@/lib/toast";
import { cn, copyText, roomCode as newRoomCode } from "@/lib/utils";
import { AddPickmateModal } from "@/components/ui/AddPickmateModal";
import { AuthPanel } from "@/components/ui/AuthModal";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { PickmateModal } from "@/components/ui/PickmateModal";
import { PresenceDot } from "@/components/ui/PresenceDot";
import { Panel, PanelTitle } from "@/components/ui/Panel";

type Tab = "list" | "drafts";

export default function PickmatesPage() {
  const router = useRouter();
  const t = useT();
  const { ready, account, email } = useAuth();

  const [tab, setTab] = useState<Tab>("list");
  const [mates, setMates] = useState<Pickmate[]>([]);
  const [drafts, setDrafts] = useState<SharedDraft[]>([]);
  const [adding, setAdding] = useState(false);
  const [copied, setCopied] = useState(false);
  const [challenged, setChallenged] = useState<string | null>(null);
  const [openMate, setOpenMate] = useState<Pickmate | null>(null);
  /** Richiesta che si sta ritirando: spegne il pulsante e mostra la rotella. */
  const [cancelling, setCancelling] = useState<string | null>(null);

  const userId = account && !account.local ? account.id : null;

  /*
   * Chi ha spento il proprio stato non vede quello degli altri: qui si smette
   * proprio di chiederlo. Non e' una cortesia dell'interfaccia, e' anche la
   * regola del database, che a un lettore nascosto risponderebbe comunque vuoto.
   */
  const sharesPresence = account?.showsPresence !== false;
  const mateIds = mates
    .filter((mate) => mate.status === "accepted")
    .map((mate) => mate.account.id);
  const presence = usePresence(mateIds, sharesPresence && Boolean(userId));

  const reload = useCallback(() => {
    if (!userId) return;
    listPickmates(userId).then(setMates);
    listSharedDrafts(userId).then(setDrafts);
  }, [userId]);

  useEffect(() => {
    reload();
  }, [reload]);

  /* L'email serve solo a farsi trovare dagli amici che la conoscono già. */
  useEffect(() => {
    if (userId && email) void saveSearchableEmail(userId, email);
  }, [userId, email]);

  const accepted = mates.filter((mate) => mate.status === "accepted");
  const incoming = mates.filter((mate) => mate.status === "pending" && mate.incoming);
  const outgoing = mates.filter((mate) => mate.status === "pending" && !mate.incoming);
  const known = new Set(mates.map((mate) => mate.account.id));

  /**
   * Ritira una richiesta di amicizia mandata e non ancora accettata.
   *
   * La riga sparisce subito dall'elenco senza aspettare il database: se poi la
   * cancellazione fallisse, la rilettura la rimetterebbe al suo posto. Meglio
   * un elenco che si corregge che un pulsante che sembra non aver fatto niente.
   */
  const cancelRequest = async (mate: Pickmate) => {
    if (!userId) return;
    setCancelling(mate.account.id);
    setMates((prima) => prima.filter((m) => m.account.id !== mate.account.id));
    try {
      await removePickmate(userId, mate.account.id);
      showToast(t("friends.cancelled", { name: `@${mate.account.nickname}` }), "info");
    } finally {
      setCancelling(null);
      reload();
    }
  };

  /*
   * Sfidare vuol dire aprire una stanza e chiamarci qualcuno: si crea il codice,
   * parte la notifica e ci si va ad aspettare l'amico. Prima serviva incollare a
   * mano il codice di una stanza gia' aperta, che spesso era quella della partita
   * finita ieri.
   */
  const challenge = async (mate: Pickmate) => {
    const profile = ensureProfile();
    const code = newRoomCode();
    saveSession({
      code,
      mode: "online",
      playerId: profile.id,
      isHost: true,
      name: profile.name || "Player",
      emoji: profile.emoji,
      categoryId: DEFAULT_CATEGORY.id,
      config: readConfig(),
    });
    await sendChallenge(mate.account.id, code);
    setChallenged(mate.account.nickname);
    router.push(`/room/${code}`);
  };

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-4 py-6 safe-bottom">
      <button
        type="button"
        onClick={() => router.push("/")}
        className="flex items-center gap-1.5 self-start text-sm text-faint transition-colors hover:text-fg"
      >
        <ArrowLeft className="size-4" />
        {t("common.home")}
      </button>

      <div>
        <h1 className="text-3xl font-black tracking-tight">{t("friends.title")}</h1>
        <p className="mt-1 text-sm text-muted">{t("friends.subtitle")}</p>
      </div>

      {!ready ? (
        <div className="flex flex-1 items-center justify-center text-faint">
          <Loader2 className="size-6 animate-spin" />
        </div>
      ) : !account ? (
        <Panel>
          <PanelTitle icon={<ShieldCheck className="size-3.5" />}>{t("auth.title")}</PanelTitle>
          <AuthPanel />
        </Panel>
      ) : (
        <>
          <Panel>
            <PanelTitle>{t("friends.you")}</PanelTitle>
            <div className="flex items-center gap-3">
              <Avatar id={account.emoji} size="lg" selected />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-lg font-black">@{account.nickname}</span>
              </span>
              <Button
                size="sm"
                variant="outline"
                onClick={async () => {
                  if (await copyText(account.nickname)) {
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1800);
                  }
                }}
              >
                {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
              </Button>
            </div>
          </Panel>

          {account.local ? (
            <p className="rounded-xl border border-line bg-surface p-3 text-sm text-muted">
              {t("friends.localMode")}
            </p>
          ) : null}

          <div className="flex gap-1 rounded-full border border-line bg-surface-2 p-1">
            {(["list", "drafts"] as Tab[]).map((key) => (
              <button
                key={key}
                type="button"
                aria-pressed={tab === key}
                onClick={() => setTab(key)}
                className={cn(
                  "flex-1 rounded-full px-3 py-2 text-sm font-bold transition-colors",
                  tab === key ? "bg-neon text-ink" : "text-muted hover:text-fg",
                )}
              >
                {t(key === "list" ? "pickmates.tabList" : "pickmates.tabDrafts")}
              </button>
            ))}
          </div>

          {tab === "list" ? (
            <>
              <Button size="lg" disabled={!userId} onClick={() => setAdding(true)}>
                <UserPlus className="size-5" />
                {t("friends.add")}
              </Button>

              {incoming.length > 0 ? (
                <Panel>
                  <PanelTitle>{t("friends.pendingIn")}</PanelTitle>
                  <div className="flex flex-col gap-2">
                    {incoming.map((mate) => (
                      <MateRow key={mate.account.id} mate={mate}>
                        <Button
                          size="sm"
                          onClick={async () => {
                            if (!userId) return;
                            await acceptPickmate(userId, mate.account.id);
                            reload();
                          }}
                        >
                          <Check className="size-4" />
                          {t("friends.accept")}
                        </Button>
                        <RemoveButton
                          onClick={async () => {
                            if (!userId) return;
                            await removePickmate(userId, mate.account.id);
                            reload();
                          }}
                        />
                      </MateRow>
                    ))}
                  </div>
                </Panel>
              ) : null}

              <Panel>
                <PanelTitle icon={<Users className="size-3.5" />}>{t("friends.list")}</PanelTitle>

                {accepted.length === 0 ? (
                  <p className="text-sm text-faint">{t("friends.none")}</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {accepted.map((mate) => (
                      <MateRow
                        key={mate.account.id}
                        mate={mate}
                        presence={presence ? (presence[mate.account.id] ?? "offline") : null}
                        onOpen={() => setOpenMate(mate)}
                      />
                    ))}
                  </div>
                )}

                {challenged ? (
                  <p className="mt-2 text-sm text-neon">
                    {t("pickmates.challengeSent", { name: `@${challenged}` })}
                  </p>
                ) : null}

                {outgoing.length > 0 ? (
                  <div className="mt-3 border-t border-line pt-3">
                    <p className="mb-2 text-xs font-bold uppercase tracking-wider text-faint">
                      {t("friends.pendingOut")}
                    </p>
                    <div className="flex flex-col gap-2">
                      {outgoing.map((mate) => (
                        <MateRow key={mate.account.id} mate={mate}>
                          {/*
                            Una richiesta mandata per sbaglio, o a cui non
                            risponde nessuno, deve poter essere ritirata: senza,
                            resta li' per sempre e non si puo' nemmeno rimandare.
                          */}
                          <button
                            type="button"
                            disabled={cancelling === mate.account.id}
                            onClick={() => cancelRequest(mate)}
                            className="flex shrink-0 items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 text-xs text-faint transition-colors hover:border-red-500/50 hover:text-red-400 disabled:opacity-50"
                          >
                            {cancelling === mate.account.id ? (
                              <Loader2 className="size-3.5 animate-spin" />
                            ) : (
                              <X className="size-3.5" />
                            )}
                            {t("friends.cancelRequest")}
                          </button>
                        </MateRow>
                      ))}
                    </div>
                  </div>
                ) : null}
              </Panel>
            </>
          ) : (
            <Panel>
              <PanelTitle icon={<Vote className="size-3.5" />}>{t("friends.drafts")}</PanelTitle>
              {drafts.length === 0 ? (
                <p className="text-sm text-faint">{t("friends.noDrafts")}</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {drafts.map((draft) => (
                    <button
                      key={draft.id}
                      type="button"
                      onClick={() => router.push(`/vote/${draft.resultId}`)}
                      className="flex items-center gap-3 rounded-xl border border-line bg-surface-2 p-3 text-start transition-colors hover:border-neon/50"
                    >
                      <span className="text-2xl">{draft.result?.categoryEmoji ?? "🎲"}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-bold">
                          {draft.result?.categoryName ?? draft.resultId}
                        </span>
                        <span className="block text-xs text-faint">
                          {t("friends.fromFriend", { name: `@${draft.from?.nickname ?? "?"}` })}
                        </span>
                      </span>
                      <span className="text-xs font-semibold text-neon">
                        {t("friends.openVote")}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </Panel>
          )}

          {userId ? (
            <>
              <PickmateModal
                mate={openMate}
                presence={
                  openMate && presence ? (presence[openMate.account.id] ?? "offline") : null
                }
                onClose={() => setOpenMate(null)}
                onChallenge={challenge}
                onRemove={async (mate) => {
                  await removePickmate(userId, mate.account.id);
                  reload();
                }}
              />

              <AddPickmateModal
                open={adding}
                userId={userId}
                known={known}
                onClose={() => setAdding(false)}
                onInvited={reload}
              />
            </>
          ) : null}
        </>
      )}
    </main>
  );
}

/**
 * Una riga della lista amici.
 *
 * Con `onOpen` diventa un pulsante che apre la scheda; senza, resta una riga
 * ferma con i suoi pulsanti a lato (e' il caso degli inviti da accettare).
 */
function MateRow({
  mate,
  children,
  presence,
  onOpen,
}: {
  mate: Pickmate;
  children?: React.ReactNode;
  presence?: PresenceState | null;
  onOpen?: () => void;
}) {
  const t = useT();
  const Tag = onOpen ? "button" : "div";
  return (
    <Tag
      {...(onOpen ? { type: "button" as const, onClick: onOpen } : {})}
      className={cn(
        "flex w-full items-center gap-3 rounded-xl border border-line bg-surface-2 p-2.5 text-start",
        onOpen && "transition-colors hover:border-neon/50",
      )}
    >
      <Avatar id={mate.account.emoji} size="sm" />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate font-semibold">@{mate.account.nickname}</span>
          <PresenceDot state={presence ?? null} />
        </span>
        <span className="block text-xs text-faint">
          {mate.played === 0
            ? t("pickmates.playedNone")
            : mate.played === 1
              ? t("pickmates.playedOne")
              : t("pickmates.playedMany", { n: mate.played })}
        </span>
      </span>
      {children}
    </Tag>
  );
}

function RemoveButton({ onClick }: { onClick: () => void }) {
  const t = useT();
  return (
    <button
      type="button"
      aria-label={t("friends.remove")}
      title={t("friends.remove")}
      onClick={onClick}
      className="rounded-lg p-1.5 text-faint transition-colors hover:text-red-500"
    >
      <X className="size-4" />
    </button>
  );
}
