const path = require("path");
const Module = require("module");
const OUT = path.resolve(process.cwd(), process.argv[2] ?? ".tmp-check/lib");

// I file compilati conservano l'alias "@/": lo risolviamo sulla cartella di build.
const ROOT = path.resolve(OUT, "..");
const resolveFilename = Module._resolveFilename;
Module._resolveFilename = function (request, ...rest) {
  const target = request.startsWith("@/") ? path.join(ROOT, request.slice(2)) : request;
  return resolveFilename.call(this, target, ...rest);
};

const game = require(path.join(OUT, "game.js"));
const bot = require(path.join(OUT, "botEngine.js"));
const catalog = require(path.join(OUT, "catalog.js"));

/*
 * Il Pick-asso Bot, messo alla prova senza browser.
 *
 * Una partita contro il bot dura minuti e dipende da timer veri: guardarla
 * giocare a mano vuol dire provarne una, non cento, e le cose che possono
 * andare storte -- il bot che finisce i crediti con la lista a meta', o che
 * smette di rispondere e blocca l'asta fino allo scadere di ogni singolo lotto
 * -- si vedono solo sulla lunga. Qui l'orologio lo muoviamo noi, e cento
 * partite passano in un secondo.
 *
 * L'attesa del bot e' simulata come nell'app: si decide alla prima occasione,
 * si segna a che ora tocchera' agire, e se nel frattempo la situazione cambia
 * si ributta tutto e si ridecide.
 */

const HUMAN_ID = "human";
const TICK_MS = 250;
/* Un tetto di sicurezza: se lo si tocca vuol dire che la partita non finisce. */
const MAX_TICKS = 20000;

let failures = 0;
function check(label, condition, detail) {
  if (condition) {
    console.log(`  ok   ${label}`);
  } else {
    failures += 1;
    console.log(`  FAIL ${label}${detail !== undefined ? ` -> ${detail}` : ""}`);
  }
}

/** La stessa impronta che usa il gancio nell'app per decidere se ripensarci. */
function impronta(state) {
  return [
    state.phase,
    state.lotNumber,
    state.lotKind,
    state.currentBid,
    state.highBidderId ?? "-",
    state.passed.length,
    Object.keys(state.votes ?? {}).length,
  ].join(":");
}

function toAction(move, id, now) {
  switch (move.kind) {
    case "bid":
      return { type: "bid", playerId: id, amount: move.amount, now };
    case "claim":
      return { type: "claim", playerId: id, now };
    case "pass":
      return { type: "pass", playerId: id, now };
    case "vote":
      return { type: "vote", voterId: id, targetId: move.targetId, now };
  }
}

/**
 * L'avversario in carne e ossa, ridotto all'osso: rilancia quando puo'
 * permetterselo, ogni tanto lascia perdere, e alla fine vota il bot -- che e'
 * l'unica rosa che puo' votare.
 */
function humanAct(state, clock) {
  if (state.phase === "voting") {
    if (game.canVote(state, HUMAN_ID, bot.BOT_PLAYER_ID)) {
      return { type: "vote", voterId: HUMAN_ID, targetId: bot.BOT_PLAYER_ID, now: clock };
    }
    return null;
  }
  if (state.phase !== "auction") return null;

  const me = game.playerById(state, HUMAN_ID);
  if (!me) return null;

  if (state.lotKind === "mystery") {
    if (game.canClaim(state, HUMAN_ID) && Math.random() < 0.4) {
      return { type: "claim", playerId: HUMAN_ID, now: clock };
    }
    if (game.canPass(state, HUMAN_ID)) return { type: "pass", playerId: HUMAN_ID, now: clock };
    return null;
  }

  const minimo = game.minimumBid(state);
  const tetto = game.maxBid(state, me);
  if (minimo <= tetto && Math.random() < 0.55) {
    const amount = Math.min(minimo + (Math.random() < 0.5 ? 0 : 1), tetto);
    if (game.canBid(state, HUMAN_ID, amount)) {
      return { type: "bid", playerId: HUMAN_ID, amount, now: clock };
    }
  }
  if (game.canPass(state, HUMAN_ID) && Math.random() < 0.5) {
    return { type: "pass", playerId: HUMAN_ID, now: clock };
  }
  return null;
}

