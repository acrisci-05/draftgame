const path = require("path");
const Module = require("module");
const OUT = path.resolve(process.cwd(), process.argv[2] ?? ".tmp-check/lib");

// I file compilati conservano l'alias "@/": lo risolviamo sulla cartella di build.
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
  if (condition) {
    console.log(`  ok   ${label}`);
  } else {
    failures += 1;
    console.log(`  FAIL ${label}${detail !== undefined ? ` -> ${detail}` : ""}`);
  }
}

/* ---------------- Catalogo ---------------- */

const categories = catalog.OFFICIAL_CATEGORIES;
check("catalogo: almeno 25 liste ufficiali", categories.length >= 25, categories.length);
check(
  "catalogo: ogni lista ha un macro-tema",
  categories.every((c) => ["sport", "pop", "gaming", "food", "life"].includes(c.theme)),
  categories.filter((c) => !c.theme).map((c) => c.id).join(","),
);
check(
  "catalogo: nessuna emoji bandiera (illeggibili su Windows)",
  categories.every((c) =>
    [c.emoji, ...c.items.map((i) => i.emoji ?? "")].every(
      (emoji) => !/[\u{1F1E6}-\u{1F1FF}]/u.test(emoji),
    ),
  ),
);
// Quasi tutte le liste hanno 30 elementi. Le Regioni Italiane ne hanno 20,
// perché venti sono: il numero lo detta la geografia, non il formato.
check(
  "ogni lista ha 30 elementi (20 per le regioni)",
  categories.every((c) => c.items.length === (c.id === "regioni" ? 20 : 30)),
  categories
    .filter((c) => c.items.length !== (c.id === "regioni" ? 20 : 30))
    .map((c) => `${c.id}:${c.items.length}`)
    .join(","),
);
check(
  "ogni lista ha lo stesso numero di elementi per fascia",
  categories.every((c) => {
    const perTier = c.items.length / 5;
    return [5, 4, 3, 2, 1].every((t) => catalog.countByTier(c.items, t) === perTier);
  }),
);
check(
  "tutte le liste passano il validatore",
  categories.every(
    (c) => catalog.validateCategory(c.name, c.emoji, c.items, c.items.length / 5).length === 0,
  ),
);
check(
  "id elementi univoci",
  categories.every((c) => new Set(c.items.map((i) => i.id)).size === c.items.length),
);
check(
  "ogni elemento ha emoji di copertina",
  categories.every((c) => c.items.every((i) => Boolean(i.emoji))),
);
check(
  "id categorie univoci",
  new Set(categories.map((c) => c.id)).size === categories.length,
);
check(
  "andata e ritorno JSON stabile",
  (() => {
    const raw = catalog.toRawCategory(categories[0]);
    const back = catalog.fromRawCategory(raw);
    return JSON.stringify(back.items) === JSON.stringify(categories[0].items);
  })(),
);

/* ---------------- Asta base ---------------- */

const category = categories[0];
const t0 = 1_000_000;

function lobby(config) {
  let state = game.createGame({ code: "TEST1", mode: "local", hostId: "a", category, config });
  state = game.reducer(state, { type: "add_player", player: { id: "a", name: "Ana" } });
  state = game.reducer(state, { type: "add_player", player: { id: "b", name: "Bea" } });
  return state;
}

let state = lobby({ maxPlayers: 3, currency: "USD", budget: 20, slots: 5 });
state = game.reducer(state, { type: "add_player", player: { id: "c", name: "Cip" } });
check("lobby: 3 giocatori entro il tetto", state.players.length === 3);
check("lobby: budget dalla configurazione", state.players.every((p) => p.budget === 20));

state = game.reducer(state, { type: "start", now: t0 });
check("start: fase asta", state.phase === "auction");
check("start: prezzo base 1", state.currentBid === 1 && state.highBidderId === null);
check("start: timer 15s", state.deadline === t0 + 15000);
check("start: 29 elementi ancora in coda", state.queue.length === 29, state.queue.length);
check("start: feed inizializzato", state.feed.length >= 1);

state = game.reducer(state, { type: "bid", playerId: "a", amount: 1, now: t0 + 2000 });
check("offerta: Ana in testa a 1", state.highBidderId === "a" && state.currentBid === 1);
check("offerta: timer riportato a 10s", state.deadline === t0 + 2000 + 10000);
check("offerta: niente anti-sniping fuori finestra", state.sniped === false);
check("chi è in testa non rilancia contro se stesso", !game.canBid(state, "a", 2));
check("chi è in testa non può passare", !game.canPass(state, "a"));
check(
  "rilancio: opzioni +1/+2/+5",
  JSON.stringify(game.bidOptions(state).map((o) => o.amount)) === "[2,3,6]",
);

