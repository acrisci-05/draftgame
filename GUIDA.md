# Pick & Pay - The Draft Game — guida al progetto

Documento di consegna: cosa è stato costruito, con quali tecnologie, come si avvia e cosa serve
per attivare le funzioni collegate al database.

---

## 1. Linguaggio e tecnologie

Il progetto è scritto interamente in **TypeScript** (nessun JavaScript sciolto se non lo script di
verifica), con **React 19** e **Next.js 16** in modalità App Router.

| Ambito | Scelta | Note |
| --- | --- | --- |
| Linguaggio | TypeScript 5 | tipizzazione stretta (`strict: true`) |
| Framework | Next.js 16 (App Router) | rendering React, rotte a cartelle |
| Interfaccia | React 19 | componenti client, nessuna classe |
| Stile | Tailwind CSS v4 | temi chiaro/scuro con variabili CSS |
| Animazioni | Framer Motion | asta, modali, transizioni |
| Icone | Lucide React | set unico, coerente |
| Realtime, database, accessi | Supabase | canali broadcast, Postgres, autenticazione via email |
| Esportazione immagine | html-to-image | card 9:16 in PNG |
| QR code | qrcode | link di voto e accesso rapido alla stanza |
| Runtime | Node.js 24 | richiesto per lo sviluppo |

Non esiste un server applicativo scritto a mano: la logica di gioco gira nel browser e Supabase
fa da database e da canale di sincronizzazione. Questo tiene i costi a zero e permette di
pubblicare il sito come sito statico con funzioni serverless (Vercel, Netlify o simili).

---

## 2. Come si avvia

Serve **Node.js 24 o superiore**. Dalla cartella del progetto:

```bash
npm install     # una volta sola, scarica le dipendenze
npm run dev     # avvia in sviluppo
```

Poi si apre **http://localhost:3000**.

Senza nessuna configurazione la **partita locale funziona subito**: due o più giocatori sullo
stesso telefono o computer, categorie incluse, card finale scaricabile. Restano spente solo le
funzioni che richiedono il database (stanze online, accesso, amici, voti, suggerimenti).

### Vederlo dal telefono

Con il computer e il telefono sulla stessa Wi-Fi, all'avvio il terminale stampa due indirizzi:
uno `Local` e uno `Network`, tipo `http://192.168.1.124:3000`. Basta aprire quello dal telefono.

La configurazione in `next.config.ts` rileva da sola gli indirizzi di rete della macchina e li
autorizza: senza quella riga Next, in sviluppo, blocca i file JavaScript quando la pagina viene
aperta da un indirizzo diverso da `localhost`, e il sito si vede a metà.

Se la Wi-Fi isola i dispositivi fra loro (capita sulle reti condivise) il telefono non raggiunge
il computer: in quel caso serve un indirizzo pubblico, come spiegato qui sotto.

### Giocare da reti diverse o da connessione dati

Da un'altra rete il telefono non può raggiungere il computer di casa: è una regola di rete, non
un difetto dell'app. Servono un indirizzo pubblico e un server raggiungibile. Tre strade, dalla
più rapida alla più solida.

**1. Tunnel temporaneo, per provare subito.** Con il sito già avviato (`npm run dev`), in un
secondo terminale:

```bash
npx cloudflared tunnel --url http://localhost:3000
```

Stampa un indirizzo `https://qualcosa.trycloudflare.com` che funziona da qualsiasi rete, anche in
4G. Vive finché il comando resta aperto, e mentre è attivo il computer è raggiungibile da
internet: va chiuso quando non serve più. Gli indirizzi dei tunnel sono già autorizzati nella
configurazione, quindi la pagina si carica intera.

**2. Pubblicazione su un host sempre attivo** (Render, Railway, Fly, un server proprio): il canale
delle stanze funziona senza altro, perché resta un processo acceso.

**3. Pubblicazione su Vercel più database**: su Vercel le funzioni sono separate fra loro e non
condividono memoria, quindi le stanze vanno appoggiate al database. È la strada consigliata per
un uso vero e continuativo.

### Comandi disponibili

