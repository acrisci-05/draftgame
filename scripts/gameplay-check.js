/**
 * La lista dei casi limite del gioco.
 *
 * Sono le regole che un giocatore da' per scontate e che, se saltano, rovinano
 * la partita senza che nessuno capisca perche': il tetto di spesa, chi ha
 * finito la lista, il divieto di votarsi da soli. Qui si provano una per una
 * sul motore vero.
 */
const path = require("path");
const Module = require("module");
const OUT = path.resolve(process.cwd(), process.argv[2] ?? ".tmp-check/lib");
const ROOT = path.resolve(OUT, "..");
const rf = Module._resolveFilename;
Module._resolveFilename = function (r, ...a) {
  return rf.call(this, r.startsWith("@/") ? path.join(ROOT, r.slice(2)) : r, ...a);
};
const game = require(path.join(OUT, "game.js"));
const catalog = require(path.join(OUT, "catalog.js"));

let ko = 0;
const check = (l, ok, d) => {
  if (ok) console.log("  ok   " + l);
  else { ko += 1; console.log("  FAIL " + l + (d !== undefined ? " -> " + d : "")); }
};

function stanza(quanti, config) {
  let s = game.createGame({
    code: "CHECK", mode: "online", hostId: "p0",
    category: catalog.OFFICIAL_CATEGORIES[0],
    config: { budget: 20, slots: 3, maxPlayers: 5, ...config },
  });
  for (let i = 0; i < quanti; i += 1) {
    s = game.reducer(s, { type: "add_player", player: { id: `p${i}`, name: `g${i}` } });
  }
  return game.reducer(s, { type: "start", now: Date.now() });
}

console.log("\nCasi limite del gioco\n");

/* 1. La regola d'oro del saldo. */
let s = stanza(2);
const me = game.playerById(s, "p0");
const tetto = game.maxBid(s, me);
check("il tetto lascia un credito per ogni slot che resterebbe vuoto",
  tetto === me.budget - (s.config.slots - me.roster.length - 1), tetto);
check("un'offerta oltre il tetto viene rifiutata", !game.canBid(s, "p0", tetto + 1));
check("un'offerta pari al tetto viene accettata", game.canBid(s, "p0", tetto));
const dopo = game.reducer(s, { type: "bid", playerId: "p0", amount: tetto + 1, now: Date.now() });
check("lo stato non cambia se l'offerta e' troppo alta", dopo === s);

/* 2. Chi ha riempito la lista esce di scena. */
let pieno = stanza(2);
const pid = pieno.players[0].id;
pieno = {
  ...pieno,
  players: pieno.players.map((p) =>
    p.id === pid
      ? { ...p, roster: [{ itemId: "x", name: "x", tier: 1, price: 1 },
                         { itemId: "y", name: "y", tier: 1, price: 1 },
                         { itemId: "z", name: "z", tier: 1, price: 1 }] }
      : p),
};
check("chi ha la lista piena non puo' piu' offrire", !game.canBid(pieno, pid, 1));
check("chi ha la lista piena non deve nemmeno passare", !game.canPass(pieno, pid));
check("chi ha la lista piena esce dai giocatori in corsa",
  !game.activePlayers(pieno).some((p) => p.id === pid));
check("chi ha la lista piena non e' piu' fra quelli da completare",
  !game.pendingPlayers(pieno).some((p) => p.id === pid));

/* 3. Voto: niente autovoto, e il tetto di tempo. */
let voto = stanza(3);
voto = { ...voto, phase: "voting" };
check("non ci si puo' votare da soli", !game.canVote(voto, "p0", "p0"));
check("si puo' votare un altro", game.canVote(voto, "p0", "p1"));
const votato = game.reducer(voto, { type: "vote", voterId: "p0", targetId: "p1", now: Date.now() });
check("non si vota due volte", !game.canVote(votato, "p0", "p2"));
check("il voto dura novanta secondi", game.VOTE_SECONDS === 90, game.VOTE_SECONDS);

/* 4. Si parte da due fino a otto. */
check("con due giocatori la partita parte", stanza(2).phase !== "lobby");
// Cinque e' il tetto: con quei giocatori e tre slot i lotti bastano.
check("con cinque giocatori la partita parte", stanza(5, { slots: 3 }).phase !== "lobby");
const uno = game.reducer(
  game.reducer(
    game.createGame({ code: "CHECK", mode: "online", hostId: "p0",
      category: catalog.OFFICIAL_CATEGORIES[0], config: { budget: 20, slots: 3, maxPlayers: 5 } }),
    { type: "add_player", player: { id: "p0", name: "solo" } }),
  { type: "start", now: Date.now() });
check("con un giocatore solo non parte", uno.phase === "lobby", uno.phase);
const sesto = game.reducer(stanza(5, { slots: 3 }), {
  type: "add_player",
  player: { id: "p6", name: "sesto" },
});
check("il sesto giocatore non entra", sesto.players.length === 5, sesto.players.length);

