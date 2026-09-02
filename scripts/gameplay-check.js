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

/* 7. Flop Draft: si scarta finche' i lotti bastano, poi si assegna d'ufficio. */

// Il tetto non e' piu' un numero scritto a mano: e' quanti lotti avanzano oltre
// quelli che servono a riempire tutte le liste. La stessa regola a due come a
// cinque -- prima erano cinque scarti per tutti, e in cinque giocatori
// finivano al quinto flop.
const TETTI = { 2: 6, 3: 9, 4: 8, 5: 5 };
for (const [n, atteso] of Object.entries(TETTI)) {
  const quanti = Number(n);
  const s = stanza(quanti, { slots: 5, allowDiscards: true });
  check(`in ${n} il tetto dei flop e' ${atteso}`, game.flopBudget(quanti) === atteso, game.flopBudget(quanti));
  check(`in ${n} si parte con ${atteso} flop disponibili`, game.discardsLeft(s) === atteso, game.discardsLeft(s));
  check(`in ${n} il primo lotto si puo' scartare`, game.canDiscardLot(s) === true);

  // Bruciati tutti i flop, non se ne concedono altri: il lotto va assegnato.
  const esauriti = { ...s, discards: new Array(atteso).fill("x") };
  check(`in ${n}, finiti i flop non si scarta piu'`, game.canDiscardLot(esauriti) === false);
}

// La capienza della lista resta il freno piu' stretto: dieci slot a testa in
// tre non lasciano lotti da buttare, per quanto il tetto ne concederebbe nove.
{
  const stretta = stanza(3, { slots: 10, allowDiscards: true });
  check("con la lista al limite non si scarta", game.discardsLeft(stretta) === 0, game.discardsLeft(stretta));
}

// Con il Flop Draft spento non si scarta mai, qualunque sia la capienza.
{
  const spento = stanza(3, { slots: 5, allowDiscards: false });
  check("con il Flop Draft spento non si scarta", game.canDiscardLot(spento) === false);
}

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
check("passando sempre, restano lotti per tutte le liste",
  passata.discards.length <= passata.items.length - passata.players.length * passata.config.slots,
  passata.discards.length);
check("passando sempre, la partita finisce lo stesso",
  passata.phase === "ended" || passata.phase === "voting", passata.phase);
check("passando sempre, le liste si riempiono d'ufficio",
  passata.players.every((p) => p.roster.length === passata.config.slots),
  passata.players.map((p) => p.roster.length).join(","));

// Il lotto d'ufficio va a chi ha piu' spazio, non a caso: e' quello che
// garantisce che tutti arrivino in fondo.
const assegnati = passata.history.filter((r) => r.winnerId);
check("i lotti invenduti trovano comunque un proprietario", assegnati.length > 0, assegnati.length);

/* 8. Il profilo che arriva in ritardo. */
//
// La sessione si legge dal dispositivo dopo il montaggio: chi apre la stanza
// viene iscritto un istante prima che si sappia chi e'. Senza il collegamento
// successivo resterebbe anonimo, e a fine partita non gli si accrediterebbe
// niente: e' il motivo per cui le statistiche restavano a zero.
let tardi = game.createGame({
  code: "TARDI", mode: "online", hostId: "p0",
  category: catalog.OFFICIAL_CATEGORIES[0],
  config: { budget: 20, slots: 3, maxPlayers: 5 },
});
tardi = game.reducer(tardi, { type: "add_player", player: { id: "p0", name: "anti" } });
check("all'inizio il giocatore e' senza profilo",
  game.playerById(tardi, "p0").accountId === undefined);

const collegato = game.reducer(tardi, {
  type: "link_account", playerId: "p0", accountId: "acc-1", handle: "crispy",
});
check("il profilo si attacca quando arriva",
  game.playerById(collegato, "p0").accountId === "acc-1",
  game.playerById(collegato, "p0").accountId);
check("arriva anche il nickname per la card",
  game.playerById(collegato, "p0").handle === "crispy");
check("ripetere il collegamento non cambia niente",
  game.reducer(collegato, { type: "link_account", playerId: "p0", accountId: "acc-1", handle: "crispy" }) === collegato);
check("collegare uno che non c'e' non rompe nulla",
  game.reducer(collegato, { type: "link_account", playerId: "ignoto", accountId: "x" }) === collegato);

// E la classifica finale deve poi riconoscerlo.
let conProfilo = game.reducer(collegato, { type: "add_player", player: { id: "p1", name: "dani" } });
conProfilo = game.reducer(conProfilo, { type: "start", now: Date.now() });
const trovato = game.finalStandings(conProfilo)
  .findIndex((entry) => entry.player.accountId === "acc-1");
check("a fine partita il profilo viene ritrovato in classifica", trovato >= 0, trovato);

console.log("");

/* 8. I titoli di fine partita: targhe, non punti. */
{
  // Una partita finita a mano: due giocatori, uno spende tutto, l'altro passa.
  let s = stanza(3, { slots: 3, budget: 10, allowDiscards: true });
  s = {
    ...s,
    phase: "ended",
    history: [
      { itemId: "a", itemName: "A", tier: 3, winnerId: "p0", winnerName: "g0", price: 6 },
      { itemId: "b", itemName: "B", tier: 3, winnerId: "p0", winnerName: "g0", price: 4 },
      { itemId: "c", itemName: "C", tier: 3, winnerId: "p1", winnerName: "g1", price: 2 },
    ],
    players: s.players.map((p) =>
      p.id === "p0"
        ? { ...p, budget: 0, passes: 1 }
        : p.id === "p1"
          ? { ...p, budget: 8, passes: 5 }
          : { ...p, budget: 4, passes: 2 },
    ),
    votes: { p0: "p1", p1: "p2", p2: "p1" },
  };

  const titoli = game.endTitles(s);
  check("chi finisce i crediti per primo e' lo Spendaccione",
    (titoli.p0 ?? []).includes("spender"), JSON.stringify(titoli));
  check("chi resta con piu' crediti e' il Braccino Corto",
    (titoli.p1 ?? []).includes("tightwad"), JSON.stringify(titoli));
  check("chi ha rinunciato di piu' e' il Maestro del Flop",
    (titoli.p1 ?? []).includes("flopMaster"), JSON.stringify(titoli));
  check("il vincitore e' il Dominatore",
    (titoli[game.winnerOf(s).player.id] ?? []).includes("dominator"), JSON.stringify(titoli));

  // A parita' non si assegna: due "braccino corto" appaiati non dicono niente.
  const pari = { ...s, players: s.players.map((p) => ({ ...p, budget: 5, passes: 2 })) };
  const titoliPari = game.endTitles(pari);
  const conTargheDiSpesa = Object.values(titoliPari).flat().filter((id) => id !== "dominator" && id !== "spender");
  check("a parita' non si assegnano targhe", conTargheDiSpesa.length === 0, JSON.stringify(titoliPari));
}

console.log(ko === 0 ? "TUTTI I CASI LIMITE REGGONO" : `${ko} CONTROLLI FALLITI`);
process.exit(ko === 0 ? 0 : 1);