const beforeSnipe = state.deadline;
state = game.reducer(state, { type: "bid", playerId: "b", amount: 3, now: beforeSnipe - 1500 });
check("anti-sniping: rilancio in extremis segnalato", state.sniped === true);
check("anti-sniping: timer di nuovo a 10s", state.deadline === beforeSnipe - 1500 + 10000);

state = game.reducer(state, { type: "pass", playerId: "c", now: t0 + 5000 });
check("passo singolo: asta ancora aperta", state.phase === "auction");
state = game.reducer(state, { type: "pass", playerId: "a", now: t0 + 6000 });
check("tutti tranne uno hanno passato: aggiudicato", state.phase === "result");
check("vincitore Bea a 3", state.lastResult.winnerId === "b" && state.lastResult.price === 3);
check("budget Bea 20 - 3 = 17", game.playerById(state, "b").budget === 17);
check("roster Bea con 1 elemento", game.playerById(state, "b").roster.length === 1);
check("feed registra l'aggiudicazione", state.feed[0].kind === "won");

state = game.reducer(state, { type: "tick", now: state.deadline + 1 });
check("dopo il risultato parte il lotto successivo", state.phase === "auction");
check("nuovo lotto: flag anti-sniping azzerato", state.sniped === false);

state = game.reducer(state, { type: "tick", now: state.deadline + 1 });
check("nessuna offerta allo scadere: negli scarti", state.discards.length === 1);
check("nessun vincitore", state.lastResult.winnerId === null);

/* ---------------- Quando il lotto non lo vuole nessuno ---------------- */

// Senza offerte sul piatto, chi passa per primo non può regalare il lotto
// all'avversario: anche l'ultimo rimasto deve poter dire di no.
let nobody = lobby({ budget: 20, slots: 4, allowDiscards: true });
nobody = game.reducer(nobody, { type: "start", now: t0 });
nobody = game.reducer(nobody, { type: "pass", playerId: "a", now: t0 + 1000 });
check("senza offerte, chi passa non aggiudica all'altro", nobody.phase === "auction");
check("nessuno ha ancora vinto il lotto", nobody.highBidderId === null);
check("l'ultimo rimasto può ancora passare", game.canPass(nobody, "b"));
check("l'ultimo rimasto può ancora offrire", game.canBid(nobody, "b", 1));

// Se passa anche lui il lotto si chiude subito, senza aspettare il timer.
const alsoPassed = game.reducer(nobody, { type: "pass", playerId: "b", now: t0 + 2000 });
check("passano tutti: lotto chiuso subito", alsoPassed.phase === "result");
check("passano tutti: nessun vincitore", alsoPassed.lastResult.winnerId === null);
check("passano tutti: finisce negli scarti", alsoPassed.discards.length === 1);
check("passano tutti: nessuno ha speso", alsoPassed.players.every((p) => p.budget === 20));

// Se invece l'ultimo rimasto lo vuole, gli basta offrire: è suo, e senza rilanci.
const lastTakes = game.reducer(nobody, { type: "bid", playerId: "b", amount: 1, now: t0 + 2000 });
check("l'ultimo rimasto che offre si aggiudica il lotto", lastTakes.phase === "result");
check("e lo paga il prezzo base", lastTakes.lastResult.winnerId === "b" && lastTakes.lastResult.price === 1);

// Anche allo scadere del tempo, con nessuno in gara, non si assegna d'ufficio.
const timedOut = game.reducer(nobody, { type: "tick", now: nobody.deadline + 1 });
check("tempo scaduto senza offerte: nessun vincitore", timedOut.lastResult.winnerId === null);

// Con gli scarti disattivati vale la regola opposta: il lotto va comunque a
// qualcuno, ma a chi ha la lista più corta, non a chi ha passato per ultimo.
let forced = lobby({ budget: 20, slots: 4, allowDiscards: false });
forced = game.reducer(forced, { type: "start", now: t0 });
forced = game.reducer(forced, { type: "bid", playerId: "a", amount: 1, now: t0 + 500 });
forced = game.reducer(forced, { type: "pass", playerId: "b", now: t0 + 1000 });
forced = game.reducer(forced, { type: "tick", now: forced.deadline + 1 });
forced = game.reducer(forced, { type: "pass", playerId: "a", now: t0 + 60_000 });
forced = game.reducer(forced, { type: "pass", playerId: "b", now: t0 + 61_000 });
check("senza scarti: il lotto rifiutato da tutti viene assegnato", forced.lastResult.winnerId !== null);
check(
  "senza scarti: lo prende chi ha la lista più corta",
  forced.lastResult.winnerId === "b",
  forced.lastResult.winnerId,
);
check("senza scarti: al prezzo base", forced.lastResult.price === 1);

