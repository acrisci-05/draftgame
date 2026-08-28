# $20 DRAFT GAME — PROJECT SPECS

======================================================================
1. REGOLAMENTO DETTAGLIATO E LOGICA DI GIOCO ($20 DRAFT GAME)
======================================================================
- Partecipanti: Da 2 a 8 giocatori per stanza (stanza locale o via codice di 4 lettere).
- Budget: Ogni giocatore parte con un saldo iniziale fisso di $20.
- Catalogo Categoria (Tier List):
  - Ogni categoria contiene 25 elementi distribuiti su 5 fasce di valore teorico:
    * Tier 5: 5 elementi da $5 (i Top / Favoriti)
    * Tier 4: 5 elementi da $4
    * Tier 3: 5 elementi da $3
    * Tier 2: 2 elementi da $2
    * Tier 1: 5 elementi da $1 (le Scelte Economy / Nicchia)
- Meccanica dell'Asta Live:
  1. Estrazione: Il sistema propone un elemento casuale dal catalogo.
  2. Offerta Iniziale: L'asta parte da $1.
  3. Controlli Rilancio: Un giocatore può rilanciare (+$1, +$2, +$5) SOLO SE il suo (Saldo Attuale - Offerta) >= 0.
  4. Timer: 15 secondi a turno per elemento. Ogni rilancio resetta il timer a 10 secondi.
  5. Pulsante "Passa": Se un giocatore clicca "Passa", rinuncia a quell'elemento per il round corrente.
  6. Aggiudicazione: L'asta termina quando il timer scade oppure quando tutti i giocatori tranne uno hanno premuto "Passa".
  7. Assegnazione: L'elemento entra nel "Roster" del vincitore e l'importo viene detratto dal suo budget. Se nessuno offre, l'elemento viene inviato agli scarti.
- Fine Partita & Valutazione:
  - Il gioco termina quando tutti gli elementi sono stati battuti o i giocatori hanno esaurito i budget.
  - Generazione automatica di una scheda riassuntiva visuale.

