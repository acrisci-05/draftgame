# Pick & Pay - The Draft Game

Asta live a budget fisso: ogni giocatore parte con lo stesso budget, gli elementi della categoria
escono a caso uno alla volta e vince chi costruisce il roster più forte. A fine partita l'app genera
una card verticale 9:16 pronta da postare e un link di voto per far decidere agli amici.

- **[GUIDA.md](./GUIDA.md)** — guida completa: tecnologie, avvio, funzioni, configurazione e limiti.
- **[PROJECT_SPECS.md](./PROJECT_SPECS.md)** — regolamento e decisioni prese in fase di sviluppo.

## Funzionalità

- **Asta live** con timer da 15 secondi per lotto, riportato a 10 dopo ogni rilancio.
- **Rilanci +1 / +2 / +5** abilitati solo quando il saldo li copre, più il pulsante "Passa".
- **Regole configurabili**: budget, valuta (EUR/USD/GBP/JPY), numero di giocatori ed elementi per
  roster, più le varianti Blind Draft e Mystery Box.
- **Anti-sniping**: ogni rilancio riporta il timer a 10 secondi, così l'ultimo secondo non decide.
- **Riserva di budget**: si tiene sempre un credito per ogni slot vuoto, nessuno resta a zero con la
  lista incompleta; i lotti finali vengono assegnati d'ufficio a chi deve ancora completare.
- **Scarti opzionali**: l'host decide se un lotto senza offerte finisce negli scarti o viene
  comunque assegnato.
- **Due modalità**: stanza locale sullo stesso dispositivo oppure stanza online con codice di 5
  caratteri (copia rapida e QR) sincronizzata via Supabase Realtime Channels.
- **Card 9:16** esportabile in PNG (1080x1920) con roster, budget residuo e QR del voto.
- **Votazione** senza registrazione: un voto per dispositivo sul link generato a fine partita.
- **Foto per tutti i 780 elementi**, fissate in `data/categories.json` e prese dall'archivio giusto
  per ognuno (Wikipedia, Wikimedia Commons, Fandom, App Store, Steam, TVmaze, Imgflip) secondo gli
  abbinamenti di `data/image-hints.json`. In partita non si cerca niente: gli indirizzi sono già lì.
- **26 liste ufficiali** a nomi corti con emoji di copertina, definite in `data/categories.json`,
  con ricerca istantanea e filtri per macro-tema nella pagina Categorie.
- **Modalità creatore**: Studio ed editor delle categorie sono già aperti in sviluppo; online li
  protegge la parola scelta in `NEXT_PUBLIC_ADMIN_KEY`.
- **Voto del gioco** da 1 a 5 stelle, anonimo, con commento facoltativo che legge solo il creatore.
- **Accesso senza password**: email con link (o codice a 6 cifre) e nickname pubblico.
- **Pickpockets** (`/pickpockets`): amici per nickname, richieste da accettare e draft mandati agli
  amici perché li votino.
- **Studio categorie** (`/studio`): vedi e modifica ogni lista elemento per elemento, cerca le foto
  reali su Wikipedia ed esporta il JSON pronto da incollare nel file dati.
- **Editor di categorie** no-code: 30 elementi divisi in 5 fasce, emoji e immagine per elemento,
  salvataggio locale e pubblicazione con link condivisibile.
- **10 lingue** (it, en, fr, es, de, pt, ru, zh, ja, ar) con selettore in navbar e nel menu, tema
  chiaro/scuro, effetti sonori sintetizzati, vibrazione e supporto RTL per l'arabo.

## Avvio

```bash
npm install
npm run dev
```

L'app parte su http://localhost:3000. La modalità locale funziona subito, senza configurazione.

Per verificare regole d'asta e catalogo senza aprire il browser:

```bash
npm run check:engine
```

## Configurazione Supabase (opzionale)

Serve per le stanze online, la condivisione delle categorie, i suggerimenti e la votazione.

1. Crea un progetto su [supabase.com](https://supabase.com).
2. Copia `.env.example` in `.env.local` e inserisci URL e chiave anon del progetto.
3. Esegui [`supabase/schema.sql`](./supabase/schema.sql) nell'SQL editor.

Per l'accesso e la sezione Pickpockets servono due impostazioni in più:

4. **Authentication → Providers → Email**: lascia attivo il provider (niente password, solo link).
5. **Authentication → URL Configuration**: metti il dominio del sito in *Site URL* e aggiungi
   `http://localhost:3000/pickpockets` e `https://iltuodominio/pickpockets` fra le *Redirect URLs*.
6. Facoltativo: in **Authentication → Email Templates → Magic Link** aggiungi `{{ .Token }}` al
   testo per far arrivare anche il codice a 6 cifre, più comodo da telefono.

## Donazioni

Il progetto è gratuito e senza pubblicità: la sezione "Sostieni il progetto" nel menu rimanda a
Revolut con l'importo scelto. Il link si personalizza con `NEXT_PUBLIC_REVOLUT_USER`; impostando
`NEXT_PUBLIC_PAYPAL_USER` si attiva anche il pulsante PayPal, altrimenti resta come spazio "in
arrivo". Nessun dato di pagamento passa dall'app.

## Struttura

```
app/                    pagine e rotte (home, creazione, stanza, categorie, studio, amici, voto)
components/ui/          bottoni, badge, input, modali, pannelli, selettore lingua
components/game/        asta, timer, controlli di offerta, card finale, editor categorie
lib/                    motore di gioco, realtime, catalogo, storage, i18n, accesso, amici
lib/i18n/               dizionari delle 10 lingue (italiano lingua sorgente)
data/categories.json    liste ufficiali: 26 categorie da 30 elementi
scripts/engine-check.js controlli sul motore di gioco e sul catalogo
public/logo.svg         marchio dell'app, sostituibile con il file originale
supabase/               schema SQL per categorie condivise, suggerimenti, risultati e voti
```

## Stack

Next.js (App Router, TypeScript) · Tailwind CSS · Framer Motion · Lucide React ·
Supabase Realtime · html-to-image · qrcode
