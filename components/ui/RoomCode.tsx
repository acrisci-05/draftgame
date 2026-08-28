"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { useT } from "@/lib/settings";
import { cn, copyText } from "@/lib/utils";

interface RoomCodeProps {
  code: string;
  size?: "sm" | "lg";
  className?: string;
}

/** Codice stanza con icona di copia e conferma a comparsa. */
export function RoomCode({ code, size = "sm", className }: RoomCodeProps) {
  const t = useT();
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    if (await copyText(code)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    }
  };

  return (
    <span className={cn("relative inline-flex items-center gap-2", className)}>
      <span
        className={cn(
          "font-mono font-black text-neon",
          size === "lg" ? "text-5xl tracking-[0.28em] text-glow" : "text-base tracking-[0.18em]",
        )}
      >
        {code}
      </span>
      <button
        type="button"
        onClick={copy}
        aria-label={t("common.copyCode")}
        title={t("common.copyCode")}
        className={cn(
          "grid shrink-0 place-items-center rounded-lg border border-line bg-surface-2 text-faint transition-colors hover:border-neon/50 hover:text-neon",
          size === "lg" ? "size-9" : "size-7",
        )}
      >
        {copied ? (
          <Check className={size === "lg" ? "size-4" : "size-3.5"} />
        ) : (
          <Copy className={size === "lg" ? "size-4" : "size-3.5"} />
        )}
      </button>

      <AnimatePresence>
        {copied ? (
          <motion.span
            initial={{ opacity: 0, y: 6, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6 }}
            className="pointer-events-none absolute -bottom-7 end-0 rounded-full bg-neon px-2.5 py-1 text-[11px] font-bold text-ink shadow-lg"
          >
            {t("common.codeCopied")}
          </motion.span>
        ) : null}
      </AnimatePresence>
    </span>
  );
}
