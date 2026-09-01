/**
 * I quattro numeri del profilo: giocate, vinte, successo, Pickmates.
 *
 * Sono gia' rimasti a zero una volta, perche' la partita non veniva scritta
 * nello storico: da fuori sembrava rotto il conteggio, mentre a mancare erano
 * le righe. Qui si percorre la catena intera -- partita finita, posizione in
 * classifica, riga salvata, numeri riletti -- con un database finto al posto
 * di quello vero, cosi' il controllo gira senza rete e senza account.
 */
const path = require("path");
const Module = require("module");

const OUT = path.resolve(process.cwd(), process.argv[2] ?? ".tmp-check/lib");
const ROOT = path.resolve(OUT, "..");
const rf = Module._resolveFilename;
Module._resolveFilename = function (r, ...a) {
  return rf.call(this, r.startsWith("@/") ? path.join(ROOT, r.slice(2)) : r, ...a);
};

/* ------------------------------------------------------------------ */
/* Database finto                                                      */
/* ------------------------------------------------------------------ */

/**
 * Imita quel poco di Supabase che il codice usa davvero.
 *
 * Le tabelle sono array in memoria. L'inserimento rispetta il vincolo di
 * unicita' su utente e codice stanza: e' quello che impedisce a chi riapre la
 * schermata finale di gonfiarsi le statistiche, e va imitato o il controllo
 * non direbbe la verita'.
 */
function creaDatabase(tabelle) {
  const dati = {
    match_history: [],
    pickmates: [],
    profiles: [],
    recent_opponents: [],
    ...(tabelle ?? {}),
  };

  const query = (nome) => {
    let righe = dati[nome] ?? [];
    const api = {
      select: () => api,
      order: () => api,
      limit: () => Promise.resolve({ data: righe, error: null }),
      eq: (campo, valore) => {
        righe = righe.filter((r) => r[campo] === valore);
        return api;
      },
      in: (campo, valori) => {
        righe = righe.filter((r) => valori.includes(r[campo]));
        return api;
      },
      or: (espressione) => {
        // Forma usata dal codice: "user_id.eq.X,friend_id.eq.Y"
        const condizioni = espressione.split(",").map((pezzo) => {
          const parti = pezzo.split(".");
          return [parti[0], parti.slice(2).join(".")];
        });
        righe = righe.filter((r) => condizioni.some(([campo, valore]) => r[campo] === valore));
        return api;
      },
      insert: (riga) => {
        const doppione = dati[nome].some(
          (r) => r.user_id === riga.user_id && r.code === riga.code,
        );
        if (doppione) return Promise.resolve({ data: null, error: { code: "23505" } });
        dati[nome].push(riga);
        return Promise.resolve({ data: riga, error: null });
      },
      then: (risolvi) => Promise.resolve({ data: righe, error: null }).then(risolvi),
    };
    return api;
  };

  return { dati, client: { from: (nome) => query(nome) } };
}

let db = creaDatabase();

require.cache[require.resolve(path.join(OUT, "supabase.js"))] = {
  id: "supabase-finto",
  filename: "supabase-finto",
  loaded: true,
  exports: { getSupabase: () => db.client, isSupabaseConfigured: true },
};

const G = require(path.join(OUT, "game.js"));
const C = require(path.join(OUT, "catalog.js"));
const H = require(path.join(OUT, "history.js"));
const P = require(path.join(OUT, "pickmates.js"));
const L = require(path.join(OUT, "levels.js"));

let ko = 0;
const check = (label, ok, detail) => {
  if (ok) {
    console.log("  ok   " + label);
  } else {
    ko += 1;
    console.log("  FAIL " + label + (detail !== undefined ? " -> " + detail : ""));
  }
};

/* ------------------------------------------------------------------ */
/* Una partita finita per davvero                                      */
/* ------------------------------------------------------------------ */

/** Prende la prima lista ufficiale e la rende giocabile. */
function primaLista() {
  const grezza = require(path.resolve(process.cwd(), "data/categories.json"))[0];
  const draft = {};
  for (const t of ["1", "2", "3", "4", "5"]) {
    draft[Number(t)] = (grezza.tiers[t] ?? []).map((riga) => ({
      name: riga[0],
      emoji: riga[1] ?? "",
      image: riga[2] ?? "",
    }));
  }
  return {
    id: grezza.id,
    name: grezza.name,
    emoji: grezza.emoji,
    items: C.buildItems(grezza.id, draft),
    source: "official",
  };
}

/** Tre giocatori con un profilo, rose assegnate, e un vincitore ai voti. */
function partitaConclusa(codice, vincitoreId) {
  let stato = G.createGame({
    code: codice,
    mode: "online",
    hostId: "p1",
    category: primaLista(),
  });
  const gente = [
    ["p1", "Anna"],
    ["p2", "Bruno"],
    ["p3", "Carla"],
  ];
  for (const [id, nome] of gente) {
    stato = G.reducer(stato, {
      type: "add_player",
      player: { id, name: nome, emoji: "flame", accountId: "acc-" + id },
    });
  }
  return {
    ...stato,
    phase: "ended",
    players: stato.players.map((p) => ({
      ...p,
      roster: [
        { itemId: "x-" + p.id, name: "Elemento", price: p.id === vincitoreId ? 7 : 4, tier: 3 },
      ],
    })),
    // Due voti al vincitore, uno a un altro: la classifica parte da qui.
    votes: { v1: vincitoreId, v2: vincitoreId, v3: "p2" },
  };
}

