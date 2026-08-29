/**
 * Riempie data/categories.json con le foto di Wikipedia.
 *
 * Per ogni elemento cerca prima con il nome della categoria come contesto, poi con
 * il solo nome, prima in italiano e poi in inglese. Accetta una foto solo se il
 * titolo della pagina è pertinente (vedi lib/image-match.ts): se nessun risultato
 * lo è, l'elemento resta senza foto e in gioco mostra la propria icona.
 *
 * Lo script è ripetibile: salta gli elementi che hanno già una foto e salva mano a
 * mano, così può essere interrotto e ripreso.
 *
 * Uso:  node scripts/fetch-images.js [idCategoria ...] [--refresh] [--hinted]
 *
 * --refresh  rifà anche le foto già presenti
 * --hinted   rifà solo gli elementi con un abbinamento in data/image-hints.json,
 *            utile dopo aver corretto un abbinamento sbagliato
 */
const fs = require("fs");
const path = require("path");
const Module = require("module");

const OUT = path.resolve(process.cwd(), ".tmp-check/lib");
const ROOT = path.resolve(OUT, "..");
const resolveFilename = Module._resolveFilename;
Module._resolveFilename = function (request, ...rest) {
  const target = request.startsWith("@/") ? path.join(ROOT, request.slice(2)) : request;
  return resolveFilename.call(this, target, ...rest);
};

const { isRelevant, isExactTitle } = require(path.join(OUT, "image-match.js"));

/** Prima le pagine col titolo identico al nome, poi quelle che vi terminano. */
function byExactness(name, pages) {
  return [...pages].sort(
    (a, b) =>
      Number(isExactTitle(name, b.title ?? "")) - Number(isExactTitle(name, a.title ?? "")),
  );
}

const DATA = path.resolve(process.cwd(), "data/categories.json");
const HINTS = path.resolve(process.cwd(), "data/image-hints.json");
const TIERS = ["5", "4", "3", "2", "1"];
const PAUSE_MS = 180;
const THUMB = 600;

// Wikimedia chiede di identificarsi: senza intestazione le richieste vengono rifiutate.
const HEADERS = {
  "User-Agent": "PickAndPay/1.0 (https://github.com/acrisci05/draftgame) node-fetch",
  Accept: "application/json",
};

const args = process.argv.slice(2);
/** Con --refresh le foto già presenti vengono ricalcolate da capo. */
const refresh = args.includes("--refresh");
/** Con --hinted si rifanno solo gli elementi elencati in data/image-hints.json. */
const hintedOnly = args.includes("--hinted");
const only = args.filter((value) => !value.startsWith("--"));
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function search(lang, query) {
  const params = new URLSearchParams({
    action: "query",
    generator: "search",
    gsrsearch: query,
    gsrlimit: "6",
    prop: "pageimages",
    piprop: "thumbnail",
    pithumbsize: String(THUMB),
    format: "json",
    origin: "*",
  });
  const response = await fetch(`https://${lang}.wikipedia.org/w/api.php?${params}`, {
    headers: HEADERS,
  });
  if (!response.ok) return [];
  const data = await response.json();
  return Object.values(data.query?.pages ?? {}).sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
}

/**
 * Pagina con esattamente quel titolo, seguendo i rimandi.
 * Recupera i casi in cui la voce esiste sotto un altro nome: "Rucola" rimanda a
 * "Eruca vesicaria", che la ricerca per parole avrebbe scartato.
 */
async function byTitle(lang, title) {
  const params = new URLSearchParams({
    action: "query",
    titles: title,
    redirects: "1",
    prop: "pageimages",
    piprop: "thumbnail",
    pithumbsize: String(THUMB),
    format: "json",
    origin: "*",
  });
  const response = await fetch(`https://${lang}.wikipedia.org/w/api.php?${params}`, {
    headers: HEADERS,
  });
  if (!response.ok) return null;
  const data = await response.json();
  const page = Object.values(data.query?.pages ?? {})[0];
  if (!page || page.missing !== undefined || !page.thumbnail?.source) return null;
  return { url: page.thumbnail.source, title: page.title, lang };
}

/**
 * Cerca un file su Wikimedia Commons.
 *
 * Wikipedia ha una voce per le cose che hanno un nome; le foto delle cose comuni
 * — una doccia calda, un cetriolino, una pizza wurstel e patatine — stanno su
 * Commons, che è un archivio di immagini e non un'enciclopedia.
 */
