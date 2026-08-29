/**
 * Controlla che ogni foto del catalogo sia raggiungibile e sia davvero un'immagine.
 *
 * Uso:  node scripts/check-photos.js [idCategoria ...]
 */
const fs = require("fs");
const path = require("path");

const DATA = path.resolve(process.cwd(), "data/categories.json");
const HEADERS = { "User-Agent": "PickAndPay/1.0 (https://github.com/acrisci05/draftgame) node-fetch" };
// Poche richieste alla volta e una pausa fra l'una e l'altra: gli archivi
// rispondono "troppe richieste" se li si interroga a raffica.
const CONCURRENCY = 2;
const PAUSE_MS = 250;

const only = process.argv.slice(2).filter((value) => !value.startsWith("--"));
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Un tentativo può fallire perché l'archivio ci sta rallentando, non perché la
 * foto manca: si riprova due volte aspettando sempre di più prima di dire che
 * c'è un problema.
 */
async function head(url) {
  let last = "";
  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (attempt > 0) await wait(1000 * attempt * attempt);
    try {
      const response = await fetch(url, { method: "HEAD", headers: HEADERS, redirect: "follow" });
      const type = response.headers.get("content-type") ?? "";
      if (response.ok) {
        return type.startsWith("image/") ? null : `non è un'immagine (${type})`;
      }
      last = `HTTP ${response.status}`;
    } catch (error) {
      last = `irraggiungibile (${error.cause?.code ?? error.message})`;
    }
  }
  return last;
}

(async () => {
  const categories = JSON.parse(fs.readFileSync(DATA, "utf8"));
  const targets = only.length > 0 ? categories.filter((c) => only.includes(c.id)) : categories;

  const jobs = [];
  for (const category of targets) {
    for (const rows of Object.values(category.tiers)) {
      for (const [name, , url] of rows) jobs.push({ label: `${category.id}/${name}`, url });
    }
  }

  const withPhoto = jobs.filter((job) => job.url);
  const problems = [];
  let done = 0;

  const queue = [...withPhoto];
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      for (let job = queue.shift(); job; job = queue.shift()) {
        const problem = await head(job.url);
        done += 1;
        if (problem) problems.push(`${job.label}: ${problem}`);
        if (done % 100 === 0) console.log(`  ${done}/${withPhoto.length}`);
        await wait(PAUSE_MS);
      }
    }),
  );

  // Due elementi con la stessa identica foto: succede quando la ricerca non
  // trova la variante e ripiega su una foto generica. Vanno distinti.
  const byUrl = new Map();
  for (const job of withPhoto) {
    byUrl.set(job.url, [...(byUrl.get(job.url) ?? []), job.label]);
  }
  const duplicates = [...byUrl.values()].filter((labels) => labels.length > 1);

  console.log(
    `\nelementi: ${jobs.length}   con foto: ${withPhoto.length}   senza foto: ${jobs.length - withPhoto.length}`,
  );
  if (duplicates.length > 0) {
    console.log(`\n${duplicates.length} foto usate da più elementi:`);
    duplicates.forEach((labels) => console.log(`  ${labels.join("  =  ")}`));
  }
  if (problems.length === 0) {
    console.log("TUTTE LE FOTO RISPONDONO");
    return;
  }
  console.log(`\n${problems.length} foto con problemi:`);
  problems.sort().forEach((problem) => console.log(`  ${problem}`));
  process.exitCode = 1;
})();
