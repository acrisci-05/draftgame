"use client";

import {
  ArrowLeft,
  Check,
  Copy,
  Loader2,
  ShieldCheck,
  Swords,
  UserPlus,
  Users,
  Vote,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { useClientValue } from "@/lib/client-store";
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
import { lastOnlineRoomCode } from "@/lib/storage";
import { useT } from "@/lib/settings";
import { cn, copyText } from "@/lib/utils";
import { AddPickmateModal } from "@/components/ui/AddPickmateModal";
import { AuthPanel } from "@/components/ui/AuthModal";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
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

  // Codice proposto: l'ultima stanza online aperta qui, finché non se ne scrive un altro.
  const suggestedCode = useClientValue(lastOnlineRoomCode, null);
  const [codeDraft, setCodeDraft] = useState<string | null>(null);
  const roomCode = codeDraft ?? suggestedCode ?? "";

  const userId = account && !account.local ? account.id : null;

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

  const challenge = async (mate: Pickmate) => {
    if (!roomCode.trim()) return;
    await sendChallenge(mate.account.id, roomCode.trim());
    setChallenged(mate.account.nickname);
    setTimeout(() => setChallenged(null), 2500);
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
                  <>
                    <div className="mb-3">
                      <Input
                        label={t("pickmates.roomCode")}
                        hint={t("pickmates.challengeNeedsRoom")}
                        value={roomCode}
                        maxLength={8}
                        placeholder="ABC12"
                        onChange={(event) => setCodeDraft(event.target.value.toUpperCase())}
                      />
                    </div>

                    <div className="flex flex-col gap-2">
                      {accepted.map((mate) => (
                        <MateRow key={mate.account.id} mate={mate}>
                          <Button
                            size="sm"
                            variant="violet"
                            disabled={!roomCode.trim()}
                            onClick={() => challenge(mate)}
                          >
                            <Swords className="size-4" />
                            {t("pickmates.challenge")}
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
                  </>
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
                          <span className="text-xs text-faint">{t("friends.waiting")}</span>
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
            <AddPickmateModal
              open={adding}
              userId={userId}
              known={known}
              onClose={() => setAdding(false)}
              onInvited={reload}
            />
          ) : null}
        </>
      )}
    </main>
  );
}

function MateRow({ mate, children }: { mate: Pickmate; children: React.ReactNode }) {
  const t = useT();
  return (
    <div className="flex items-center gap-3 rounded-xl border border-line bg-surface-2 p-2.5">
      <Avatar id={mate.account.emoji} size="sm" />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold">@{mate.account.nickname}</span>
        <span className="block text-xs text-faint">
          {mate.played === 0
            ? t("pickmates.playedNone")
            : mate.played === 1
              ? t("pickmates.playedOne")
              : t("pickmates.playedMany", { n: mate.played })}
        </span>
      </span>
      {children}
    </div>
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
