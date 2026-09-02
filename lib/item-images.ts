/**
 * La foto di un elemento, cercata invece che scritta a mano.
 *
 * Tre sorgenti in fila, dalla piu' pertinente alla piu' rassegnata:
 *
 * 1. **Unsplash**, se c'e' la chiave. Foto da catalogo, sempre belle, ma la
 *    ricerca e' larga: "psychology" restituisce persone in ufficio. Va bene
 *    per le cose concrete, meno per i concetti.
 * 2. **Wikimedia Commons**, che per i concetti e' piu' preciso proprio perche'
 *    e' un archivio enciclopedico: "filosofia" ha la Scuola di Atene, non uno
 *    sconosciuto che pensa davanti a una finestra. Non serve nessuna chiave.
 * 3. **Picsum**, che non cerca niente: da' una foto qualsiasi. E' il ripiego,
 *    e la sua unica virtu' e' non lasciare un buco.
 *
 * ## Perche' non viene chiamata mentre si gioca
 *
 * Le foto stanno scritte in `data/categories.json` e questa funzione serve a
 * riempirlo, non a sostituirlo. Tre ragioni, in ordine di peso:
 *
 * - **In asta tutti devono vedere lo stesso lotto.** Una ricerca fatta sul
 *   telefono di ognuno restituisce foto diverse per lo stesso elemento: si
 *   rilancerebbe su cose diverse chiamandole con lo stesso nome. E' il motivo
 *   che da solo chiude la questione.
 * - I limiti di chiamate. Unsplash in prova ne concede cinquanta all'ora per
 *   tutta l'applicazione: una partita da trenta lotti con cinque telefoni le
 *   esaurisce in tre minuti.
 * - La chiave. In una pagina servita al browser sarebbe leggibile da chiunque
 *   apra gli strumenti da sviluppatore.
 *
 * Serve invece dove una curatela non c'e': le liste che si creano dall'editor,
 * dove nessuno ha scelto le foto a mano, e gli script che riempiono il
 * catalogo. Li' si risolve una volta e si salva l'indirizzo trovato.
 */

/**
 * Le parole con cui cercare, in inglese e descrittive.
 *
 * Il nome italiano da solo non basta e a volte porta altrove: "Pesca" cercata
 * cosi' com'e' aveva restituito la cartina di un comune, "Bacio" il quadro di
 * Hayez. La descrizione in inglese dice all'archivio cosa si vuole davvero
 * vedere -- non la parola, la cosa.
 *
 * La mappa piena vive in `data/image-hints.json`, categoria per categoria, ed
 * e' quella che usano gli script. Qui stanno solo gli esempi che servono a
 * capire la forma, piu' quelli generici.
 */
export const ITEM_QUERIES: Readonly<Record<string, string>> = {
  Pistacchio: "pistachio ice cream",
  Matematica: "mathematics blackboard equations",
  "Educazione Fisica": "school gymnasium sports class",
  Filosofia: "philosophy ancient greek school",
  Psicologia: "rorschach inkblot psychology",
  Diritto: "scales of justice law",
};

/** La ricerca da mandare all'archivio per questo elemento. */
export function queryFor(itemName: string, hint?: string): string {
  return hint ?? ITEM_QUERIES[itemName] ?? itemName;
}

export type ImageSource = "unsplash" | "commons" | "picsum";

export interface ItemImage {
  url: string;
  /** Da dove arriva: serve a sapere quali foto valgono un controllo a occhio. */
  source: ImageSource;
  /** Le parole con cui e' stata trovata, per rifare la ricerca se sbaglia. */
  query: string;
}

const UNSPLASH_KEY = process.env.NEXT_PUBLIC_UNSPLASH_ACCESS_KEY ?? process.env.UNSPLASH_ACCESS_KEY;

const AGENT = "PickAndPay/1.0 (https://github.com/acrisci-05/draftgame)";

/**
 * Un numero sempre uguale a partire dallo stesso nome.
 *
 * Serve a Picsum: senza, il ripiego darebbe una foto diversa a ogni ricarico e
 * lo stesso lotto cambierebbe faccia fra un giro e l'altro. Con il seme, la
 * foto di scorta di "Matematica" e' sempre quella.
 */