======================================================================
2. REQUISITI ED ENGINE DI ESPORTAZIONE TIKTOK (FORMATO 9:16)
======================================================================
- Componente `TikTokCard.tsx`:
  - Canvas a risoluzione proporzionale 9:16 (es. 1080x1920 px scalato per mobile).
  - Dark Mode Neon Layout: Sfondo nero (#09090b), dettagli verde neon (#22c55e) e viola accentati.
  - Contenuto visuale:
    * Header con Titolo della Stanza e Nome Categoria.
    * Griglie individuali dei giocatori con le carte/nomi degli elementi acquistati.
    * Badge indicante il budget residuo per ciascun giocatore.
  - Funzionalità: Pulsante "Scarica Immagine" che usa `html-to-image` per esportare la card direttamente in PNG nella galleria del dispositivo.

======================================================================
3. EDITOR PERMITTIVO DI CATEGORIE CUSTOM
======================================================================
- Form no-code per permettere agli utenti di creare cataloghi personalizzati.
- Campi richiesti: Nome Categoria, Icona/Emoji, e inserimento degli elementi ripartiti nei 5 Tier di prezzo ($5, $4, $3, $2, $1).
- Salvataggio locale in `localStorage` e su database Supabase per la condivisione tramite link univoco.

======================================================================
4. TECH STACK & STRUTTURA DEL CODICE
======================================================================
- Framework: Next.js (App Router, TypeScript).
- Styling: Tailwind CSS + Framer Motion per micro-interazioni e animazioni dell'asta.
- Icone: Lucide React.
- State Management & Realtime: Supabase Realtime Channels (per sincronizzare offerte, timer e budget tra gli smartphone collegati alla stanza).
- Rendering Grafico: `html-to-image`.

======================================================================
5. REGOLE TASSATIVE DI SVILUPPO (ANONIMATO E PULIZIA)
======================================================================
- NON inserire riferimenti ad assistenti virtuali in nessun file di progetto, commento al codice, file markdown, package.json o messaggio di commit Git.
- Struttura cartelle pulita: `/app` (pagine e rotte), `/components/ui` (bottoni, modali), `/components/game` (asta, timer, card finale), `/lib` (logica realtime e utility).

======================================================================
6. NOTE IMPLEMENTATIVE (DECISIONI PRESE IN FASE DI BUILD)
======================================================================
- Distribuzione dei tier: la specifica indica 25 elementi totali ma elenca "Tier 2: 2 elementi".
  Per avere fasce simmetriche e liste più ricche ogni categoria usa 6 elementi per fascia
  (6x5 = 30): il catalogo ufficiale e il validatore dell'editor richiedono questo conteggio.
- Budget e valuta sono configurabili in lobby (default 20, EUR/USD/GBP/JPY): il valore delle fasce
  resta 5/4/3/2/1 e l'offerta di apertura resta 1.
- Apertura dell'asta: finché nessuno ha offerto, i tre pulsanti valgono come offerta secca
  di $1 / $2 / $5 (l'asta parte da $1). Dopo la prima offerta diventano rilanci +$1 / +$2 / +$5
  sul prezzo corrente.
- Il giocatore che detiene l'offerta più alta non può rilanciare contro se stesso nè passare.
- Un giocatore il cui saldo non copre la prossima offerta minima è considerato fuori dal round
  e non viene conteggiato nella condizione "tutti tranne uno hanno passato".
- Modalità stanza locale: partita su singolo dispositivo (pass-and-play), non richiede Supabase.
  Modalità online: stanza con codice di 5 caratteri (lettere e numeri, senza O/0/I/1/L)
  sincronizzata via Supabase Realtime Channels, con il dispositivo che ha creato la stanza come
  autorità sullo stato e sul timer. Il codice si copia con un tocco e ha il QR di accesso rapido.
- Varianti opzionali attivabili in lobby: Blind Draft (cover sfocata fino all'aggiudicazione) e
  Mystery Box (ogni 5 lotti una box a prezzo fisso con elemento casuale).
- Fine partita: oltre alla card 9:16 si può pubblicare il risultato e ottenere un link di voto
  (un voto per dispositivo, nessuna registrazione). Richiede Supabase.
- Interfaccia disponibile in 10 lingue (it, en, fr, es, de, pt, ru, zh, ja, ar) con selettore in
  home e nel menu; la preferenza resta sul dispositivo e l'arabo attiva il layout RTL.
  Le categorie ufficiali hanno nome italiano e inglese: le altre lingue usano quello inglese.
- Sostegno al progetto: sezione dedicata nel menu con importi predefiniti (5, 10, 20, 30, 40, 50,
  100 euro) o importo libero e rimando a Revolut; lo spazio per PayPal si attiva impostando
  NEXT_PUBLIC_PAYPAL_USER. Nessun dato di pagamento viene gestito dall'app.

======================================================================
7. NOME UFFICIALE, INTERFACCIA E GESTIONE DELLE LISTE
======================================================================
- Nome ufficiale: "Pick & Pay - The Draft Game". Marchio in `public/logo.svg` (versione vettoriale
  del logo al neon): sostituendo quel file cambia il logo in navbar, home e scheda del browser.
- Home: una sola macro-card con logo, titolo in gradiente verde-ciano, profilo giocatore e due sole
  azioni, "Crea partita" (verde) e "Unisciti con codice" (viola, modal con input a 5 caratteri).
  "Come funziona" e il sostegno al progetto restano in fondo come sezioni discrete.
- Configurazione stanza su pagina dedicata (/create): modalità Locale (1 dispositivo) oppure Online
  (più dispositivi), categoria, budget con preset rapidi, valuta, giocatori, slot, Blind Draft,
  Mystery Box. Le stesse regole restano modificabili in lobby da chi ospita.
- Navbar: bandiera della lingua (modal a pillole con le 10 lingue), tema, audio e menu hamburger.
  Il drawer usa effetto vetro, voci con freccia e un solo box donazioni con badge "Sostieni con €2".
- Fasce mostrate come tier visivi con badge colorati (S/A/B/C/D più il valore) al posto dei
  conteggi tipo "1/6".
- Asta: immagine grande dell'elemento al centro, titolo sotto, prezzo e ultimo rilancio in evidenza,
  clessidra animata con ticchettio sotto i 5 secondi, feed delle offerte, pannello per giocatore con
  Rilancia/Passa, budget, slot e inventario in miniatura. Vibrazione a ogni offerta dove supportata.
- Anti-sniping: ogni rilancio riporta il timer a 10 secondi, quindi un'offerta all'ultimo istante
  lascia sempre tempo di rispondere; quando succede compare l'avviso dedicato.
- Liste ufficiali: 22 categorie a nomi corti con emoji di copertina per ogni elemento, definite in
  `data/categories.json`. Si modificano a mano nel file oppure dallo Studio (/studio), che salva le
  modifiche sul dispositivo ed esporta il JSON pronto da incollare nel file dati.
- Ogni elemento accetta anche l'URL di un'immagine: se presente sostituisce la copertina generata.

======================================================================
8. ECONOMIA DELL'ASTA, SCARTI E PAGINA CATEGORIE
======================================================================
- Riserva obbligatoria: l'offerta massima è "saldo - (slot ancora vuoti - 1)". Nessuno può quindi
  arrivare a zero con la lista incompleta: se mancano 3 elementi il saldo non scende sotto 3.
- Pulsante Max: offre esattamente il tetto consentito dalla riserva, senza rilanci ripetuti.
- Lotti finali: se resta un solo giocatore da completare e i lotti bastano appena, gli vengono
  assegnati d'ufficio al prezzo base, così la lista si chiude sempre.
- Scarti: interruttore in configurazione stanza. Attivi (default) un lotto senza offerte finisce
  negli scarti; disattivati viene assegnato a chi ha meno elementi al prezzo base.
- Pagina categorie: legenda delle fasce (S/A/B/C/D con prezzo e significato), badge con tooltip al
  tocco o al passaggio del mouse, ricerca istantanea (nome categoria o elemento), filtri per
  macro-tema (Tutte, Sport, Pop Culture, Gaming, Cibo, Vita quotidiana) e schede interamente
  cliccabili con anteprima dei nomi principali.
- Asta: cronologia scorrevole e richiudibile sotto il lotto, alone pulsante su chi detiene
  l'offerta più alta, comandi fissi in fondo allo schermo su telefono (pulsanti da 48px o più).
- Card 9:16: roster raggruppato per fascia, dal 5 in alto all'1 in fondo, con badge dorato del
  prezzo pagato su ogni miniatura.
- Immagini reali: dallo Studio si cercano su Wikipedia (una alla volta o tutta la lista) e l'URL
  finisce nel file dati. Le licenze Wikimedia variano: prima di pubblicare vanno verificate.
- Le emoji bandiera non sono usate nei cataloghi: Windows non ha i glifi e le mostra come sigle
  ("IT", "GB"). Restano solo nel selettore della lingua, dove la sigla resta comunque leggibile.
