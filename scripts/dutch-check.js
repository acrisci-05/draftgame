/**
 * Verifiche dell'asta al ribasso (Dutch Draft).
 *
 * Prova la modalita' da sola e insieme alle altre tre, perche' e' proprio nelle
 * combinazioni che stanno i guasti: col Blind il lotto e' coperto ma il prezzo
 * deve scendere lo stesso, con la Mystery Box scende anche il prezzo della box,
 * e col Flop Draft un lotto che non prende nessuno deve finire negli scarti
 * senza inceppare la partita.
 *
 * Uso:  node scripts/dutch-check.js [cartella-compilata]
 */
const path = require("path");
const Module = require("module");
const OUT = path.resolve(process.cwd(), process.argv[2] ?? ".tmp-check/lib");

const ROOT = path.resolve(OUT, "..");
const resolveFilename = Module._resolveFilename;
Module._resolveFilename = function (request, ...rest) {
  const target = request.startsWith("@/") ? path.join(ROOT, request.slice(2)) : request;
  return resolveFilename.call(this, target, ...rest);
};

const game = require(path.join(OUT, "game.js"));
const bot = require(path.join(OUT, "botEngine.js"));
const catalog = require(path.join(OUT, "catalog.js"));

let failures = 0;
function check(label, condition, detail) {
  if (condition) {
    console.log(`  ok   ${label}`);
  } else {
    failures += 1;
    console.log(`  FAIL ${label}${detail !== undefined ? ` -> ${detail}` : ""}`);
  }
}

const category = catalog.OFFICIAL_CATEGORIES[0];
const T0 = 1_000_000;

/** Una stanza pronta all'asta, con gli interruttori richiesti. */
function apri(config, giocatori = ["a", "b"], now = T0) {
  let state = game.createGame({
    code: "DUTCH",
    mode: "local",
    hostId: giocatori[0],
    category,
    config: { budget: 20, slots: 3, maxPlayers: 5, lotSeconds: 10, ...config },
  });
  giocatori.forEach((id, i) => {
    state = game.reducer(state, {
      type: "add_player",
      player: { id, name: `P${i + 1}` },
    });
  });
  return game.reducer(state, { type: "start", now });
}

/* ---------------- 1. Il prezzo ---------------- */
console.log("\n1. Discesa del prezzo");

let s = apri({ dutchDraft: true });
const apertura = game.dutchOpening(20);
const durata = game.lotSeconds(s) * 1000;

check("lotto al ribasso riconosciuto", game.isDutchLot(s));
check("prezzo di apertura proporzionato al budget", apertura === 12, apertura);
check("all'apertura si paga il massimo", game.dutchPriceAt(s, T0) === apertura);
check(
  "a meta' tempo si paga circa meta' della corsa",
  game.dutchPriceAt(s, T0 + durata / 2) === Math.round((apertura + game.DUTCH_FLOOR) / 2),
  game.dutchPriceAt(s, T0 + durata / 2),
);
check("a fine tempo si paga il pavimento", game.dutchPriceAt(s, T0 + durata) === game.DUTCH_FLOOR);
check("il pavimento e' un credito, non zero", game.DUTCH_FLOOR === 1);
check(
  "oltre la scadenza non si scende sotto il pavimento",
  game.dutchPriceAt(s, T0 + durata * 5) === game.DUTCH_FLOOR,
);
check(
  "un istante precedente all'apertura non paga meno del massimo",
  game.dutchPriceAt(s, T0 - 60_000) === apertura,
);
check(
  "la discesa non torna mai indietro",
  (() => {
    let precedente = Infinity;
    for (let ms = 0; ms <= durata; ms += 100) {
      const p = game.dutchPriceAt(s, T0 + ms);
      if (p > precedente) return false;
      precedente = p;
    }
    return true;
  })(),
);
check(
  "il prezzo dipende dalla durata scelta dall'host",
  (() => {
    const lento = apri({ dutchDraft: true, lotSeconds: 20 });
    const veloce = apri({ dutchDraft: true, lotSeconds: 10 });
    // Dopo cinque secondi il lotto veloce e' sceso di piu' di quello lento.
    return game.dutchPriceAt(veloce, T0 + 5000) < game.dutchPriceAt(lento, T0 + 5000);
  })(),
);

