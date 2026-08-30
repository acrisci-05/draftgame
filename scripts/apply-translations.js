/**
 * Aggiunge a un dizionario le chiavi tradotte contenute in un file JSON.
 *
 * I dizionari diversi dall'italiano possono essere parziali: quello che manca
 * ripiega sull'inglese e poi sull'italiano. Questo script serve a completarli
 * senza riscrivere a mano i file.
 *
 * Uso:  node scripts/apply-translations.js fr percorso/traduzioni.json
 */
const fs = require("fs");
const path = require("path");

const [locale, source] = process.argv.slice(2);
if (!locale || !source) {
  console.error("Uso: node scripts/apply-translations.js <lingua> <file.json>");
  process.exit(1);
}

const file = path.resolve(process.cwd(), `lib/i18n/${locale}.ts`);
const dictionary = fs.readFileSync(file, "utf8");
const translations = JSON.parse(fs.readFileSync(path.resolve(source), "utf8"));

const already = new Set(
  [...dictionary.matchAll(/^\s{2}"([^"]+)":/gm)].map((match) => match[1]),
);

const lines = [];
for (const [key, value] of Object.entries(translations)) {
  if (already.has(key)) continue;
  lines.push(`  ${JSON.stringify(key)}: ${JSON.stringify(value)},`);
}

if (lines.length === 0) {
  console.log(`${locale}: niente da aggiungere`);
  process.exit(0);
}

// Le nuove chiavi entrano in fondo, prima della graffa di chiusura.
const closing = dictionary.lastIndexOf("};");
const updated =
  dictionary.slice(0, closing) + lines.join("\n") + "\n" + dictionary.slice(closing);
fs.writeFileSync(file, updated, "utf8");

console.log(`${locale}: ${lines.length} chiavi aggiunte`);