| Comando | Cosa fa |
| --- | --- |
| `npm run dev` | avvia in sviluppo con ricarica automatica |
| `npm run build` | compila la versione di produzione |
| `npm run start` | serve la versione compilata |
| `npm run lint` | controlla stile e regole del codice |
| `npm run check:engine` | esegue 63 verifiche automatiche su regole d'asta e cataloghi |
| `npm run check:multiplayer` | prova una stanza online completa fra due partecipanti |
| `npm run check:rooms` | prova il canale del server con due dispositivi collegati |
| `npm run check:images` | verifica il filtro che scarta le foto non pertinenti |
| `npm run check:photos` | controlla che tutte le foto del catalogo rispondano ancora |
| `npm run check:layout` | verifica che nessuna pagina sbordi in orizzontale su telefono |
| `npm run docs:pdf` | rigenera `docs/Guida-Pick-and-Pay.pdf` da `docs/guida.html` |
| `npm run images:fetch` | riempie le liste con le foto (si può interrompere e riprendere) |
| `npm run images:sheet` | crea `public/_review.html`: tutte le foto in griglia per guardarle a occhio |
| `node scripts/fetch-images.js <categoria> --hinted` | rifà solo gli elementi con abbinamento in `data/image-hints.json` |
| `node scripts/probe-images.js "commons:<ricerca>"` | prova una ricerca prima di metterla fra gli abbinamenti |
| `npm run share` | apre un indirizzo pubblico temporaneo per provare da rete dati |

---

## 3. Struttura delle cartelle

```
app/                        pagine e rotte
  page.tsx                    home
  create/                     configurazione partita
  room/[code]/                stanza di gioco
  categories/                 elenco, editor e categorie condivise
  studio/                     gestione liste (solo creatore)
  pickmates/                  Pickmates, sfide e draft ricevuti
  vote/[id]/                  votazione pubblica dei draft
components/ui/              bottoni, badge, input, modali, navbar, menu
components/game/            asta, timer, controlli offerta, card finale, editor liste
lib/                        motore di gioco, realtime, catalogo, immagini, accesso, amici
lib/i18n/                   dizionari delle 10 lingue
data/categories.json        33 liste ufficiali (30 elementi, 20 per le regioni)
scripts/engine-check.js     verifiche automatiche del motore
supabase/schema.sql         schema del database con tutte le policy
public/logo.svg             marchio dell'app
```

---

## 4. Che cos'è il gioco

Asta dal vivo a budget fisso. Ogni giocatore parte con gli stessi crediti (20 di default), gli
elementi della categoria escono uno alla volta e si rilancia a tempo. Alla fine ognuno ha la sua
lista e si genera una card verticale 9:16 da postare, più un link per far votare il roster
migliore.

### Regolamento applicato dal motore

- **Budget**: uguale per tutti, configurabile (10, 20, 50, 100 o valore libero) in €, $, £ o ¥.
- **Prezzo di apertura**: ogni elemento parte da 1 a 5 crediti a seconda di quanto è ambito. Il
  prezzo si vede in asta quando il lotto esce; le **fasce non compaiono più** nell'interfaccia,
  perché sapere che una lista ha trenta elementi è utile, sapere come sono divisi per prezzo no.
  Sotto il nome di ogni categoria c'è il numero di elementi.
- **Asta**: 15 secondi per lotto, riportati a 10 dopo ogni rilancio. Rilanci +1, +2, +5 e
  pulsante Max.
- **Anti-sniping**: siccome ogni rilancio riporta il timer a 10 secondi, un'offerta all'ultimo
  istante lascia sempre agli altri il tempo di rispondere; quando succede compare l'avviso.
- **Passa**: chi passa esce da quel lotto e non può rientrarci. Se resta un solo giocatore in
  corsa, il lotto è suo.
- **Riserva obbligatoria**: si tiene sempre un credito per ogni slot ancora vuoto. Con 3 elementi
  mancanti non si può scendere sotto 3 crediti, quindi nessuno resta bloccato con la lista a metà.
- **Lotti finali**: se rimane un solo giocatore da completare e i lotti bastano appena, gli
  vengono assegnati d'ufficio al prezzo base.