function seedOf(itemName: string): string {
  let hash = 2166136261;
  for (let i = 0; i < itemName.length; i += 1) {
    hash ^= itemName.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return String(hash >>> 0);
}

/** L'ultima spiaggia: una foto qualsiasi, ma sempre la stessa per quell'elemento. */
export function fallbackImage(itemName: string, size = 640): string {
  return `https://picsum.photos/seed/${encodeURIComponent(seedOf(itemName))}/${size}/${size}`;
}

async function fromUnsplash(query: string): Promise<string | null> {
  if (!UNSPLASH_KEY) return null;
  const params = new URLSearchParams({
    query,
    per_page: "1",
    orientation: "squarish",
    content_filter: "high",
  });
  try {
    const response = await fetch(`https://api.unsplash.com/search/photos?${params}`, {
      headers: {
        Authorization: `Client-ID ${UNSPLASH_KEY}`,
        "Accept-Version": "v1",
        "User-Agent": AGENT,
      },
    });
    if (!response.ok) return null;
    const data = (await response.json()) as {
      results?: { urls?: { regular?: string; small?: string } }[];
    };
    const first = data.results?.[0]?.urls;
    return first?.regular ?? first?.small ?? null;
  } catch {
    return null;
  }
}

async function fromCommons(query: string): Promise<string | null> {
  const search = new URLSearchParams({
    format: "json",
    origin: "*",
    action: "query",
    list: "search",
    srsearch: `${query} filetype:bitmap|drawing`,
    srnamespace: "6",
    srlimit: "1",
  });
  try {
    const found = await fetch(`https://commons.wikimedia.org/w/api.php?${search}`, {
      headers: { "User-Agent": AGENT },
    });
    if (!found.ok) return null;
    const title = ((await found.json()) as { query?: { search?: { title: string }[] } }).query
      ?.search?.[0]?.title;
    if (!title) return null;

    // Secondo giro: dal titolo del file al suo indirizzo, ridotto a 960px.
    const info = new URLSearchParams({
      format: "json",
      origin: "*",
      action: "query",
      titles: title,
      prop: "imageinfo",
      iiprop: "url",
      iiurlwidth: "960",
    });
    const detail = await fetch(`https://commons.wikimedia.org/w/api.php?${info}`, {
      headers: { "User-Agent": AGENT },
    });
    if (!detail.ok) return null;
    const pages = ((await detail.json()) as {
      query?: { pages?: Record<string, { imageinfo?: { thumburl?: string }[] }> };
    }).query?.pages;
    return Object.values(pages ?? {})[0]?.imageinfo?.[0]?.thumburl ?? null;
  } catch {
    return null;
  }
}

/**
 * La foto di un elemento. Non fallisce mai: al peggio torna il ripiego.
 *
 * `hint` scavalca la traduzione automatica quando la ricerca giusta la si
 * conosce gia' (e' il contenuto di `data/image-hints.json`).
 */
export async function fetchItemImage(
  itemName: string,
  options: { hint?: string; preferUnsplash?: boolean } = {},
): Promise<ItemImage> {
  const query = queryFor(itemName, options.hint);

  /*
   * L'ordine si puo' invertire. Per le cose concrete -- un gusto di gelato, un
   * panino -- Unsplash da' foto piu' belle; per i concetti Commons e' piu'
   * pertinente, che e' l'unica cosa che conta davvero su una card d'asta.
   */
  const ordine = options.preferUnsplash
    ? ([fromUnsplash, fromCommons] as const)
    : ([fromCommons, fromUnsplash] as const);
  const nomi: ImageSource[] = options.preferUnsplash
    ? ["unsplash", "commons"]
    : ["commons", "unsplash"];

  for (let i = 0; i < ordine.length; i += 1) {
    const url = await ordine[i](query);
    if (url) return { url, source: nomi[i], query };
  }

  return { url: fallbackImage(itemName), source: "picsum", query };
}
