"use client";

import { Check, Loader2, Send } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { useT } from "@/lib/settings";
import { isSupabaseConfigured, sendSuggestion } from "@/lib/supabase";
import { AuthPanel } from "./AuthModal";
import { Button } from "./Button";
import { Input, Textarea } from "./Input";
import { Modal } from "./Modal";

export function SuggestModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT();
  const { account } = useAuth();
  const [name, setName] = useState("");
  const [idea, setIdea] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  const submit = async () => {
    if (!name.trim() || !account) return;
    setStatus("sending");
    try {
      await sendSuggestion(name, idea, account.id);
      setStatus("sent");
      setName("");
      setIdea("");
    } catch {
      setStatus("error");
    }
  };

  // I suggerimenti arrivano solo da chi ha fatto l'accesso: restano collegati al profilo.
  if (!account) {
    return (
      <Modal open={open} title={t("suggest.title")} onClose={onClose}>
        <div className="flex flex-col gap-3">
          <p className="text-sm text-muted">{t("auth.required")}</p>
          <AuthPanel />
        </div>
      </Modal>
    );
  }

  return (
    <Modal open={open} title={t("suggest.title")} onClose={onClose}>
      <div className="flex flex-col gap-3">
        <p className="text-sm text-muted">{t("suggest.subtitle")}</p>

        <Input
          label={t("suggest.name")}
          value={name}
          maxLength={60}
          placeholder={t("suggest.namePlaceholder")}
          onChange={(event) => setName(event.target.value)}
        />

        <Textarea
          label={t("suggest.idea")}
          value={idea}
          maxLength={1000}
          placeholder={t("suggest.ideaPlaceholder")}
          onChange={(event) => setIdea(event.target.value)}
        />

        {!isSupabaseConfigured ? (
          <p className="text-sm text-amber-500">{t("suggest.offline")}</p>
        ) : null}
        {status === "error" ? <p className="text-sm text-red-500">{t("suggest.error")}</p> : null}
        {status === "sent" ? <p className="text-sm text-neon">{t("suggest.sent")}</p> : null}

        <Button
          onClick={submit}
          disabled={!isSupabaseConfigured || status === "sending" || !name.trim()}
        >
          {status === "sending" ? (
            <Loader2 className="size-4 animate-spin" />
          ) : status === "sent" ? (
            <Check className="size-4" />
          ) : (
            <Send className="size-4" />
          )}
          {t("suggest.send")}
        </Button>
      </div>
    </Modal>
  );
}
