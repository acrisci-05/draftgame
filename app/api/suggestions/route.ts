import { createClient } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";
import { notifyTelegram, suggestionMessage } from "@/lib/server/telegram";

/**
 * Invio di un suggerimento.
 *
 * Passa dal server per una ragione sola: la notifica su Telegram richiede il
 * token del bot, che non può stare nel browser. Il salvataggio potrebbe avvenire
 * anche dal client, ma tenendo insieme le due cose il suggerimento e l'avviso
 * partono dallo stesso punto e non possono disallinearsi.
 *
 * Chi scrive deve essere autenticato: il browser manda il proprio token, il
 * server lo verifica presso Supabase e usa quell'identità per la scrittura. Le
 * regole della tabella restano quindi in vigore, e nessuno può firmare un
 * suggerimento col nome di un altro.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const MAX_NAME = 60;
const MAX_IDEA = 1000;

export async function POST(request: NextRequest) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return Response.json({ error: "database-not-configured" }, { status: 503 });
  }

  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (!token) return Response.json({ error: "not-signed-in" }, { status: 401 });

  // Il client parla a Supabase con il token di chi ha compilato il modulo:
  // le regole della tabella valgono esattamente come se scrivesse dal browser.
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  // Prima si stabilisce chi sta scrivendo: a uno sconosciuto non si legge
  // nemmeno il contenuto della richiesta.
  const { data: auth } = await supabase.auth.getUser(token);
  const user = auth?.user;
  if (!user) return Response.json({ error: "not-signed-in" }, { status: 401 });

  let body: { name?: unknown; idea?: unknown };
  try {
    body = (await request.json()) as { name?: unknown; idea?: unknown };
  } catch {
    return Response.json({ error: "invalid-body" }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim().slice(0, MAX_NAME) : "";
  const idea = typeof body.idea === "string" ? body.idea.trim().slice(0, MAX_IDEA) : "";
  if (!name) return Response.json({ error: "missing-name" }, { status: 400 });

  const { error } = await supabase
    .from("suggestions")
    .insert({ name, idea, author: user.id });
  if (error) return Response.json({ error: "insert-failed" }, { status: 400 });

  // Da qui in poi il suggerimento è al sicuro: se la notifica non parte,
  // l'utente non deve accorgersene né riprovare.
  const { data: profile } = await supabase
    .from("profiles")
    .select("nickname")
    .eq("id", user.id)
    .maybeSingle();

  const notified = await notifyTelegram(
    suggestionMessage({
      nickname: (profile as { nickname?: string } | null)?.nickname ?? "sconosciuto",
      name,
      idea,
    }),
  );

  return Response.json({ ok: true, notified });
}