/** Una partita intera, dal fischio d'inizio alla proclamazione. */
function playMatch(category, config) {
  let state = game.createGame({
    code: "BOTSIM",
    mode: "local",
    hostId: HUMAN_ID,
    category,
    config,
    practice: true,
  });
  state = game.reducer(state, {
    type: "add_player",
    player: { id: HUMAN_ID, name: "Umano" },
  });
  state = game.reducer(state, {
    type: "add_player",
    player: { id: bot.BOT_PLAYER_ID, name: bot.BOT_NAME, emoji: bot.BOT_AVATAR },
  });

  let clock = 1_000_000;
  state = game.reducer(state, { type: "start", now: clock });

  let firma = null;
  let attesa = null;
  let ticks = 0;
  const problemi = [];

  while (state.phase !== "ended" && ticks < MAX_TICKS) {
    ticks += 1;
    clock += TICK_MS;

    /*
     * Il gancio del bot, riprodotto com'e' davvero.
     *
     * Alla partenza dell'attesa la mossa serve solo a sapere quanto aspettare;
     * quella vera si ricalcola quando l'attesa scade, sullo stato di allora.
     * Se qui si riproducesse il vecchio comportamento -- mandare la mossa
     * decisa all'inizio -- il controllo direbbe che va tutto bene anche
     * riportando indietro il codice.
     */
    const adesso = impronta(state);
    if (adesso !== firma) {
      firma = adesso;
      const previsione = bot.decideBotMove(state, bot.BOT_PLAYER_ID, { now: clock });
      attesa = previsione
        ? { at: clock + previsione.delay + bot.GRACE_AFTER_CHANGE_MS }
        : null;
    }

    if (attesa && clock >= attesa.at) {
      attesa = null;
      // Le stesse rinunce del gancio: fase cambiata, o gia' in testa.
      const fermo =
        (state.phase !== "auction" && state.phase !== "voting") ||
        (state.phase === "auction" && state.highBidderId === bot.BOT_PLAYER_ID);
      if (!fermo) {
        const prima = game.playerById(state, bot.BOT_PLAYER_ID);
        const mossa = bot.decideBotMove(state, bot.BOT_PLAYER_ID, { now: clock });
        if (mossa) {
          // Il tetto piu' largo che il bot possa darsi su un lotto: la quota
          // massima, o la regola del saldo se e' quella a stringere.
          const tetto = bot.maxBidFor(state, prima, bot.BID_SHARE_MAX * 1.6);
          if (mossa.kind === "bid" && mossa.amount > tetto) {
            problemi.push(`rilancio ${mossa.amount} oltre il tetto ${tetto}`);
          }
          const prevLotto = state.lotNumber;
          const prevFase = state.phase;
          state = game.reducer(state, toAction(mossa, bot.BOT_PLAYER_ID, clock));
          // La mossa deve fare qualcosa: se il riduttore la rifiuta in
          // silenzio il bot resta fermo per tutto il lotto, ed e' il guasto
          // che sembrava un blocco.
          if (state.lotNumber === prevLotto && state.phase === prevFase && impronta(state) === firma) {
            problemi.push(`mossa ${mossa.kind} rifiutata dal riduttore`);
          }
          firma = impronta(state);
        }
      }
    }

    const umano = humanAct(state, clock);
    if (umano) state = game.reducer(state, umano);

    state = game.reducer(state, { type: "tick", now: clock });

    const robot = game.playerById(state, bot.BOT_PLAYER_ID);
    if (robot.budget < 0) problemi.push(`crediti negativi: ${robot.budget}`);
    if (robot.roster.length > state.config.slots) {
      problemi.push(`lista oltre gli slot: ${robot.roster.length}`);
    }
  }

  return { state, ticks, problemi };
}

/* ------------------------------------------------------------------ */

console.log("\nPick-asso Bot");

/* ---------------- I ritardi ---------------- */

const fasce = { pass: [2000, 3500], bid: [2500, 4500], hesitate: [4000, 6000], snipe: [800, 1200] };
for (const [tipo, [min, max]] of Object.entries(fasce)) {
  const campioni = Array.from({ length: 500 }, () => bot.getBotDelay(tipo));
  check(
    `ritardo "${tipo}" sempre fra ${min} e ${max} ms`,
    campioni.every((ms) => ms >= min && ms <= max),
    `${Math.min(...campioni)}-${Math.max(...campioni)}`,
  );
  check(
    `ritardo "${tipo}" mai fisso`,
    new Set(campioni).size > 50,
    `${new Set(campioni).size} valori distinti`,
  );
}

/* ---------------- La soglia di spesa ---------------- */

