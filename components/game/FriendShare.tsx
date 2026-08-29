"use client";

import { Check, Loader2, Send, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { listPickmates, shareResultWithPickmates, type Pickmate } from "@/lib/pickmates";
import { useT } from "@/lib/settings";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";

/** Manda il draft appena concluso ai Pickmates perché lo votino. */
export function FriendShare({ resultId }: { resultId: string | null }) {
  const t = useT();
  const { account } = useAuth();
  const [friends, setFriends] = useState<Pickmate[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  const userId = account?.id ?? null;

  useEffect(() => {
    if (!userId) return;
    let active = true;
    listPickmates(userId).then((all) => {
      if (active) setFriends(all.filter((friend) => friend.status === "accepted"));
    });
    return () => {
      active = false;
    };
  }, [userId]);

  if (!account || friends.length === 0) return null;

  const toggle = (id: string) =>
    setSelected((current) =>
      current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id],
    );

  const send = async () => {
    if (!resultId || selected.length === 0) return;
    setStatus("sending");
    try {
      await shareResultWithPickmates(resultId, account.id, selected);
      setStatus("sent");
    } catch {
      setStatus("error");
    }
  };

  return (
    <div className="mt-3 border-t border-line pt-3">
      <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-faint">
        <Users className="size-3.5" />
        {t("friends.share")}
      </p>

      <div className="flex flex-wrap gap-1.5">
        {friends.map((friend) => {
          const active = selected.includes(friend.account.id);
          return (
            <button
              key={friend.account.id}
              type="button"
              aria-pressed={active}
              onClick={() => toggle(friend.account.id)}
              className={cn(
                "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-semibold transition-all",
                active
                  ? "border-neon/70 bg-neon/15 text-neon glow-neon"
                  : "border-line bg-surface-2 text-muted hover:text-fg",
              )}
            >
              <Avatar id={friend.account.emoji} size="xs" />@{friend.account.nickname}
            </button>
          );
        })}
      </div>

      {!resultId ? (
        <p className="mt-2 text-xs text-amber-500">{t("friends.shareNeedsLink")}</p>
      ) : null}
      {status === "sent" ? (
        <p className="mt-2 text-sm text-neon">{t("friends.shareDone", { n: selected.length })}</p>
      ) : null}
      {status === "error" ? (
        <p className="mt-2 text-sm text-red-500">{t("vote.error")}</p>
      ) : null}

      <Button
        size="sm"
        variant="violet"
        className="mt-2"
        disabled={!resultId || selected.length === 0 || status === "sending"}
        onClick={send}
      >
        {status === "sending" ? (
          <Loader2 className="size-4 animate-spin" />
        ) : status === "sent" ? (
          <Check className="size-4" />
        ) : (
          <Send className="size-4" />
        )}
        {t("friends.share")}
      </Button>
    </div>
  );
}
