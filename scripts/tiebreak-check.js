/** Il sorteggio dell'ultimo spareggio: neutrale, ma uguale ovunque. */
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
const check = (l, ok, d) => { if (ok) console.log("  ok   " + l); else { ko++; console.log("  FAIL " + l + (d !== undefined ? " -> " + d : "")); } };

const pari = (code, ids) => {
  let s = game.createGame({ code, mode: "online", hostId: ids[0], category: catalog.OFFICIAL_CATEGORIES[0], config: { budget: 20, slots: 3, maxPlayers: 8 } });
  for (const id of ids) s = game.reducer(s, { type: "add_player", player: { id, name: id } });
  s.phase = "voting";
  return s; // tutti pari: stessi crediti, nessun acquisto, nessun voto
};

console.log("\nSorteggio dell'ultimo spareggio\n");

// Stessa stanza, stessi giocatori: lo stesso vincitore, sempre.
const a = game.finalStandings(pari("ABCDE", ["p1", "p2", "p3"]));
const b = game.finalStandings(pari("ABCDE", ["p1", "p2", "p3"]));
check("due dispositivi, stessa classifica",
  a.map((r) => r.player.id).join() === b.map((r) => r.player.id).join(),
  a.map((r) => r.player.id).join() + " vs " + b.map((r) => r.player.id).join());

check("il motivo dichiarato e' il sorteggio", a[0].reason === "coin", a[0].reason);

// L'ordine con cui entrano non deve contare.
const dritto = game.finalStandings(pari("WXYZ2", ["p1", "p2"])).map((r) => r.player.id).join();
const rovescio = game.finalStandings(pari("WXYZ2", ["p2", "p1"])).map((r) => r.player.id).join();
check("entrare prima o dopo non cambia nulla", dritto === rovescio, dritto + " vs " + rovescio);

// Su tante stanze diverse, chi ospita non deve vincere piu' spesso.
let vinceHost = 0;
const GIRI = 2000;
const alfabeto = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
for (let i = 0; i < GIRI; i += 1) {
  let code = "";
  for (let k = 0; k < 5; k += 1) code += alfabeto[Math.floor(Math.random() * alfabeto.length)];
  const cl = game.finalStandings(pari(code, ["host", "ospite"]));
  if (cl[0].player.id === "host") vinceHost += 1;
}
const quota = (vinceHost / GIRI) * 100;
check(`chi ospita vince circa met\u00e0 delle volte (${quota.toFixed(1)}%)`,
  quota > 43 && quota < 57, quota.toFixed(1) + "%");

// Otto giocatori tutti pari: la catena deve separarli tutti, senza ex aequo.
const otto = pari("8PLAY", ["a", "b", "c", "d", "e", "f", "g", "h"]);
const cl8 = game.finalStandings(otto);
check("otto giocatori: la classifica li ordina tutti", cl8.length === 8, cl8.length);
check("otto giocatori: nessuna posizione doppia",
  new Set(cl8.map((r) => r.player.id)).size === 8);
check("otto giocatori: il vincitore e' uno solo",
  cl8.filter((r) => r.player.id === cl8[0].player.id).length === 1);
const stessa = game.finalStandings(pari("8PLAY", ["a", "b", "c", "d", "e", "f", "g", "h"]));
check("otto giocatori: stesso ordine su un altro dispositivo",
  cl8.map((r) => r.player.id).join() === stessa.map((r) => r.player.id).join());

// Pareggio a tre su otto, con gli altri cinque staccati dai voti.
let tre = pari("TRE12", ["a", "b", "c", "d", "e", "f", "g", "h"]);
for (const chi of ["d", "e", "f", "g", "h"]) tre.players.find((p) => p.id === chi).budget = 1;
const cl3 = game.finalStandings(tre);
const primi = cl3.slice(0, 3).map((r) => r.player.id);
check("pareggio a tre: i tre pari stanno davanti",
  primi.every((id) => ["a", "b", "c"].includes(id)), primi.join());
check("pareggio a tre: separati dal sorteggio", cl3[0].reason === "coin", cl3[0].reason);

console.log("");
console.log(ko === 0 ? "SORTEGGIO NEUTRALE E RIPETIBILE" : `${ko} CONTROLLI FALLITI`);
process.exit(ko === 0 ? 0 : 1);
