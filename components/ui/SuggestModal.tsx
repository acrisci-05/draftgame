"use client";

import { AlertCircle, CheckCircle2, Loader2, Send } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { useT } from "@/lib/settings";
import { saveLocalSuggestion } from "@/lib/storage";
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

  // Toccare i campi cancella l'esito precedente: un "inviato" verde che resta
  // mentre si scrive la proposta successiva confonde e basta.
  const edit = (set: (value: string) => void) => (value: string) => {
    if (status === "sent" || status === "error") setStatus("idle");
    set(value);
  };

  const submit = async () => {
    if (!name.trim() || !account) return;
    setStatus("sending");
    try {
      if (isSupabaseConfigured) {
        await sendSuggestion(name, idea);
      } else {
        // Senza database il suggerimento resta sul dispositivo: niente blocchi.
        saveLocalSuggestion(name, idea);
      }
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
          disabled={status === "sending"}
          placeholder={t("suggest.namePlaceholder")}
          onChange={(event) => edit(setName)(event.target.value)}
        />

        <Textarea
          label={t("suggest.idea")}
          value={idea}
          maxLength={1000}
          disabled={status === "sending"}
          placeholder={t("suggest.ideaPlaceholder")}
          onChange={(event) => edit(setIdea)(event.target.value)}
        />

        {status === "error" ? (
          <p
            role="alert"
            className="flex items-start gap-2 rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-400"
          >
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            <span>{t("suggest.error")}</span>
          </p>
        ) : null}

        {status === "sent" ? (
          <p
            role="status"
            className="flex items-start gap-2 rounded-xl border border-neon/40 bg-neon/10 p-3 text-sm text-neon"
          >
            <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
            <span>{isSupabaseConfigured ? t("suggest.sent") : t("suggest.localSaved")}</span>
          </p>
        ) : null}

        <Button onClick={submit} disabled={status === "sending" || !name.trim()}>
          {status === "sending" ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Send className="size-4" />
          )}
          {status === "sending" ? t("suggest.sending") : t("suggest.send")}
        </Button>
      </div>
    </Modal>
  );
}