check(
  "soglia: dodici crediti su tre posti liberi fanno quattro",
  bot.affordableCeiling({ config: { slots: 5 } }, { budget: 12, roster: [1, 2] }) === 4,
  bot.affordableCeiling({ config: { slots: 5 } }, { budget: 12, roster: [1, 2] }),
);
check(
  "soglia: sull'ultimo posto vale tutto il budget",
  bot.affordableCeiling({ config: { slots: 5 } }, { budget: 9, roster: [1, 2, 3, 4] }) === 9,
);
check(
  "soglia: a lista piena non si spende piu' niente",
  bot.affordableCeiling({ config: { slots: 5 } }, { budget: 9, roster: [1, 2, 3, 4, 5] }) === 0,
);

/* ---------------- La quota di budget per lotto ---------------- */

{
  const quote = Array.from({ length: 400 }, () => bot.bidShare(5));
  check(
    "la quota di budget sta fra un quarto e due quinti",
    quote.every((q) => q >= bot.BID_SHARE_MIN && q <= bot.BID_SHARE_MAX),
    `${Math.min(...quote).toFixed(3)}-${Math.max(...quote).toFixed(3)}`,
  );
  check("la quota non e' mai due volte la stessa", new Set(quote).size > 350, new Set(quote).size);
  check(
    "sugli ultimi posti il bot puo' osare di piu'",
    Array.from({ length: 200 }, () => bot.bidShare(1)).some((q) => q > bot.BID_SHARE_MAX),
  );
}

/* ---------------- La scelta sul singolo lotto ---------------- */

/*
 * Due guasti veri, tutti e due invisibili dentro una partita simulata perche'
 * non rompevano niente: il bot finiva la partita lo stesso, con la lista piena,
 * e i controlli passavano. Si vedevano solo giocando.
 *
 * Il primo: con il piatto vuoto e l'avversario gia' fuori, il lotto era suo a
 * un credito e ne offriva due una volta su due. Il secondo, piu' grosso: non
 * passava mai. Non per scelta -- non esisteva proprio una strada che portasse
 * al "passa" se non "non me lo posso permettere" -- e siccome la quota per
 * posto e' quasi sempre piu' alta del prezzo di un lotto Base, comprava
 * riempitivo finche' non restava niente per i lotti che contano.
 *
 * Qui i lotti si costruiscono uno per uno, con la fascia e il prezzo che
 * servono, e si guarda la mossa. Il tiro a sorte si passa da fuori: una
 * probabilita' non si prova sperando che esca.
 */

/** Un'asta su misura: fascia del lotto, piatto, e come sta messo il bot. */
function scenario({
  tier = 1,
  currentBid = 0,
  highBidder = null,
  passed = [],
  botBudget = 20,
  botRoster = 0,
  queueLeft = 20,
  slots = 5,
} = {}) {
  const items = Array.from({ length: queueLeft + 1 }, (_, i) => ({
    id: `it${i}`,
    name: `Elemento ${i}`,
    tier: i === 0 ? tier : 3,
  }));
  const roster = Array.from({ length: botRoster }, (_, i) => ({
    itemId: `avuto${i}`,
    name: `Avuto ${i}`,
    tier: 3,
    price: 1,
  }));
  return {
    phase: "auction",
    config: { ...game.DEFAULT_CONFIG, slots, allowDiscards: true },
    items,
    queue: items.slice(1).map((it) => it.id),
    currentItemId: "it0",
    lotKind: "normal",
    lotPrice: 0,
    currentBid,
    highBidderId: highBidder,
    passed,
    turnId: bot.BOT_PLAYER_ID,
    deadline: 2_000_000,
    discards: [],
    players: [
      { id: HUMAN_ID, name: "Umano", emoji: "cat", budget: 20, roster: [], passes: 0 },
      {
        id: bot.BOT_PLAYER_ID,
        name: bot.BOT_NAME,
        emoji: bot.BOT_AVATAR,
        budget: botBudget,
        roster,
        passes: 0,
      },
    ],
  };
}

const ORA = 1_000_000;
const mossa = (stato, roll) =>
  bot.decideBotMove(stato, bot.BOT_PLAYER_ID, { now: ORA, roll, share: bot.BID_SHARE_MIN });

/* --- 1. L'offerta minima quando non c'e' nessuno a contendere --- */

