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
    "i due giocatori hanno avatar diversi",
    hostState.players[0].emoji !== hostState.players[1].emoji,
    hostState.players.map((p) => p.emoji).join(","),
  );

  // L'ospite cambia avatar dal proprio telefono: l'intento passa dall'host.
  const freeAvatar = game.AVATAR_IDS.find(
    (avatar) => !hostState.players.some((p) => p.emoji === avatar),
  );
  guestChannel.postMessage({
    type: "intent",
    action: { type: "set_avatar", playerId: "guest", emoji: freeAvatar },
  });
  await wait();
  check(
    "l'ospite cambia avatar e lo vedono tutti",
    hostState.players[1].emoji === freeAvatar && guestState.players[1].emoji === freeAvatar,
  );

  // Ma non può prendersi quello dell'host.
  guestChannel.postMessage({
    type: "intent",
    action: { type: "set_avatar", playerId: "guest", emoji: hostState.players[0].emoji },
  });
  await wait();
  check("non può prendersi l'avatar dell'host", hostState.players[1].emoji === freeAvatar);
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

  /* ---------------------------------------------------------------- */
  /* Casi limite                                                       */
  /* ---------------------------------------------------------------- */

  console.log("\nCasi limite\n");

  // Pulsanti bloccati: chi è già in testa non rilancia contro sé stesso e
  // nessuno può offrire più di quanto il saldo (meno la riserva) consente.
  hostState = game.reducer(hostState, { type: "next", now: t0 + 3000 });
  const leader = hostState.players.find((p) => p.id === "guest");
  hostState = game.reducer(hostState, {
    type: "bid",
    playerId: "guest",
    amount: 2,
    now: t0 + 3100,
  });
  check(
    "chi è in testa non può rilanciare su sé stesso",
    !game.canBid(hostState, "guest", 3),
  );
  check("chi è in testa non può nemmeno passare", !game.canPass(hostState, "guest"));
  check(
    "nessuno può offrire oltre il proprio tetto",
    !game.canBid(hostState, "host", game.maxBid(hostState, hostState.players[0]) + 1),
  );
  check(
    "il tetto tiene conto della riserva per gli slot vuoti",
    game.maxBid(hostState, leader) <= leader.budget,
  );

  // Due offerte nello stesso istante: vince quella applicata per prima e la
  // seconda viene rifiutata, perché nel frattempo il prezzo è salito.
  const before = hostState.currentBid;
  const first = game.reducer(hostState, {
    type: "bid",
    playerId: "host",
    amount: before + 1,
    now: t0 + 3200,
  });
  const second = game.reducer(first, {
    type: "bid",
    playerId: "host",
    amount: before + 1,
    now: t0 + 3200,
  });
  check("due offerte identiche nello stesso istante: una sola passa", second === first);
  check("il prezzo sale una volta sola", first.currentBid === before + 1);

  // Disconnessione durante l'asta: il giocatore resta in partita con il suo
  // roster (chi perde la linea per qualche secondo non perde quanto ha vinto)
  // e la stanza continua a vivere per gli altri.
  const dropped = game.reducer(hostState, { type: "remove_player", playerId: "guest" });
  check(
    "chi cade in asta non perde posto e roster",
    dropped.players.length === hostState.players.length && dropped.phase === hostState.phase,
  );

  // E la partita non si inchioda: allo scadere del tempo il lotto si assegna
  // anche se il disconnesso non risponde più.
  const expired = game.reducer(hostState, { type: "tick", now: hostState.deadline + 1 });
  check("il timer chiude il lotto anche senza risposta", expired.phase === "result");

  // In lobby invece il posto si libera davvero.
  let lobby = game.createGame({ code: "TEST2", mode: "online", hostId: "host", category });
  lobby = game.reducer(lobby, { type: "add_player", player: { id: "host", name: "Ana" } });
  lobby = game.reducer(lobby, { type: "add_player", player: { id: "guest", name: "Bea" } });
  const left = game.reducer(lobby, { type: "remove_player", playerId: "guest" });
  check("in lobby chi esce libera il posto", left.players.length === 1);

  // Riconnessione: il "hello" di chi rientra non crea un doppione.
  guestChannel.postMessage({ type: "hello", player: { id: "guest", name: "Bea" } });
  await wait();
  check(
    "chi rientra non compare due volte",
    hostState.players.filter((p) => p.id === "guest").length === 1,
  );

  // Orologio condiviso: la scadenza viaggia nello stato, quindi tutti i
  // dispositivi contano lo stesso tempo anche se il loro orologio è sfasato.
  check("la scadenza è la stessa per tutti", guestState.deadline === hostState.deadline);

  /* ---------------------------------------------------------------- */
  /* Rientro dall'app in secondo piano                                 */
  /* ---------------------------------------------------------------- */

  // Al ritorno lo stato in mano può essere vecchio: chi partecipa si ripresenta
  // e l'host gli rimanda lo stato buono. È quello che fa il riaggancio quando
  // la scheda torna in primo piano.
  guestState = { ...guestState, currentBid: 999, phase: "lobby" };
  guestChannel.postMessage({ type: "hello", player: { id: "guest", name: "Bea" } });
  await wait();
  check(
    "al rientro lo stato torna allineato",
    guestState.currentBid === hostState.currentBid && guestState.phase === hostState.phase,
    `${guestState.currentBid}/${hostState.currentBid}`,
  );
  check(
    "il riaggancio non duplica il giocatore",
    hostState.players.filter((p) => p.id === "guest").length === 1,
  );

  /* ---------------------------------------------------------------- */
  /* Passaggio di host                                                 */
  /* ---------------------------------------------------------------- */

  // Se il dispositivo che ospita sparisce, il successore è il primo giocatore
  // rimasto: lo calcolano tutti allo stesso modo, quindi uno solo si promuove.
  const presentWithoutHost = hostState.players.filter((p) => p.id !== "host").map((p) => p.id);
  const heir = game.nextHost(hostState, presentWithoutHost);
  check("con l'host sparito c'è un successore", heir === "guest", heir);
  check(
    "tutti calcolano lo stesso successore",
    game.nextHost(hostState, [...presentWithoutHost].reverse()) === heir,
  );
  const migrated = game.reducer(hostState, { type: "set_host", playerId: heir });
  check("il nuovo host comanda la stanza", migrated.hostId === "guest");
  check(
    "la partita non riparte da capo",
    migrated.phase === hostState.phase && migrated.lotNumber === hostState.lotNumber,
  );

  hostChannel.close();
  guestChannel.close();

  console.log(
    failures === 0 ? "\nSTANZA ONLINE FUNZIONANTE" : `\n${failures} CONTROLLI FALLITI`,
  );
  process.exit(failures === 0 ? 0 : 1);
})();
