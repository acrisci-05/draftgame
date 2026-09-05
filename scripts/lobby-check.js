/**
 * Le regole della lobby: martello, avvio forzato, adozione di una stanza
 * orfana e finestra di rientro automatico.
 *
 * Uso:  node scripts/lobby-check.js [cartella-compilata]
 */
const path = require("path");
const Module = require("module");
const OUT = path.resolve(process.cwd(), process.argv[2] ?? ".tmp-check/lib");
const ROOT = path.resolve(OUT, "..");
const rf = Module._resolveFilename;
Module._resolveFilename = function (r, ...a) {
  return rf.call(this, r.startsWith("@/") ? path.join(ROOT, r.slice(2)) : r, ...a);
};

/* Il magazzino del browser, finto: storage.ts lo cerca su window. */
const memoria = new Map();
global.window = {
  localStorage: {
    get length() { return memoria.size; },
    key: (i) => [...memoria.keys()][i] ?? null,
    getItem: (k) => (memoria.has(k) ? memoria.get(k) : null),
    setItem: (k, v) => memoria.set(k, String(v)),
    removeItem: (k) => memoria.delete(k),
  },
};

const game = require(path.join(OUT, "game.js"));
const st = require(path.join(OUT, "storage.js"));
const catalog = require(path.join(OUT, "catalog.js"));

let ko = 0;
const check = (l, ok, d) => {
  if (ok) console.log("  ok   " + l);
  else { ko += 1; console.log("  FAIL " + l + (d !== undefined ? " -> " + d : "")); }
};

const category = catalog.OFFICIAL_CATEGORIES[0];

function lobby(ids) {
  let s = game.createGame({
    code: "LOBBY",
    mode: "online",
    hostId: ids[0],
    category,
    config: { budget: 20, slots: 3, maxPlayers: 5 },
  });
  ids.forEach((id, i) => {
    s = game.reducer(s, { type: "add_player", player: { id, name: "P" + (i + 1) } });
  });
  return s;
}

/* ---------------- 1. Il martello ---------------- */
console.log("\n1. Il martello");

let s = lobby(["a", "b", "c"]);
check("appena entrati nessuno e' pronto", game.notReady(s).length === 3);
check("e non si parte", !game.everyoneReady(s));

s = game.reducer(s, { type: "gavel", playerId: "a" });
check("chi batte il martello risulta pronto", s.players.find((p) => p.id === "a").ready === true);
check("gli altri no", game.notReady(s).length === 2);

s = game.reducer(s, { type: "gavel", playerId: "a" });
check("ribattendo si ritira", s.players.find((p) => p.id === "a").ready !== true);

s = game.reducer(s, { type: "gavel", playerId: "a" });
s = game.reducer(s, { type: "gavel", playerId: "b" });
s = game.reducer(s, { type: "gavel", playerId: "c" });
check("battuto da tutti, si e' pronti", game.everyoneReady(s));
check("non manca piu' nessuno", game.notReady(s).length === 0);

check(
  "un martello da chi non c'e' non fa niente",
  game.reducer(s, { type: "gavel", playerId: "zzz" }) === s,
);

const inAsta = game.reducer(s, { type: "start", now: 1_000 });
check(
  "a partita avviata il martello non ha piu' effetto",
  game.reducer(inAsta, { type: "gavel", playerId: "a" }) === inAsta,
);

check(
  "chi entra dopo non e' pronto, e ferma il tavolo",
  (() => {
    const dopo = game.reducer(s, { type: "add_player", player: { id: "d", name: "P4" } });
    return !game.everyoneReady(dopo) && game.notReady(dopo).length === 1;
  })(),
);

check(
  "ricominciando si ribatte il martello da capo",
  (() => {
    const finita = game.reducer(inAsta, { type: "restart" });
    return finita.players.every((p) => p.ready !== true);
  })(),
);

/* ---------------- 2. L'avvio forzato ---------------- */
console.log("\n2. L'avvio forzato");

const T = 5_000_000;
function conIngressi(quando) {
  const base = lobby(["a", "b", "c"]);
  return {
    ...base,
    players: base.players.map((p, i) => ({ ...p, joinedAt: quando[i] })),
  };
}

let attesa = conIngressi([T, T, T]);
attesa = game.reducer(attesa, { type: "gavel", playerId: "a" });
attesa = game.reducer(attesa, { type: "gavel", playerId: "b" });

check(
  "appena entrati non si puo' forzare",
  !game.canForceStart(attesa, T + 1000),
);
check(
  "dopo la tolleranza si puo' forzare",
  game.canForceStart(attesa, T + game.GAVEL_GRACE_SECONDS * 1000 + 1),
);
check(
  "se hanno battuto tutti non c'e' niente da forzare",
  (() => {
    const pronti = game.reducer(attesa, { type: "gavel", playerId: "c" });
    return !game.canForceStart(pronti, T + 60_000);
  })(),
);
check(
  "chi e' appena arrivato non si scavalca, nemmeno se un altro e' fermo da un pezzo",
  (() => {
    let misto = conIngressi([T, T, T + 30_000]);
    misto = game.reducer(misto, { type: "gavel", playerId: "a" });
    // b e' fermo da un pezzo, c e' appena entrato: si aspetta c.
    return !game.canForceStart(misto, T + 20_000);
  })(),
);
check(
  "chi manca risulta fermo dopo la tolleranza",
  game.stalledPlayers(attesa, T + game.GAVEL_GRACE_SECONDS * 1000 + 1).length === 1,
);

