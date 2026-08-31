"use client";

import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect } from "react";
import { createPortal } from "react-dom";
import { useIsClient } from "@/lib/client-store";

interface ModalProps {
  open: boolean;
  title?: string;
  onClose: () => void;
  children: ReactNode;
}

/**
 * Una finestra sopra il resto della pagina.
 *
 * Viene disegnata in fondo al documento e non dove e' scritta nel codice, e la
 * ragione e' una trappola del CSS: un elemento con `backdrop-filter` diventa il
 * riferimento per i figli posizionati in modo fisso. La barra in alto ha lo
 * sfondo sfocato, quindi una finestra aperta da li' non copriva lo schermo ma
 * soltanto la barra: usciva schiacciata, con titolo e pulsante di chiusura
 * tagliati fuori, e cliccare piu' in basso non la chiudeva perche' lo sfondo
 * cliccabile finiva dopo pochi pixel. Restava incastrata e serviva ricaricare.
 *
 * Spostandola in fondo al documento non ha piu' nessun antenato sfocato, e
 * torna a comportarsi come ci si aspetta ovunque venga aperta.
 */
export function Modal({ open, title, onClose, children }: ModalProps) {
  // Il documento esiste solo nel browser: al primo disegno sul server no.
  const isClient = useIsClient();

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!isClient) return null;

  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-60 flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="max-h-[88vh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-line bg-surface p-5 shadow-2xl sm:rounded-3xl"
            initial={{ y: 40, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 30, opacity: 0 }}
            transition={{ type: "spring", stiffness: 320, damping: 30 }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between gap-4">
              <h2 className="text-lg font-bold">{title}</h2>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="rounded-lg p-1.5 text-faint transition-colors hover:bg-surface-2 hover:text-fg"
              >
                <X className="size-5" />
              </button>
            </div>
            {children}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}
