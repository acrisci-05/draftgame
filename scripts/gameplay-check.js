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

/* 6. I lotti devono bastare per tutti. */
const troppi = stanza(5, { slots: 10 });
check("non si parte se i lotti non bastano per tutti", troppi.phase === "lobby", troppi.phase);
const giusti = stanza(5, { slots: 5 });
check(
  "cinque giocatori con cinque elementi a testa ci stanno",
  giusti.phase !== "lobby",
  giusti.phase,
);

console.log("");
console.log(ko === 0 ? "TUTTI I CASI LIMITE REGGONO" : `${ko} CONTROLLI FALLITI`);
process.exit(ko === 0 ? 0 : 1);
