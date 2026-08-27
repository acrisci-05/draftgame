# $20 Draft Game

Asta live a budget fisso: ogni giocatore parte con **$20**, gli elementi della categoria escono a
caso uno alla volta e vince chi costruisce il roster più forte. A fine partita l'app genera una card
verticale 9:16 pronta da postare.

Le regole complete sono in [`PROJECT_SPECS.md`](./PROJECT_SPECS.md).

## Funzionalità

- **Asta live** con timer da 15 secondi per lotto, riportato a 10 dopo ogni rilancio.
- **Rilanci +$1 / +$2 / +$5** abilitati solo quando il saldo li copre, più il pulsante "Passa".
- **Due modalità**: stanza locale sullo stesso dispositivo oppure stanza online con codice di 4
  lettere sincronizzata via Supabase Realtime Channels.
- **Card 9:16** esportabile in PNG (1080x1920) con roster e budget residuo di ogni giocatore.
- **Editor di categorie** no-code: 25 elementi divisi in 5 fasce di prezzo, salvataggio locale e
  pubblicazione con link condivisibile.

## Avvio

```bash
npm install
npm run dev
```

L'app parte su http://localhost:3000. La modalità locale funziona subito, senza configurazione.

## Configurazione Supabase (opzionale)

Serve solo per le stanze online e per condividere le categorie tramite link.

1. Crea un progetto su [supabase.com](https://supabase.com).
2. Copia `.env.example` in `.env.local` e inserisci URL e chiave anon del progetto.
3. Esegui [`supabase/schema.sql`](./supabase/schema.sql) nell'SQL editor.

## Struttura

```
app/                    pagine e rotte (home, stanza, categorie)
components/ui/          bottoni, badge, input, modali, pannelli
components/game/        asta, timer, controlli di offerta, card finale, editor categorie
lib/                    motore di gioco, realtime, catalogo, storage, utility
supabase/               schema SQL per le categorie condivise
```

## Stack

Next.js (App Router, TypeScript) · Tailwind CSS · Framer Motion · Lucide React ·
Supabase Realtime · html-to-image