- **Scarti**: l'host decide prima di iniziare. Attivi, un lotto senza offerte viene messo da parte;
  disattivati, viene assegnato a chi ha meno elementi.
- **Varianti**: *Blind Draft* (nome e immagine nascosti fino all'assegnazione, poi lo svelamento) e *Mystery Box* (ogni 5
  lotti una scatola a prezzo fisso con elemento casuale).

Tutte queste regole sono verificate da `npm run check:engine`.

---

## 5. Cosa è stato costruito

### Partita
- Due modalità: **locale** su un solo dispositivo, oppure **online** con codice stanza di 5
  caratteri (lettere e numeri, senza caratteri ambigui), copiabile con un tocco e con QR di
  accesso rapido.
- Schermata d'asta con immagine grande al centro, titolo sotto, prezzo e ultimo rilancio in
  evidenza, clessidra animata con ticchettio negli ultimi 5 secondi.
- Pannello per ogni giocatore con budget, slot occupati, inventario in miniatura, e i comandi
  Rilancia / Max / Passa fissati in basso sul telefono.
- Alone verde pulsante su chi sta vincendo il lotto. Sotto l'immagine non c'è più la cronologia
  delle offerte: rubava spazio all'elemento in asta senza aggiungere niente di utile.
- Effetti sonori sintetizzati (nessun file audio da scaricare) e vibrazione dove supportata.

### Categorie
- **33 liste ufficiali** da 30 elementi (le Regioni Italiane ne hanno 20, quante sono davvero):
  burger, best feelings, Pixar, social, Marvel, superpoteri, drink, snack, pizze, giochi da tavolo,
  videogiochi, giochi mobile, Clash Royale, calcio, sport, artisti musicali, app, capitali europee,
  città italiane, città americane, regioni italiane, beach, colazione, fast food, dolci, anime,
  cartoni, serie TV, meme, duo iconici, scuse per non uscire, momenti cringe, isola deserta.
- Pagina categorie con il **numero di elementi** sotto ogni nome, **ricerca istantanea**
  (cerca anche dentro gli elementi) e **filtri per tema** (Sport, Pop Culture, Gaming, Cibo,
  Vita quotidiana).
- **Studio** riservato al creatore: apre qualsiasi lista, modifica emoji, nomi e immagini elemento
  per elemento, salva sul dispositivo ed esporta il JSON o la query SQL già pronta.

### Immagini
- Le liste ufficiali hanno le **foto già fissate** dentro `data/categories.json`: arrivano da
  Wikipedia e non dipendono da alcuna ricerca durante la partita. Si aggiornano con
  `npm run images:fetch`, che riprende da dove si era interrotto.