/* ---------------- 2. Da sola ---------------- */
console.log("\n2. Modalita' da sola");

s = apri({ dutchDraft: true });
check("nessun turno: il lotto e' aperto a tutti", s.turnId === null);
check("puo' prendere chiunque, non solo chi ha la mano", game.canTakeDutch(s, "b", T0));
check("i rilanci sono spenti", !game.canBid(s, "a", 5));
check("non si passa: si lascia scorrere", !game.canPass(s, "a"));
check("il cronometro copre tutto il lotto", s.deadline === T0 + durata);

const meta = T0 + durata / 2;
const prezzoMeta = game.dutchPriceAt(s, meta);
let preso = game.reducer(s, { type: "take_dutch", playerId: "b", now: meta });
check("chi prende si aggiudica il lotto", preso.lastResult?.winnerId === "b");
check(
  "paga il prezzo dell'istante in cui ha premuto",
  preso.lastResult?.price === prezzoMeta,
  `${preso.lastResult?.price} invece di ${prezzoMeta}`,
);
check(
  "il costo viene scalato dal budget",
  preso.players.find((p) => p.id === "b").budget === 20 - prezzoMeta,
);
check("il lotto entra nella rosa", preso.players.find((p) => p.id === "b").roster.length === 1);
check("si passa alla schermata di aggiudicazione", preso.phase === "result");

check(
  "chi ha gia' preso non prende due volte lo stesso lotto",
  (() => {
    const doppio = game.reducer(preso, { type: "take_dutch", playerId: "a", now: meta + 10 });
    return doppio.lastResult?.winnerId === "b" && doppio.history.length === preso.history.length;
  })(),
);

check(
  "chi arriva un istante dopo non porta via il lotto",
  (() => {
    const primo = game.reducer(s, { type: "take_dutch", playerId: "a", now: meta });
    const secondo = game.reducer(primo, { type: "take_dutch", playerId: "b", now: meta + 1 });
    return secondo.lastResult?.winnerId === "a";
  })(),
);

check(
  "un istante inventato nel futuro non compra sotto il pavimento",
  (() => {
    const furbo = game.reducer(s, {
      type: "take_dutch",
      playerId: "a",
      now: T0 + durata * 100,
    });
    return furbo.lastResult?.price === game.DUTCH_FLOOR;
  })(),
);

check(
  "chi non arriva al prezzo di adesso non puo' prendere",
  (() => {
    const povero = apri({ dutchDraft: true, budget: 20 });
    /*
     * Cinque crediti con tre posti vuoti: due restano di riserva, quindi ne
     * puo' spendere tre. L'apertura da dodici e' fuori portata, il pavimento
     * no -- ed e' il punto: il pulsante si accende da solo quando il prezzo
     * scende dentro il suo budget.
     */
    const magro = {
      ...povero,
      players: povero.players.map((p) => (p.id === "a" ? { ...p, budget: 5 } : p)),
    };
    return !game.canTakeDutch(magro, "a", T0) && game.canTakeDutch(magro, "a", T0 + durata);
  })(),
);

check(
  "la riserva resta intatta: non si arriva a zero con la rosa incompleta",
  (() => {
    const stretto = apri({ dutchDraft: true, budget: 20, slots: 3 });
    const p = stretto.players.find((x) => x.id === "a");
    // Con tre slot vuoti si tengono due crediti da parte.
    return game.maxBid(stretto, p) === 18;
  })(),
);

/* ---------------- 3. Nessuno prende: il flop ---------------- */
console.log("\n3. Nessuno prende");

s = apri({ dutchDraft: true, allowDiscards: true });
let scaduto = game.reducer(s, { type: "tick", now: T0 + durata + 1 });
check("a tempo scaduto il lotto si chiude", scaduto.phase === "result");
check("senza acquirenti e' un flop", scaduto.lastResult?.winnerId === null);
check("il flop finisce negli scarti", scaduto.discards.length === 1);

s = apri({ dutchDraft: true, allowDiscards: false });
scaduto = game.reducer(s, { type: "tick", now: T0 + durata + 1 });
check(
  "senza flop il lotto viene assegnato d'ufficio",
  scaduto.lastResult?.winnerId !== null,
  scaduto.lastResult?.winnerId,
);
check("l'assegnazione d'ufficio costa il minimo", scaduto.lastResult?.price === game.OPENING_BID);