console.log("\nI numeri del profilo\n");

const stato = partitaConclusa("ABCDE", "p3");
const classifica = G.finalStandings(stato);

check(
  "primo in classifica e' chi ha preso piu' voti",
  classifica[0].player.id === "p3",
  classifica.map((e) => e.player.id).join(" > "),
);

(async () => {
  /* ---------------------------------------------------------------- */
  /* Si scrive lo storico come fa la schermata finale                  */
  /* ---------------------------------------------------------------- */

  for (let i = 0; i < classifica.length; i += 1) {
    const giocatore = classifica[i].player;
    await H.recordMatch(giocatore.accountId, {
      code: stato.code,
      category: stato.category.name,
      players: stato.players.length,
      position: i + 1,
      spent: giocatore.roster.reduce((n, r) => n + r.price, 0),
      items: giocatore.roster.length,
      currency: "EUR",
    });
  }

  check(
    "una partita scrive una riga per giocatore",
    db.dati.match_history.length === 3,
    db.dati.match_history.length,
  );
  const rigaVincitore = db.dati.match_history.find((r) => r.user_id === "acc-p3");
  check(
    "la riga porta la posizione giusta",
    Boolean(rigaVincitore) && rigaVincitore.position === 1,
    db.dati.match_history.map((r) => r.user_id + ":" + r.position).join(" ") || "(nessuna riga)",
  );

  // Riaprire la schermata finale non deve regalare partite ne' vittorie.
  await H.recordMatch("acc-p3", {
    code: stato.code,
    category: "x",
    players: 3,
    position: 1,
    spent: 7,
    items: 1,
    currency: "EUR",
  });
  check(
    "riaprire i risultati non aggiunge una partita",
    db.dati.match_history.length === 3,
    db.dati.match_history.length,
  );

  /* ---------------------------------------------------------------- */
  /* I numeri riletti                                                  */
  /* ---------------------------------------------------------------- */

  const vincitore = await H.fetchStats("acc-p3");
  check("il vincitore ha 1 giocata", vincitore.played === 1, vincitore.played);
  check("il vincitore ha 1 vittoria", vincitore.won === 1, vincitore.won);
  check("il vincitore e' al 100%", vincitore.winRate === 100, vincitore.winRate);

  const perdente = await H.fetchStats("acc-p1");
  check("chi perde ha comunque 1 giocata", perdente.played === 1, perdente.played);
  check("chi perde ha 0 vittorie", perdente.won === 0, perdente.won);
  check("chi perde e' allo 0%", perdente.winRate === 0, perdente.winRate);

  const mai = await H.fetchStats("acc-nessuno");
  check(
    "chi non ha mai giocato resta a zero, non NaN",
    mai.played === 0 && mai.won === 0 && mai.winRate === 0,
    JSON.stringify(mai),
  );

  /* ---------------------------------------------------------------- */
  /* La percentuale mostrata nel profilo                               */
  /* ---------------------------------------------------------------- */

  const p = (played, won) => L.winRate({ played, won, mates: 0, xp: 0 });
  check("4 giocate e 2 vinte fanno 50%", p(4, 2) === 50, p(4, 2));
  check("3 giocate e 1 vinta fanno 33%", p(3, 1) === 33, p(3, 1));
  check("2 giocate e 1 vinta fanno 50%", p(2, 1) === 50, p(2, 1));
  check("senza partite la percentuale e' 0, non una divisione per zero", p(0, 0) === 0, p(0, 0));

  /* ---------------------------------------------------------------- */
  /* Pickmates                                                         */
  /* ---------------------------------------------------------------- */

  db = creaDatabase({
    profiles: [
      { id: "acc-a", nickname: "anna", emoji: "flame" },
      { id: "acc-b", nickname: "bruno", emoji: "bolt" },
      { id: "acc-c", nickname: "carla", emoji: "star" },
    ],
    pickmates: [
      // Uno chiesto da me e accettato, uno ricevuto e accettato.
      { user_id: "io", friend_id: "acc-a", status: "accepted" },
      { user_id: "acc-b", friend_id: "io", status: "accepted" },
      // Uno ancora in attesa: non deve contare fra i Pickmates.
      { user_id: "io", friend_id: "acc-c", status: "pending" },
    ],
    recent_opponents: [{ user_id: "io", opponent_id: "acc-a", played_count: 5 }],
  });

  const amici = await P.listPickmates("io");
  check("la rubrica trova tutti i legami", amici.length === 3, amici.length);

  const accettati = amici.filter((m) => m.status === "accepted");
  check("solo gli accettati contano come Pickmates", accettati.length === 2, accettati.length);

  const bruno = amici.find((m) => m.account.nickname === "bruno");
  check("chi ha mandato lui la richiesta e' riconosciuto", bruno && bruno.incoming === true);

  const anna = amici.find((m) => m.account.nickname === "anna");
  check("le partite giocate insieme arrivano al posto giusto", anna && anna.played === 5,
    anna && anna.played);

  console.log("");
  console.log(ko === 0 ? "I NUMERI DEL PROFILO TORNANO" : ko + " CONTROLLI FALLITI");
  process.exit(ko === 0 ? 0 : 1);
})();
