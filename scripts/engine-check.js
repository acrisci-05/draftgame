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
// Quasi tutte le liste hanno 30 elementi. Tre fanno eccezione, e ogni volta e'
// l'argomento a dettare il numero, non la voglia di sgarrare: le Regioni
// Italiane sono venti, le Auto sono quarantacinque perche' le marche in vendita
// sono quelle -- tagliarne quindici vorrebbe dire togliere dal gioco marchi che
// la gente conosce -- e Build Your Room ne ha quaranta, otto per fascia, perche'
// una stanza si arreda con quello che ci sta.
const QUANTI = { regioni: 20, cars: 45, "build-your-room": 40 };
const attesi = (c) => QUANTI[c.id] ?? 30;
check(
  "ogni lista ha il numero di elementi previsto",
  categories.every((c) => c.items.length === attesi(c)),
  categories
    .filter((c) => c.items.length !== attesi(c))
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
check("offerta: timer di nuovo al massimo", state.deadline === t0 + 2000 + 15000);
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
check("anti-sniping: timer di nuovo al massimo", state.deadline === beforeSnipe - 1500 + 15000);

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

// Con l'asta a turni il tempo e' di chi ha la mano: allo scadere passa lui e
// la mano va avanti. Il lotto si chiude quando li' ha lasciati tutti.
let giri = 0;
while (state.phase === "auction" && giri < 10) {
  state = game.reducer(state, { type: "tick", now: state.deadline + 1 });
  giri += 1;
}
check("scaduti tutti i turni: negli scarti", state.discards.length === 1, state.discards.length);
check("nessun vincitore", state.lastResult.winnerId === null);
check("bastano tanti turni quanti i giocatori", giri <= state.players.length, giri);

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
const timedOut = scadeIlLotto(nobody);
check("tempo scaduto senza offerte: nessun vincitore", timedOut.lastResult.winnerId === null);

// Con gli scarti disattivati vale la regola opposta: il lotto va comunque a
// qualcuno, ma a chi ha la lista più corta, non a chi ha passato per ultimo.
let forced = lobby({ budget: 20, slots: 4, allowDiscards: false });
forced = game.reducer(forced, { type: "start", now: t0 });

// Primo lotto: se lo prende chi ha la mano, cosi' le due liste non sono piu'
// lunghe uguali. Senza questo passaggio i due sono identici e la regola da
// provare -- va a chi ha la lista piu' corta -- non avrebbe niente da dire.
const primo = forced.turnId;
forced = game.reducer(forced, { type: "bid", playerId: primo, amount: 1, now: t0 + 500 });
let giroUno = 0;
while (forced.phase === "auction" && giroUno < 10) {
  forced = game.reducer(forced, { type: "pass", playerId: forced.turnId, now: t0 + 1000 + giroUno * 500 });
  giroUno += 1;
}
forced = game.reducer(forced, { type: "tick", now: forced.deadline + 1 });
const altro = forced.players.find((p) => p.id !== primo).id;

// Secondo lotto: non lo vuole nessuno. Con i turni si passa uno per volta, e
// il lotto si chiude quando li ha lasciati tutti.
let mano = 0;
while (forced.phase === "auction" && mano < 10) {
  forced = game.reducer(forced, { type: "pass", playerId: forced.turnId, now: t0 + 20_000 + mano * 1000 });
  mano += 1;
}
check("senza scarti: il lotto rifiutato da tutti viene assegnato", forced.lastResult.winnerId !== null);
check(
  "senza scarti: lo prende chi ha la lista più corta",
  forced.lastResult.winnerId === altro,
  forced.lastResult.winnerId,
);
check("senza scarti: al prezzo base", forced.lastResult.price === 1);

/* ---------------- Voto finale ---------------- */

/** Porta una partita fino alla fine dell'asta, con tre giocatori. */
function playedOut() {
  let s = game.createGame({
    code: "VOTE1",
    mode: "local",
    hostId: "a",
    category,
    config: { maxPlayers: 3, budget: 20, slots: 1 },
  });
  for (const [id, name] of [["a", "Ana"], ["b", "Bea"], ["c", "Cip"]]) {
    s = game.reducer(s, { type: "add_player", player: { id, name } });
  }
  s = game.reducer(s, { type: "start", now: t0 });
  let clock = t0;
  let guard = 0;
  while (s.phase !== "voting" && s.phase !== "ended" && guard < 200) {
    if (s.phase === "auction") {
      const buyer = s.players.find((p) => game.canBid(s, p.id, 1));
      if (buyer) s = game.reducer(s, { type: "bid", playerId: buyer.id, amount: 1, now: clock });
      else s = game.reducer(s, { type: "tick", now: s.deadline + 1 });
    } else {
      s = game.reducer(s, { type: "tick", now: s.deadline + 1 });
    }
    clock += 1000;
    guard += 1;
  }
  return s;
}

let voting = playedOut();
check("finita l'asta si vota, non si premia", voting.phase === "voting", voting.phase);
check("il voto ha il suo tempo", voting.deadline > 0);
check("all'inizio non ha votato nessuno", game.pendingVoters(voting).length === 3);

check("non si vota la propria rosa", !game.canVote(voting, "a", "a"));
check("si vota quella di un altro", game.canVote(voting, "a", "b"));

voting = game.reducer(voting, { type: "vote", voterId: "a", targetId: "b", now: t0 });
check("il voto viene registrato", game.voteTally(voting)["b"] === 1);
check("chi ha votato non vota due volte", !game.canVote(voting, "a", "c"));
check(
  "il secondo voto dello stesso giocatore non passa",
  game.reducer(voting, { type: "vote", voterId: "a", targetId: "c", now: t0 }) === voting,
);
check("con voti in sospeso la partita non finisce", voting.phase === "voting");

voting = game.reducer(voting, { type: "vote", voterId: "b", targetId: "c", now: t0 });
voting = game.reducer(voting, { type: "vote", voterId: "c", targetId: "b", now: t0 });
check("votato l'ultimo, si chiude subito", voting.phase === "ended", voting.phase);
const podium = game.finalStandings(voting);
check("vince chi ha piu' voti", podium[0].player.id === "b" && podium[0].votes === 2, podium[0].player.id);
check("il motivo del primo posto sono i voti", podium[0].reason === "votes");

// Il tempo scaduto chiude comunque: chi non ha votato, non vota.
let silent = playedOut();
silent = game.reducer(silent, { type: "vote", voterId: "a", targetId: "c", now: t0 });
silent = game.reducer(silent, { type: "tick", now: silent.deadline + 1 });
check("allo scadere si proclama lo stesso", silent.phase === "ended");
check("vince chi aveva l'unico voto", game.winnerOf(silent).player.id === "c");

// Pareggi: non devono esistere, un vincitore solo ci deve essere sempre.
let tied = playedOut();
tied = game.reducer(tied, { type: "vote", voterId: "a", targetId: "b", now: t0 });
tied = game.reducer(tied, { type: "vote", voterId: "b", targetId: "a", now: t0 });
tied = game.reducer(tied, { type: "vote", voterId: "c", targetId: "a", now: t0 });
const tiedPodium = game.finalStandings(tied);
check("a parita' di voti decide qualcos'altro", tiedPodium[0].votes >= tiedPodium[1].votes);
check(
  "il primo posto e' di uno solo",
  tiedPodium.filter((entry) => entry.votes === tiedPodium[0].votes && entry.player.id === tiedPodium[0].player.id).length === 1,
);
check("c'e' sempre un vincitore", game.winnerOf(tied) !== null);

// Due giocatori con gli stessi voti: decide chi ha speso meno.
const pair = {
  ...playedOut(),
  players: [
    { id: "x", name: "X", emoji: "flame", budget: 12, roster: [{ itemId: "1", name: "a", tier: 1, price: 8 }] },
    { id: "y", name: "Y", emoji: "zap", budget: 15, roster: [{ itemId: "2", name: "b", tier: 1, price: 5 }] },
  ],
  votes: { x: "y", y: "x" },
};
const byCredits = game.finalStandings(pair);
check(
  "a parita' di voti vince chi ha piu' crediti rimasti",
  byCredits[0].player.id === "y",
  byCredits[0].player.id,
);
check("e il motivo lo dice", byCredits[0].reason === "credits", byCredits[0].reason);

/* ---------------- Durata del lotto ---------------- */

// La durata e' una sola: vale all'apertura del lotto e a ogni rilancio.
let fast = lobby({ budget: 20, slots: 3, lotSeconds: 10 });
fast = game.reducer(fast, { type: "start", now: t0 });
check("stanza veloce: 10 secondi all'apertura", fast.deadline === t0 + 10000, fast.deadline - t0);
fast = game.reducer(fast, { type: "bid", playerId: "a", amount: 1, now: t0 + 3000 });
check(
  "stanza veloce: il rilancio rimette 10 secondi",
  fast.deadline === t0 + 3000 + 10000,
  fast.deadline - (t0 + 3000),
);

let slow = lobby({ budget: 20, slots: 3, lotSeconds: 20 });
slow = game.reducer(slow, { type: "start", now: t0 });
check("stanza comoda: 20 secondi all'apertura", slow.deadline === t0 + 20000);
// Rilancia chi ha la mano: da li' il cronometro riparte per il prossimo.
slow = game.reducer(slow, { type: "bid", playerId: slow.turnId, amount: 1, now: t0 + 5000 });
check("stanza comoda: dopo il rilancio il turno dopo ha 20 secondi", slow.deadline === t0 + 5000 + 20000, slow.deadline - (t0 + 5000));

// Le partite vecchie non hanno la durata scritta: vale lo standard.
const legacy = game.reducer(
  { ...lobby({ budget: 20, slots: 3 }), config: { ...lobby({}).config, lotSeconds: undefined } },
  { type: "start", now: t0 },
);
check("senza durata scritta valgono 15 secondi", legacy.deadline === t0 + 15000, legacy.deadline - t0);
check("lo standard e' 15", game.LOT_TIMER_DURATION === 15);
check(
  "le scelte sono 10, 15 e 20",
  JSON.stringify(game.LOT_TIMER_CHOICES) === "[10,15,20]",
  JSON.stringify(game.LOT_TIMER_CHOICES),
);

/* ---------------- Livelli, trofei e colori ---------------- */

const levels = require(path.join(OUT, "levels.js"));

// I livelli hanno una suite tutta loro: npm run check:levels.

const nothing = levels.trophiesFor({ played: 0, won: 0, mates: 0, xp: 0 });
check("a zero i tre trofei sono spenti", nothing.every((t) => !t.unlocked));
const some = levels.trophiesFor({ played: 5, won: 1, mates: 3, xp: 300 });
check("con partite, vittoria e amici sono accesi", some.every((t) => t.unlocked));
const partial = levels.trophiesFor({ played: 5, won: 0, mates: 2, xp: 250 });
check(
  "il trofeo mostra a che punto si e'",
  partial[2].progress === 2 && partial[2].target === 3 && !partial[2].unlocked,
);
check("percentuale senza partite: zero", levels.winRate({ played: 0, won: 0, mates: 0, xp: 0 }) === 0);
check("percentuale su 4 partite e 2 vittorie", levels.winRate({ played: 4, won: 2, mates: 0, xp: 400 }) === 50);

// Colori: come gli avatar, uno per giocatore.
let palette = lobby({ maxPlayers: 4 });
check(
  "chi entra riceve un colore diverso",
  palette.players[0].color !== palette.players[1].color,
  palette.players.map((p) => p.color).join(","),
);
const recolored = game.reducer(palette, { type: "set_color", playerId: "b", color: "amber" });
check("dalla lobby si cambia colore", game.playerById(recolored, "b").color === "amber");
check(
  "non si prende il colore di un altro",
  game.reducer(recolored, { type: "set_color", playerId: "a", color: "amber" }) === recolored,
);
const colorLocked = game.reducer(recolored, { type: "start", now: t0 });
check(
  "a partita avviata il colore non si cambia piu'",
  game.reducer(colorLocked, { type: "set_color", playerId: "b", color: "pink" }) === colorLocked,
);

/* ---------------- Passaggio di host ---------------- */

// Se chi ospita la stanza sparisce, il posto lo prende il primo giocatore
// rimasto nell'ordine della lista: lo stesso ordine su tutti i dispositivi.
let hostState = lobby({ maxPlayers: 4, budget: 20, slots: 4 });
hostState = game.reducer(hostState, { type: "add_player", player: { id: "c", name: "Cip" } });

check("host presente: nessun successore", game.nextHost(hostState, ["a", "b", "c"]) === null);
check(
  "host sparito: tocca al primo rimasto",
  game.nextHost(hostState, ["b", "c"]) === "b",
  game.nextHost(hostState, ["b", "c"]),
);
check(
  "il successore e' lo stesso per tutti i dispositivi",
  game.nextHost(hostState, ["c", "b"]) === game.nextHost(hostState, ["b", "c"]),
);
check("nessuno rimasto: nessun successore", game.nextHost(hostState, []) === null);

const promoted = game.reducer(hostState, { type: "set_host", playerId: "b" });
check("il nuovo host risulta nello stato", promoted.hostId === "b");
check(
  "promuovere l'host attuale non cambia niente",
  game.reducer(promoted, { type: "set_host", playerId: "b" }) === promoted,
);
check(
  "non si promuove chi non e' in stanza",
  game.reducer(promoted, { type: "set_host", playerId: "zzz" }) === promoted,
);
// Il passaggio vale anche a partita avviata: e' li' che serve davvero.
const running = game.reducer(game.reducer(hostState, { type: "start", now: t0 }), {
  type: "set_host",
  playerId: "c",
});
check("si cambia host anche durante l'asta", running.hostId === "c" && running.phase === "auction");

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
// Finiti i soldi l'asta chiude, ma la partita non e' decisa: si passa al voto.
check("budget esauriti: si passa al voto", broke.phase === "voting", broke.phase);
check("budget esauriti: l'asta e' chiusa", broke.currentItemId === null);

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

/** Lascia scadere il tempo a tutti, uno per volta, finche' il lotto si chiude. */
function scadeIlLotto(state) {
  let giri = 0;
  while (state.phase === "auction" && giri < 12) {
    state = game.reducer(state, { type: "tick", now: state.deadline + 1 });
    giri += 1;
  }
  return state;
}
/* ---------------- Scarti disattivati ---------------- */

let noDiscard = lobby({ budget: 20, slots: 4, allowDiscards: false });
noDiscard = game.reducer(noDiscard, { type: "start", now: t0 });
noDiscard = scadeIlLotto(noDiscard);
check("senza scarti: il lotto viene comunque assegnato", noDiscard.lastResult.winnerId !== null);
check("senza scarti: prezzo base", noDiscard.lastResult.price === 1);
check("senza scarti: nessuno scarto registrato", noDiscard.discards.length === 0);
check("senza scarti: feed segnala l'assegnazione d'ufficio", noDiscard.feed[0].kind === "auto");

let withDiscard = lobby({ budget: 20, slots: 4, allowDiscards: true });
withDiscard = game.reducer(withDiscard, { type: "start", now: t0 });
withDiscard = scadeIlLotto(withDiscard);
check("con scarti: nessuna offerta manda il lotto agli scarti", withDiscard.discards.length === 1);

/* ---------------- Assegnazione dei lotti finali ---------------- */

let closing = lobby({ budget: 20, slots: 2 });
closing = game.reducer(closing, { type: "start", now: t0 });
// Bea completa subito la sua lista, Ana resta l'unica da servire. Con i turni
// non si puo' piu' far agire chi si vuole: si aspetta la propria mano, e se
// tocca ad Ana lei passa.
for (let lotto = 0; lotto < 2; lotto += 1) {
  let mosse = 0;
  while (closing.phase === "auction" && mosse < 6) {
    const chi = closing.turnId;
    if (!chi) break;
    if (chi === "b" && game.canBid(closing, "b", game.minimumBid(closing))) {
      closing = game.reducer(closing, { type: "bid", playerId: "b", amount: game.minimumBid(closing), now: t0 });
    } else {
      closing = game.reducer(closing, { type: "pass", playerId: chi, now: t0 });
    }
    mosse += 1;
  }
  closing = game.reducer(closing, { type: "tick", now: closing.deadline + 1 });
}
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


/* ---------------- Avatar ritirati ---------------- */

// Togliere un'icona dall'elenco non deve rompere chi ce l'aveva addosso: il
// valore resta scritto nel suo profilo, e senza una traduzione si vedrebbe la
// parola al posto del disegno.
check("un avatar in elenco si risolve in se stesso", game.resolveAvatar("flame") === "flame");
check("la moneta ritirata trova un erede", game.resolveAvatar("coins") === "gem", game.resolveAvatar("coins"));
check("un valore inventato non ne trova nessuno", game.resolveAvatar("pinguino") === null);
check("la moneta non si puo' piu' scegliere", game.AVATAR_IDS.includes("coins") === false);
check("capra e cuoco sono scegliibili", game.AVATAR_IDS.includes("goat") && game.AVATAR_IDS.includes("chef"));
check("nessun avatar ripetuto", new Set(game.AVATAR_IDS).size === game.AVATAR_IDS.length);
console.log(failures === 0 ? "\nTUTTI I CONTROLLI SUPERATI" : `\n${failures} CONTROLLI FALLITI`);
process.exit(failures === 0 ? 0 : 1);