/* ---------------- 4. Con gli altri interruttori ---------------- */
console.log("\n4. Tutti e quattro insieme");

const tutti = {
  dutchDraft: true,
  blindDraft: true,
  mysteryBox: true,
  allowDiscards: true,
};

s = apri(tutti, ["a", "b", "c"]);
check("con quattro interruttori la partita parte", s.phase === "auction");
check("il prezzo scende lo stesso col lotto coperto", game.isDutchLot(s));
check("nessun turno anche a tre giocatori", s.turnId === null);
check(
  "tutti e tre possono prendere",
  ["a", "b", "c"].every((id) => game.canTakeDutch(s, id, T0)),
);

preso = game.reducer(s, { type: "take_dutch", playerId: "c", now: T0 + 2000 });
check("col Blind acceso si vince comunque un elemento vero", Boolean(preso.lastResult?.itemName));
check(
  "il prezzo pagato e' quello della discesa",
  preso.lastResult?.price === game.dutchPriceAt(s, T0 + 2000),
);

/* La Mystery Box compare al quinto lotto: si arriva fin li' e si guarda. */
check(
  "la Mystery Box al ribasso parte dal prezzo di apertura, non da quello fisso",
  (() => {
    let corsa = apri(tutti, ["a", "b", "c"]);
    let t = T0;
    for (let giro = 0; giro < 30 && corsa.phase === "auction"; giro += 1) {
      if (corsa.lotKind === "mystery") {
        return (
          corsa.lotPrice === game.dutchOpening(corsa.config.budget) &&
          corsa.lotPrice !== game.mysteryPrice(corsa.config.budget)
        );
      }
      t = corsa.deadline + 1;
      corsa = game.reducer(corsa, { type: "tick", now: t });
      if (corsa.phase === "result") {
        t += 1;
        corsa = game.reducer(corsa, { type: "next", now: t });
      }
    }
    return false;
  })(),
);

check(
  "la Mystery Box al ribasso si prende col prezzo dell'istante",
  (() => {
    let corsa = apri(tutti, ["a", "b", "c"]);
    let t = T0;
    for (let giro = 0; giro < 30 && corsa.phase === "auction"; giro += 1) {
      if (corsa.lotKind === "mystery") {
        const atteso = game.dutchPriceAt(corsa, t + 1500);
        const dopo = game.reducer(corsa, { type: "take_dutch", playerId: "a", now: t + 1500 });
        return (
          dopo.lastResult?.winnerId === "a" &&
          dopo.lastResult?.price === atteso &&
          dopo.lastResult?.mystery === true
        );
      }
      t = corsa.deadline + 1;
      corsa = game.reducer(corsa, { type: "tick", now: t });
      if (corsa.phase === "result") {
        t += 1;
        corsa = game.reducer(corsa, { type: "next", now: t });
      }
    }
    return false;
  })(),
);

check("col ribasso acceso il claim della box e' spento", (() => {
  let corsa = apri(tutti, ["a", "b", "c"]);
  let t = T0;
  for (let giro = 0; giro < 30 && corsa.phase === "auction"; giro += 1) {
    if (corsa.lotKind === "mystery") return !game.canClaim(corsa, "a");
    t = corsa.deadline + 1;
    corsa = game.reducer(corsa, { type: "tick", now: t });
    if (corsa.phase === "result") {
      t += 1;
      corsa = game.reducer(corsa, { type: "next", now: t });
    }
  }
  return false;
})());

/* ---------------- 5. Partite intere ---------------- */
console.log("\n5. Partite portate a termine");

/** Gioca una partita fino in fondo: ognuno prende quando il prezzo gli sta bene. */
function partita(config, giocatori, soglia) {
  let state = apri(config, giocatori);
  let t = T0;
  for (let giro = 0; giro < 400; giro += 1) {
    if (state.phase === "voting" || state.phase === "ended") break;

    if (state.phase === "result") {
      t = state.deadline + 1;
      state = game.reducer(state, { type: "tick", now: t });
      continue;
    }

    if (state.phase === "auction") {
      // Ognuno ha la sua soglia: chi prende presto paga di piu'.
      const istante = t + Math.round(game.lotSeconds(state) * 1000 * soglia);
      const compratore = state.players.find((p) => game.canTakeDutch(state, p.id, istante));
      if (compratore) {
        t = istante;
        state = game.reducer(state, { type: "take_dutch", playerId: compratore.id, now: t });
      } else {
        t = state.deadline + 1;
        state = game.reducer(state, { type: "tick", now: t });
      }
      continue;
    }
    break;
  }
  return state;
}

