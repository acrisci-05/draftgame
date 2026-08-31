"use client";

import { Check, Loader2, Send, Star } from "lucide-react";
import { useEffect, useState } from "react";
import { useT } from "@/lib/settings";
import { ensureProfile, saveLocalFeedback } from "@/lib/storage";
import { fetchRatingSummary, isSupabaseConfigured, sendRating } from "@/lib/supabase";
import type { RatingSummary } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { Button } from "./Button";
import { Textarea } from "./Input";
import { Modal } from "./Modal";

export function RatingModal({
  open,
  onClose,
  /**
   * Quando la richiesta arriva da sola dopo una partita, invece che dal menu.
   * Cambia i pulsanti in fondo: chi non l'ha cercata deve poter dire "adesso
   * no" o "mai piu'" senza doversi inventare come chiudere.
   */
  prompted = false,
  onLater,
  onNever,
}: {
  open: boolean;
  onClose: () => void;
  prompted?: boolean;
  onLater?: () => void;
  onNever?: () => void;
}) {
  const t = useT();
  const [stars, setStars] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [summary, setSummary] = useState<RatingSummary | null>(null);

  useEffect(() => {
    if (!open || !isSupabaseConfigured) return;
    let active = true;
    fetchRatingSummary().then((result) => {
      if (active) setSummary(result);
    });
    return () => {
      active = false;
    };
  }, [open, status]);

  const submit = async () => {
    if (stars < 1) return;
    setStatus("sending");
    try {
      if (isSupabaseConfigured) {
        await sendRating(stars, comment, ensureProfile().id);
      } else {
        // Senza database il voto resta sul dispositivo: niente blocchi.
        saveLocalFeedback(stars, comment);
      }
      setStatus("sent");
      setComment("");
    } catch {
      setStatus("error");
    }
  };

  return (
    <Modal open={open} title={t("rate.title")} onClose={onClose}>
      <div className="flex flex-col gap-4">
        <p className="text-sm text-muted">{t("rate.subtitle")}</p>

        <div className="flex justify-center gap-1.5" onMouseLeave={() => setHover(0)}>
          {[1, 2, 3, 4, 5].map((value) => {
            const active = value <= (hover || stars);
            return (
              <button
                key={value}
                type="button"
                aria-label={`${value}`}
                aria-pressed={value === stars}
                onMouseEnter={() => setHover(value)}
                onFocus={() => setHover(value)}
                onClick={() => setStars(value)}
                className="transition-transform hover:scale-110 focus-visible:outline-none"
              >
                <Star
                  className={cn(
                    "size-10 transition-colors",
                    active ? "fill-gold text-gold" : "text-line",
                  )}
                />
              </button>
            );
          })}
        </div>

        <Textarea
          label={t("rate.comment")}
          value={comment}
          maxLength={1000}
          placeholder={t("rate.commentPlaceholder")}
          onChange={(event) => setComment(event.target.value)}
        />

        {summary && summary.count > 0 ? (
          <p className="text-center text-xs text-faint">
            {t("rate.average", {
              avg: summary.average.toFixed(1),
              count: summary.count,
            })}
          </p>
        ) : null}

        {status === "error" ? <p className="text-sm text-red-500">{t("rate.error")}</p> : null}
        {status === "sent" ? (
          <p className="text-sm text-neon">
            {isSupabaseConfigured ? t("rate.thanks") : t("rate.localSaved")}
          </p>
        ) : null}

        <Button onClick={submit} disabled={stars < 1 || status === "sending"}>
          {status === "sending" ? (
            <Loader2 className="size-4 animate-spin" />
          ) : status === "sent" ? (
            <Check className="size-4" />
          ) : (
            <Send className="size-4" />
          )}
          {t("rate.send")}
        </Button>

        {prompted ? (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onLater}
              className="flex-1 rounded-xl border border-line px-3 py-2 text-sm text-muted transition-colors hover:text-fg"
            >
              {t("rate.later")}
            </button>
            <button
              type="button"
              onClick={onNever}
              className="flex-1 rounded-xl px-3 py-2 text-sm text-faint transition-colors hover:text-fg"
            >
              {t("rate.never")}
            </button>
          </div>
        ) : null}
      </div>
    </Modal>
  );
}
