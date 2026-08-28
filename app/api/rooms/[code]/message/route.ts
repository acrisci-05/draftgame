import type { NextRequest } from "next/server";
import { publish, roomSize } from "@/lib/server/rooms";

/** Invio di un messaggio alla stanza: il server lo gira agli altri partecipanti. */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY = 512 * 1024;

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ code: string }> },
) {
  const { code } = await context.params;
  const room = code.toUpperCase().slice(0, 8);

  let body: { clientId?: string; message?: unknown };
  try {
    const raw = await request.text();
    if (raw.length > MAX_BODY) {
      return Response.json({ error: "message-too-large" }, { status: 413 });
    }
    body = JSON.parse(raw) as { clientId?: string; message?: unknown };
  } catch {
    return Response.json({ error: "invalid-body" }, { status: 400 });
  }

  if (!body.clientId || !body.message) {
    return Response.json({ error: "missing-fields" }, { status: 400 });
  }

  const message = body.message as { type?: string };
  publish(room, body.clientId, JSON.stringify(message), message.type === "state");

  return Response.json({ ok: true, peers: roomSize(room) });
}