{
  // L'avversario ha passato, il piatto e' vuoto: il lotto e' gia' suo a uno.
  const fuori = scenario({ tier: 5, passed: [HUMAN_ID] });
  const cento = Array.from({ length: 100 }, () => mossa(fuori, 0));
  check(
    "avversario fuori e piatto vuoto: offre uno, sempre",
    cento.every((m) => m.kind === "bid" && m.amount === 1),
    [...new Set(cento.map((m) => `${m.kind}:${m.amount ?? "-"}`))].join(" "),
  );

  // E anche con l'avversario ancora in gara: sul piatto vuoto non c'e' niente
  // da scavalcare, e aprire a due e' un credito regalato.
  const aperto = scenario({ tier: 5 });
  const apertura = Array.from({ length: 100 }, () => mossa(aperto, 0));
  check(
    "piatto vuoto: si apre al minimo, non a due",
    apertura.every((m) => m.kind === "bid" && m.amount === 1),
    [...new Set(apertura.map((m) => m.amount))].join(" "),
  );

  // Contro un'offerta vera invece si rilancia, di uno o di due.
  const contesa = scenario({ tier: 5, currentBid: 3, highBidder: HUMAN_ID });
  const rilanci = new Set(
    Array.from({ length: 200 }, () => mossa(contesa, 0)).map((m) => m.amount),
  );
  check(
    "contro un'offerta vera rilancia di uno o due",
    [...rilanci].every((a) => a === 4 || a === 5) && rilanci.size === 2,
    [...rilanci].join(" "),
  );
}

/* --- 2. Il "passa" sui lotti Base --- */

{
  const base = scenario({ tier: 1, currentBid: 1, highBidder: HUMAN_ID });
  check(
    "lotto Base gia' aperto: col tiro basso lascia perdere",
    mossa(base, 0.1).kind === "pass",
    mossa(base, 0.1).kind,
  );
  check(
    "ma non sempre: col tiro alto resta a contendere",
    mossa(base, 0.99).kind === "bid",
    mossa(base, 0.99).kind,
  );
  check(
    "la soglia e' tre volte su quattro",
    bot.BASE_PASS_CHANCE >= 0.7 && bot.BASE_PASS_CHANCE <= 0.8,
    bot.BASE_PASS_CHANCE,
  );

  // Un posto per un credito non si rifiuta: qui il tiro non conta niente.
  const gratis = scenario({ tier: 1 });
  check(
    "un lotto Base a un credito lo prende comunque",
    mossa(gratis, 0).kind === "bid" && mossa(gratis, 0).amount === 1,
  );

  // Sui lotti che contano non si molla per gusto, nemmeno col tiro piu' basso.
  for (const [nome, t] of [["Top", 5], ["Elite", 4], ["Standard", 3]]) {
    const pregiato = scenario({ tier: t, currentBid: 2, highBidder: HUMAN_ID });
    check(
      `su un lotto ${nome} non lascia perdere per gusto`,
      mossa(pregiato, 0).kind === "bid",
      mossa(pregiato, 0).kind,
    );
  }
}

/* --- 3. Crediti stretti: sui Base si passa e basta --- */

{
  // Quattro crediti e quattro posti da coprire: la quota per posto e' uno.
  const stretto = scenario({
    tier: 2,
    currentBid: 1,
    highBidder: HUMAN_ID,
    botBudget: 4,
    botRoster: 1,
  });
  check(
    "coi crediti stretti il Base si lascia sempre, senza tirare a sorte",
    Array.from({ length: 100 }, () => mossa(stretto, 0.999)).every((m) => m.kind === "pass"),
  );
  check(
    "e la stretta si misura sulla quota per posto",
    bot.isTightOnCredits(stretto, game.playerById(stretto, bot.BOT_PLAYER_ID)) === true,
  );
  check(
    "con lo stesso budget ma un posto solo da coprire non e' piu' stretta",
    bot.isTightOnCredits(
      scenario({ botBudget: 4, botRoster: 4 }),
      { budget: 4, roster: new Array(4).fill({}) },
    ) === false,
  );
}

/* --- 4. Sul fondo del mazzo si smette di scegliere --- */

{
  const fondo = scenario({
    tier: 1,
    currentBid: 1,
    highBidder: HUMAN_ID,
    botRoster: 3,
    queueLeft: 2,
  });
  check(
    "quando i lotti stanno finendo il Base si prende lo stesso",
    Array.from({ length: 50 }, () => mossa(fondo, 0)).every((m) => m.kind === "bid"),
  );
  check(
    "e la valvola si accorge che il mazzo e' corto",
    bot.lotsRunningShort(fondo, game.playerById(fondo, bot.BOT_PLAYER_ID)) === true,
  );
  const largo = scenario({ botRoster: 3, queueLeft: 20 });
  check(
    "col mazzo lungo invece si puo' ancora scegliere",
    bot.lotsRunningShort(largo, game.playerById(largo, bot.BOT_PLAYER_ID)) === false,
  );
}

