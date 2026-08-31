/**
 * Le soglie dei livelli.
 *
 * Si controlla che la scala sia continua (nessun buco, nessun salto
 * all'indietro) e che i confini di fascia cadano dove promettono le regole:
 * quei numeri sono scritti nel sito, e se il codice ne usa altri il giocatore
 * si sente preso in giro.
 */
const path = require("path");
const Module = require("module");
const OUT = path.resolve(process.cwd(), process.argv[2] ?? ".tmp-check/lib");
const ROOT = path.resolve(OUT, "..");
const rf = Module._resolveFilename;
Module._resolveFilename = function (r, ...a) {
  return rf.call(this, r.startsWith("@/") ? path.join(ROOT, r.slice(2)) : r, ...a);
};
const L = require(path.join(OUT, "levels.js"));

let ko = 0;
const check = (label, ok, detail) => {
  if (ok) console.log("  ok   " + label);
  else { ko += 1; console.log("  FAIL " + label + (detail !== undefined ? " -> " + detail : "")); }
};

console.log("\nLivelli ed esperienza\n");

check("a zero punti si e' livello 1", L.levelFor(0).level === 1, L.levelFor(0).level);
check("livello 1 e' fascia Recluta", L.levelFor(0).tier.id === "rookie");

// I confini promessi dalle regole.
const confini = [
  [499, 5, "rookie"],
  [500, 6, "trader"],
  [1999, 15, "trader"],
  [2000, 16, "strategist"],
  [5999, 30, "strategist"],
  [6000, 31, "icon"],
  [14999, 50, "icon"],
  [15000, 51, "whale"],
];
for (const [xp, livello, fascia] of confini) {
  const l = L.levelFor(xp);
  check(`${String(xp).padStart(5)} xp -> livello ${livello}, ${fascia}`,
    l.level === livello && l.tier.id === fascia, `livello ${l.level}, ${l.tier.id}`);
}

// La scala non deve mai tornare indietro ne' saltare.
let precedente = 0, monotona = true, salti = 0;
for (let xp = 0; xp <= 40000; xp += 7) {
  const l = L.levelFor(xp).level;
  if (l < precedente) monotona = false;
  if (l > precedente + 1) salti += 1;
  precedente = l;
}
check("il livello non torna mai indietro", monotona);
check("non si salta un livello", salti === 0, salti);

// La barra deve restare dentro i binari.
let barraOk = true;
for (let xp = 0; xp <= 40000; xp += 13) {
  const l = L.levelFor(xp);
  if (l.progress < 0 || l.progress > 1 || l.toNext < 0 || l.xpInto < 0) barraOk = false;
}
check("la barra resta fra 0 e 1", barraOk);

// Il conto di una partita.
const pieno = L.matchXp({ won: true, votes: 7, socialBonus: true });
check("partita vinta con 7 voti e bonus = 50+100+70+100", pieno.total === 320, pieno.total);
const tetto = L.matchXp({ won: false, votes: 50, socialBonus: false });
check("i voti si fermano a 100", tetto.votes === 100 && tetto.total === 150, tetto.total);
const minimo = L.matchXp({ won: false, votes: 0, socialBonus: false });
check("una partita persa vale comunque 50", minimo.total === 50, minimo.total);
check("voti negativi non tolgono punti", L.matchXp({ won: false, votes: -5, socialBonus: false }).votes === 0);

// L'ospite sta fuori dalla scala.
check("l'ospite e' livello 0", L.GUEST_LEVEL.level === 0);
check("l'ospite non ha una fascia della scala", L.GUEST_LEVEL.tier.id === "guest");

// Quanto ci vuole davvero: serve a capire se la scala e' umana.
const perLivello = (n) => L.xpForLevel(n);
console.log("");
console.log("  Partite per arrivarci (50 xp l'una, senza vittorie ne' bonus):");
for (const n of [2, 5, 6, 16, 31, 51]) {
  console.log(`     livello ${String(n).padStart(2)}  ${String(perLivello(n)).padStart(6)} xp  ~${Math.ceil(perLivello(n) / 50)} partite`);
}

console.log("");
console.log(ko === 0 ? "SCALA COERENTE" : `${ko} CONTROLLI FALLITI`);
process.exit(ko === 0 ? 0 : 1);
