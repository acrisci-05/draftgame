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
il computer: in quel caso conviene pubblicare il sito, per esempio importando il repository su
Vercel, e usare l'indirizzo pubblico.

### Comandi disponibili

| Comando | Cosa fa |
| --- | --- |
| `npm run dev` | avvia in sviluppo con ricarica automatica |
| `npm run build` | compila la versione di produzione |
| `npm run start` | serve la versione compilata |
| `npm run lint` | controlla stile e regole del codice |
| `npm run check:engine` | esegue 63 verifiche automatiche su regole d'asta e cataloghi |

---

## 3. Struttura delle cartelle

```
app/                        pagine e rotte
  page.tsx                    home
  create/                     configurazione partita
  room/[code]/                stanza di gioco
  categories/                 elenco, editor e categorie condivise
  studio/                     gestione liste (solo creatore)
  pickpockets/                amici e draft ricevuti
  vote/[id]/                  votazione pubblica dei draft
components/ui/              bottoni, badge, input, modali, navbar, menu
components/game/            asta, timer, controlli offerta, card finale, editor liste
lib/                        motore di gioco, realtime, catalogo, immagini, accesso, amici
lib/i18n/                   dizionari delle 10 lingue
data/categories.json        26 liste ufficiali da 30 elementi
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
- **Fasce di valore**: ogni lista ha 30 elementi divisi in 5 fasce da 5 a 1 crediti,
  mostrate come tier **S, A, B, C, D** con badge colorati e prezzo base.
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
- **Varianti**: *Blind Draft* (immagine coperta fino all'assegnazione) e *Mystery Box* (ogni 5
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
- Cronologia delle offerte richiudibile sotto il lotto e alone verde pulsante su chi sta vincendo.
- Effetti sonori sintetizzati (nessun file audio da scaricare) e vibrazione dove supportata.

### Categorie
- **26 liste ufficiali** da 30 elementi con nomi corti ed emoji: burger, best feelings, Pixar,
  social, Marvel, superpoteri, drink, snack, pizze, giochi da tavolo, videogiochi, Clash Royale,
  calcio, sport, artisti musicali, app, capitali europee, città italiane, città americane, beach,
  colazione, fast food, anime, cartoni, serie TV, meme.
- Pagina categorie con **legenda delle fasce**, badge con prezzo al tocco, **ricerca istantanea**
  (cerca anche dentro gli elementi) e **filtri per tema** (Sport, Pop Culture, Gaming, Cibo,
  Vita quotidiana).
- **Studio** riservato al creatore: apre qualsiasi lista, modifica emoji, nomi e immagini elemento
  per elemento, salva sul dispositivo ed esporta il JSON o la query SQL già pronta.

### Immagini
- Ogni elemento può avere un URL immagine. Se manca, l'app cerca da sola una foto pertinente su
  Wikipedia e la tiene in cache sul dispositivo.
- Se la ricerca non trova nulla si passa a un'immagine generica e, in ultima istanza, alla
  copertina con emoji dentro un badge. Nessun link da inserire a mano.

### Fine partita
- Card verticale **1080x1920** con roster raggruppato per fascia, badge dorato del prezzo pagato
  su ogni miniatura, budget residuo e QR del voto. Si scarica in PNG o si condivide con il menu
  nativo del telefono.
- **Votazione pubblica**: si genera un link (`/vote/...`) da mandare a chi vuole, un voto per
  dispositivo, nessuna registrazione.

### Account e amici
- **Accesso senza password**: si inserisce l'email e arriva il link di ingresso; se il template
  dell'email include il token, funziona anche il codice a 6 cifre. L'app non vede né conserva
  password.
- Al primo accesso si sceglie un **nickname pubblico** e un avatar.
- **Pickpockets**: rubrica amici per nickname, richieste da accettare, e invio dei propri draft
  agli amici perché li votino.
- I **suggerimenti di categoria** arrivano solo da chi ha fatto l'accesso.

### Contorno
- **10 lingue** (italiano, inglese, francese, spagnolo, tedesco, portoghese, russo, cinese,
  giapponese, arabo con layout da destra a sinistra), tema chiaro/scuro, audio attivabile.
- **Voto del gioco** da 1 a 5 stelle con commento facoltativo, anonimo.
- Sezione **sostegno al progetto** con rimando a Revolut. Nessun dato di pagamento passa dall'app.
- **Modalità creatore** protetta da chiave: solo chi la possiede vede Studio ed editor.
- **Avatar a icone**: i profili usano icone vettoriali (fiamma, fulmine, corona, scudo, joypad,
  teschio, coppa, fantasma, gemma) al posto delle emoji, così non esiste alcun rischio di
  caratteri corrotti fra dispositivi e file di dati.
- **Installazione sulla schermata Home**: su telefono compare una striscia in basso e nel menu c'è
  la voce dedicata, con istruzioni passo passo separate per iPhone/iPad e Android. Dove il browser
  lo permette (Android) l'installazione parte con un solo tocco.

---

## 6. Configurazione del database (facoltativa)

Serve per: stanze online, accesso, amici, votazioni, suggerimenti, liste pubblicate.

1. Crea un progetto gratuito su [supabase.com](https://supabase.com).
2. Copia `.env.example` in `.env.local` e riempi:

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
NEXT_PUBLIC_SITE_URL=https://iltuodominio
NEXT_PUBLIC_ADMIN_KEY=una-chiave-a-scelta
NEXT_PUBLIC_INSTAGRAM_URL=https://instagram.com/tuoprofilo
NEXT_PUBLIC_REVOLUT_USER=tuoutente
```

3. Apri l'**SQL editor** di Supabase ed esegui tutto il contenuto di `supabase/schema.sql`:
   crea le tabelle `categories`, `suggestions`, `results`, `votes`, `feedback`, `official_lists`,
   `profiles`, `friendships`, `shared_results` con le rispettive regole di accesso.
4. **Authentication → URL Configuration**: metti il dominio in *Site URL* e aggiungi
   `http://localhost:3000/pickpockets` e `https://iltuodominio/pickpockets` fra le *Redirect URLs*.
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

## 7. Verifiche automatiche

`npm run check:engine` compila il motore ed esegue **63 controlli**: distribuzione delle fasce,
unicità degli identificativi, apertura dell'asta, rilanci, aggiudicazione per tempo scaduto o per
abbandono, scarti, riserva di budget, assegnazione dei lotti finali, Mystery Box, chiusura della
partita e formato del codice stanza. Tutti superati.

Insieme a `npm run lint` e `npm run build` sono i tre comandi da lanciare prima di pubblicare.

---

## 8. Stato del lavoro e limiti noti

**Funziona senza configurazione**: partita locale, tutte le 26 categorie, regole complete, card
9:16 scaricabile, lingue, temi, audio.

**Richiede Supabase**: stanze online, accesso, Pickpockets, votazioni, suggerimenti, voto a stelle,
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

## 9. Dove guardare il codice

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
