const path = require("path");
const Module = require("module");
const OUT = path.resolve(process.cwd(), process.argv[2] ?? ".tmp-check/lib");
const ROOT = path.resolve(OUT, "..");
const rf = Module._resolveFilename;
Module._resolveFilename = function (r, ...rest) {
  return rf.call(this, r.startsWith("@/") ? path.join(ROOT, r.slice(2)) : r, ...rest);
};
const game = require(path.join(OUT, "game.js"));
const catalog = require(path.join(OUT, "catalog.js"));

/*
 * L'asta a turni, da due a cinque dispositivi.
 *
 * La domanda a cui questo file risponde e' una sola: con la mano che gira, una
 * partita finisce ancora? Un turno che non passa a nessuno e' uno stallo, e uno
 * stallo in una stanza con cinque telefoni non lo scopre nessuno finche' non
 * succede a una serata vera.
 */

let failures = 0;
function check(label, condition, detail) {
  if (condition) console.log(`  ok   ${label}`);
  else {
    failures += 1;
    console.log(`  FAIL ${label}${detail !== undefined ? ` -> ${detail}` : ""}`);
  }
}

function stanza(quanti, config) {
  let s = game.createGame({
    code: "TURNI",
    mode: "online",
    hostId: "p0",
    category: catalog.OFFICIAL_CATEGORIES[0],
    config: { budget: 20, slots: 4, maxPlayers: 5, ...config },
  });
  for (let i = 0; i < quanti; i += 1) {
    s = game.reducer(s, { type: "add_player", player: { id: `p${i}`, name: `g${i}` } });
  }
  return game.reducer(s, { type: "start", now: 1_000_000 });
}

console.log("\nAsta a turni\n");

/* ---------------- Chi apre, e come ruota ---------------- */

for (const quanti of [2, 3, 4, 5]) {
  let s = stanza(quanti);
  check(`in ${quanti} il primo lotto lo apre chi ospita`, s.turnId === "p0", s.turnId);

  // Si guardano i primi tre lotti: l'apertura deve scorrere di uno per volta.
  const aperture = [s.turnId];
  let clock = 1_000_000;
  for (let lotto = 1; lotto < Math.min(3, quanti); lotto += 1) {
    let mosse = 0;
    while (s.phase === "auction" && mosse < 20) {
      clock += 100;
      s = game.reducer(s, { type: "pass", playerId: s.turnId, now: clock });
      mosse += 1;
    }
    clock += 6000;
    s = game.reducer(s, { type: "tick", now: clock });
    if (s.phase === "auction") aperture.push(s.turnId);
  }
  const attese = aperture.map((_, i) => `p${i % quanti}`).slice(0, aperture.length);
  check(
    `in ${quanti} l'apertura scorre di giocatore in giocatore`,
    aperture.join(",") === attese.join(","),
    aperture.join(",") + " invece di " + attese.join(","),
  );
}

/* ---------------- Fuori turno non si tocca niente ---------------- */

{
  const s = stanza(3);
  const fuori = s.players.find((p) => p.id !== s.turnId).id;
  check("fuori turno non si rilancia", game.canBid(s, fuori, 1) === false);
  check("fuori turno non si passa", game.canPass(s, fuori) === false);
  check("nel proprio turno si rilancia", game.canBid(s, s.turnId, 1) === true);
  check("nel proprio turno si passa", game.canPass(s, s.turnId) === true);
  const dopo = game.reducer(s, { type: "bid", playerId: fuori, amount: 1, now: 1_000_100 });
  check("un rilancio fuori turno non cambia niente", dopo === s);
}

/* ---------------- Contro il bot apre sempre la persona ---------------- */

