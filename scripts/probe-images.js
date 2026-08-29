/**
 * Prova rapida delle sorgenti di foto: pagina di Wikipedia con quel titolo e
 * ricerca file su Wikimedia Commons. Serve per capire, prima di scrivere gli
 * abbinamenti, quali elementi una foto ce l'hanno davvero.
 *
 * Uso:  node scripts/probe-images.js "en:Nyan Cat" "commons:pizza diavola"
 */
const HEADERS = {
  "User-Agent": "PickAndPay/1.0 (https://github.com/acrisci05/draftgame) node-fetch",
  Accept: "application/json",
};

async function pageImage(lang, title) {
  const params = new URLSearchParams({
    action: "query",
    titles: title,
    redirects: "1",
    prop: "pageimages",
    piprop: "thumbnail",
    pithumbsize: "600",
    format: "json",
    origin: "*",
  });
  const response = await fetch(`https://${lang}.wikipedia.org/w/api.php?${params}`, {
    headers: HEADERS,
  });
  const data = await response.json();
  const page = Object.values(data.query?.pages ?? {})[0];
  if (!page || page.missing !== undefined) return null;
  return page.thumbnail?.source ? { title: page.title, url: page.thumbnail.source } : null;
}

async function commonsFile(query) {
  const params = new URLSearchParams({
    action: "query",
    generator: "search",
    gsrsearch: `filetype:bitmap ${query}`,
    gsrnamespace: "6",
    gsrlimit: "5",
    prop: "imageinfo",
    iiprop: "url",
    iiurlwidth: "600",
    format: "json",
    origin: "*",
  });
  const response = await fetch(`https://commons.wikimedia.org/w/api.php?${params}`, {
    headers: HEADERS,
  });
  const data = await response.json();
  const pages = Object.values(data.query?.pages ?? {}).sort(
    (a, b) => (a.index ?? 0) - (b.index ?? 0),
  );
  return pages
    .map((page) => ({ title: page.title, url: page.imageinfo?.[0]?.thumburl }))
    .filter((entry) => entry.url);
}

(async () => {
  for (const arg of process.argv.slice(2)) {
    const [source, ...rest] = arg.split(":");
    const query = rest.join(":").trim();
    if (source === "commons") {
      const hits = await commonsFile(query);
      console.log(`commons "${query}" ->`);
      hits.forEach((hit) => console.log(`   ${hit.title}`));
      if (hits.length === 0) console.log("   (niente)");
    } else {
      const hit = await pageImage(source, query);
      console.log(`${source} "${query}" -> ${hit ? hit.title : "(niente)"}`);
    }
  }
})();