for (const n of [2, 3, 5]) {
  const ids = ["a", "b", "c", "d", "e"].slice(0, n);
  const finita = partita({ dutchDraft: true }, ids, 0.5);
  check(
    `${n} giocatori al ribasso: la partita arriva in fondo`,
    finita.phase === "voting" || finita.phase === "ended",
    finita.phase,
  );
  check(
    `${n} giocatori al ribasso: nessuno sfora il budget`,
    finita.players.every((p) => p.budget >= 0),
  );
  check(
    `${n} giocatori al ribasso: ogni acquisto e' costato almeno un credito`,
    finita.players.every((p) => p.roster.every((r) => r.price >= game.DUTCH_FLOOR)),
  );
}

const quattro = partita(tutti, ["a", "b", "c"], 0.4);
check(
  "quattro interruttori: la partita arriva in fondo",
  quattro.phase === "voting" || quattro.phase === "ended",
  quattro.phase,
);
check("quattro interruttori: nessun budget negativo", quattro.players.every((p) => p.budget >= 0));
check(
  "quattro interruttori: le rose si riempiono",
  quattro.players.some((p) => p.roster.length > 0),
);

/* ---------------- 6. Le altre modalita' restano intatte ---------------- */
console.log("\n6. Nessun danno alle altre modalita'");

s = apri({ dutchDraft: false });
check("senza ribasso i turni tornano", typeof s.turnId === "string");
check("senza ribasso si rilancia", game.canBid(s, s.turnId, 1));
check("senza ribasso si passa", game.canPass(s, s.turnId));
check("senza ribasso non si puo' prendere al ribasso", !game.canTakeDutch(s, s.turnId, T0));
check(
  "senza ribasso l'azione al ribasso non fa niente",
  (() => {
    const dopo = game.reducer(s, { type: "take_dutch", playerId: s.turnId, now: T0 });
    return dopo === s;
  })(),
);
check(
  "una stanza vecchia senza il campo si comporta come prima",
  (() => {
    const vecchia = apri({});
    delete vecchia.config.dutchDraft;
    return !game.isDutchLot(vecchia) && typeof vecchia.turnId === "string";
  })(),
);
check(
  "senza ribasso la Mystery Box resta a prezzo fisso",
  (() => {
    let corsa = apri({ mysteryBox: true }, ["a", "b"]);
    let t = T0;
    for (let giro = 0; giro < 30 && corsa.phase === "auction"; giro += 1) {
      if (corsa.lotKind === "mystery") {
        return corsa.lotPrice === game.mysteryPrice(corsa.config.budget);
      }
      t = corsa.deadline + 1;
      corsa = game.reducer(corsa, { type: "tick", now: t });
      if (corsa.phase === "result") {
        t += 1;
        corsa = game.reducer(corsa, { type: "next", now: t });
      }
    }
    return false;
  })(),
);

/* ---------------- 7. Il bot ---------------- */
console.log("\n7. Il Pick-asso Bot al ribasso");

function stanzaBot(config) {
  let state = game.createGame({
    code: "DUTCH",
    mode: "local",
    hostId: "umano",
    category,
    config: { budget: 20, slots: 3, maxPlayers: 2, lotSeconds: 10, ...config },
    practice: true,
  });
  state = game.reducer(state, { type: "add_player", player: { id: "umano", name: "Tu" } });
  state = game.reducer(state, {
    type: "add_player",
    player: { id: bot.BOT_PLAYER_ID, name: "Pick-asso" },
  });
  return game.reducer(state, { type: "start", now: T0 });
}