{
  let s = game.createGame({
    code: "BOTT", mode: "local", hostId: "umano",
    category: catalog.OFFICIAL_CATEGORIES[0],
    config: { maxPlayers: 2, slots: 4 }, practice: true,
  });
  s = game.reducer(s, { type: "add_player", player: { id: "umano", name: "io" } });
  s = game.reducer(s, { type: "add_player", player: { id: "bot-pickasso", name: "bot" } });
  s = game.reducer(s, { type: "start", now: 1_000_000 });

  const aperture = [];
  let clock = 1_000_000;
  for (let lotto = 0; lotto < 4 && s.phase !== "ended" && s.phase !== "voting"; lotto += 1) {
    aperture.push(s.turnId);
    let mosse = 0;
    while (s.phase === "auction" && mosse < 10) {
      clock += 100;
      s = game.reducer(s, { type: "pass", playerId: s.turnId, now: clock });
      mosse += 1;
    }
    clock += 6000;
    s = game.reducer(s, { type: "tick", now: clock });
  }
  check(
    "contro il bot apre sempre la persona, a ogni lotto",
    aperture.every((chi) => chi === "umano"),
    aperture.join(","),
  );
}

/* ---------------- Cento partite intere, da due a cinque ---------------- */

function partita(quanti) {
  let s = stanza(quanti, { slots: 4, allowDiscards: true });
  let clock = 1_000_000;
  let giri = 0;
  const fuoriTurno = [];

  while (s.phase !== "ended" && s.phase !== "voting" && giri < 4000) {
    giri += 1;
    clock += 250;

    if (s.phase === "result") {
      s = game.reducer(s, { type: "tick", now: s.deadline + 1 });
      continue;
    }
    if (s.phase !== "auction") {
      s = game.reducer(s, { type: "tick", now: clock });
      continue;
    }

    const chi = s.turnId;
    if (!chi) {
      fuoriTurno.push("turno vuoto in asta");
      s = game.reducer(s, { type: "tick", now: s.deadline + 1 });
      continue;
    }

    // Solo chi ha la mano puo' agire: se qualcun altro ci provasse, niente.
    const altro = s.players.find((p) => p.id !== chi);
    if (altro && game.reducer(s, { type: "pass", playerId: altro.id, now: clock }) !== s) {
      fuoriTurno.push(`${altro.id} ha agito nel turno di ${chi}`);
    }

    const minimo = game.minimumBid(s);
    const me = game.playerById(s, chi);
    if (s.lotKind === "mystery") {
      if (game.canClaim(s, chi) && Math.random() < 0.4) {
        s = game.reducer(s, { type: "claim", playerId: chi, now: clock });
      } else {
        s = game.reducer(s, { type: "pass", playerId: chi, now: clock });
      }
      continue;
    }
    if (game.canBid(s, chi, minimo) && Math.random() < 0.5 && minimo <= game.maxBid(s, me)) {
      s = game.reducer(s, { type: "bid", playerId: chi, amount: minimo, now: clock });
    } else {
      s = game.reducer(s, { type: "pass", playerId: chi, now: clock });
    }
  }

  return { s, giri, fuoriTurno };
}

for (const quanti of [2, 3, 4, 5]) {
  let finite = 0;
  let listePiene = 0;
  let problemi = [];
  let giriMax = 0;
  const PARTITE = 25;

  for (let i = 0; i < PARTITE; i += 1) {
    const { s, giri, fuoriTurno } = partita(quanti);
    if (s.phase === "voting" || s.phase === "ended") finite += 1;
    if (s.players.every((p) => p.roster.length === s.config.slots)) listePiene += 1;
    giriMax = Math.max(giriMax, giri);
    problemi = problemi.concat(fuoriTurno);
  }

  check(`in ${quanti}: ${PARTITE} partite arrivano in fondo`, finite === PARTITE, `${finite}/${PARTITE}`);
  check(`in ${quanti}: tutte le liste si riempiono`, listePiene === PARTITE, `${listePiene}/${PARTITE}`);
  check(`in ${quanti}: nessuno agisce fuori dal proprio turno`, problemi.length === 0, problemi[0]);
  check(`in ${quanti}: nessuno stallo`, giriMax < 4000, giriMax);
}

console.log(failures === 0 ? "\nI TURNI GIRANO\n" : `\n${failures} controlli falliti.\n`);
process.exit(failures === 0 ? 0 : 1);
