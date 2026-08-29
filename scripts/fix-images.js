/**
 * Correzioni mirate alle foto delle liste.
 *
 * La ricerca automatica sbaglia quando il nome dell'elemento è ambiguo rispetto
 * al mondo reale: "Vedova Nera" è anche un ragno, "Rocket" è anche un razzo.
 * Qui si indica la voce di Wikipedia da usare, senza margini di errore.
 *
 * Uso:  node scripts/fix-images.js
 */
const fs = require("fs");
const path = require("path");

const DATA = path.resolve(process.cwd(), "data/categories.json");
const TIERS = ["5", "4", "3", "2", "1"];
const THUMB = 600;
const HEADERS = {
  "User-Agent": "PickAndPay/1.0 (https://github.com/acrisci05/draftgame) node-fetch",
  Accept: "application/json",
};

/**
 * [categoria, elemento, titolo della voce, lingua].
 * Con titolo `null` la foto viene tolta: quando l'automatismo ha preso qualcosa
 * di fuorviante e non esiste un'immagine libera, l'icona è la scelta migliore.
 */
const FIXES = [
  ["marvel", "Vedova Nera", null, "it"],
  ["marvel", "Falcon", null, "it"],
  ["marvel", "Stilt-Man", null, "it"],
  ["tvshows", "Friends", null, "it"],
  ["pixar", "La Luna", null, "it"],
  ["superpowers", "Raggi X", null, "it"],
  ["superpowers", "Telecinesi", null, "it"],
  ["marvel", "Vedova Nera", "Vedova Nera (Marvel Comics)", "it"],
  ["marvel", "Rocket", "Rocket Raccoon", "it"],
  ["marvel", "Falcon", "Falcon (personaggio)", "it"],
  ["tvshows", "Friends", "Friends", "it"],
  ["pixar", "La Luna", "La Luna (cortometraggio)", "it"],
  ["pixar", "Nemo", "Alla ricerca di Nemo", "it"],
  ["pixar", "Dory", "Alla ricerca di Dory", "it"],
  ["pixar", "Arlo", "Il viaggio di Arlo", "it"],
  ["cartoons", "Fanta Genitori", "Due fantagenitori", "it"],
  ["videogiochi", "Fortnite", "Fortnite", "it"],
  ["superpowers", "Elasticità", "Mister Fantastic", "it"],
];

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
  return { url: page.thumbnail.source, title: page.title };
}

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
        lines.push(`        ${JSON.stringify(row)}${rowIndex === rows.length - 1 ? "" : ","}`);
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
  let done = 0;

  for (const [categoryId, itemName, title, lang] of FIXES) {
    const category = categories.find((c) => c.id === categoryId);
    if (!category) continue;

    let target = null;
    for (const tier of TIERS) {
      const rows = category.tiers[tier] ?? [];
      const index = rows.findIndex((row) => row[0] === itemName);
      if (index >= 0) target = { rows, index };
    }
    if (!target) {
      console.log(`  ?    ${categoryId}/${itemName}: elemento non trovato`);
      continue;
    }

    const [name, emoji] = target.rows[target.index];

    if (title === null) {
      target.rows[target.index] = [name, emoji ?? ""];
      done += 1;
      console.log(`  ok   ${(categoryId + "/" + itemName).padEnd(30)} foto rimossa, resta l'icona`);
      continue;
    }

    const photo = await byTitle(lang, title);
    if (!photo) {
      console.log(`  --   ${categoryId}/${itemName}: nessuna foto per "${title}"`);
      continue;
    }

    target.rows[target.index] = [name, emoji ?? "", photo.url];
    done += 1;
    console.log(`  ok   ${(categoryId + "/" + itemName).padEnd(30)} ${photo.title}`);
    await new Promise((resolve) => setTimeout(resolve, 180));
  }

  fs.writeFileSync(DATA, serialize(categories), "utf8");
  console.log(`\ncorrette: ${done} su ${FIXES.length}`);
})();
