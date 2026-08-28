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
  acceptFriend,
  addFriend,
  listFriends,
  listSharedDrafts,
  removeFriend,
  type AddFriendResult,
  type Friend,
  type SharedDraft,
} from "@/lib/friends";
import { useT } from "@/lib/settings";
import { copyText } from "@/lib/utils";
import { AuthPanel } from "@/components/ui/AuthModal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Panel, PanelTitle } from "@/components/ui/Panel";

export default function PickpocketsPage() {
  const router = useRouter();
  const t = useT();
  const { ready, account } = useAuth();

  const [friends, setFriends] = useState<Friend[]>([]);
  const [drafts, setDrafts] = useState<SharedDraft[]>([]);
  const [nickname, setNickname] = useState("");
  const [result, setResult] = useState<AddFriendResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const userId = account?.id ?? null;

  const reload = useCallback(() => {
    if (!userId) return;
    listFriends(userId).then(setFriends);
    listSharedDrafts(userId).then(setDrafts);
  }, [userId]);

  useEffect(() => {
    reload();
  }, [reload]);

  const invite = async () => {
    if (!userId || !nickname.trim()) return;
    setBusy(true);
    const outcome = await addFriend(userId, nickname);
    setResult(outcome);
    if (outcome === "sent") {
      setNickname("");
      reload();
    }
    setBusy(false);
  };

  const accepted = friends.filter((friend) => friend.status === "accepted");
  const incoming = friends.filter((friend) => friend.status === "pending" && friend.incoming);
  const outgoing = friends.filter((friend) => friend.status === "pending" && !friend.incoming);

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
              <span className="grid size-12 shrink-0 place-items-center rounded-full border border-neon/50 bg-neon/10 text-2xl">
                {account.emoji}
              </span>
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

          <Panel>
            <PanelTitle icon={<UserPlus className="size-3.5" />}>{t("friends.add")}</PanelTitle>
            <div className="flex gap-2">
              <Input
                value={nickname}
                placeholder={t("friends.addPlaceholder")}
                maxLength={20}
                onChange={(event) => {
                  setNickname(event.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""));
                  setResult(null);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") invite();
                }}
              />
              <Button className="shrink-0" disabled={busy || !nickname.trim()} onClick={invite}>
                {busy ? <Loader2 className="size-4 animate-spin" /> : <UserPlus className="size-4" />}
                {t("friends.addButton")}
              </Button>
            </div>
            {result ? (
              <p
                className={`mt-2 text-sm ${result === "sent" ? "text-neon" : "text-amber-500"}`}
              >
                {t(
                  result === "sent"
                    ? "friends.sent"
                    : result === "self"
                      ? "friends.self"
                      : result === "duplicate"
                        ? "friends.duplicate"
                        : "friends.notFound",
                )}
              </p>
            ) : null}
          </Panel>

          {incoming.length > 0 ? (
            <Panel>
              <PanelTitle>{t("friends.pendingIn")}</PanelTitle>
              <div className="flex flex-col gap-2">
                {incoming.map((friend) => (
                  <FriendRow key={friend.account.id} friend={friend}>
                    <Button
                      size="sm"
                      onClick={async () => {
                        if (!userId) return;
                        await acceptFriend(userId, friend.account.id);
                        reload();
                      }}
                    >
                      <Check className="size-4" />
                      {t("friends.accept")}
                    </Button>
                    <RemoveButton
                      onClick={async () => {
                        if (!userId) return;
                        await removeFriend(userId, friend.account.id);
                        reload();
                      }}
                    />
                  </FriendRow>
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
                {accepted.map((friend) => (
                  <FriendRow key={friend.account.id} friend={friend}>
                    <RemoveButton
                      onClick={async () => {
                        if (!userId) return;
                        await removeFriend(userId, friend.account.id);
                        reload();
                      }}
                    />
                  </FriendRow>
                ))}
              </div>
            )}

            {outgoing.length > 0 ? (
              <div className="mt-3 border-t border-line pt-3">
                <p className="mb-2 text-xs font-bold uppercase tracking-wider text-faint">
                  {t("friends.pendingOut")}
                </p>
                <div className="flex flex-col gap-2">
                  {outgoing.map((friend) => (
                    <FriendRow key={friend.account.id} friend={friend}>
                      <span className="text-xs text-faint">{t("friends.waiting")}</span>
                    </FriendRow>
                  ))}
                </div>
              </div>
            ) : null}
          </Panel>

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
        </>
      )}
    </main>
  );
}

function FriendRow({ friend, children }: { friend: Friend; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-line bg-surface-2 p-2.5">
      <span className="grid size-9 shrink-0 place-items-center rounded-full border border-line bg-surface text-lg">
        {friend.account.emoji}
      </span>
      <span className="min-w-0 flex-1 truncate font-semibold">@{friend.account.nickname}</span>
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
