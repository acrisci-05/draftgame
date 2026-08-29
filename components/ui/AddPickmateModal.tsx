"use client";

import { AtSign, Check, Clock, Loader2, Search, UserPlus } from "lucide-react";
import { useEffect, useState } from "react";
import type { Account } from "@/lib/auth";
import {
  findByEmail,
  invitePickmate,
  listRecentOpponents,
  searchByNickname,
  type AddPickmateResult,
  type RecentOpponent,
} from "@/lib/pickmates";
import { useT } from "@/lib/settings";
import { cn } from "@/lib/utils";
import { Avatar } from "./Avatar";
import { Button } from "./Button";
import { Input } from "./Input";
import { Modal } from "./Modal";

type Mode = "nickname" | "email" | "recent";

/**
 * Ricerca di un nuovo Pickmate in tre modi: per pezzo di nickname, per indirizzo
 * email esatto, oppure scegliendo fra gli avversari delle ultime partite.
 */
export function AddPickmateModal({
  open,
  userId,
  known,
  onClose,
  onInvited,
}: {
  open: boolean;
  userId: string;
  /** Chi è già in rubrica: non lo si invita due volte. */
  known: Set<string>;
  onClose: () => void;
  onInvited: () => void;
}) {
  const t = useT();
  const [mode, setMode] = useState<Mode>("nickname");
  const [query, setQuery] = useState("");
  const [outcome, setOutcome] = useState<AddPickmateResult | null>(null);
  const [invited, setInvited] = useState<string[]>([]);

  /*
   * Ogni ricerca è archiviata con la chiave che l'ha prodotta. Se la chiave non
   * corrisponde a quella corrente vuol dire che il risultato non è ancora
   * arrivato: così lo stato "sto cercando" si legge, non si imposta.
   */
  const [found, setFound] = useState<{ key: string; items: Account[] } | null>(null);
  const [recent, setRecent] = useState<RecentOpponent[] | null>(null);
  const [emailKey, setEmailKey] = useState("");

  const nickQuery = query.trim();
  const searchKey =
    mode === "nickname" ? (nickQuery.length >= 2 ? `nick:${nickQuery}` : "") : `mail:${emailKey}`;

  /* Ricerca per nickname mentre si scrive. */
  useEffect(() => {
    if (!open || mode !== "nickname" || nickQuery.length < 2) return;
    let active = true;
    const timer = setTimeout(() => {
      searchByNickname(nickQuery, userId).then((items) => {
        if (active) setFound({ key: `nick:${nickQuery}`, items });
      });
    }, 350);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [open, mode, nickQuery, userId]);

  /* Avversari recenti: si caricano appena si apre la scheda. */
  useEffect(() => {
    if (!open || mode !== "recent") return;
    let active = true;
    listRecentOpponents(userId).then((items) => {
      if (active) setRecent(items);
    });
    return () => {
      active = false;
    };
  }, [open, mode, userId]);

  const lookupEmail = async () => {
    const target = query.trim();
    setEmailKey(target);
    setOutcome(null);
    const account = await findByEmail(target, userId);
    setFound({ key: `mail:${target}`, items: account ? [account] : [] });
    if (!account) setOutcome("not-found");
  };

  const invite = async (account: Account) => {
    const result = await invitePickmate(userId, account.id);
    setOutcome(result);
    if (result === "sent") {
      setInvited((current) => [...current, account.id]);
      onInvited();
    }
  };

  const modes: { key: Mode; label: string; icon: typeof Search }[] = [
    { key: "nickname", label: t("pickmates.searchNickname"), icon: Search },
    { key: "email", label: t("pickmates.searchEmail"), icon: AtSign },
    { key: "recent", label: t("pickmates.searchRecent"), icon: Clock },
  ];

  // Niente da cercare (campo vuoto o email non ancora inviata): nessuna attesa.
  const idle = searchKey === "" || searchKey === "mail:";
  const searching =
    mode === "recent" ? recent === null : !idle && found?.key !== searchKey;

  const candidates: { account: Account; note?: string }[] =
    mode === "recent"
      ? (recent ?? []).map((entry) => ({
          account: entry.account,
          note:
            entry.played === 1
              ? t("pickmates.playedOne")
              : t("pickmates.playedMany", { n: entry.played }),
        }))
      : (found?.key === searchKey ? found.items : []).map((account) => ({ account }));

  return (
    <Modal open={open} title={t("friends.add")} onClose={onClose}>
      <div className="flex flex-col gap-3">
        <div className="flex gap-1 rounded-full border border-line bg-surface-2 p-1">
          {modes.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              aria-pressed={mode === key}
              onClick={() => {
                setMode(key);
                setQuery("");
                setEmailKey("");
                setFound(null);
                setOutcome(null);
              }}
              className={cn(
                "flex flex-1 items-center justify-center gap-1.5 rounded-full px-2 py-2 text-sm font-bold transition-colors",
                mode === key ? "bg-neon text-ink" : "text-muted hover:text-fg",
              )}
            >
              <Icon className="size-3.5" />
              {label}
            </button>
          ))}
        </div>

        {mode === "nickname" ? (
          <Input
            value={query}
            placeholder={t("pickmates.nicknamePlaceholder")}
            maxLength={20}
            onChange={(event) =>
              setQuery(event.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))
            }
          />
        ) : null}

        {mode === "email" ? (
          <div className="flex gap-2">
            <Input
              type="email"
              inputMode="email"
              value={query}
              hint={t("pickmates.emailHint")}
              placeholder={t("pickmates.emailPlaceholder")}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") void lookupEmail();
              }}
            />
            <Button className="shrink-0" disabled={!query.includes("@")} onClick={lookupEmail}>
              <Search className="size-4" />
            </Button>
          </div>
        ) : null}

        {mode === "recent" ? (
          <p className="text-xs text-faint">{t("pickmates.recentHint")}</p>
        ) : null}

        {searching ? (
          <p className="flex items-center gap-2 py-4 text-sm text-faint">
            <Loader2 className="size-4 animate-spin" />
            {t("common.loading")}
          </p>
        ) : idle && mode !== "recent" ? null : candidates.length === 0 ? (
          <p className="py-4 text-sm text-faint">
            {mode === "recent" ? t("pickmates.noRecent") : t("pickmates.noResults")}
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {candidates.map(({ account, note }) => {
              const done = invited.includes(account.id) || known.has(account.id);
              return (
                <div
                  key={account.id}
                  className="flex items-center gap-3 rounded-xl border border-line bg-surface-2 p-2.5"
                >
                  <Avatar id={account.emoji} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">@{account.nickname}</span>
                    {note ? <span className="block text-xs text-faint">{note}</span> : null}
                  </span>
                  <Button size="sm" disabled={done} onClick={() => invite(account)}>
                    {done ? <Check className="size-4" /> : <UserPlus className="size-4" />}
                    {t("pickmates.invite")}
                  </Button>
                </div>
              );
            })}
          </div>
        )}

        {outcome && outcome !== "sent" ? (
          <p className="text-sm text-amber-500">
            {t(
              outcome === "self"
                ? "friends.self"
                : outcome === "duplicate"
                  ? "friends.duplicate"
                  : "friends.notFound",
            )}
          </p>
        ) : null}
        {outcome === "sent" ? <p className="text-sm text-neon">{t("friends.sent")}</p> : null}
      </div>
    </Modal>
  );
}
