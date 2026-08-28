/**
 * Verifica il trasporto locale delle stanze: due "schede" che parlano
 * sullo stesso canale, come fanno host e ospite nel browser.
 */
const path = require("path");
const Module = require("module");
const OUT = path.resolve(process.cwd(), ".tmp-check/lib");
const ROOT = path.resolve(OUT, "..");
const resolveFilename = Module._resolveFilename;
Module._resolveFilename = function (request, ...rest) {
  const target = request.startsWith("@/") ? path.join(ROOT, request.slice(2)) : request;
  return resolveFilename.call(this, target, ...rest);
};

const game = require(path.join(OUT, "game.js"));
const catalog = require(path.join(OUT, "catalog.js"));

let failures = 0;
function check(label, condition, detail) {
  if (condition) console.log(`  ok   ${label}`);
  else {
    failures += 1;
    console.log(`  FAIL ${label}${detail !== undefined ? ` -> ${detail}` : ""}`);
  }
}

/* Il canale del browser, riprodotto qui con la versione di Node. */
const { BroadcastChannel } = require("node:worker_threads");

const category = catalog.OFFICIAL_CATEGORIES[0];
const t0 = 1_000_000;

const hostChannel = new BroadcastChannel("pp-room-TEST1");
const guestChannel = new BroadcastChannel("pp-room-TEST1");

let hostState = game.createGame({
  code: "TEST1",
  mode: "online",
  hostId: "host",
  category,
  config: { slots: 3 },
});
hostState = game.reducer(hostState, {
  type: "add_player",
  player: { id: "host", name: "Ana" },
});

let guestState = null;

// L'host applica le intenzioni e ritrasmette lo stato.
hostChannel.onmessage = (event) => {
  const message = event.data;
  if (message.type === "hello") {
    hostState = game.reducer(hostState, { type: "add_player", player: message.player });
    hostChannel.postMessage({ type: "state", state: hostState, now: Date.now() });
  }
  if (message.type === "intent") {
    hostState = game.reducer(hostState, message.action);
    hostChannel.postMessage({ type: "state", state: hostState, now: Date.now() });
  }
};

// L'ospite riceve solo lo stato.
guestChannel.onmessage = (event) => {
  if (event.data.type === "state") guestState = event.data.state;
};

const wait = () => new Promise((resolve) => setTimeout(resolve, 40));

(async () => {
  console.log("Stanza online sul trasporto locale\n");

  guestChannel.postMessage({ type: "hello", player: { id: "guest", name: "Bea" } });
  await wait();

  check("l'ospite entra nella stanza", hostState.players.length === 2, hostState.players.length);
  check("l'ospite riceve lo stato", guestState !== null);
  check(
    "i due vedono la stessa lista",
    guestState && guestState.players.length === hostState.players.length,
  );

  hostState = game.reducer(hostState, { type: "start", now: t0 });
  hostChannel.postMessage({ type: "state", state: hostState, now: Date.now() });
  await wait();
  check("l'asta parte anche per l'ospite", guestState.phase === "auction");
  check("stesso lotto per entrambi", guestState.currentItemId === hostState.currentItemId);

  guestChannel.postMessage({
    type: "intent",
    action: { type: "bid", playerId: "guest", amount: 2, now: t0 + 1000 },
  });
  await wait();
  check("l'offerta dell'ospite arriva all'host", hostState.highBidderId === "guest");
  check("l'ospite vede la propria offerta confermata", guestState.currentBid === 2);
  check("stesso timer per entrambi", guestState.deadline === hostState.deadline);

  guestChannel.postMessage({
    type: "intent",
    action: { type: "pass", playerId: "host", now: t0 + 2000 },
  });
  await wait();
  check("con tutti gli altri fuori il lotto è aggiudicato", hostState.phase === "result");
  check("l'ospite si è preso il lotto", hostState.lastResult.winnerId === "guest");
  check("anche l'ospite vede l'aggiudicazione", guestState.lastResult.winnerId === "guest");

  hostChannel.close();
  guestChannel.close();

  console.log(
    failures === 0 ? "\nSTANZA ONLINE FUNZIONANTE" : `\n${failures} CONTROLLI FALLITI`,
  );
  process.exit(failures === 0 ? 0 : 1);
})();