/* ---------------- 3. La stanza orfana ---------------- */
console.log("\n3. La lobby rimasta senza nessuno");

const orfana = lobby(["a", "b"]);

check(
  "un nuovo arrivato adotta la lobby vuota",
  game.lobbyAdopter(orfana, ["nuovo"], "nuovo"),
);
check(
  "se c'e' ancora qualcuno del tavolo non si adotta: tocca a lui",
  !game.lobbyAdopter(orfana, ["b", "nuovo"], "nuovo"),
);
check(
  "se l'host e' presente non si adotta niente",
  !game.lobbyAdopter(orfana, ["a", "nuovo"], "nuovo"),
);
check(
  "fra due arrivati insieme ne comanda uno solo",
  (() => {
    const primo = game.lobbyAdopter(orfana, ["m2", "m1"], "m1");
    const secondo = game.lobbyAdopter(orfana, ["m2", "m1"], "m2");
    return primo && !secondo;
  })(),
);
check(
  "chi non e' presente non adotta",
  !game.lobbyAdopter(orfana, ["altro"], "nuovo"),
);
check(
  "a partita avviata non si adotta: si e' persa, non e' orfana",
  (() => {
    let corsa = lobby(["a", "b"]);
    corsa = game.reducer(corsa, { type: "gavel", playerId: "a" });
    corsa = game.reducer(corsa, { type: "gavel", playerId: "b" });
    corsa = game.reducer(corsa, { type: "start", now: T });
    return !game.lobbyAdopter(corsa, ["nuovo"], "nuovo");
  })(),
);
check(
  "chi adotta puo' poi iscriversi e prendere il posto di host",
  (() => {
    let dopo = game.reducer(orfana, {
      type: "add_player",
      player: { id: "nuovo", name: "Nuovo" },
    });
    dopo = game.reducer(dopo, { type: "set_host", playerId: "nuovo" });
    return dopo.hostId === "nuovo" && Boolean(game.playerById(dopo, "nuovo"));
  })(),
);

/* ---------------- 4. Il rientro automatico ---------------- */
console.log("\n4. La finestra di rientro");

const sessione = (code) => ({
  code, mode: "online", playerId: "p1", isHost: false, name: "anti", emoji: "flame",
});

memoria.clear();
st.saveSession(sessione("AAAAA"));
check("appena entrati si rientra da soli", st.sessionForReentry("AAAAA")?.code === "AAAAA");

const chiave = "pp:session:AAAAA";
function invecchia(code, minuti) {
  const k = "pp:session:" + code;
  const v = JSON.parse(memoria.get(k));
  v.lastSeenAt = Date.now() - minuti * 60 * 1000;
  memoria.set(k, JSON.stringify(v));
}

invecchia("AAAAA", 1);
check("dopo un minuto si rientra ancora", st.sessionForReentry("AAAAA")?.code === "AAAAA");

invecchia("AAAAA", 10);
check("dopo dieci minuti non si rientra da soli", st.sessionForReentry("AAAAA") === null);
check("ma la sessione resta, per rientrare a mano", st.getSession("AAAAA")?.code === "AAAAA");

check(
  "il battito riapre la finestra",
  (() => {
    st.touchSession("AAAAA");
    return st.sessionForReentry("AAAAA")?.code === "AAAAA";
  })(),
);

st.markSessionFinished("AAAAA");
check("in una partita finita non si rientra mai", st.sessionForReentry("AAAAA") === null);

check("in una stanza mai vista non si rientra", st.sessionForReentry("ZZZZZ") === null);

check(
  "il battito non resuscita una sessione cancellata",
  (() => {
    st.clearSession("AAAAA");
    st.touchSession("AAAAA");
    return st.getSession("AAAAA") === null;
  })(),
);

/*
 * La finestra breve del rientro non tocca il banner della home, che ha una
 * ragione sua: li' si *chiede* se tornare, e chiederlo dopo mezz'ora va bene.
 */
memoria.clear();
st.saveSession(sessione("BBBBB"));
invecchia("BBBBB", 10);
check(
  "il banner della home continua a proporre una stanza di dieci minuti fa",
  st.resumableSession()?.code === "BBBBB",
);
check(
  "ma il rientro automatico li' non scatta",
  st.sessionForReentry("BBBBB") === null,
);

console.log("");
console.log(ko === 0 ? "LA LOBBY E' IN REGOLA" : ko + " CONTROLLI FALLITI");
process.exit(ko === 0 ? 0 : 1);
