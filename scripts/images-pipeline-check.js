const path = require("path");
const Module = require("module");
const OUT = path.resolve(process.cwd(), process.argv[2] ?? ".tmp-check/lib");
const ROOT = path.resolve(OUT, "..");
const rf = Module._resolveFilename;
Module._resolveFilename = function (r, ...rest) {
  return rf.call(this, r.startsWith("@/") ? path.join(ROOT, r.slice(2)) : r, ...rest);
};
const img = require(path.join(OUT, "item-images.js"));

/*
 * La scala delle sorgenti.
 *
 * Non si prova la rete: si prova l'ordine, che e' la parte che si puo' sbagliare
 * scrivendo. Chiedere una locandina a un archivio di fotografie, o un gusto di
 * gelato a un catalogo di videogiochi, non da' un errore -- da' una risposta
 * sbagliata, che e' peggio perche' non se ne accorge nessuno.
 */

let failures = 0;
function check(label, condition, detail) {
  if (condition) console.log(`  ok   ${label}`);
  else {
    failures += 1;
    console.log(`  FAIL ${label}${detail !== undefined ? ` -> ${detail}` : ""}`);
  }
}

console.log("\nLa scala delle immagini\n");

const ordini = {
  pop: img.sourceOrderFor("pop"),
  gaming: img.sourceOrderFor("gaming"),
  food: img.sourceOrderFor("food"),
  life: img.sourceOrderFor("life"),
  sport: img.sourceOrderFor("sport"),
};

check("la cultura pop chiede prima le locandine", ordini.pop[0] === "tmdb", ordini.pop.join(">"));
check("i videogiochi chiedono prima le copertine", ordini.gaming[0] === "rawg", ordini.gaming.join(">"));
check("il cibo chiede prima la fotografia di catalogo", ordini.food[0] === "unsplash", ordini.food.join(">"));
check("la vita quotidiana pure", ordini.life[0] === "unsplash", ordini.life.join(">"));
check("lo sport chiede prima l'enciclopedia", ordini.sport[0] === "commons", ordini.sport.join(">"));
check(
  "una lista senza tema non resta a mani vuote",
  img.sourceOrderFor(undefined).length > 0,
  img.sourceOrderFor(undefined).join(">"),
);
check(
  "ogni tema ha almeno una seconda possibilita'",
  Object.values(ordini).every((o) => o.length >= 2),
);

/* La scelta a mano non si discute. */
const curati = Object.keys(img.CUSTOM_ITEM_IMAGES);
check("ci sono foto scelte a mano", curati.length > 0, curati.length);
check(
  "sono tutti indirizzi veri",
  Object.values(img.CUSTOM_ITEM_IMAGES).every((u) => /^https:\/\/\S+$/.test(u)),
);

/* I ripieghi devono essere stabili: due giocatori, stesso lotto, stessa foto. */
const a = img.fallbackImage("Matematica");
const b = img.fallbackImage("Matematica");
check("il ripiego di scorta e' sempre lo stesso", a === b, `${a} / ${b}`);
check("elementi diversi hanno ripieghi diversi", img.fallbackImage("Fisica") !== a);

const g1 = img.generatedImage("Momenti Cringe");
const g2 = img.generatedImage("Momenti Cringe");
check("anche l'immagine generata e' sempre la stessa", g1 === g2);
check("l'immagine generata porta il nome dell'elemento", g1.includes(encodeURIComponent("Momenti Cringe")));

/* Le parole con cui si cerca. */
check(
  "il nome italiano viene tradotto dove serve",
  img.queryFor("Pistacchio") === "pistachio ice cream",
  img.queryFor("Pistacchio"),
);
check("un abbinamento esplicito vince su tutto", img.queryFor("Pistacchio", "commons:qualcosa") === "commons:qualcosa");
check("senza traduzione si cerca il nome cosi' com'e'", img.queryFor("Zibibbo") === "Zibibbo");

console.log(failures === 0 ? "\nLA SCALA REGGE\n" : `\n${failures} controlli falliti.\n`);
process.exit(failures === 0 ? 0 : 1);