/* ---------------- Slot del roster ---------------- */

let slotState = lobby({ slots: 3, budget: 20 });
slotState = game.reducer(slotState, { type: "start", now: t0 });
let clock = t0;
let guard = 0;
while (slotState.phase !== "ended" && guard < 400) {
  if (slotState.phase === "auction") {
    const target = slotState.players.find((p) => game.canBid(slotState, p.id, 1));
    if (target) {
      slotState = game.reducer(slotState, {
        type: "bid",
        playerId: target.id,
        amount: 1,
        now: clock,
      });
    }
  }
  clock += 20000;
  slotState = game.reducer(slotState, { type: "tick", now: clock });
  guard += 1;
}
check("slot: partita chiusa", slotState.phase === "ended", `iterazioni ${guard}`);
check(
  "slot: nessun roster supera il limite",
  slotState.players.every((p) => p.roster.length <= 3),
  slotState.players.map((p) => p.roster.length).join(","),
);
check(
  "slot: giocatore con roster pieno fuori dalle offerte",
  slotState.players.some((p) => p.roster.length === 3),
);

/* ---------------- Mystery Box ---------------- */

let mystery = lobby({ mysteryBox: true, budget: 20, slots: 8 });
mystery = game.reducer(mystery, { type: "start", now: t0 });
let steps = 0;
while (!game.isMysteryLot(mystery) && steps < 30) {
  mystery = game.reducer(mystery, { type: "tick", now: mystery.deadline + 1 });
  if (mystery.phase === "result") {
    mystery = game.reducer(mystery, { type: "tick", now: mystery.deadline + 1 });
  }
  steps += 1;
}
check("mystery: compare una box", game.isMysteryLot(mystery), `dopo ${steps} lotti`);
check("mystery: prezzo fisso 3 su budget 20", mystery.lotPrice === 3, mystery.lotPrice);
check("mystery: non si può rilanciare", !game.canBid(mystery, "a", 4));
check("mystery: si può prendere", game.canClaim(mystery, "a"));
const beforeClaim = game.playerById(mystery, "a").roster.length;
mystery = game.reducer(mystery, { type: "claim", playerId: "a", now: t0 });
check("mystery: elemento assegnato", game.playerById(mystery, "a").roster.length === beforeClaim + 1);
check(
  "mystery: prezzo fisso scalato",
  game.playerById(mystery, "a").roster.slice(-1)[0].price === 3,
);
check("mystery: marcato come mystery", game.playerById(mystery, "a").roster.slice(-1)[0].mystery === true);

/* ---------------- Budget esaurito ---------------- */

let broke = lobby({ budget: 20, slots: 5 });
broke = game.reducer(broke, { type: "start", now: t0 });
broke.players.forEach((p) => {
  p.budget = 0;
});
broke = game.reducer(broke, { type: "tick", now: broke.deadline + 1 });
broke = game.reducer(broke, { type: "tick", now: broke.deadline + 1 });
check("budget esauriti: partita finita", broke.phase === "ended");

/* ---------------- Riserva di budget ---------------- */

let reserve = lobby({ budget: 20, slots: 5 });
reserve = game.reducer(reserve, { type: "start", now: t0 });
const ana = game.playerById(reserve, "a");
check("riserva: con 5 slot liberi si può offrire al massimo budget - 4", game.maxBid(reserve, ana) === 16, game.maxBid(reserve, ana));
check("riserva: offerta oltre il tetto rifiutata", !game.canBid(reserve, "a", 17));
check("riserva: offerta al tetto accettata", game.canBid(reserve, "a", 16));
check("riserva: pulsante Max propone il tetto", game.maxBidOption(reserve, ana) === 16);

reserve = game.reducer(reserve, { type: "bid", playerId: "a", amount: 16, now: t0 + 1000 });
reserve = game.reducer(reserve, { type: "pass", playerId: "b", now: t0 + 1200 });
const anaAfter = game.playerById(reserve, "a");
check("riserva: budget residuo pari agli slot mancanti", anaAfter.budget === 4 && anaAfter.roster.length === 1);
check(
  "riserva: restano esattamente 1 credito per slot",
  anaAfter.budget === game.slotsLeft(reserve, anaAfter),
);
check("riserva: può ancora offrire il minimo", game.maxBid(reserve, anaAfter) >= 1);

/* ---------------- Scarti disattivati ---------------- */

