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
 * Le foto scelte a mano, che nessuna ricerca deve poter scavalcare.
 *
 * I personaggi sotto copyright sono il caso in cui la ricerca automatica non
 * fallisce per sfortuna, ma per come sono fatti gli archivi: Wikimedia ospita
 * solo materiale libero, quindi di Mario e Luigi ha la fotografia di due
 * cosplayer, di Sonic il logo, di Calvin e Hobbes il lettering del titolo.
 * Unsplash e' anche peggio, perche' quelle parole non le conosce proprio e
 * restituisce una foto qualunque.
 *
 * Qui l'indirizzo e' fissato: si guarda prima di tutto il resto e non si
 * discute. Sono pochi apposta -- ogni voce e' un indirizzo che qualcuno deve
 * ricontrollare se un giorno si rompe -- e valgono solo dove la ricerca ha
 * dimostrato di non farcela.
 */
export const CUSTOM_ITEM_IMAGES: Readonly<Record<string, string>> = {
  "Mario & Luigi":
    "https://static.wikia.nocookie.net/mario/images/f/fc/M%26L_logo.png/revision/latest/scale-to-width-down/600?cb=20230731203605",
  "Tom & Jerry":
    "https://static.tvmaze.com/uploads/images/original_untouched/483/1209807.jpg",
  "Batman & Robin":
    "https://static.wikia.nocookie.net/batman/images/6/68/The_Robin_Character.jpg/revision/latest/scale-to-width-down/483?cb=20250111191936",
  "Sherlock & Watson":
    "https://static.tvmaze.com/uploads/images/original_untouched/171/428042.jpg",
  "Sonic & Tails":
    "https://static.wikia.nocookie.net/sonic/images/7/78/Sonic_Model_Sheet_2.png/revision/latest?cb=20250312210855",
  "Naruto & Sasuke":
    "https://static.wikia.nocookie.net/naruto/images/d/d6/Naruto_Part_I.png/revision/latest/scale-to-width-down/600?cb=20251228135525",
  "Calvin & Hobbes":
    "https://static.wikia.nocookie.net/candh/images/e/ed/Cavintrans.png/revision/latest/scale-to-width-down/558?cb=20201026002306",
};

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

export type ImageSource = "custom" | "unsplash" | "commons" | "picsum";

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
  /*
   * Prima di tutto: c'e' una scelta fatta a mano per questo elemento?
   *
   * Sta qui in cima e non in fondo perche' e' una decisione, non un ripiego.
   * Se qualcuno ha guardato quella foto e ha detto "e' questa", non ha senso
   * interrogare due archivi per poi ignorarne le risposte.
   */
  const fissata = CUSTOM_ITEM_IMAGES[itemName];
  if (fissata) return { url: fissata, source: "custom", query: itemName };

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