async function commonsSearch(query) {
  const params = new URLSearchParams({
    action: "query",
    generator: "search",
    gsrsearch: `filetype:bitmap ${query}`,
    gsrnamespace: "6",
    gsrlimit: "10",
    prop: "imageinfo",
    iiprop: "url",
    iiurlwidth: String(THUMB),
    format: "json",
    origin: "*",
  });
  const response = await fetch(`https://commons.wikimedia.org/w/api.php?${params}`, {
    headers: HEADERS,
  });
  if (!response.ok) return [];
  const pages = Object.values((await response.json()).query?.pages ?? {}).sort(
    (a, b) => (a.index ?? 0) - (b.index ?? 0),
  );
  return pages
    .map((page) => ({ title: page.title ?? "", url: page.imageinfo?.[0]?.thumburl }))
    .filter((entry) => entry.url);
}

const words = (value) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 2);

/** Il file va preso solo se il suo nome contiene tutte le parole cercate. */
function matchesQuery(query, title) {
  const target = words(title);
  return words(query).every((word) => target.some((candidate) => candidate.startsWith(word)));
}

/**
 * Abbinamenti scelti a mano (data/image-hints.json). Quando ci sono valgono più
 * di qualsiasi ricerca automatica: sono stati verificati uno per uno.
 */
const hints = JSON.parse(fs.readFileSync(HINTS, "utf8"));

async function fromHint(hint) {
  const separator = hint.indexOf(":");
  const source = hint.slice(0, separator);
  const query = hint.slice(separator + 1).trim();

  if (source === "commons") {
    // La ricerca parte dalla descrizione completa e, se nessun file la soddisfa
    // tutta, lascia cadere l'ultima parola: "person sleeping bed morning" diventa
    // "person sleeping bed" e poi "person sleeping". Le parole più importanti
    // stanno all'inizio, quindi la foto resta pertinente.
    const terms = query.split(/\s+/).filter(Boolean);
    for (let length = terms.length; length > 0; length -= 1) {
      const attempt = terms.slice(0, length).join(" ");
      const files = await commonsSearch(attempt);
      const file = files.find((entry) => matchesQuery(attempt, entry.title));
      if (file) return { url: file.url, title: file.title, lang: "commons" };
      await wait(PAUSE_MS);
    }
    return null;
  }
  return byTitle(source, query);
}

/**
 * Titoli alternativi tipici di certe categorie: su Wikipedia la voce di una pizza
 * si chiama "Pizza margherita" e quella di un meme porta il chiarimento "(meme)".
 */
const ALIASES = {
  pizze: (name) => [`Pizza ${name}`, `${name} (pizza)`],
  meme: (name) => [`${name} (meme)`, `${name} (Internet meme)`],
  "clash-royale": (name) => [`${name} (Clash Royale)`],
  superpowers: (name) => [`${name} (fumetto)`],
};

/**
 * Immagini che rappresentano un ente, non la cosa: stemmi, gonfaloni e bandiere.
 * Vanno bene come ripiego, ma se c'è una foto vera è meglio quella.
 */
const HERALDIC =
  /(gonfalone|stemma|coat[_-]?of[_-]?arms|blason|wappen|escudo|bandiera|flag[_-]?of|drapeau|seal[_-]?of)/i;

function isHeraldic(url) {
  return HERALDIC.test(decodeURIComponent(url.split("/").pop() ?? ""));
}

/**
 * Cerca la foto dell'elemento.
 *
 * L'ordine conta: si parte dalla ricerca con il nome della categoria, che
 * disambigua i casi doppi ("Thor" nella categoria Marvel non è il dio norreno,
 * "FIFA" fra i videogiochi non è la federazione). Solo dopo si prova la pagina
 * con quel titolo esatto e infine la ricerca secca.
 */
