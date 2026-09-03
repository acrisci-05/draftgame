"use client";

import { Check, Download, Link2 } from "lucide-react";
import { useEffect, useState } from "react";
import { SHARE_URL } from "@/lib/config";
import { useSettings } from "@/lib/settings";
import { copyText } from "@/lib/utils";
import { Button } from "./Button";
import { Modal } from "./Modal";
import { QrCode } from "./QrCode";

interface ShareModalProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Il gioco passato di mano.
 *
 * Si gioca in compagnia, e finora l'unico modo di far entrare chi ti sta
 * accanto era dettargli l'indirizzo. Qui c'e' il codice da inquadrare per chi
 * e' nella stessa stanza, il link da incollare per chi e' altrove, e il codice
 * come immagine per chi lo vuole mettere in una storia.
 */
export function ShareModal({ open, onClose }: ShareModalProps) {
  const { t } = useSettings();
  const [qr, setQr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Il "Copiato!" e' una conferma, non uno stato: dopo due secondi se ne va.
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  /*
   * Chiudere spegne la conferma.
   *
   * Vale per la X, per il tasto Esc e per il clic fuori dalla finestra: tutti
   * passano di qui, cosi' chi riapre non ci ritrova il "Copiato!" di prima.
   */
  const close = () => {
    setCopied(false);
    onClose();
  };

  const onCopy = async () => {
    if (await copyText(SHARE_URL)) setCopied(true);
  };

  /*
   * Lo scarico passa da un collegamento finto.
   *
   * Il codice e' gia' un'immagine in memoria (`data:`), quindi non c'e' niente
   * da chiedere alla rete: basta un `<a download>` creato al volo e premuto
   * dal codice perche' il browser la salvi come un file qualsiasi.
   */
  const onDownload = () => {
    if (!qr) return;
    const link = document.createElement("a");
    link.href = qr;
    link.download = "pick-and-pay-qr.png";
    link.click();
  };

  return (
    <Modal open={open} title={t("share.title")} onClose={close}>
      <div className="flex flex-col items-center gap-4">
        <p className="text-center text-sm text-muted">{t("share.hint")}</p>

        <div className="rounded-2xl border border-line bg-white p-2">
          <QrCode value={SHARE_URL} size={200} onReady={setQr} />
        </div>

        <p className="w-full break-all rounded-xl border border-neon/40 bg-neon/10 px-3 py-2.5 text-center font-mono text-sm font-semibold text-neon">
          {SHARE_URL}
        </p>

        <div className="grid w-full gap-2 sm:grid-cols-2">
          <Button variant="outline" onClick={onCopy}>
            {copied ? <Check className="size-4" /> : <Link2 className="size-4" />}
            {copied ? t("share.copied") : t("share.copy")}
          </Button>
          {/*
            Finche' il codice non e' pronto non c'e' niente da salvare: il
            pulsante resta spento invece di scaricare un file vuoto.
          */}
          <Button onClick={onDownload} disabled={!qr}>
            <Download className="size-4" />
            {t("share.download")}
          </Button>
        </div>

        <Button variant="ghost" size="sm" className="w-full" onClick={close}>
          {t("common.close")}
        </Button>
      </div>
    </Modal>
  );
}