/* 5. L'host puo' togliere qualcuno prima di cominciare. */
let lobby = game.createGame({ code: "CHECK", mode: "online", hostId: "p0",
  category: catalog.OFFICIAL_CATEGORIES[0], config: { budget: 20, slots: 3, maxPlayers: 5 } });
for (const id of ["p0", "p1", "p2"]) {
  lobby = game.reducer(lobby, { type: "add_player", player: { id, name: id } });
}
const tolto = game.reducer(lobby, { type: "remove_player", playerId: "p2" });
check("in attesa si puo' togliere un giocatore", tolto.players.length === 2, tolto.players.length);
const inCorso = game.reducer(stanza(3), { type: "remove_player", playerId: "p2" });
check("a partita iniziata non si toglie piu' nessuno",
  inCorso.players.length === 3, inCorso.players.length);

/* 6. I lotti devono bastare per tutti, margine compreso. */
const troppi = stanza(5, { slots: 10 });
check("non si parte se i lotti non bastano per tutti", troppi.phase === "lobby", troppi.phase);
const giusti = stanza(5, { slots: 5 });
check(
  "cinque giocatori con cinque elementi a testa ci stanno",
  giusti.phase !== "lobby",
  giusti.phase,
);

// La regola, presa da sola. Trenta lotti sono il taglio esatto per cinque
// giocatori da cinque elementi: 5x5+5 fa trenta.
check("la soglia e' (giocatori x slot) + 5", game.canStartMatch(5, 30, 5));
check("un lotto in meno e non si parte", !game.canStartMatch(5, 29, 5));
check("il margine e' di cinque", game.LOT_MARGIN === 5, game.LOT_MARGIN);
check("una lista da venti regge tre giocatori da cinque", game.canStartMatch(3, 20, 5));
check("una lista da venti non regge quattro giocatori da cinque", !game.canStartMatch(4, 20, 5));
check("una lista da venti regge cinque giocatori da tre", game.canStartMatch(5, 20, 3));

// Il tetto suggerito deve coincidere con la regola.
for (const lotti of [20, 25, 30]) {
  for (const slot of [3, 4, 5]) {
    const tetto = game.maxPlayersFor(lotti, slot);
    const coerente =
      (tetto === 0 || game.canStartMatch(tetto, lotti, slot)) &&
      (tetto >= 5 || !game.canStartMatch(tetto + 1, lotti, slot));
    check(`tetto coerente con ${lotti} lotti e ${slot} elementi (max ${tetto})`, coerente);
  }
}

check("la soglia minima di una lista e' venti", game.MIN_CATEGORY_ITEMS === 20, game.MIN_CATEGORY_ITEMS);

/* 7. Gli scarti sono cinque, poi i lotti si assegnano d'ufficio. */
check("il tetto degli scarti e' cinque", game.MAX_DISCARDS === 5, game.MAX_DISCARDS);

// Una partita in cui passano sempre tutti: senza tetto si svuoterebbe il mazzo.
function passanoTutti() {
  let s = stanza(3, { slots: 3, allowDiscards: true });
  let now = Date.now();
  for (let giri = 0; giri < 2000 && s.phase !== "ended" && s.phase !== "voting"; giri += 1) {
    now += 300;
    if (s.phase === "result") { s = game.reducer(s, { type: "tick", now: now + 5000 }); continue; }
    if (s.phase !== "auction") { s = game.reducer(s, { type: "tick", now }); continue; }
    const chi = s.players.find((p) => game.canPass(s, p.id));
    if (!chi) { s = game.reducer(s, { type: "tick", now: s.deadline + 1 }); continue; }
    s = game.reducer(s, { type: "pass", playerId: chi.id, now });
  }
  return s;
}
const passata = passanoTutti();
check("passando sempre, non si supera il tetto",
  passata.discards.length <= game.MAX_DISCARDS, passata.discards.length);
check("passando sempre, la partita finisce lo stesso",
  passata.phase === "ended" || passata.phase === "voting", passata.phase);
check("passando sempre, le liste si riempiono d'ufficio",
  passata.players.every((p) => p.roster.length === passata.config.slots),
  passata.players.map((p) => p.roster.length).join(","));

// Il lotto d'ufficio va a chi ha piu' spazio, non a caso: e' quello che
// garantisce che tutti arrivino in fondo.
const assegnati = passata.history.filter((r) => r.winnerId);
check("i lotti invenduti trovano comunque un proprietario", assegnati.length > 0, assegnati.length);

console.log("");
console.log(ko === 0 ? "TUTTI I CASI LIMITE REGGONO" : `${ko} CONTROLLI FALLITI`);
process.exit(ko === 0 ? 0 : 1);
