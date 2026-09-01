/**
 * Notifica su Telegram.
 *
 * Vive solo sul server: il token del bot sta in TELEGRAM_BOT_TOKEN, senza il
 * prefisso NEXT_PUBLIC_, quindi non viene mai spedito al browser. Se finisse
 * nella pagina chiunque potrebbe leggerlo e scrivere sul telefono del creatore.
 *
 * Senza le due variabili la funzione non fa niente e non protesta: il sito
 * continua a funzionare, semplicemente non arriva la notifica.
 */

const TOKEN = process.env.TELEGRAM_BOT_TOKEN?.trim() ?? "";
const CHAT_ID = process.env.TELEGRAM_CHAT_ID?.trim() ?? "";

export const isTelegramConfigured = Boolean(TOKEN && CHAT_ID);

/** Caratteri che Telegram interpreterebbe come formattazione HTML. */
function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * Manda il messaggio e dice se è partito.
 *
 * Non solleva mai: una notifica persa non deve far fallire il salvataggio del
 * suggerimento, che è la cosa importante. Il timeout evita che una richiesta
 * lenta verso Telegram tenga bloccata la risposta all'utente.
 */
export async function notifyTelegram(text: string): Promise<boolean> {
  if (!isTelegramConfigured) return false;

  const stop = AbortSignal.timeout(5000);
  try {
    const response = await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: CHAT_ID,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
      signal: stop,
    });
    return response.ok;
  } catch {
    return false;
  }
}

const RULE = "━━━━━━━━━━━━━━━";

/** Data e ora italiane: il server può stare in qualunque fuso, il telefono no. */
function romeTime(when: Date): string {
  return new Intl.DateTimeFormat("it-IT", {
    timeZone: "Europe/Rome",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(when);
}

/**
 * Il messaggio che arriva sul telefono quando qualcuno propone un'idea.
 *
 * Formattato in HTML perché è l'unico dei due dialetti di Telegram che non
 * obbliga a mettere una barra rovesciata davanti a mezzo alfabeto: con
 * Markdown un punto esclamativo nel testo di un utente basterebbe a far
 * rifiutare l'intero messaggio.
 */
export function suggestionMessage(input: {
  nickname: string;
  name: string;
  idea: string;
  when?: Date;
}): string {
  const idea = input.idea.trim();
  const lines = [
    "💡 <b>NUOVO SUGGERIMENTO</b>",
    RULE,
    "",
    "📂 <b>Categoria</b>",
    escapeHtml(input.name),
    "",
  ];

  if (idea) {
    lines.push("💬 <b>Idea</b>", `<blockquote>${escapeHtml(idea)}</blockquote>`, "");
  } else {
    lines.push("<i>Nessun testo: solo il nome della categoria.</i>", "");
  }

  lines.push(
    RULE,
    `👤 <code>@${escapeHtml(input.nickname)}</code>  ·  🕐 ${romeTime(input.when ?? new Date())}`,
  );

  return lines.join("\n");
}

/**
 * Il messaggio di una valutazione.
 *
 * Si distingue a colpo d'occhio da un suggerimento: stelle invece della
 * lampadina, e il voto scritto anche in cifre, perché contare cinque simboli
 * su uno schermo piccolo non è immediato.
 */
export function ratingMessage(input: {
  stars: number;
  comment: string;
  nickname: string | null;
}): string {
  const piene = "⭐".repeat(input.stars);
  const vuote = "☆".repeat(Math.max(0, 5 - input.stars));
  const commento = input.comment.trim();
  const chi = input.nickname
    ? `<code>@${escapeHtml(input.nickname)}</code>`
    : "<i>Anonimo</i>";

  const righe = [
    "⭐ <b>NUOVA VALUTAZIONE</b>",
    RULE,
    "",
    `<b>Voto:</b> ${piene}${vuote}  ${input.stars}/5`,
    "",
  ];

  if (commento) {
    righe.push("<b>Commento</b>", `<blockquote>${escapeHtml(commento)}</blockquote>`, "");
  } else {
    righe.push("<i>Nessun commento.</i>", "");
  }

  righe.push(RULE, `👤 ${chi}  ·  🕐 ${romeTime(new Date())}`);
  return righe.join("\n");
}