/* --- 5. Il guardrail della riserva --- */

{
  // Un credito e tre posti da coprire: la riserva ne blocca due, e per stare
  // in gara ne servirebbero tre. Non e' una scelta, e' un obbligo.
  const senzaFiato = scenario({
    tier: 5,
    currentBid: 2,
    highBidder: HUMAN_ID,
    botBudget: 3,
    botRoster: 2,
  });
  const robot = game.playerById(senzaFiato, bot.BOT_PLAYER_ID);
  check(
    "l'offerta che sfonda la riserva si riconosce",
    bot.violatesReserve(senzaFiato, robot, game.minimumBid(senzaFiato)) === true,
  );
  check(
    "e il bot e' costretto a passare, anche su un lotto Top",
    mossa(senzaFiato, 0.99).kind === "pass",
    mossa(senzaFiato, 0.99).kind,
  );
  check(
    "la riserva tiene un credito per ogni posto che resterebbe vuoto",
    game.maxBid(senzaFiato, robot) === 1,
    game.maxBid(senzaFiato, robot),
  );
}

/* ---------------- Cento partite intere ---------------- */

const categoria = catalog.OFFICIAL_CATEGORIES[0];
const config = { ...game.DEFAULT_CONFIG, maxPlayers: 2, budget: 20, slots: 5 };

const PARTITE = 100;
let finite = 0;
let listePiene = 0;
let votiAlBot = 0;
let problemi = [];
let ticksMax = 0;

for (let i = 0; i < PARTITE; i += 1) {
  const esito = playMatch(categoria, config);
  if (esito.state.phase === "ended") finite += 1;
  ticksMax = Math.max(ticksMax, esito.ticks);
  problemi = problemi.concat(esito.problemi);

  const robot = game.playerById(esito.state, bot.BOT_PLAYER_ID);
  if (robot.roster.length === esito.state.config.slots) listePiene += 1;
  if ((esito.state.votes ?? {})[bot.BOT_PLAYER_ID] === HUMAN_ID) votiAlBot += 1;
}

check(`${PARTITE} partite arrivano alla proclamazione`, finite === PARTITE, `${finite}/${PARTITE}`);
check("il bot non va mai sotto zero ne' oltre gli slot", problemi.length === 0, problemi[0]);
check(
  "il bot chiude sempre la lista",
  listePiene === PARTITE,
  `${listePiene}/${PARTITE} liste complete`,
);
check(
  "il bot vota sempre la rosa della persona",
  votiAlBot === PARTITE,
  `${votiAlBot}/${PARTITE}`,
);
check("nessuna partita si impianta", ticksMax < MAX_TICKS, `${ticksMax} battiti al massimo`);

/* ---------------- Il bot sta fermo dove non e' di casa ---------------- */

const normale = game.createGame({
  code: "NOBOT",
  mode: "local",
  hostId: HUMAN_ID,
  category: categoria,
});
check(
  "una partita normale non porta il contrassegno",
  normale.isPractice === undefined,
  normale.isPractice,
);

/* ---------------- La lista a sorte ---------------- */

const sorteggiate = new Set();
for (let i = 0; i < 300; i += 1) {
  const scelta = game.randomPlayableCategory(catalog.OFFICIAL_CATEGORIES);
  if (!scelta) continue;
  sorteggiate.add(scelta.id);
  if (scelta.items.length < game.MIN_CATEGORY_ITEMS) {
    failures += 1;
    console.log(`  FAIL sorteggiata una lista troppo corta: ${scelta.id}`);
  }
}
check(
  "il dado gira su piu' liste, mai su una troppo corta",
  sorteggiate.size > 5,
  `${sorteggiate.size} liste diverse`,
);
check(
  "il dado rispetta la misura della partita",
  game.randomPlayableCategory(
    [{ id: "corta", items: new Array(20).fill({}) }],
    { players: 2, slots: 10 },
  ) === null,
);
check("il dado su un elenco vuoto non esplode", game.randomPlayableCategory([]) === null);

console.log(
  failures === 0
    ? "\nTutto a posto.\n"
    : `\n${failures} controlli falliti.\n`,
);
process.exit(failures === 0 ? 0 : 1);
