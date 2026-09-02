"use client";

import { motion } from "framer-motion";
import { ChevronRight, Loader2, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { BOT_PLAYER_ID } from "@/lib/botEngine";
import { fetchHistory, type PastMatch } from "@/lib/history";
import { useT } from "@/lib/settings";
import {
  fetchResultsByCodes,
  fetchVoters,
  type MatchDetail,
  type Voter,
} from "@/lib/supabase";
import type { CurrencyCode, Player } from "@/lib/types";
import { cn, money } from "@/lib/utils";
import { Avatar } from "@/components/ui/Avatar";
import { Modal } from "@/components/ui/Modal";

/**
 * Le partite giocate, e chi le ha votate.
 *
 * Lo storico da solo e' una colonna di numeri; quello che si vuole sapere e'
 * un'altra cosa -- contro chi, e chi ha detto che la mia rosa era la migliore.
 * Il primo dato sta nel risultato pubblicato, il secondo nei voti.
 *
 * Una cosa che qui non c'e', e non per dimenticanza: **non si aggiungono
 * Pickmate da questa schermata**. Vedere il nome di chi ti ha votato e avere
 * sotto un pulsante "aggiungi" e' l'invito a mandare richieste di getto a
 * sconosciuti; chi vuole aggiungere qualcuno passa dalla sua sezione e lo
 * cerca. Qui si guarda e basta.
 */

interface Riga extends PastMatch {
  detail?: MatchDetail;
}

export function MatchHistory({
  userId,
  accountId,
  limit = 8,
}: {
  /** Il profilo di cui mostrare le partite. */
  userId: string;
  /** Lo stesso identificativo, per riconoscersi dentro le rose salvate. */
  accountId: string;
  limit?: number;
}) {
  const t = useT();
  const [righe, setRighe] = useState<Riga[] | null>(null);
  const [aperta, setAperta] = useState<Riga | null>(null);

  useEffect(() => {
    let active = true;
    fetchHistory(userId, limit).then(async (partite) => {
      if (!active) return;
      if (partite.length === 0) {
        setRighe([]);
        return;
      }
      // Un giro solo per tutti i dettagli, non uno per partita.
      const dettagli = await fetchResultsByCodes(partite.map((p) => p.code));
      if (!active) return;
      const perCodice = new Map(dettagli.map((d) => [d.code, d]));
      setRighe(partite.map((p) => ({ ...p, detail: perCodice.get(p.code) })));
    });
    return () => {
      active = false;
    };
  }, [userId, limit]);

  if (righe === null) {
    return (
      <div className="flex justify-center py-6 text-faint">
        <Loader2 className="size-5 animate-spin" />
      </div>
    );
  }

  if (righe.length === 0) {
    return <p className="py-4 text-center text-sm text-faint">{t("history.empty")}</p>;
  }

  return (
    <>
      <div className="flex flex-col gap-2">
        {righe.map((riga, index) => (
          <motion.button
            key={riga.id}
            type="button"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.04 }}
            onClick={() => setAperta(riga)}
            className="flex w-full items-center gap-2.5 rounded-xl border border-line bg-surface-2 p-2.5 text-start transition-colors hover:border-neon/40"
          >
            {/* La posizione: oro solo al primo posto, che e' l'unico che conta. */}
            <span
              className={cn(
                "grid size-7 shrink-0 place-items-center rounded-lg font-mono text-[11px] font-black",
                riga.position === 1 ? "bg-gold/20 text-gold" : "bg-surface text-faint",
              )}
            >
              {riga.position}
            </span>

            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-bold">
                {titolo(riga, accountId, t)}
              </span>
              <span className="block truncate text-xs text-faint">{riga.category}</span>
            </span>

            <Voti riga={riga} accountId={accountId} />

            <ChevronRight className="size-4 shrink-0 text-faint" />
          </motion.button>
        ))}
      </div>

      <Modal
        open={aperta !== null}
        title={aperta ? titolo(aperta, accountId, t) : ""}
        onClose={() => setAperta(null)}
      >
        {aperta ? <Dettaglio riga={aperta} accountId={accountId} /> : null}
      </Modal>
    </>
  );
}

/** "TU vs Marco", "TU vs Pick-asso 🤖", "TU vs altri 3". */
function titolo(riga: Riga, accountId: string, t: ReturnType<typeof useT>): string {
  const players = riga.detail?.players;
  if (!players) {
    // Senza il risultato pubblicato resta il numero, che lo storico ha sempre.
    return riga.players === 2 ? t("history.duel") : t("history.table", { n: riga.players });
  }
  const altri = players.filter((p) => p.accountId !== accountId);
  if (riga.detail?.practice) return t("history.vsBot");
  if (altri.length === 1) return t("history.vs", { player: altri[0].name });
  return t("history.table", { n: players.length });
}

