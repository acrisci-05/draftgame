/**
 * Controlla che il database sia collegato e completo.
 *
 * Da lanciare dopo aver creato il progetto su Supabase e aver eseguito
 * supabase/schema.sql: dice se le chiavi sono al loro posto, se ogni tabella
 * esiste, se le due funzioni di ricerca rispondono e se le regole di accesso
 * stanno facendo il loro lavoro.
 *
 * Uso:  npm run check:supabase
 *
 * Usa solo la chiave pubblica (anon), la stessa che finisce nel sito: nessun
 * dato riservato passa da qui.
 */
const fs = require("node:fs");
const path = require("node:path");

/* ------------------------------------------------------------------ */
/* Lettura delle chiavi da .env.local                                  */
/* ------------------------------------------------------------------ */

function readEnv() {
  const file = path.resolve(process.cwd(), ".env.local");
  if (!fs.existsSync(file)) return {};
  const out = {};
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const clean = line.trim();
    if (!clean || clean.startsWith("#")) continue;
    const at = clean.indexOf("=");
    if (at < 1) continue;
    // I valori possono essere scritti con o senza virgolette.
    out[clean.slice(0, at).trim()] = clean
      .slice(at + 1)
      .trim()
      .replace(/^["']|["']$/g, "");
  }
  return out;
}

const env = { ...readEnv(), ...process.env };
const URL_KEY = "NEXT_PUBLIC_SUPABASE_URL";
const ANON_KEY = "NEXT_PUBLIC_SUPABASE_ANON_KEY";
const url = (env[URL_KEY] ?? "").replace(/\/$/, "");
const key = env[ANON_KEY] ?? "";

let failures = 0;
const ok = (label, detail) => console.log(`  ok   ${label}${detail ? ` — ${detail}` : ""}`);
const fail = (label, detail) => {
  failures += 1;
  console.log(`  MANCA ${label}${detail ? ` — ${detail}` : ""}`);
};

if (!url || !key) {
  console.log("Database non configurato.\n");
  console.log("  Mancano le chiavi in .env.local:");
  if (!url) console.log(`    ${URL_KEY}=  (Project Settings -> API -> Project URL)`);
  if (!key) console.log(`    ${ANON_KEY}=  (Project Settings -> API -> anon public)`);
  console.log("\n  Senza queste il gioco funziona lo stesso, ma in locale:");
  console.log("  niente accesso, niente Pickmates, niente notifiche, niente link di voto.");
  console.log("  I passi completi sono nel capitolo 13 della guida.");
  process.exit(1);
}

/* ------------------------------------------------------------------ */
/* Le tabelle e le funzioni che schema.sql deve aver creato            */
/* ------------------------------------------------------------------ */

const TABLES = [
  ["profiles", "nickname e avatar di chi si registra"],
  ["profile_emails", "email di ricerca, leggibili solo dal proprietario"],
  ["pickmates", "la rubrica degli amici"],
  ["recent_opponents", "avversari delle ultime partite"],
  ["challenges", "inviti a entrare in una stanza"],
  ["match_history", "storico personale: da qui escono le statistiche del profilo"],
  ["games", "partite giocate"],
  ["game_players", "chi ha giocato a cosa"],
  ["results", "risultati pubblicati"],
  ["shared_results", "draft mandati agli amici"],
  ["votes", "voti sui draft"],
  ["categories", "liste condivise dagli utenti"],
  ["official_lists", "liste ufficiali sul database"],
  ["suggestions", "suggerimenti di categoria"],
  ["feedback", "voto del gioco a stelle"],
];

const FUNCTIONS = [
  ["find_pickmate_by_email", { target_email: "nessuno@esempio.invalid" }, "ricerca per email esatta"],
  ["bump_recent_opponent", { opponent: "00000000-0000-0000-0000-000000000000" }, "conteggio delle sfide"],
];

const headers = { apikey: key, Authorization: `Bearer ${key}` };

async function tableExists(name) {
  const response = await fetch(`${url}/rest/v1/${name}?select=*&limit=1`, { headers });
  // 200 = leggibile, 401/403 = c'e' ma la protegge una regola: in entrambi i casi esiste.
  if (response.ok || response.status === 401 || response.status === 403) {
    return { exists: true, status: response.status };
  }
  const body = await response.text();
  return { exists: false, status: response.status, body: body.slice(0, 120) };
}

async function functionExists(name, args) {
  const response = await fetch(`${url}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify(args),
  });
  // 404 significa che la funzione non c'e'. Un rifiuto per permessi va bene:
  // vuol dire che esiste e chiede l'accesso, che e' esattamente il suo compito.
  if (response.status === 404) {
    const body = await response.text();
    return { exists: false, body: body.slice(0, 120) };
  }
  return { exists: true, status: response.status };
}

(async () => {
  console.log(`Database ${url}\n`);

  /* 1. Il progetto risponde?
     Basta che risponda da servizio, con un codice qualsiasi che non sia un
     guasto: la radice dell'API rifiuta la chiave pubblica (401) ed e' normale,
     perche' le tabelle si leggono una per una, non tutte insieme. Il vero
     controllo di raggiungibilita' lo fanno le prove qui sotto. */
  try {
    const response = await fetch(`${url}/rest/v1/`, { headers });
    if (response.status < 500) ok("il progetto risponde");
    else fail("il progetto ha un guasto", `codice ${response.status}`);
  } catch (error) {
    console.log(`  MANCA il progetto non e' raggiungibile — ${error.message}`);
    console.log("\n  Se il progetto e' nuovo puo' volerci qualche minuto.");
    console.log("  Sul piano gratuito i progetti fermi da una settimana vanno in pausa:");
    console.log("  si riattivano dal pannello di Supabase con un clic.");
    process.exit(1);
  }

  /* 2. L'autenticazione e' accesa? */
  try {
    const response = await fetch(`${url}/auth/v1/settings`, { headers });
    if (response.ok) {
      const settings = await response.json();
      ok(
        "registrazione via email",
        settings.external?.email === false ? "DISATTIVATA nel pannello" : "attiva",
      );
    } else {
      fail("impostazioni di accesso non leggibili", `codice ${response.status}`);
    }
  } catch {
    fail("impostazioni di accesso non leggibili");
  }

  /* 3. Le tabelle. */
  console.log("\nTabelle\n");
  for (const [name, what] of TABLES) {
    const result = await tableExists(name);
    if (result.exists) ok(name, what);
    else fail(name, `${what} (codice ${result.status})`);
  }

  /* 4. Le funzioni di ricerca. */
  console.log("\nFunzioni\n");
  for (const [name, args, what] of FUNCTIONS) {
    const result = await functionExists(name, args);
    if (result.exists) ok(name, what);
    else fail(name, what);
  }

  /* 5. Le regole di accesso: senza aver fatto l'accesso non si deve poter
     leggere ne' l'elenco degli iscritti ne' gli indirizzi email. */
  console.log("\nRegole di accesso\n");

  const emails = await fetch(`${url}/rest/v1/profile_emails?select=email&limit=5`, { headers });
  const emailRows = emails.ok ? await emails.json() : null;
  if (!emails.ok || (Array.isArray(emailRows) && emailRows.length === 0)) {
    ok("le email non sono leggibili da fuori");
  } else {
    fail("le email sono esposte", "riesegui supabase/schema.sql");
  }

  const history = await fetch(`${url}/rest/v1/match_history?select=user_id&limit=5`, { headers });
  const historyRows = history.ok ? await history.json() : null;
  if (!history.ok || (Array.isArray(historyRows) && historyRows.length === 0)) {
    ok("lo storico delle partite non e' leggibile da fuori");
  } else {
    fail("lo storico e' esposto", "riesegui supabase/schema.sql");
  }

  const mates = await fetch(`${url}/rest/v1/pickmates?select=user_id&limit=5`, { headers });
  const mateRows = mates.ok ? await mates.json() : null;
  if (!mates.ok || (Array.isArray(mateRows) && mateRows.length === 0)) {
    ok("le amicizie non sono leggibili da fuori");
  } else {
    fail("le amicizie sono esposte", "riesegui supabase/schema.sql");
  }

  console.log(
    failures === 0
      ? "\nDATABASE PRONTO. Adesso prova a registrarti dal sito: il profilo deve comparire in /pickmates."
      : `\n${failures} COSE DA SISTEMARE. Quasi sempre basta rieseguire supabase/schema.sql nell'SQL editor.`,
  );
  process.exit(failures === 0 ? 0 : 1);
})();
