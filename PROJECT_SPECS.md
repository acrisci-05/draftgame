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
  Il totale coerente con 25 elementi è 5 per ogni tier, quindi il catalogo e il validatore
  dell'editor richiedono 5 elementi per ciascuna delle 5 fasce (5x5 = 25).
- Apertura dell'asta: finché nessuno ha offerto, i tre pulsanti valgono come offerta secca
  di $1 / $2 / $5 (l'asta parte da $1). Dopo la prima offerta diventano rilanci +$1 / +$2 / +$5
  sul prezzo corrente.
- Il giocatore che detiene l'offerta più alta non può rilanciare contro se stesso nè passare.
- Un giocatore il cui saldo non copre la prossima offerta minima è considerato fuori dal round
  e non viene conteggiato nella condizione "tutti tranne uno hanno passato".
- Modalità stanza locale: partita su singolo dispositivo (pass-and-play), non richiede Supabase.
  Modalità online: stanza con codice di 4 lettere sincronizzata via Supabase Realtime Channels,
  con il dispositivo che ha creato la stanza come autorità sullo stato e sul timer.
