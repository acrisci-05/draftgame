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
      const previsione = bot.decideBotMove(state, bot.BOT_PLAYER_ID);
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
        const mossa = bot.decideBotMove(state, bot.BOT_PLAYER_ID);
        if (mossa) {
          const soglia = bot.affordableCeiling(state, prima);
          if (mossa.kind === "bid" && mossa.amount > soglia) {
            problemi.push(`rilancio ${mossa.amount} oltre la soglia ${soglia}`);
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

const fasce = { pass: [2000, 3500], bid: [2500, 4500], hesitate: [4000, 6000] };
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
