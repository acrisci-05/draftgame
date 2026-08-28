import type { NextRequest } from "next/server";
import { joinRoom, leaveRoom, roomIds, publish } from "@/lib/server/rooms";

/**
 * Flusso di eventi della stanza.
 * Il partecipante resta collegato e riceve i messaggi degli altri in tempo reale.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ENCODER = new TextEncoder();
/** Commento SSE periodico: tiene viva la connessione attraverso i proxy. */
const KEEPALIVE_MS = 25_000;

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ code: string }> },
) {
  const { code } = await context.params;
  const room = code.toUpperCase().slice(0, 8);
  const clientId = request.nextUrl.searchParams.get("client") ?? crypto.randomUUID();

  let keepalive: ReturnType<typeof setInterval> | undefined;

  const stream = new ReadableStream({
    start(controller) {
      const send = (payload: string) => {
        controller.enqueue(ENCODER.encode(`data: ${payload}\n\n`));
      };

      const lastState = joinRoom(room, { id: clientId, send });

      // Chi arriva riceve subito l'ultimo stato conosciuto e l'elenco dei presenti.
      send(JSON.stringify({ type: "ready", clientId, peers: roomIds(room) }));
      if (lastState) send(lastState);

      publish(room, clientId, JSON.stringify({ type: "peers", peers: roomIds(room) }), false);

      keepalive = setInterval(() => {
        try {
          controller.enqueue(ENCODER.encode(": keepalive\n\n"));
        } catch {
          /* la connessione è già chiusa: ci pensa il cleanup */
        }
      }, KEEPALIVE_MS);

      request.signal.addEventListener("abort", () => {
        if (keepalive) clearInterval(keepalive);
        leaveRoom(room, clientId);
        publish(room, clientId, JSON.stringify({ type: "peers", peers: roomIds(room) }), false);
        try {
          controller.close();
        } catch {
          /* già chiusa */
        }
      });
    },
    cancel() {
      if (keepalive) clearInterval(keepalive);
      leaveRoom(room, clientId);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      // Evita il buffering dei proxy, che ritarderebbe i messaggi.
      "X-Accel-Buffering": "no",
    },
  });
}
