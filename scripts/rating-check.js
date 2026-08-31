/**
 * Quando si chiede un parere sull'app, e quando si sta zitti.
 *
 * Le tre regole servono a non diventare molesti, e una sbagliata si nota solo
 * dopo, quando qualcuno si e' gia' stufato: meglio provarle qui.
 */
const path = require("path");
const Module = require("module");
const OUT = path.resolve(process.cwd(), process.argv[2] ?? ".tmp-check/lib");
const ROOT = path.resolve(OUT, "..");
const rf = Module._resolveFilename;
Module._resolveFilename = function (r, ...a) {
  return rf.call(this, r.startsWith("@/") ? path.join(ROOT, r.slice(2)) : r, ...a);
};

// Una memoria finta: il modulo parla con localStorage, che qui non esiste.
const memoria = new Map();
global.window = {
  localStorage: {
    getItem: (k) => (memoria.has(k) ? memoria.get(k) : null),
    setItem: (k, v) => memoria.set(k, String(v)),
    removeItem: (k) => memoria.delete(k),
  },
};

const r = require(path.join(OUT, "rating-prompt.js"));

let ko = 0;
const check = (l, ok, d) => {
  if (ok) console.log("  ok   " + l);
  else { ko += 1; console.log("  FAIL " + l + (d !== undefined ? " -> " + d : "")); }
};
const GIORNO = 24 * 60 * 60 * 1000;

console.log("\nQuando chiedere un parere\n");

check("appena installato non si chiede niente", !r.shouldAskRating());

r.countMatch();
check("dopo una partita e' ancora presto", !r.shouldAskRating(), r.matchesCompleted());
r.countMatch();
check("dopo due e' ancora presto", !r.shouldAskRating(), r.matchesCompleted());
r.countMatch();
check("alla terza si chiede", r.shouldAskRating(), r.matchesCompleted());

// Si e' chiesto: da qui trenta giorni di silenzio.
const adesso = Date.now();
r.markPrompted();
check("chiesto una volta, non si insiste subito", !r.shouldAskRating(adesso + 1000));
check("dopo dieci giorni ancora silenzio", !r.shouldAskRating(adesso + 10 * GIORNO));
check("dopo ventinove giorni ancora silenzio", !r.shouldAskRating(adesso + 29 * GIORNO));
check("dopo trenta giorni si puo' richiedere", r.shouldAskRating(adesso + 30 * GIORNO));

// Chi ha votato, o ha detto basta, non va piu' disturbato.
r.markRated();
check("chi ha gia' votato non viene piu' disturbato", !r.shouldAskRating(adesso + 365 * GIORNO));

check("la soglia e' tre partite", r.MATCHES_BEFORE_ASKING === 3, r.MATCHES_BEFORE_ASKING);
check("l'attesa e' di trenta giorni", r.DAYS_BETWEEN_ASKS === 30, r.DAYS_BETWEEN_ASKS);

console.log("");
console.log(ko === 0 ? "LA RICHIESTA NON DIVENTA MOLESTA" : `${ko} CONTROLLI FALLITI`);
process.exit(ko === 0 ? 0 : 1);
