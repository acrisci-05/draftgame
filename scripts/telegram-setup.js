/**
 * Prepara le notifiche su Telegram.
 *
 * Legge TELEGRAM_BOT_TOKEN da .env.local, chiede a Telegram chi ha scritto al
 * bot e ricava il codice della chat: è un numero che non si trova nell'app di
 * Telegram, va chiesto ai suoi server. Poi manda un messaggio di prova, perché
 * "configurato" e "funziona" non sono la stessa cosa.
 *
 * Uso:  npm run telegram
 */
const fs = require("node:fs");
const path = require("node:path");

const ENV_FILE = path.join(__dirname, "..", ".env.local");

/** Lettura minimale del file: basta per due variabili, niente dipendenze. */
function readEnv() {
  if (!fs.existsSync(ENV_FILE)) return {};
  const values = {};
  for (const line of fs.readFileSync(ENV_FILE, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const at = trimmed.indexOf("=");
    if (at < 0) continue;
    values[trimmed.slice(0, at).trim()] = trimmed
      .slice(at + 1)
      .trim()
      .replace(/^["']|["']$/g, "");
  }
  return values;
}

/** Riscrive una variabile lasciando intatto tutto il resto del file. */
function writeEnv(key, value) {
  const original = fs.readFileSync(ENV_FILE, "utf8");
  const line = `${key}="${value}"`;
  const pattern = new RegExp(`^${key}=.*$`, "m");
  const updated = pattern.test(original)
    ? original.replace(pattern, line)
    : `${original.replace(/\s*$/, "")}\n${line}\n`;
  fs.writeFileSync(ENV_FILE, updated, "utf8");
}

async function ask(url) {
  const response = await fetch(url);
  const body = await response.json().catch(() => null);
  if (!body) throw new Error("Telegram ha risposto in modo inatteso.");
  return body;
}

(async () => {
  const env = readEnv();
  const token = (env.TELEGRAM_BOT_TOKEN || "").trim();

  if (!token) {
    console.log("");
    console.log("  Manca il token del bot.");
    console.log("");
    console.log("  1. Su Telegram apri una chat con  @BotFather");
    console.log("  2. Manda  /newbot  e segui le due domande (nome e username)");
    console.log("  3. Copia il token che ti restituisce e incollalo in .env.local:");
    console.log('       TELEGRAM_BOT_TOKEN="123456789:AAE..."');
    console.log("  4. Manda un messaggio qualsiasi al TUO bot, poi rilancia questo comando.");
    console.log("");
    process.exit(1);
  }

  const me = await ask(`https://api.telegram.org/bot${token}/getMe`);
  if (!me.ok) {
    console.log("");
    console.log("  Il token non è valido: Telegram non riconosce questo bot.");
    console.log("  Ricontrolla di averlo copiato per intero, due punti compresi.");
    console.log("");
    process.exit(1);
  }
  console.log("");
  console.log(`  Bot riconosciuto: @${me.result.username}`);

  let chatId = (env.TELEGRAM_CHAT_ID || "").trim();

  if (!chatId) {
    const updates = await ask(`https://api.telegram.org/bot${token}/getUpdates`);
    const chats = new Map();
    for (const update of updates.result || []) {
      const chat = update.message?.chat ?? update.channel_post?.chat;
      if (chat) chats.set(String(chat.id), chat);
    }

    if (chats.size === 0) {
      console.log("");
      console.log("  Nessun messaggio ricevuto dal bot.");
      console.log(`  Apri Telegram, cerca  @${me.result.username}, premi AVVIA`);
      console.log("  e scrivigli qualcosa. Poi rilancia questo comando.");
      console.log("");
      console.log("  (Il bot non può scriverti per primo: è una regola di Telegram,");
      console.log("   serve a evitare che i bot importunino chi non li ha cercati.)");
      console.log("");
      process.exit(1);
    }

    if (chats.size > 1) {
      console.log("");
      console.log("  Più chat hanno scritto al bot. Scegli la tua e mettila a mano");
      console.log("  in .env.local come TELEGRAM_CHAT_ID:");
      for (const [id, chat] of chats) {
        const who = chat.username ? `@${chat.username}` : chat.title || chat.first_name || "";
        console.log(`    ${id}   ${who}`);
      }
      console.log("");
      process.exit(1);
    }

    const [[found, chat]] = [...chats];
    chatId = found;
    writeEnv("TELEGRAM_CHAT_ID", chatId);
    const who = chat.username ? `@${chat.username}` : chat.first_name || "";
    console.log(`  Chat trovata: ${chatId} ${who ? `(${who})` : ""}`);
    console.log("  Scritta in .env.local.");
  } else {
    console.log(`  Chat già impostata: ${chatId}`);
  }

  const sent = await ask(
    `https://api.telegram.org/bot${token}/sendMessage?chat_id=${encodeURIComponent(chatId)}` +
      `&text=${encodeURIComponent("Pick & Pay è collegato. I suggerimenti arriveranno qui.")}`,
  );

  console.log("");
  if (sent.ok) {
    console.log("  MESSAGGIO DI PROVA INVIATO — guarda Telegram.");
    console.log("  Riavvia  npm run dev  per caricare le variabili nuove.");
  } else {
    console.log(`  Invio fallito: ${sent.description || "motivo sconosciuto"}`);
    console.log("  Se dice 'chat not found', manda prima un messaggio al bot.");
  }
  console.log("");
})();
