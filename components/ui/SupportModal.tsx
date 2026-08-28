"use client";

import { GraduationCap, Heart, Wallet } from "lucide-react";
import { useState } from "react";
import {
  DONATION_AMOUNTS,
  DONATION_MAX,
  DONATION_MIN,
  clampDonation,
  isPaypalConfigured,
  paypalUrl,
  revolutUrl,
} from "@/lib/donate";
import { useT } from "@/lib/settings";
import { cn } from "@/lib/utils";
import { Modal } from "./Modal";

export function SupportModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT();
  const [preset, setPreset] = useState<number | null>(DONATION_AMOUNTS[1]);
  const [custom, setCustom] = useState("");

  const parsedCustom = Number(custom);
  const amount = preset ?? (custom.trim() ? clampDonation(parsedCustom) : null);
  const label = amount ? `€${amount}` : "";
  const paypalHref = amount ? paypalUrl(amount) : null;

  const pickCustom = (value: string) => {
    const digits = value.replace(/[^0-9]/g, "").slice(0, 4);
    setCustom(digits);
    /* Campo svuotato: si torna all'importo predefinito, così il pulsante resta utilizzabile. */
    setPreset(digits ? null : DONATION_AMOUNTS[1]);
  };

  return (
    <Modal open={open} title={t("support.title")} onClose={onClose}>
      <div className="flex flex-col gap-4">
        <div className="rounded-2xl border border-line bg-surface-2 p-4">
          <span className="mb-3 grid size-12 place-items-center rounded-xl bg-violet/15 text-violet">
            <GraduationCap className="size-6" />
          </span>
          <p className="text-sm font-bold">{t("support.subtitle")}</p>
          <p className="mt-1.5 text-sm leading-relaxed text-muted">{t("support.body")}</p>
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-faint">
            {t("support.amount")}
          </p>
          <div className="grid grid-cols-4 gap-2">
            {DONATION_AMOUNTS.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => {
                  setPreset(value);
                  setCustom("");
                }}
                className={cn(
                  "h-11 rounded-xl border text-sm font-bold transition-colors",
                  preset === value
                    ? "border-neon bg-neon/15 text-neon"
                    : "border-line bg-surface-2 text-muted hover:text-fg",
                )}
              >
                €{value}
              </button>
            ))}
            <input
              type="number"
              inputMode="numeric"
              min={DONATION_MIN}
              max={DONATION_MAX}
              value={custom}
              placeholder={t("support.custom")}
              aria-label={t("support.custom")}
              onChange={(event) => pickCustom(event.target.value)}
              className={cn(
                "h-11 w-full rounded-xl border bg-surface-2 px-2 text-center text-sm font-bold text-fg",
                "placeholder:text-[11px] placeholder:font-semibold placeholder:text-faint/80",
                "focus:outline-none",
                preset === null && custom ? "border-neon text-neon" : "border-line focus:border-neon/70",
              )}
            />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <a
            href={amount ? revolutUrl(amount) : undefined}
            target="_blank"
            rel="noreferrer noopener"
            aria-disabled={!amount}
            onClick={(event) => {
              if (!amount) event.preventDefault();
            }}
            className={cn(
              "flex h-12 items-center justify-center gap-2 rounded-xl font-bold transition-colors",
              amount
                ? "bg-neon text-ink glow-neon hover:bg-neon-soft"
                : "pointer-events-none bg-neon/30 text-ink/60",
            )}
          >
            <Heart className="size-5" />
            {t("support.revolut", { amount: label })}
          </a>

          {paypalHref ? (
            <a
              href={paypalHref}
              target="_blank"
              rel="noreferrer noopener"
              className="flex h-12 items-center justify-center gap-2 rounded-xl bg-violet font-bold text-white transition-colors hover:bg-violet-soft"
            >
              <Wallet className="size-5" />
              {t("support.paypal")}
            </a>
          ) : (
            /* Spazio già predisposto: si attiva impostando NEXT_PUBLIC_PAYPAL_USER. */
            <div
              className="flex h-12 items-center justify-center gap-2 rounded-xl border border-dashed border-line bg-surface-2 text-sm font-semibold text-faint"
              aria-disabled={!isPaypalConfigured}
            >
              <Wallet className="size-5" />
              {t("support.paypal")}
              <span className="rounded-full border border-line px-2 py-0.5 text-[10px] uppercase tracking-wider">
                {t("support.paypalSoon")}
              </span>
            </div>
          )}
        </div>

        <p className="text-xs text-faint">{t("support.note")}</p>
        <p className="text-xs font-semibold text-neon">{t("support.thanks")}</p>
      </div>
    </Modal>
  );
}
