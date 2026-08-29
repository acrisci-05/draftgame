/**
 * Genera public/_review.html: tutte le foto del catalogo in griglia, categoria per
 * categoria, per controllarle a occhio. La pagina è solo uno strumento di lavoro,
 * non fa parte del sito (è esclusa dal controllo di versione).
 *
 * Uso:  node scripts/contact-sheet.js && apri http://localhost:3000/_review.html
 */
const fs = require("fs");
const path = require("path");

const DATA = path.resolve(process.cwd(), "data/categories.json");
const OUT = path.resolve(process.cwd(), "public/_review.html");
const TIERS = ["5", "4", "3", "2", "1"];

const escape = (value) =>
  String(value).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

const categories = JSON.parse(fs.readFileSync(DATA, "utf8"));

const sections = categories
  .map((category) => {
    const cells = TIERS.flatMap((tier) =>
      (category.tiers[tier] ?? []).map(([name, emoji, image]) => {
        const picture = image
          ? `<img src="${escape(image)}" alt="" loading="lazy">`
          : `<span class="none">${escape(emoji ?? "")}</span>`;
        return `<figure><div class="frame">${picture}</div><figcaption><b>${escape(name)}</b><span>${tier}</span></figcaption></figure>`;
      }),
    ).join("");
    const missing = Object.values(category.tiers)
      .flat()
      .filter((row) => !row[2]).length;
    return `<section id="${escape(category.id)}"><h2>${escape(category.emoji)} ${escape(category.name)} <small>${escape(category.id)}${missing ? ` — ${missing} senza foto` : ""}</small></h2><div class="grid">${cells}</div></section>`;
  })
  .join("\n");

const html = `<!doctype html>
<html lang="it">
<head>
<meta charset="utf-8">
<title>Controllo foto — Pick &amp; Pay</title>
<style>
  body { margin: 0; padding: 24px; background: #0b0b0d; color: #f4f4f5; font: 15px/1.4 system-ui, sans-serif; }
  h1 { font-size: 22px; margin: 0 0 20px; }
  h2 { font-size: 19px; margin: 32px 0 12px; border-bottom: 1px solid #27272a; padding-bottom: 6px; }
  h2 small { color: #a1a1aa; font-weight: 400; font-size: 13px; }
  .grid { display: grid; grid-template-columns: repeat(6, 1fr); gap: 12px; }
  figure { margin: 0; }
  .frame { aspect-ratio: 1; background: #18181b; border-radius: 10px; display: grid; place-items: center; overflow: hidden; }
  .frame img { width: 100%; height: 100%; object-fit: contain; }
  .none { font-size: 44px; }
  figcaption { display: flex; justify-content: space-between; gap: 6px; margin-top: 5px; font-size: 12px; }
  figcaption b { font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  figcaption span { color: #22c55e; font-weight: 700; }
</style>
</head>
<body>
<h1>Controllo foto — ${categories.length} categorie</h1>
${sections}
</body>
</html>
`;

fs.writeFileSync(OUT, html, "utf8");
console.log(`scritto ${path.relative(process.cwd(), OUT)}`);