s = stanzaBot({ dutchDraft: true });
const mossa = bot.decideBotMove(s, bot.BOT_PLAYER_ID, { now: T0 });
check("il bot sa cosa fare al ribasso", mossa !== null && mossa.kind === "take_dutch", mossa?.kind);
check(
  "il bot aspetta invece di comprare subito al massimo",
  mossa !== null && mossa.delay > 0,
  mossa?.delay,
);
check(
  "il bot si sveglia prima che il lotto chiuda",
  mossa !== null && mossa.delay < game.lotSeconds(s) * 1000,
  mossa?.delay,
);
check(
  "il bot paga di piu' per un lotto Top che per un riempitivo",
  (() => {
    const botPlayer = game.playerById(s, bot.BOT_PLAYER_ID);
    // Stesso tiro di dado per entrambi: cambia solo la fascia del lotto.
    const alto = { ...s, items: s.items, currentItemId: s.items.find((i) => i.tier === 5).id };
    const basso = { ...s, currentItemId: s.items.find((i) => i.tier === 1).id };
    return bot.dutchTargetPrice(alto, botPlayer, 0.5) > bot.dutchTargetPrice(basso, botPlayer, 0.5);
  })(),
);
/*
 * La scala delle soglie deve restare distinta.
 *
 * Era il guasto: la quota per posto -- crediti diviso posti liberi, quattro su
 * un budget da venti -- veniva usata come tetto rigido, e schiacciava a quattro
 * le prime tre fasce. Leggendario e mediocre si compravano allo stesso prezzo e
 * il resto sempre a due. Questi controlli tengono separati i gradini.
 */
check(
  "la soglia di un lotto Top sfora la quota per posto",
  (() => {
    const botPlayer = game.playerById(s, bot.BOT_PLAYER_ID);
    const quota = bot.affordableCeiling(s, botPlayer);
    const alto = { ...s, currentItemId: s.items.find((i) => i.tier === 5).id };
    return bot.dutchTargetPrice(alto, botPlayer, 0.5) > quota;
  })(),
);
check(
  "fra Top, medio e riempitivo ci sono tre prezzi diversi",
  (() => {
    const botPlayer = game.playerById(s, bot.BOT_PLAYER_ID);
    const perFascia = (tier) =>
      bot.dutchTargetPrice({ ...s, currentItemId: s.items.find((i) => i.tier === tier).id },
        botPlayer, 0.5);
    const [alto, medio, basso] = [5, 3, 1].map(perFascia);
    return alto > medio && medio > basso;
  })(),
);
check(
  "la soglia non sfonda mai la riserva del motore",
  (() => {
    const botPlayer = game.playerById(s, bot.BOT_PLAYER_ID);
    const tetto = game.maxBid(s, botPlayer);
    return [5, 4, 3, 2, 1].every((tier) => {
      const st = { ...s, currentItemId: s.items.find((i) => i.tier === tier).id };
      for (let roll = 0; roll <= 1.0001; roll += 0.1) {
        const target = bot.dutchTargetPrice(st, botPlayer, Math.min(1, roll));
        if (target !== null && target > tetto) return false;
      }
      return true;
    });
  })(),
);
check(
  "il tempo di reazione sta fra 800 e 2200 millesimi",
  (() => {
    for (let roll = 0; roll <= 1.0001; roll += 0.05) {
      const ms = bot.dutchReactionDelay(Math.min(1, roll));
      if (ms < 800 || ms > 2200) return false;
    }
    return bot.dutchReactionDelay(0) === 800 && bot.dutchReactionDelay(1) === 2200;
  })(),
);

check(
  "il bot non punta mai sotto il pavimento",
  (() => {
    const botPlayer = game.playerById(s, bot.BOT_PLAYER_ID);
    for (let roll = 0; roll <= 1.0001; roll += 0.05) {
      const target = bot.dutchTargetPrice(s, botPlayer, Math.min(1, roll));
      if (target !== null && target < game.DUTCH_FLOOR) return false;
    }
    return true;
  })(),
);
check(
  "il bot compra davvero, se lo si lascia fare",
  (() => {
    const botPlayer = game.playerById(s, bot.BOT_PLAYER_ID);
    const target = bot.dutchTargetPrice(s, botPlayer, 0.5);
    const attesa = bot.dutchWaitFor(s, target, T0);
    const dopo = game.reducer(s, {
      type: "take_dutch",
      playerId: bot.BOT_PLAYER_ID,
      now: T0 + attesa,
    });
    return dopo.lastResult?.winnerId === bot.BOT_PLAYER_ID;
  })(),
);

console.log(
  failures === 0
    ? "\nTUTTI I CONTROLLI SUPERATI"
    : `\n${failures} CONTROLLI FALLITI`,
);
process.exit(failures === 0 ? 0 : 1);
