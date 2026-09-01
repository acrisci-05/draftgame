import { createClient } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";
import { notifyTelegram, ratingMessage } from "@/lib/server/telegram";

/**
 * Il voto sul gioco.
 *
 * Passa dal server per la stessa ragione dei suggerimenti: il token del bot
 * Telegram non può stare nel browser. Qui però c'è una differenza importante —
 * votare non richiede un account. Il voto è anonimo per scelta, quindi la
 * rotta accetta anche chi non ha fatto l'accesso, e in quel caso il messaggio
 * dice "Anonimo" invece del nickname.
 *
 * Il salvataggio sul database viene prima e la notifica dopo: se Telegram non
 * risponde, il voto è comunque archiviato e non va chiesto di rifarlo.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const MAX_COMMENT = 1000;

export async function POST(request: NextRequest) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return Response.json({ error: "database-not-configured" }, { status: 503 });
  }

  let body: { stars?: unknown; comment?: unknown; voterKey?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return Response.json({ error: "invalid-body" }, { status: 400 });
  }

  const stars = Math.round(Number(body.stars));
  if (!Number.isInteger(stars) || stars < 1 || stars > 5) {
    return Response.json({ error: "invalid-stars" }, { status: 400 });
  }

  // Il commento è facoltativo: si vota anche con le sole stelle.
  const comment =
    typeof body.comment === "string" ? body.comment.trim().slice(0, MAX_COMMENT) : "";
  const voterKey = typeof body.voterKey === "string" ? body.voterKey.trim().slice(0, 64) : "";
  if (!voterKey) return Response.json({ error: "missing-voter" }, { status: 400 });

  // Chi ha fatto l'accesso porta il proprio token: serve solo a firmare il
  // messaggio col nickname, non a poter votare.
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: token ? { headers: { Authorization: `Bearer ${token}` } } : {},
  });

  /*
   * Inserimento semplice, non "inserisci oppure aggiorna".
   *
   * La seconda forma permetterebbe di cambiare voto, ma richiede il permesso
   * di aggiornamento sulla tabella, che sul database non c'e': l'intera
   * operazione veniva rifiutata anche al primo voto, quando non c'era proprio
   * niente da aggiornare. Meglio una funzione che funziona senza poter
   * cambiare idea, che una completa che non parte mai.
   *
   * Il codice 23505 e' il vincolo di unicita': quel dispositivo aveva gia'
   * votato. Non e' un errore da mostrare -- il voto c'e', ed e' quello che
   * conta -- quindi si prosegue e si ringrazia lo stesso.
   */
  const { error } = await supabase
    .from("feedback")
    .insert({ stars, comment: comment || null, voter_key: voterKey });

  const giaVotato = error?.code === "23505";
  if (error && !giaVotato) {
    return Response.json({ error: "save-failed" }, { status: 400 });
  }

  // Un voto ripetuto non si rimanda al creatore: sarebbe rumore.
  if (giaVotato) return Response.json({ ok: true, already: true });

  // Da qui in poi il voto è al sicuro: la notifica è un di più.
  let nickname: string | null = null;
  try {
    if (token) {
      const { data: auth } = await supabase.auth.getUser(token);
      if (auth?.user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("nickname")
          .eq("id", auth.user.id)
          .maybeSingle();
        nickname = (profile as { nickname?: string } | null)?.nickname ?? null;
      }
    }
    await notifyTelegram(ratingMessage({ stars, comment, nickname }));
  } catch {
    /* si perde solo l'avviso sul telefono */
  }

  return Response.json({ ok: true });
}
