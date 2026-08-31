/**
 * Il banner "torna alla partita" deve sparire quando la partita e' finita.
 *
 * Prima restava per ore su una gara conclusa, perche' la sessione salvata nel
 * dispositivo non veniva cancellata da nessuno. Qui si controlla la regola che
 * decide se riproporla.
 */
const path = require("path");
const Module = require("module");
const OUT = path.resolve(process.cwd(), process.argv[2] ?? ".tmp-check/lib");
const ROOT = path.resolve(OUT, "..");
const rf = Module._resolveFilename;
Module._resolveFilename = function (r, ...a) {
  return rf.call(this, r.startsWith("@/") ? path.join(ROOT, r.slice(2)) : r, ...a);
};

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

const st = require(path.join(OUT, "storage.js"));

let ko = 0;
const check = (l, ok, d) => {
  if (ok) console.log("  ok   " + l);
  else { ko += 1; console.log("  FAIL " + l + (d !== undefined ? " -> " + d : "")); }
};

const stanza = (code) => ({
  code, mode: "online", playerId: "p1", isHost: true, name: "anti", emoji: "flame",
});

console.log("\nQuando riproporre la partita lasciata a meta'\n");

check("senza stanze aperte non si propone niente", st.resumableSession() === null);

st.saveSession(stanza("ABCDE"));
check("appena entrati la stanza si ripropone", st.resumableSession()?.code === "ABCDE");

// Finita la partita, la sessione si chiude.
st.clearSession("ABCDE");
check("a partita finita non si ripropone piu'", st.resumableSession() === null);

// La scadenza a tempo, per chi non e' arrivato a chiuderla.
st.saveSession(stanza("FGHJK"));
const chiave = "pp:session:FGHJK";
const vecchia = JSON.parse(memoria.get(chiave));
vecchia.openedAt = Date.now() - 2 * 60 * 60 * 1000; // due ore fa
memoria.set(chiave, JSON.stringify(vecchia));
check("una stanza di due ore fa non si ripropone", st.resumableSession() === null);

vecchia.openedAt = Date.now() - 10 * 60 * 1000; // dieci minuti fa
memoria.set(chiave, JSON.stringify(vecchia));
check("una di dieci minuti fa si', si ripropone", st.resumableSession()?.code === "FGHJK");

// Fra due stanze si propone la piu' recente.
st.saveSession(stanza("MNPQR"));
check("fra due si propone la piu' recente", st.resumableSession()?.code === "MNPQR",
  st.resumableSession()?.code);

console.log("");
console.log(ko === 0 ? "IL BANNER COMPARE SOLO QUANDO SERVE" : `${ko} CONTROLLI FALLITI`);
process.exit(ko === 0 ? 0 : 1);
