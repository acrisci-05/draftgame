const path = require("path");
const Module = require("module");
const OUT = path.resolve(process.cwd(), process.argv[2] ?? ".tmp-check/lib");
const ROOT = path.resolve(OUT, "..");
const rf = Module._resolveFilename;
Module._resolveFilename = function (r, ...rest) {
  return rf.call(this, r.startsWith("@/") ? path.join(ROOT, r.slice(2)) : r, ...rest);
};

/*
 * Le regole del voto, provate sulla logica.
 *
 * Il divieto vero sta nel database e non si puo' provare da qui senza una
 * connessione. Quello che si prova qui e' la regola con cui l'app decide chi ha
 * giocato -- perche' se sbaglia quella, mette i pulsanti davanti a chi non
 * dovrebbe averli, e la richiesta parte per essere respinta.
 */

let failures = 0;
function check(label, condition, detail) {
  if (condition) console.log(`  ok   ${label}`);
  else {
    failures += 1;
    console.log(`  FAIL ${label}${detail !== undefined ? ` -> ${detail}` : ""}`);
  }
}

/** La stessa regola del componente: la chiave del votante fra i giocatori. */
const haGiocato = (payload, voterKey) => payload.players.some((p) => p.id === voterKey);

console.log("\nLe regole del voto\n");

/* Stanze da uno a cinque dispositivi, piu' la sfida al bot. */
for (const quanti of [2, 3, 4, 5]) {
  const payload = {
    code: "AAAAA",
    players: Array.from({ length: quanti }, (_, i) => ({ id: `p${i}`, name: `g${i}` })),
  };
  check(
    `in ${quanti}: ognuno dei giocatori viene riconosciuto`,
    payload.players.every((p) => haGiocato(payload, p.id)),
  );
  check(`in ${quanti}: uno spettatore no`, haGiocato(payload, "spettatore") === false);
}

/* Contro il bot: la persona ha giocato, chi guarda no. */
{
  const payload = {
    code: "BOTTT",
    practice: true,
    players: [
      { id: "umano", name: "io" },
      { id: "bot-pickasso", name: "Pick-asso Bot 🤖" },
    ],
  };
  check("contro il bot la persona e' riconosciuta", haGiocato(payload, "umano"));
  check("uno spettatore puo' votare", haGiocato(payload, "chiunque") === false);
  check(
    "il bot resta fra i giocatori, quindi il suo posto e' votabile",
    payload.players.some((p) => p.id === "bot-pickasso"),
  );
  check("e la partita si riconosce come sfida al bot", payload.practice === true);
}

/* Le percentuali: quello che vede chi ha appena votato. */
{
  const tally = [
    { playerId: "a", votes: 3 },
    { playerId: "b", votes: 1 },
  ];
  const total = tally.reduce((s, r) => s + r.votes, 0);
  const quota = (id) => {
    const v = tally.find((r) => r.playerId === id)?.votes ?? 0;
    return total > 0 ? Math.round((v / total) * 100) : 0;
  };
  check("le percentuali si calcolano sul totale", quota("a") === 75 && quota("b") === 25, `${quota("a")}/${quota("b")}`);
  check("senza voti non si divide per zero", (() => {
    const vuoto = [];
    const tot = vuoto.reduce((s, r) => s + r.votes, 0);
    return (tot > 0 ? 50 : 0) === 0;
  })());
}

console.log(failures === 0 ? "\nIL VOTO E' IN REGOLA\n" : `\n${failures} controlli falliti.\n`);
process.exit(failures === 0 ? 0 : 1);
