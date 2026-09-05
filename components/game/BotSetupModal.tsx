"use client";

import { Rocket } from "lucide-react";
import { useState } from "react";
import { useT } from "@/lib/settings";
import type { RoomConfig } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Segmented, Switch } from "@/components/ui/Switch";

/**
 * Come si gioca la sfida al bot: si sceglie qui, non sulla home.
 *
 * Stava in linea sotto il pulsante, e la home ne pagava il prezzo: due caselle,
 * un titolino e una riga di spiegazione sotto il pulsante piu' importante della
 * pagina, sempre a schermo anche per chi al bot non ci gioca. Dentro una
 * finestra costa un tocco a chi vuole scegliere e niente a tutti gli altri, e
 * per giunta ci sta comodo anche il resto delle varianti -- che in linea non
 * sarebbero mai entrate.
 *
 * La finestra non decide niente da sola: riceve la configurazione di partenza e
 * restituisce quella scelta. Chi la apre resta l'unico a sapere cosa farne.
 */

export type BotGameMode = "CLASSIC" | "DUTCH";

export function botModeOf(config: Pick<RoomConfig, "dutchDraft">): BotGameMode {
  return config.dutchDraft ? "DUTCH" : "CLASSIC";
}

export function BotSetupModal({
  open,
  config,
  onClose,
  onStart,
}: {
  open: boolean;
  /** Le regole con cui si e' giocato l'ultima volta. */
  config: RoomConfig;
  onClose: () => void;
  onStart: (config: RoomConfig) => void;
}) {
  const t = useT();

  /*
   * Una copia da modificare, buttata via se si chiude senza confermare.
   *
   * La chiave sull'apertura fa ripartire lo stato ogni volta che la finestra si
   * riapre: senza, chi cambia idea, chiude e riapre si ritroverebbe davanti le
   * scelte abbandonate invece di quelle con cui gioca davvero.
   */
  return (
    <Modal open={open} title={t("home.botSetupTitle")} onClose={onClose}>
      {open ? <BotSetupForm config={config} onStart={onStart} /> : null}
    </Modal>
  );
}

function BotSetupForm({
  config,
  onStart,
}: {
  config: RoomConfig;
  onStart: (config: RoomConfig) => void;
}) {
  const t = useT();
  const [mode, setMode] = useState<BotGameMode>(() => botModeOf(config));
  const [blind, setBlind] = useState(config.blindDraft);
  const [mystery, setMystery] = useState(config.mysteryBox);
  const [flop, setFlop] = useState(config.allowDiscards);

  const avvia = () => {
    onStart({
      ...config,
      maxPlayers: 2,
      dutchDraft: mode === "DUTCH",
      blindDraft: blind,
      mysteryBox: mystery,
      allowDiscards: flop,
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-[11px] uppercase tracking-[0.18em] text-faint">
          {t("home.botMode")}
        </p>
        <Segmented
          className="mt-1.5"
          value={mode}
          onChange={setMode}
          options={[
            { value: "CLASSIC", label: t("home.botModeClassic") },
            { value: "DUTCH", label: t("home.botModeDutch") },
          ]}
        />
        {/*
          La spiegazione cambia con la scelta.
          Le due modalita' non si distinguono dal nome: "Dutch Draft" non dice
          niente a chi non l'ha mai giocata, e una riga che cambia sotto la
          casella la racconta nel momento in cui la si sta guardando.
        */}
        <p className="mt-2 text-xs leading-relaxed text-muted">
          {mode === "DUTCH" ? t("home.botModeDutchHint") : t("home.botModeClassicHint")}
        </p>
      </div>

      {/*
        Le varianti, le stesse della lobby.
        Contro il bot valgono uguale, e prima non c'era modo di accenderle: chi
        giocava da solo si ritrovava sempre quelle dell'ultima partita fra amici
        senza poterle cambiare.
      */}
      <div className="flex flex-col gap-2 border-t border-line pt-4">
        <p className="text-[11px] uppercase tracking-[0.18em] text-faint">
          {t("home.botExtras")}
        </p>
        <Switch
          checked={blind}
          onChange={setBlind}
          label={t("lobby.blind")}
          hint={t("lobby.blindHint")}
        />
        <Switch
          checked={mystery}
          onChange={setMystery}
          label={t("lobby.mystery")}
          hint={t("lobby.mysteryHint")}
        />
        <Switch
          checked={flop}
          onChange={setFlop}
          label={t("lobby.discards")}
          hint={flop ? t("lobby.discardsOn") : t("lobby.discardsOff")}
        />
      </div>

      <Button size="lg" className="w-full" onClick={avvia}>
        <Rocket className="size-5" />
        {t("home.botStart")}
      </Button>
    </div>
  );
}
