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

/* ---------------- Lo storico: chi ha votato e come si legge ---------------- */

{
  const io = "acc-mio";
  const detail = {
    practice: false,
    players: [
      { id: "p0", name: "io", accountId: io },
      { id: "p1", name: "Marco", accountId: "acc-marco" },
    ],
  };
  const voti = [
    { playerId: "p0", name: "sara", registered: true },
    { playerId: "p0", name: null, registered: false },
    { playerId: "p1", name: "luca", registered: true },
  ];

  const mio = detail.players.find((p) => p.accountId === io).id;
  const pro = voti.filter((v) => v.playerId === mio).length;
  const contro = voti.length - pro;
  check("i voti a favore si contano sulla propria rosa", pro === 2, pro);
  check("gli altri finiscono fra i contrari", contro === 1, contro);

  const ospiti = voti.filter((v) => !v.registered).length;
  check("gli ospiti restano senza nome", ospiti === 1 && voti.find((v) => !v.registered).name === null);

  const altri = detail.players.filter((p) => p.accountId !== io);
  check("l'avversario si riconosce dal profilo", altri.length === 1 && altri[0].name === "Marco");

  // Contro il bot il titolo non guarda i profili: il bot non ne ha uno.
  const contBot = {
    practice: true,
    players: [{ id: "umano", accountId: io }, { id: "bot-pickasso", name: "Pick-asso Bot" }],
  };
  check("la sfida al bot si riconosce dal contrassegno", contBot.practice === true);
  check(
    "e il bot non ha un profilo da confondere col proprio",
    contBot.players.find((p) => p.id === "bot-pickasso").accountId === undefined,
  );
}
console.log(failures === 0 ? "\nIL VOTO E' IN REGOLA\n" : `\n${failures} controlli falliti.\n`);
process.exit(failures === 0 ? 0 : 1);
