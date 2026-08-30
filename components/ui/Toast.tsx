"use client";

import { AnimatePresence, motion } from "framer-motion";
import { CircleAlert, Info, PartyPopper } from "lucide-react";
import { useEffect, useState } from "react";
import { onToast, type ToastMessage } from "@/lib/toast";
import { cn } from "@/lib/utils";

/**
 * Contenitore degli avvisi brevi.
 *
 * Vive nella barra in alto, che è montata su ogni pagina: da qui un avviso può
 * comparire anche mentre il modale che l'ha chiesto si sta chiudendo. Ne resta
 * a schermo uno solo, il più recente, e si può togliere con un tocco.
 */
export function ToastHost() {
  const [toast, setToast] = useState<(ToastMessage & { id: number }) | null>(null);

  useEffect(() => onToast((message) => setToast({ ...message, id: Date.now() })), []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), toast.duration);
    return () => clearTimeout(timer);
  }, [toast]);

  const Icon = toast?.tone === "error" ? CircleAlert : toast?.tone === "info" ? Info : PartyPopper;

  return (
    <AnimatePresence>
      {toast ? (
        <motion.button
          key={toast.id}
          type="button"
          initial={{ opacity: 0, y: -20, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.96 }}
          transition={{ type: "spring", stiffness: 320, damping: 26 }}
          onClick={() => setToast(null)}
          className={cn(
            "fixed inset-x-3 top-3 z-[70] mx-auto flex max-w-md items-center gap-2.5 rounded-2xl border p-3.5 text-start shadow-xl backdrop-blur safe-top",
            toast.tone === "error"
              ? "border-red-500/50 bg-red-500/15 text-red-200"
              : toast.tone === "info"
                ? "border-violet/50 bg-violet/15 text-violet"
                : "border-neon/50 bg-neon/15 text-neon",
          )}
        >
          <Icon className="size-5 shrink-0" />
          <span className="text-sm font-bold text-balance">{toast.text}</span>
        </motion.button>
      ) : null}
    </AnimatePresence>
  );
}
