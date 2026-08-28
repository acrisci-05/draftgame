/**
 * Controlla il filtro di pertinenza delle foto e, se c'è rete, prova qualche
 * ricerca vera per vedere cosa verrebbe accettato e cosa scartato.
 */
const path = require("path");
const Module = require("module");
const OUT = path.resolve(process.cwd(), ".tmp-check/lib");
const ROOT = path.resolve(OUT, "..");
const resolveFilename = Module._resolveFilename;
Module._resolveFilename = function (request, ...rest) {
  const target = request.startsWith("@/") ? path.join(ROOT, request.slice(2)) : request;
  return resolveFilename.call(this, target, ...rest);
};

const { isRelevant } = require(path.join(OUT, "image-match.js"));

let failures = 0;
function check(label, condition, detail) {
  if (condition) console.log(`  ok   ${label}`);
  else {
    failures += 1;
    console.log(`  FAIL ${label}${detail !== undefined ? ` -> ${detail}` : ""}`);
  }
}

console.log("Filtro di pertinenza\n");

const accepted = [
  ["Up", "Up (film 2009)"],
  ["Cars", "Cars (film 2006)"],
  ["Roma", "Roma"],
  ["Thor", "Thor (personaggio)"],
  ["Smash Burger", "Smash burger"],
  ["Reggia di Caserta", "Reggia di Caserta"],
  ["Messi", "Lionel Messi"],
  ["Iron Man", "Iron Man (film 2008)"],
];
const rejected = [
  ["Up", "Upload (serie televisiva)"],
  ["Cars", "Carsoli"],
  ["Smash Burger", "Hamburger"],
  ["Snake", "Snake River"],
  ["Zap", "Zapping"],
  ["Roma", "Romania"],
];

accepted.forEach(([name, title]) =>
  check(`accetta "${title}" per "${name}"`, isRelevant(name, title)),
);
rejected.forEach(([name, title]) =>
  check(`scarta "${title}" per "${name}"`, !isRelevant(name, title)),
);

/* Prova sul campo, saltata se non c'è rete. */
async function probe() {
  const samples = [
    ["Up", "Film Pixar"],
    ["Colosseo", "Città Italiane"],
    ["Messi", "Leggende del Calcio"],
    ["Snake", "Videogiochi"],
  ];

  console.log("\nRicerche reali (saltate senza rete)\n");

  for (const [name, hint] of samples) {
    const params = new URLSearchParams({
      action: "query",
      generator: "search",
      gsrsearch: `${name} ${hint}`,
      gsrlimit: "6",
      prop: "pageimages|description",
      piprop: "thumbnail",
      pithumbsize: "600",
      format: "json",
      origin: "*",
    });
    try {
      const response = await fetch(`https://it.wikipedia.org/w/api.php?${params}`);
      const data = await response.json();
      const pages = Object.values(data.query?.pages ?? {});
      const best = pages
        .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
        .find((page) => page.thumbnail?.source && isRelevant(name, page.title ?? ""));
      const other = pages.find((page) => page.thumbnail?.source);
      console.log(
        `  ${name.padEnd(10)} accettata: ${best ? best.title : "nessuna (resta l'icona)"}` +
          (best || !other ? "" : `   scartata: ${other.title}`),
      );
    } catch {
      console.log("  rete non disponibile: prova saltata");
      return;
    }
  }
}

probe().then(() => {
  console.log(
    failures === 0 ? "\nFILTRO IMMAGINI CORRETTO" : `\n${failures} CONTROLLI FALLITI`,
  );
  process.exit(failures === 0 ? 0 : 1);
});
