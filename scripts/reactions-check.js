const path = require("path");
const Module = require("module");
const OUT = path.resolve(process.cwd(), process.argv[2] ?? ".tmp-check/lib");
const ROOT = path.resolve(OUT, "..");
const rf = Module._resolveFilename;
Module._resolveFilename = function (r, ...rest) {
  return rf.call(this, r.startsWith("@/") ? path.join(ROOT, r.slice(2)) : r, ...rest);
};
const game = require(path.join(OUT, "game.js"));
const bot = require(path.join(OUT, "botEngine.js"));
const catalog = require(path.join(OUT, "catalog.js"));

/*
 * Il giro completo delle reazioni.
 *
 * Le prove che c'erano guardavano i pezzi -- il riduttore accetta, il bot sceglie
 * la faccina giusta -- ma nessuna metteva insieme la catena: la persona manda,
 * il bot legge, il bot risponde, e le due faccine si vedono insieme. E' quella
 * la cosa che si rompe, perche' dipende da tre tempi diversi.
 */

let failures = 0;
function check(label, condition, detail) {
  if (condition) console.log(`  ok   ${label}`);
  else {
    failures += 1;
    console.log(`  FAIL ${label}${detail !== undefined ? ` -> ${detail}` : ""}`);
  }
}

const UMANO = "umano";
function duello() {
  let s = game.createGame({
    code: "REAZ", mode: "local", hostId: UMANO,
    category: catalog.OFFICIAL_CATEGORIES[0],
    config: { maxPlayers: 2, slots: 4, budget: 20 }, practice: true,
  });
  s = game.reducer(s, { type: "add_player", player: { id: UMANO, name: "io" } });
  s = game.reducer(s, { type: "add_player", player: { id: bot.BOT_PLAYER_ID, name: "bot" } });
  return game.reducer(s, { type: "start", now: 1_000_000 });
}

console.log("\nIl giro delle reazioni\n");

/* ---------------- Le cinque faccine ci sono tutte ---------------- */

check("le faccine sono cinque", game.REACTIONS.length === 5, game.REACTIONS.length);
check("sono tutte diverse", new Set(game.REACTIONS).size === 5);
check("il riduttore le accetta tutte", game.REACTIONS.every((e) => game.isReaction(e)));

/* ---------------- Persona manda, bot risponde ---------------- */

{
  const t0 = 1_000_000;
  let s = duello();
  s = game.reducer(s, { type: "react", playerId: UMANO, emoji: "🤡", now: t0 + 1000 });
  check("la faccina della persona arriva", game.liveReactions(s, t0 + 1000).length === 1);

  // Quello che fa il gancio: legge l'ultima altrui e sceglie la risposta.
  const ultima = bot.latestForeignReaction(s, t0 + 1000);
  check("il bot vede la faccina della persona", ultima?.emoji === "🤡", JSON.stringify(ultima));

  const risposta = bot.botReplyTo(ultima.emoji, s);
  check("il bot ha una risposta", Boolean(risposta), risposta);

  // Risponde dopo uno o due secondi: la faccina della persona e' ancora a schermo.
  const quando = t0 + 2000;
  check("a quel punto puo' reagire", game.canReact(s, bot.BOT_PLAYER_ID, quando) === true);
  s = game.reducer(s, { type: "react", playerId: bot.BOT_PLAYER_ID, emoji: risposta, now: quando });
  const vive = game.liveReactions(s, quando);
  check("si vedono tutte e due insieme", vive.length === 2, vive.map((r) => r.emoji).join(""));
  check(
    "una e' della persona e una del bot",
    new Set(vive.map((r) => r.playerId)).size === 2,
  );
}

/* ---------------- A tutte e cinque il bot risponde qualcosa ---------------- */

{
  const base = duello();
  const stati = {
    "in testa": { ...base, highBidderId: bot.BOT_PLAYER_ID },
    "a secco": {
      ...base,
      players: base.players.map((p) => (p.id === bot.BOT_PLAYER_ID ? { ...p, budget: 0 } : p)),
    },
    "in gara": base,
  };
  for (const emoji of game.REACTIONS) {
    for (const [come, s] of Object.entries(stati)) {
      const risposta = bot.botReplyTo(emoji, s);
      check(
        `a ${emoji} risponde qualcosa (${come})`,
        Boolean(risposta) && game.isReaction(risposta),
        String(risposta),
      );
    }
  }
}

/* ---------------- Il bot non parla da solo ---------------- */

{
  const t0 = 2_000_000;
  const s = duello();
  check("senza che gli abbiano parlato non ha risposte", bot.latestForeignReaction(s, t0) === null);
  check("e non commenta niente di sua iniziativa", bot.botSpontaneousReaction(s, s) === null);
}

/* ---------------- Il bot commenta solo sui tre fatti ---------------- */

{
  const t0 = 3_000_000;
  const prima = duello();

  // Colpo all'ultimo secondo: il bot rilancia dentro la finestra.
  const dopoSnipe = { ...prima, highBidderId: bot.BOT_PLAYER_ID, sniped: true };
  check(
    "il colpo in extremis merita un commento",
    bot.botSpontaneousReaction(dopoSnipe, prima) === "💸",
    bot.botSpontaneousReaction(dopoSnipe, prima),
  );

  // Lotto buttato via dalla persona.
  const dopoFlop = { ...prima, phase: "result", discards: [...prima.discards, "x"] };
  check(
    "il lotto buttato via pure",
    bot.botSpontaneousReaction(dopoFlop, { ...prima, phase: "auction" }) === "🤡",
    bot.botSpontaneousReaction(dopoFlop, { ...prima, phase: "auction" }),
  );

  // Un lotto qualunque, vinto da lui: niente da dire.
  const vinto = {
    ...prima,
    phase: "result",
    lastResult: { itemId: "x", itemName: "x", tier: 1, winnerId: bot.BOT_PLAYER_ID, winnerName: "bot", price: 2 },
  };
  check("ma un lotto vinto normalmente no", bot.botSpontaneousReaction(vinto, { ...prima, phase: "auction" }) === null);
  void t0;
}

/* ---------------- Il freno vale anche per il bot ---------------- */

{
  const t0 = 4_000_000;
  let s = duello();
  s = game.reducer(s, { type: "react", playerId: bot.BOT_PLAYER_ID, emoji: "🤌", now: t0 });
  check("subito dopo il bot non puo' rimandarne un'altra", game.canReact(s, bot.BOT_PLAYER_ID, t0 + 500) === false);
  check("ma la persona si', non e' frenata da lui", game.canReact(s, UMANO, t0 + 500) === true);
}

console.log(failures === 0 ? "\nLE REAZIONI GIRANO\n" : `\n${failures} controlli falliti.\n`);
process.exit(failures === 0 ? 0 : 1);
