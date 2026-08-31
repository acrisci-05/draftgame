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

/** Il messaggio che arriva sul telefono quando qualcuno propone un'idea. */
export function suggestionMessage(input: {
  nickname: string;
  name: string;
  idea: string;
}): string {
  const idea = input.idea.trim();
  return [
    "💡 <b>Nuovo suggerimento</b>",
    "",
    `<b>Categoria:</b> ${escapeHtml(input.name)}`,
    idea ? `<b>Idea:</b> ${escapeHtml(idea)}` : "<i>Nessun testo, solo il nome.</i>",
    "",
    `Da @${escapeHtml(input.nickname)}`,
  ].join("\n");
}