async function findPhoto(name, categoryName, categoryId) {
  const aliases = ALIASES[categoryId]?.(name) ?? [];
  let fallback = null;

  const hint = hints[categoryId]?.[name];
  if (hint) {
    try {
      const chosen = await fromHint(hint);
      if (chosen) return chosen;
    } catch {
      /* rete instabile: si prosegue con la ricerca automatica */
    }
    await wait(PAUSE_MS);
  }

  const consider = (url, title, lang) => {
    if (!url) return null;
    if (isHeraldic(url)) {
      fallback = fallback ?? { url, title, lang };
      return null;
    }
    return { url, title, lang };
  };

  const searches = [
    ["it", `${name} ${categoryName}`],
    ["en", `${name} ${categoryName}`],
  ];

  for (const [lang, query] of searches) {
    try {
      const pages = await search(lang, query);
      for (const page of byExactness(name, pages)) {
        if (!page.thumbnail?.source || !isRelevant(name, page.title ?? "")) continue;
        const hit = consider(page.thumbnail.source, page.title, lang);
        if (hit) return hit;
      }
    } catch {
      /* rete instabile: si passa al tentativo successivo */
    }
    await wait(PAUSE_MS);
  }

  for (const lang of ["it", "en"]) {
    for (const title of [name, ...aliases]) {
      try {
        const exact = await byTitle(lang, title);
        if (exact) {
          const hit = consider(exact.url, exact.title, lang);
          if (hit) return hit;
        }
      } catch {
        /* rete instabile: si prosegue */
      }
      await wait(PAUSE_MS);
    }
  }

  for (const lang of ["it", "en"]) {
    try {
      const pages = await search(lang, name);
      for (const page of byExactness(name, pages)) {
        if (!page.thumbnail?.source || !isRelevant(name, page.title ?? "")) continue;
        const hit = consider(page.thumbnail.source, page.title, lang);
        if (hit) return hit;
      }
    } catch {
      /* rete instabile: si passa al tentativo successivo */
    }
    await wait(PAUSE_MS);
  }

  // Nessuna foto vera: meglio lo stemma che l'assenza.
  return fallback;
}

/** Serializzatore su misura: una riga per elemento, file leggibile e modificabile. */
function serialize(categories) {
  const lines = ["["];
  categories.forEach((category, categoryIndex) => {
    lines.push("  {");
    lines.push(`    "id": ${JSON.stringify(category.id)},`);
    lines.push(`    "name": ${JSON.stringify(category.name)},`);
    if (category.nameEn !== undefined) {
      lines.push(`    "nameEn": ${JSON.stringify(category.nameEn)},`);
    }
    lines.push(`    "emoji": ${JSON.stringify(category.emoji)},`);
    if (category.theme !== undefined) {
      lines.push(`    "theme": ${JSON.stringify(category.theme)},`);
    }
    lines.push('    "tiers": {');
    TIERS.forEach((tier, tierIndex) => {
      const rows = category.tiers[tier] ?? [];
      lines.push(`      ${JSON.stringify(tier)}: [`);
      rows.forEach((row, rowIndex) => {
        const comma = rowIndex === rows.length - 1 ? "" : ",";
        lines.push(`        ${JSON.stringify(row)}${comma}`);
      });
      lines.push(`      ]${tierIndex === TIERS.length - 1 ? "" : ","}`);
    });
    lines.push("    }");
    lines.push(`  }${categoryIndex === categories.length - 1 ? "" : ","}`);
  });
  lines.push("]");
  return lines.join("\n") + "\n";
}

(async () => {
  const categories = JSON.parse(fs.readFileSync(DATA, "utf8"));
  const targets = only.length > 0 ? categories.filter((c) => only.includes(c.id)) : categories;

  let found = 0;
  let already = 0;
  const missing = [];

  for (const category of targets) {
    let inCategory = 0;
    let total = 0;

    for (const tier of TIERS) {
      const rows = category.tiers[tier] ?? [];
      for (let index = 0; index < rows.length; index += 1) {
        const [name, emoji, image] = rows[index];
        total += 1;

        const hinted = hints[category.id]?.[name] !== undefined;
        if (image && !refresh && !(hintedOnly && hinted)) {
          already += 1;
          inCategory += 1;
          continue;
        }

        const photo = await findPhoto(name, category.name, category.id);
        if (photo) {
          rows[index] = [name, emoji ?? "", photo.url];
          found += 1;
          inCategory += 1;
        } else if (image) {
          // Ricalcolo senza esito: si tiene la foto che c'era, mai un passo indietro.
          inCategory += 1;
        } else {
          missing.push(`${category.id}/${name}`);
        }
      }
      // Salvataggio dopo ogni fascia: il lavoro fatto non si perde.
      fs.writeFileSync(DATA, serialize(categories), "utf8");
    }

    console.log(`${category.id.padEnd(16)} ${inCategory}/${total}`);
  }

  fs.writeFileSync(DATA, serialize(categories), "utf8");

  console.log(`\nnuove foto: ${found}   già presenti: ${already}   senza foto: ${missing.length}`);
  if (missing.length > 0) {
    console.log("\nElementi rimasti con la sola icona:");
    missing.forEach((entry) => console.log(`  ${entry}`));
  }
})();