let noDiscard = lobby({ budget: 20, slots: 4, allowDiscards: false });
noDiscard = game.reducer(noDiscard, { type: "start", now: t0 });
noDiscard = game.reducer(noDiscard, { type: "tick", now: noDiscard.deadline + 1 });
check("senza scarti: il lotto viene comunque assegnato", noDiscard.lastResult.winnerId !== null);
check("senza scarti: prezzo base", noDiscard.lastResult.price === 1);
check("senza scarti: nessuno scarto registrato", noDiscard.discards.length === 0);
check("senza scarti: feed segnala l'assegnazione d'ufficio", noDiscard.feed[0].kind === "auto");

let withDiscard = lobby({ budget: 20, slots: 4, allowDiscards: true });
withDiscard = game.reducer(withDiscard, { type: "start", now: t0 });
withDiscard = game.reducer(withDiscard, { type: "tick", now: withDiscard.deadline + 1 });
check("con scarti: nessuna offerta manda il lotto agli scarti", withDiscard.discards.length === 1);

/* ---------------- Assegnazione dei lotti finali ---------------- */

let closing = lobby({ budget: 20, slots: 2 });
closing = game.reducer(closing, { type: "start", now: t0 });
// Bea completa subito la sua lista, Ana resta l'unica da servire.
["b", "b"].forEach(() => {
  closing = game.reducer(closing, { type: "bid", playerId: "b", amount: 1, now: t0 });
  closing = game.reducer(closing, { type: "pass", playerId: "a", now: t0 });
  closing = game.reducer(closing, { type: "tick", now: closing.deadline + 1 });
});
check("chiusura: Bea ha la lista piena", game.playerById(closing, "b").roster.length === 2);
let safety = 0;
while (closing.phase !== "ended" && safety < 80) {
  closing = game.reducer(closing, { type: "tick", now: closing.deadline + 1 });
  safety += 1;
}
check("chiusura: anche Ana completa la lista", game.playerById(closing, "a").roster.length === 2);
check("chiusura: partita terminata", closing.phase === "ended");
check(
  "chiusura: nessun giocatore resta a zero con slot vuoti",
  closing.players.every((p) => p.roster.length === 2),
);

/* ---------------- Avatar ---------------- */

let room = game.createGame({
  code: "AVTR1",
  mode: "local",
  hostId: "a",
  category: categories[0],
  config: { maxPlayers: 6 },
});
room = game.reducer(room, { type: "add_player", player: { id: "a", name: "Ana" } });
room = game.reducer(room, { type: "add_player", player: { id: "b", name: "Bea" } });
room = game.reducer(room, { type: "add_player", player: { id: "c", name: "Cip" } });

check(
  "chi entra riceve un avatar diverso dagli altri",
  new Set(room.players.map((p) => p.emoji)).size === room.players.length,
  room.players.map((p) => p.emoji).join(","),
);

const wanted = room.players[0].emoji;
const doubled = game.reducer(room, {
  type: "add_player",
  player: { id: "d", name: "Dan", emoji: wanted },
});
check(
  "chiedere un avatar già preso ne assegna uno libero",
  doubled.players[3].emoji !== wanted && new Set(doubled.players.map((p) => p.emoji)).size === 4,
);

const free = game.AVATAR_IDS.find((id) => !room.players.some((p) => p.emoji === id));
const changed = game.reducer(room, { type: "set_avatar", playerId: "b", emoji: free });
check("dalla lobby si può cambiare avatar", changed.players[1].emoji === free);

const refused = game.reducer(room, {
  type: "set_avatar",
  playerId: "b",
  emoji: room.players[2].emoji,
});
check("non si può prendere l'avatar di un altro", refused === room);

const started = game.reducer(changed, { type: "start", now: Date.now() });
const late = game.reducer(started, { type: "set_avatar", playerId: "b", emoji: free });
check("a partita avviata l'avatar non si cambia più", late === started);

/* ---------------- Codice stanza ---------------- */

const utils = require(path.join(OUT, "utils.js"));
const codes = Array.from({ length: 200 }, () => utils.roomCode());
check("codice stanza: 5 caratteri", codes.every((c) => c.length === 5));
check("codice stanza: lettere e numeri", codes.every((c) => /^[A-Z0-9]+$/.test(c)));
check(
  "codice stanza: niente caratteri ambigui",
  codes.every((c) => !/[OIL01]/.test(c)),
);

console.log(failures === 0 ? "\nTUTTI I CONTROLLI SUPERATI" : `\n${failures} CONTROLLI FALLITI`);
process.exit(failures === 0 ? 0 : 1);
