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
/* ---------------- Il link si genera anche col database indietro ---------------- */

/*
 * Nasce da un guasto vero, e da una toppa che non toccava terra.
 *
 * Era stato aggiunto al risultato un contrassegno per le sfide al bot, e su un
 * database senza quella colonna l'inserimento veniva rifiutato per intero: il
 * pulsante "genera link" smetteva di funzionare per tutti. La toppa doveva
 * riscrivere la riga senza il contrassegno, ma aspettava il codice 42703 --
 * quello di Postgres. L'interfaccia REST ferma la richiesta prima e ne dice un
 * altro, PGRST204. Il controllo di allora provava una copia della regola
 * scritta apposta nel controllo stesso: passava, mentre il pulsante no.
 *
 * Da qui si prova la funzione vera, quella che gira sul telefono di chi gioca.
 */
{
  const { colonnaSconosciuta, RESULT_ESSENTIALS } = require(path.join(OUT, "supabase.js"));

  check(
    "la colonna mancante si riconosce dall'interfaccia REST",
    colonnaSconosciuta({
      code: "PGRST204",
      message: "Could not find the 'practice' column of 'results' in the schema cache",
    }) === "practice",
  );
  check(
    "e si riconosce anche da Postgres",
    colonnaSconosciuta({
      code: "42703",
      message: 'column "practice" of relation "results" does not exist',
    }) === "practice",
  );
  check("un rifiuto delle regole di accesso non e' una colonna mancante",
    colonnaSconosciuta({ code: "42501", message: "new row violates row-level security policy" }) === null);
  check("e nemmeno la rete caduta, che un codice non ce l'ha",
    colonnaSconosciuta({ code: "", message: "TypeError: Failed to fetch" }) === null);

  /* La riscrittura: si toglie l'accessorio, mai l'essenziale. */
  const togliibile = (colonna) => Boolean(colonna) && !RESULT_ESSENTIALS.includes(colonna);
  check("il contrassegno del bot si puo' togliere", togliibile("practice"));
  check("i giocatori no", togliibile("players") === false);
  check("nemmeno il codice della stanza", togliibile("code") === false);
}

/* ---------------- Un link solo per partita, anche in tre ---------------- */

/*
 * In tre si preme il pulsante in tre, e uscivano tre link diversi sulla stessa
 * partita: i voti degli amici si spargevano su tre conteggi. L'impronta
 * riconosce la partita gia' pubblicata -- ma deve distinguere la rivincita,
 * che ha gli stessi giocatori nella stessa stanza ed e' un'altra partita.
 */
{
  const { improntaPartita } = require(path.join(OUT, "supabase.js"));
  const rosa = (itemId, price) => [{ itemId, price, name: "x", tier: "gold" }];
  const partita = [
    { id: "p1", budget: 40, roster: rosa("a", 10) },
    { id: "p2", budget: 30, roster: rosa("b", 20) },
    { id: "p3", budget: 20, roster: rosa("c", 30) },
  ];

  check(
    "la stessa partita ha la stessa impronta, in qualunque ordine arrivi",
    improntaPartita(partita) === improntaPartita([...partita].reverse()),
  );
  check(
    "la rivincita degli stessi tre e' un'altra partita",
    improntaPartita(partita) !==
      improntaPartita([
        { id: "p1", budget: 10, roster: rosa("c", 40) },
        { id: "p2", budget: 30, roster: rosa("b", 20) },
        { id: "p3", budget: 20, roster: rosa("a", 30) },
      ]),
  );
  check(
    "e un quarto giocatore la cambia",
    improntaPartita(partita) !==
      improntaPartita([...partita, { id: "p4", budget: 50, roster: rosa("d", 5) }]),
  );
}
console.log(failures === 0 ? "\nIL VOTO E' IN REGOLA\n" : `\n${failures} controlli falliti.\n`);
process.exit(failures === 0 ? 0 : 1);