- **Abbinamenti a mano** in `data/image-hints.json`: ogni elemento che la ricerca automatica non
  trova ha una fonte scelta da noi, e ognuna è l'archivio ufficiale del suo mondo.

  | Come si scrive | Da dove prende la foto |
  | --- | --- |
  | `commons:doccia calda` | Wikimedia Commons, per le cose comuni senza voce enciclopedica |
  | `it:Atletica leggera` / `en:Rick Astley` | la voce di Wikipedia con quel titolo esatto |
  | `fandom:clashroyale/Mega Knight` | il wiki dei fan: carte di un gioco, personaggi dei fumetti |
  | `itunes:Fortnite` | l'icona ufficiale dall'App Store (prima il negozio italiano, poi quello USA) |
  | `steam:1245620` | la copertina del gioco su Steam (il numero è quello nell'indirizzo) |
  | `tvmaze:Suits` | la locandina della serie televisiva |
  | `imgflip:Distracted Boyfriend` | il template originale del meme |

  Il file si legge e si corregge a mano: dopo averlo modificato basta
  `node scripts/fetch-images.js <categoria> --hinted` per rifare solo quegli elementi.
- **Tutti gli elementi hanno la foto** tranne uno, "Niente" a colazione, che di proposito mostra la
  sua icona. `npm run check:photos` le interroga una per una, segnala quelle che non rispondono più
  e quelle usate da due elementi; `npm run images:sheet` le mette tutte in griglia su una pagina,
  per controllare a occhio che l'immagine sia davvero quella giusta.
- Tre regole imparate controllando le foto una per una, e ora applicate dallo script:
  - **niente stemmi, cartine e firme**: per una città vogliamo il panorama, non il puntino sulla
    mappa d'Italia o lo stemma della squadra di calcio; per un cantante la foto, non l'autografo;
  - **niente foto ripetute** dentro la stessa categoria: quando la ricerca non trova la variante
    ("pizza ortolana") e ripiegherebbe su una foto generica già usata, passa al candidato dopo;
  - **il nome del file deve contenere le parole cercate**, altrimenti la foto viene scartata: è così
    che si evitano gli scambi di persona ("Monopoli" la città, "Scarabeo" lo scooter).
- Le foto non stanno nel progetto: sono indirizzi verso gli archivi di origine. Se un giorno una
  sparisce, la scheda torna a mostrare la propria icona e il gioco non si rompe.
- **Da sapere prima di pubblicare**: le foto di Wikipedia e Wikimedia Commons hanno licenze libere
  (spesso con obbligo di citare l'autore), mentre le carte di Clash Royale, le icone delle app, le
  copertine dei giochi, le locandine delle serie e i template dei meme restano dei rispettivi
  proprietari: qui sono richiamate dal loro sito, come fa un qualsiasi collegamento. Per un gioco
  fra amici va bene; se un domani il sito diventa un prodotto a pagamento, quelle immagini vanno
  sostituite o autorizzate.
- **Filtro di pertinenza**: una foto trovata online viene accettata solo se il titolo della pagina
  corrisponde davvero al nome cercato. "Up" prende *Up (film 2009)* e non *Upload*, "Snake" non
  diventa *Snake River*, "Smash Burger" non diventa *Hamburger*. Se nessun risultato è pertinente
  resta l'icona: meglio nessuna foto che una sbagliata.
- Nello **Studio** la ricerca mostra fino a sei candidati con titolo e anteprima: si sceglie
  quello giusto con un clic, e i risultati poco attinenti sono segnalati. C'è anche il campo per
  incollare un indirizzo e il pulsante per togliere una foto. Le scelte fatte qui valgono sempre e
  finiscono nel file dati con "Esporta JSON".
- Nel menu c'è l'interruttore **Foto automatiche**, spento di default: acceso, l'app cerca da sola
  una foto per gli elementi che non ne hanno, sempre passando dal filtro di pertinenza.

### Fine partita
- Card verticale **1080x1920** con roster raggruppato per fascia, badge dorato del prezzo pagato
  su ogni miniatura, budget residuo e QR del voto. Si scarica in PNG o si condivide con il menu
  nativo del telefono.
- **Votazione pubblica**: si genera un link (`/vote/...`) da mandare a chi vuole, un voto per
  dispositivo, nessuna registrazione.

### Account e amici
- **Registrazione e accesso con email e password**, in due schede dentro la stessa finestra.
  In registrazione si scelgono nickname e avatar, con il controllo di disponibilità mentre si
  scrive; c'è anche il recupero password. Le password vanno al servizio di autenticazione, che le
  conserva cifrate: l'app non le salva né le vede mai in chiaro.
- **Password con quattro requisiti obbligatori**, controllati mentre si scrive: almeno 8 caratteri,
  una maiuscola, un numero e un carattere speciale fra `!@#$%^&*`. Sotto il campo ci sono le quattro
  spunte che si accendono di verde una alla volta, e finché non sono tutte verdi il pulsante
  "Registrati" resta spento. Lo stesso controllo viene rifatto prima dell'invio, così una password
  debole non parte nemmeno.
- Il **nickname è unico**: lo garantiscono il controllo prima dell'invio e un vincolo del
  database che accetta solo minuscole, cifre e underscore, così "Marco" e "marco" non convivono.
- Senza database si può comunque creare un **profilo su questo dispositivo** e giocare subito.

### Pickmates
La rubrica degli amici con cui si gioca, in `/pickmates`, divisa in due schede: *I miei Pickmates*
e *Draft ricevuti*.

- **Tre modi per trovare qualcuno**: per **nickname** (basta un pezzo del nome), per **email**
  esatta, oppure scegliendo fra i **Pickmates recenti**, cioè chi si è incontrato nelle ultime
  partite: lì si aggiungono con un tocco.
- Accanto a ogni Pickmate c'è **quante sfide avete giocato insieme**: il conteggio cresce da solo a
  fine partita, per chi in stanza aveva fatto l'accesso.
- **Sfida**: dalla lista si manda l'invito a entrare nella stanza aperta. Arriva all'altro come
  notifica, con una battuta a sorte fra otto.
- Si continuano a mandare i propri draft agli amici perché li votino.
- I **suggerimenti di categoria** arrivano solo da chi ha fatto l'accesso.

### Notifiche dal vivo
La campanella in navbar compare a chi ha fatto l'accesso e ascolta il canale realtime del database:
quando qualcuno scrive una riga che ti riguarda, l'avviso arriva senza ricaricare la pagina.

| Notifica | Cosa mostra | Pulsanti |
| --- | --- | --- |
| Richiesta Pickmate | chi ti ha invitato | Accetta · Rifiuta |
| Sfida in arrivo | chi ti sfida, il codice stanza e una battuta a sorte | Entra nella stanza · Ignora |

### Scheda del creatore
Dal menu (voce con la corona) e dal piè di pagina della home: avatar con il badge "Creatore",
nome e qualifica, la visione del progetto, i collegamenti social (Instagram con i suoi colori, X,
GitHub, donazioni), la versione dell'app con le ultime novità e il pulsante per mandare un
suggerimento, che legge solo il creatore.

### Contorno
- **10 lingue** (italiano, inglese, francese, spagnolo, tedesco, portoghese, russo, cinese,
  giapponese, arabo con layout da destra a sinistra), tema chiaro/scuro, audio attivabile.
- **Voto del gioco** da 1 a 5 stelle con commento facoltativo, anonimo.
- Sezione **sostegno al progetto** con rimando a Revolut. Nessun dato di pagamento passa dall'app.
- **Modalità creatore**: sul proprio computer è già aperta, non serve inventarsi nulla. La chiave
  la si sceglie solo quando il sito va online, scrivendola in `NEXT_PUBLIC_ADMIN_KEY`: da quel
  momento Studio ed editor li vede solo chi la conosce.
- **Avatar a icone**: i profili usano icone vettoriali (fiamma, fulmine, corona, scudo, joypad,
  teschio, coppa, fantasma, gemma) al posto delle emoji, così non esiste alcun rischio di
  caratteri corrotti fra dispositivi e file di dati.
- **Installazione sulla schermata Home**: su telefono compare una striscia in basso e nel menu c'è
  la voce dedicata, con istruzioni passo passo separate per iPhone/iPad e Android. Dove il browser
  lo permette (Android) l'installazione parte con un solo tocco.

---

## 6. Cosa funziona senza database, e cosa aggiunge

L'app non si blocca mai: quando le chiavi del database mancano, ogni funzione ha una via locale.

| Funzione | Senza database | Con database |
| --- | --- | --- |
| Partita locale | completa | completa |
| Stanza online fra dispositivi | dal server dell'app | dai canali del database |
| Profilo | nickname e avatar su questo dispositivo | account con email e password |
| Amici Pickmates | non disponibile | completa |
| Voto del gioco | salvato sul dispositivo | arriva al creatore |
| Suggerimenti | salvati sul dispositivo | arrivano al creatore |
| Link di voto dei draft | non disponibile | link e QR condivisibili |

### Come viaggiano le stanze online

L'app sceglie da sola il canale migliore fra i tre disponibili:

1. **Database** (se configurato): il più solido. Funziona ovunque e regge il riavvio del sito.
2. **Server dell'app**: due indirizzi, `/api/rooms/[codice]/stream` per ricevere e
   `/api/rooms/[codice]/message` per inviare. Tutti i dispositivi che raggiungono il server
   giocano insieme: sulla stessa Wi-Fi usando l'indirizzo di rete del computer, oppure da reti
   qualsiasi quando il sito è pubblicato. Le stanze vivono nella memoria del server, quindi si
   azzerano se il server si riavvia.
3. **Solo browser**: ultimo ripiego, sincronizza schede e finestre dello stesso computer.

In alto nella stanza c'è sempre scritto quale canale è in uso.

> Una nota per la pubblicazione: il canale del server ha bisogno di un processo sempre attivo
> (Railway, Render, Fly, un server proprio). Su hosting a funzioni separate come Vercel le stanze
> vanno collegate al database, che è la strada consigliata comunque.

## 7. Configurazione del database (facoltativa)

Serve per: stanze fra dispositivi, accesso via email, amici, votazioni, suggerimenti, liste
pubblicate.

1. Crea un progetto gratuito su [supabase.com](https://supabase.com).
2. Copia `.env.example` in `.env.local` e riempi:

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
NEXT_PUBLIC_SITE_URL=https://iltuodominio
NEXT_PUBLIC_ADMIN_KEY=la-parola-che-scegli-tu
NEXT_PUBLIC_INSTAGRAM_URL=https://instagram.com/tuoprofilo
NEXT_PUBLIC_REVOLUT_USER=tuoutente
```

3. Apri l'**SQL editor** di Supabase ed esegui tutto il contenuto di `supabase/schema.sql`:
   crea le tabelle `categories`, `suggestions`, `results`, `votes`, `feedback`, `official_lists`,
   `profiles`, `pickmates`, `recent_opponents`, `challenges`, `profile_emails`, `shared_results`
   con le rispettive regole di accesso. Lo script si può rieseguire quando serve: aggiorna quello
   che manca e travasa da solo la vecchia tabella `friendships` in `pickmates`.
   Due note sul perché è fatto così:
   - le **email** non stanno in `profiles` ma in una tabella a parte che legge solo il proprietario;
     la ricerca passa da una funzione che accetta solo l'indirizzo esatto, quindi nessuno può
     scorrere l'elenco degli iscritti;
   - `pickmates` e `challenges` vengono aggiunte alla pubblicazione realtime: è da lì che arrivano
     le notifiche senza ricaricare la pagina.
4. **Authentication → URL Configuration**: metti il dominio in *Site URL* e aggiungi
   `http://localhost:3000/pickmates` e `https://iltuodominio/pickmates` fra le *Redirect URLs*.
5. Facoltativo: in **Authentication → Email Templates → Magic Link** aggiungi `{{ .Token }}` per
   far arrivare anche il codice a 6 cifre.

### Sicurezza dei dati

- Le liste ufficiali sul database sono **in sola lettura** per l'app: si aggiungono solo
  dall'SQL editor (lo Studio prepara la query da incollare). Nessun utente può inserirle.
- I commenti del voto non sono leggibili pubblicamente: la vista `ratings_summary` espone solo
  media e numero di voti.
- Amicizie e draft condivisi sono visibili solo alle persone coinvolte.
- La modalità creatore protegge l'interfaccia; la vera protezione dei dati sta nelle regole del
  database.

---

## 8. Pubblicare il sito

Il modo più semplice è **Vercel**: è di chi fa Next.js, il piano gratuito basta e si aggiorna da
solo a ogni `git push`. Il sito è già pronto per andare online: mancano solo le chiavi.

### Prima di pubblicare: il database
Le stanze online stabili, la registrazione, i Pickmates e le notifiche hanno bisogno di Supabase.
Va fatto **prima**, e provato in locale una volta:

1. Crea un progetto gratuito su [supabase.com](https://supabase.com).
2. In *Project Settings → API* copia **Project URL** e **anon public key**.
3. Mettile in `.env.local` (copiando `.env.example`) e riavvia `npm run dev`.
4. Nell'**SQL editor** esegui tutto `supabase/schema.sql`.
5. Prova a **registrarti** dal sito in locale: se il profilo compare in `/pickmates`, è tutto a posto.

### Poi la pubblicazione
1. Vai su [vercel.com](https://vercel.com) e accedi **con GitHub**.
2. *Add New → Project* e scegli il repository `draftgame`. Vercel riconosce Next.js da solo:
   non toccare nulla dei comandi di build.
3. Apri **Environment Variables** e incolla le stesse righe di `.env.local`:
   `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SITE_URL`
   (l'indirizzo che ti darà Vercel), `NEXT_PUBLIC_ADMIN_KEY` (la parola che scegli tu),
   e se vuoi `NEXT_PUBLIC_INSTAGRAM_URL` e `NEXT_PUBLIC_REVOLUT_USER`.
4. **Deploy**. Dopo un paio di minuti hai un indirizzo tipo `pick-and-pay.vercel.app`.
5. Torna su Supabase, *Authentication → URL Configuration*: metti quell'indirizzo in **Site URL** e
   aggiungi `https://tuo-indirizzo.vercel.app/pickmates` fra le **Redirect URLs**. Senza questo
   passaggio il link di conferma dell'email riporta a `localhost` e la registrazione non si chiude.
6. Da quel momento ogni `git push` ripubblica il sito da solo.

### Dopo la pubblicazione, in cinque minuti
- Apri il sito dal telefono e fai una **partita locale**: deve funzionare senza altro.
- **Registrati** con un'email vera e controlla che arrivi la mail di conferma.
- Crea una **stanza online**, entra dal secondo telefono con il codice o il QR e verifica che
  offerte e timer si muovano insieme.
- Manda il link su WhatsApp: deve comparire l'anteprima con il logo (`public/og.png`).
- Aggiungi il sito alla schermata Home dal menu, per provare l'installazione.

### Un dominio tuo (facoltativo)
Comprato il dominio, in Vercel *Settings → Domains* lo si aggiunge e si seguono le due righe DNS
indicate. Poi si aggiorna `NEXT_PUBLIC_SITE_URL` e la Site URL su Supabase.

---

## 9. Verifiche automatiche

`npm run check:engine` compila il motore ed esegue i controlli su: distribuzione delle fasce,
unicità degli identificativi, apertura dell'asta, rilanci, aggiudicazione per tempo scaduto o per
abbandono, scarti, riserva di budget, assegnazione dei lotti finali, Mystery Box, chiusura della
partita e formato del codice stanza. Tutti superati.

Insieme a `npm run lint` e `npm run build` sono i tre comandi da lanciare prima di pubblicare.

---

## 10. Stato del lavoro e limiti noti

**Funziona senza configurazione**: partita locale, tutte le 26 categorie, regole complete, card
9:16 scaricabile, lingue, temi, audio.

**Richiede Supabase**: stanze online, accesso, Pickmates, votazioni, suggerimenti, voto a stelle,
liste pubblicate sul database.

Da sapere:

1. **Accesso non provato dall'inizio alla fine**: il codice compila e le pagine rispondono, ma il
   giro completo dell'email richiede un progetto Supabase reale, che va creato.
2. **Immagini da Wikipedia**: le licenze variano da foto a foto. Prima di pubblicare conviene
   verificarle, oppure inserire URL propri dallo Studio.
3. **Traduzioni**: italiano e inglese sono completi; le altre otto lingue coprono quasi tutto e
   per le voci più recenti ripiegano sull'inglese.
4. **Logo**: `public/logo.svg` è una versione vettoriale del marchio. Sostituendo quel file cambia
   ovunque.
5. **Emoji bandiera**: Windows non ha i glifi delle bandiere e le mostra come sigle ("IT", "GB").
   Per questo nei cataloghi si usano monumenti e simboli; le bandiere restano solo nel selettore
   della lingua, dove su telefono si vedono correttamente.

---

## 11. Dove guardare il codice

| Domanda | File |
| --- | --- |
| Come funziona l'asta | `lib/game.ts` |
| Come si sincronizzano i dispositivi | `lib/realtime.ts` |
| Da dove arrivano le liste | `data/categories.json` e `lib/catalog.ts` |
| Come si risolvono le immagini | `lib/images.ts` |
| Accesso e amici | `lib/auth.ts`, `lib/friends.ts` |
| Schermata d'asta | `components/game/AuctionStage.tsx` |
| Card finale | `components/game/TikTokCard.tsx` |
| Regole del database | `supabase/schema.sql` |

Il regolamento completo e le decisioni prese in fase di sviluppo sono in
[`PROJECT_SPECS.md`](./PROJECT_SPECS.md).
