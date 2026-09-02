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

export type ImageSource =
  | "custom"
  | "tmdb"
  | "rawg"
  | "unsplash"
  | "commons"
  | "generated"
  | "picsum";

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
 * La locandina di un film o di una serie (TMDB).
 *
 * Per la cultura pop e' la sorgente giusta e le altre non ci arrivano: Commons
 * non ha le locandine -- sono protette -- e Unsplash non sa cosa sia
 * "Breaking Bad". Serve una chiave gratuita da themoviedb.org.
 */
async function fromTmdb(query: string): Promise<string | null> {
  const key = process.env.TMDB_API_KEY;
  if (!key) return null;
  try {
    const params = new URLSearchParams({ api_key: key, query, include_adult: "false" });
    const response = await fetch(`https://api.themoviedb.org/3/search/multi?${params}`, {
      headers: { "User-Agent": AGENT },
    });
    if (!response.ok) return null;
    const risultati = ((await response.json()) as {
      results?: { poster_path?: string | null; profile_path?: string | null }[];
    }).results;
    const primo = (risultati ?? []).find((r) => r.poster_path || r.profile_path);
    const percorso = primo?.poster_path ?? primo?.profile_path;
    return percorso ? `https://image.tmdb.org/t/p/w780${percorso}` : null;
  } catch {
    return null;
  }
}

/**
 * La copertina di un videogioco (RAWG).
 *
 * Stessa storia della cultura pop: le copertine dei giochi sono protette e
 * negli archivi liberi non ci sono. Chiave gratuita da rawg.io/apidocs.
 */
async function fromRawg(query: string): Promise<string | null> {
  const key = process.env.RAWG_API_KEY;
  if (!key) return null;
  try {
    const params = new URLSearchParams({ key, search: query, page_size: "1" });
    const response = await fetch(`https://api.rawg.io/api/games?${params}`, {
      headers: { "User-Agent": AGENT },
    });
    if (!response.ok) return null;
    const primo = ((await response.json()) as {
      results?: { background_image?: string | null }[];
    }).results?.[0];
    return primo?.background_image ?? null;
  } catch {
    return null;
  }
}

/**
 * Un'immagine generata, per quello che una fotografia non ha.
 *
 * "Scuse per non uscire", "Momenti cringe": non esistono foto di un concetto,
 * e ogni archivio risponde con qualcosa che non c'entra. Un disegno generato
 * almeno parla dell'idea giusta.
 *
 * Ultima prima dei ripieghi, e non prima: un'immagine inventata e' sempre
 * peggio di una vera che esiste davvero, e il seme fisso serve a farla uscire
 * sempre uguale -- in asta due giocatori devono vedere lo stesso lotto.
 */
export function generatedImage(itemName: string, style = "3d render, pop art, clean background"): string {
  const prompt = encodeURIComponent(`${itemName}, ${style}`);
  return `https://image.pollinations.ai/prompt/${prompt}?width=768&height=768&nologo=true&seed=${seedOf(itemName)}`;
}
/**
 * La foto di un elemento, cercata in ordine di pertinenza.
 *
 * L'ordine non e' un'opinione: ogni sorgente sa una cosa sola, e chiederla a
 * quella sbagliata porta via tempo e restituisce spazzatura. Il tema della
 * lista dice quale interrogare per prima.
 *
 * 1. **Scelta a mano**, se c'e': qualcuno ha guardato quella foto e ha deciso.
 * 2. **TMDB** per la cultura pop -- locandine e volti che gli archivi liberi
 *    non hanno, perche' sono protetti.
 * 3. **RAWG** per i videogiochi, per la stessa ragione.
 * 4. **Unsplash** per cibo, oggetti e vita quotidiana: fotografia di catalogo,
 *    che li' e' esattamente quello che serve.
 * 5. **Wikimedia Commons** per persone, luoghi, monumenti e concetti: e' un
 *    archivio enciclopedico, e per la filosofia ha la Scuola di Atene invece di
 *    uno sconosciuto pensieroso.
 * 6. **Un'immagine generata**, per i concetti che una fotografia non ha.
 * 7. **Picsum**, che non cerca niente.
 *
 * Gli ultimi due gradini non stanno qui ma nel componente che disegna la card:
 * l'icona del giocatore e la copertina con emoji su fondo sfumato si producono
 * senza andare in rete, e sono l'unica cosa che funziona anche offline.
 *
 * Ogni sorgente che vuole una chiave si spegne da sola quando la chiave non
 * c'e': senza nessuna chiave restano la scelta a mano, Commons e i ripieghi,
 * che e' esattamente il comportamento di prima.
 */
export type ImageTheme = "sport" | "pop" | "gaming" | "food" | "life";

/** Le sorgenti da provare, nell'ordine giusto per questo tema. */
export function sourceOrderFor(theme?: ImageTheme): ImageSource[] {
  switch (theme) {
    case "pop":
      return ["tmdb", "commons", "unsplash"];
    case "gaming":
      return ["rawg", "tmdb", "commons"];
    case "food":
    case "life":
      return ["unsplash", "commons"];
    case "sport":
      // Atleti, piloti, stadi: gente e luoghi veri, che Commons documenta bene.
      return ["commons", "unsplash"];
    default:
      return ["commons", "unsplash"];
  }
}

const CERCATORI: Record<string, (query: string) => Promise<string | null>> = {
  tmdb: fromTmdb,
  rawg: fromRawg,
  unsplash: fromUnsplash,
  commons: fromCommons,
};

export async function fetchItemImage(
  itemName: string,
  options: { hint?: string; theme?: ImageTheme; allowGenerated?: boolean } = {},
): Promise<ItemImage> {
  /*
   * Prima di tutto: c'e' una scelta fatta a mano per questo elemento?
   *
   * Sta qui in cima e non in fondo perche' e' una decisione, non un ripiego.
   * Se qualcuno ha guardato quella foto e ha detto "e' questa", non ha senso
   * interrogare quattro archivi per poi ignorarne le risposte.
   */
  const fissata = CUSTOM_ITEM_IMAGES[itemName];
  if (fissata) return { url: fissata, source: "custom", query: itemName };

  const query = queryFor(itemName, options.hint);

  for (const sorgente of sourceOrderFor(options.theme)) {
    const cerca = CERCATORI[sorgente];
    if (!cerca) continue;
    const url = await cerca(query);
    if (url) return { url, source: sorgente, query };
  }

  // Un disegno inventato e' meglio di una foto a caso, ma peggio di qualunque
  // foto vera: per questo si chiede solo a chi lo vuole.
  if (options.allowGenerated) {
    return { url: generatedImage(itemName), source: "generated", query };
  }

  return { url: fallbackImage(itemName), source: "picsum", query };
}
