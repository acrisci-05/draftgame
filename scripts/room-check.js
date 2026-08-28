/**
 * Prova la stanza passando dal server dell'app: due partecipanti che si collegano
 * con indirizzi diversi, come farebbero due telefoni su reti diverse.
 */
const BASE = process.argv[2] || "http://192.168.1.124:3000";
const CODE = "K9X2P";

let failures = 0;
function check(label, condition, detail) {
  if (condition) console.log(`  ok   ${label}`);
  else {
    failures += 1;
    console.log(`  FAIL ${label}${detail !== undefined ? ` -> ${detail}` : ""}`);
  }
}

/** Apre lo stream e raccoglie i messaggi ricevuti. */
async function openStream(clientId, received) {
  const response = await fetch(`${BASE}/api/rooms/${CODE}/stream?client=${clientId}`, {
    headers: { Accept: "text/event-stream" },
  });
  if (!response.ok) throw new Error(`stream ${response.status}`);

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  (async () => {
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";
        for (const part of parts) {
          const line = part.split("\n").find((l) => l.startsWith("data: "));
          if (!line) continue;
          try {
            received.push(JSON.parse(line.slice(6)));
          } catch {
            /* keepalive */
          }
        }
      }
    } catch {
      /* stream chiuso */
    }
  })();

  return () => reader.cancel().catch(() => {});
}

async function send(clientId, message) {
  const response = await fetch(`${BASE}/api/rooms/${CODE}/message`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ clientId, message }),
  });
  return response.json();
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

(async () => {
  console.log(`Stanza ${CODE} sul server ${BASE}\n`);

  const hostInbox = [];
  const guestInbox = [];

  const closeHost = await openStream("host-1", hostInbox);
  await wait(200);
  check("l'host apre il canale", hostInbox.some((m) => m.type === "ready"));

  // L'host pubblica lo stato iniziale della stanza.
  await send("host-1", { type: "state", state: { code: CODE, phase: "lobby", players: 1 }, now: Date.now() });
  await wait(150);

  const closeGuest = await openStream("guest-1", guestInbox);
  await wait(300);

  check("l'ospite entra nel canale", guestInbox.some((m) => m.type === "ready"));
  check(
    "l'ospite riceve subito lo stato salvato",
    guestInbox.some((m) => m.type === "state" && m.state.phase === "lobby"),
  );
  check(
    "l'host vede il nuovo arrivato",
    hostInbox.some((m) => m.type === "peers" && m.peers.includes("guest-1")),
  );

  // L'ospite manda un'intenzione, l'host la riceve.
  await send("guest-1", { type: "intent", action: { type: "bid", playerId: "guest", amount: 3 } });
  await wait(200);
  check(
    "l'intenzione dell'ospite arriva all'host",
    hostInbox.some((m) => m.type === "intent" && m.action.amount === 3),
  );
  check(
    "l'ospite non riceve il proprio messaggio",
    !guestInbox.some((m) => m.type === "intent"),
  );

  // L'host ritrasmette lo stato aggiornato.
  await send("host-1", { type: "state", state: { code: CODE, phase: "auction", players: 2 }, now: Date.now() });
  await wait(200);
  check(
    "l'ospite riceve lo stato aggiornato",
    guestInbox.some((m) => m.type === "state" && m.state.phase === "auction"),
  );

  await closeGuest();
  await wait(300);
  check(
    "l'host viene avvisato dell'uscita",
    hostInbox.some((m) => m.type === "peers" && !m.peers.includes("guest-1")),
  );

  await closeHost();

  console.log(
    failures === 0
      ? "\nSTANZA FRA DISPOSITIVI FUNZIONANTE"
      : `\n${failures} CONTROLLI FALLITI`,
  );
  process.exit(failures === 0 ? 0 : 1);
})();