/**
 * Due numeri: quanti hanno scelto la mia rosa e quanti hanno scelto un'altra.
 *
 * Verde e rosso perche' e' la lettura che si fa in mezzo secondo, senza contare
 * niente. Se nessuno ha votato non compare niente: uno zero a zero sembrerebbe
 * una sconfitta invece di una partita che non e' mai stata condivisa.
 */
function Voti({ riga, accountId }: { riga: Riga; accountId: string }) {
  const [voti, setVoti] = useState<Voter[] | null>(null);
  const resultId = riga.detail?.resultId;

  useEffect(() => {
    if (!resultId) return;
    let active = true;
    fetchVoters(resultId).then((lista) => {
      if (active) setVoti(lista);
    });
    return () => {
      active = false;
    };
  }, [resultId]);

  if (!voti || voti.length === 0) return null;

  const mio = riga.detail?.players.find((p) => p.accountId === accountId)?.id;
  const pro = voti.filter((v) => v.playerId === mio).length;
  const contro = voti.length - pro;

  return (
    <span className="flex shrink-0 items-center gap-1 font-mono text-[11px] font-black">
      <span className="rounded-md bg-neon/15 px-1.5 py-0.5 text-neon">+{pro}</span>
      {contro > 0 ? (
        <span className="rounded-md bg-red-500/15 px-1.5 py-0.5 text-red-400">-{contro}</span>
      ) : null}
    </span>
  );
}

/** Chi ha votato chi, rosa per rosa. */
function Dettaglio({ riga, accountId }: { riga: Riga; accountId: string }) {
  const t = useT();
  const [voti, setVoti] = useState<Voter[] | null>(null);
  const resultId = riga.detail?.resultId;

  useEffect(() => {
    if (!resultId) return;
    let active = true;
    fetchVoters(resultId).then((lista) => {
      if (active) setVoti(lista);
    });
    return () => {
      active = false;
    };
  }, [resultId]);

  const players = riga.detail?.players;
  // Senza risultato pubblicato non c'e' niente da caricare: la rotella non deve
  // girare a vuoto in attesa di una richiesta che non partira' mai.
  const inCaricamento = Boolean(resultId) && voti === null;

  if (!players) {
    return <p className="py-4 text-center text-sm text-faint">{t("history.noDetail")}</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-faint">
        {riga.category} · {money(riga.spent, riga.currency as CurrencyCode)}
      </p>

      {inCaricamento ? (
        <div className="flex justify-center py-4 text-faint">
          <Loader2 className="size-5 animate-spin" />
        </div>
      ) : (
        players.map((player) => (
          <RosaVotata
            key={player.id}
            player={player}
            mio={player.accountId === accountId}
            bot={riga.detail?.practice === true && player.id === BOT_PLAYER_ID}
            votanti={(voti ?? []).filter((v) => v.playerId === player.id)}
          />
        ))
      )}
    </div>
  );
}

function RosaVotata({
  player,
  mio,
  bot,
  votanti,
}: {
  player: Player;
  mio: boolean;
  bot: boolean;
  votanti: Voter[];
}) {
  const t = useT();

  return (
    <div
      className={cn(
        "rounded-xl border p-3",
        mio ? "border-neon/50 bg-neon/5" : "border-line bg-surface-2",
      )}
    >
      <div className="flex items-center gap-2">
        <Avatar id={player.emoji} size="xs" />
        <span className="min-w-0 flex-1 truncate text-sm font-bold">
          {bot ? t("vote.botName") : player.name}
          {bot ? <span aria-hidden> 🤖</span> : null}
        </span>
        <span
          className={cn(
            "flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-black",
            votanti.length > 0 ? "bg-neon/15 text-neon" : "bg-surface text-faint",
          )}
        >
          <Users className="size-3" />
          {votanti.length}
        </span>
      </div>

      {votanti.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {votanti.map((votante, index) => (
            <span
              key={`${votante.at}-${index}`}
              className={cn(
                "rounded-md px-2 py-0.5 text-[11px] font-semibold",
                // Verde chi ha un profilo, grigio chi ha votato da ospite: e'
                // l'unica differenza che conta, e si legge senza leggenda.
                votante.registered ? "bg-neon/10 text-neon" : "bg-surface text-faint",
              )}
            >
              {votante.registered && votante.name ? `@${votante.name}` : t("history.guestVoter")}
            </span>
          ))}
        </div>
      ) : (
        <p className="mt-2 text-xs text-faint">{t("history.noVotes")}</p>
      )}
    </div>
  );
}
