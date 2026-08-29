/**
 * Controlla che ogni foto del catalogo sia raggiungibile e sia davvero un'immagine.
 *
 * Uso:  node scripts/check-photos.js [idCategoria ...]
 */
const fs = require("fs");
const path = require("path");

const DATA = path.resolve(process.cwd(), "data/categories.json");
const HEADERS = { "User-Agent": "PickAndPay/1.0 (https://github.com/acrisci05/draftgame) node-fetch" };
// Una richiesta alla volta, con una pausa fra l'una e l'altra: gli archivi
// rispondono "troppe richieste" a chi li interroga a raffica, e allora il
// controllo direbbe che una foto è rotta quando invece è solo stato rallentato.
const PAUSE_MS = 500;

const only = process.argv.slice(2).filter((value) => !value.startsWith("--"));
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Esito di una verifica: `null` se la foto c'è, `{ throttled: true }` se
 * l'archivio ci ha rallentati (non è un difetto del catalogo), altrimenti la
 * descrizione del problema.
 */
async function head(url) {
  let last = "";
  for (let attempt = 0; attempt < 4; attempt += 1) {
    if (attempt > 0) await wait(2000 * attempt);
    try {
      const response = await fetch(url, { method: "HEAD", headers: HEADERS, redirect: "follow" });
      if (response.ok) {
        const type = response.headers.get("content-type") ?? "";
        return type.startsWith("image/") ? null : { problem: `non è un'immagine (${type})` };
      }
      if (response.status === 429) {
        // L'archivio dice quanto aspettare: se lo dice, gli si dà retta.
        const after = Number(response.headers.get("retry-after"));
        await wait(Number.isFinite(after) && after > 0 ? Math.min(after, 30) * 1000 : 5000);
        last = "";
        continue;
      }
      return { problem: `HTTP ${response.status}` };
    } catch (error) {
      last = `irraggiungibile (${error.cause?.code ?? error.message})`;
    }
  }
  return last ? { problem: last } : { throttled: true };
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
  const throttled = [];
  let done = 0;

  for (const job of withPhoto) {
    const result = await head(job.url);
    done += 1;
    if (result?.problem) problems.push(`${job.label}: ${result.problem}`);
    if (result?.throttled) throttled.push(job.label);
    if (done % 100 === 0) console.log(`  ${done}/${withPhoto.length}`);
    await wait(PAUSE_MS);
  }

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
  if (throttled.length > 0) {
    console.log(
      `\n${throttled.length} non verificate: l'archivio ci sta rallentando (riprova più tardi)`,
    );
    throttled.sort().forEach((label) => console.log(`  ${label}`));
  }
  if (problems.length === 0) {
    console.log(throttled.length === 0 ? "\nTUTTE LE FOTO RISPONDONO" : "\nNESSUNA FOTO ROTTA");
    return;
  }
  console.log(`\n${problems.length} foto con problemi:`);
  problems.sort().forEach((problem) => console.log(`  ${problem}`));
  process.exitCode = 1;
})();
