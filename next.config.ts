import { networkInterfaces } from "node:os";
import type { NextConfig } from "next";

/**
 * Indirizzi di rete locale di questa macchina.
 * Servono in sviluppo: senza, Next blocca i file JavaScript quando il sito
 * viene aperto dal telefono con l'indirizzo IP invece che da localhost.
 */
function localAddresses(): string[] {
  const addresses = new Set<string>([
    "localhost",
    "127.0.0.1",
    // Domini dei tunnel pubblici, per provare il gioco da rete dati.
    "*.trycloudflare.com",
    "*.loca.lt",
    "*.ngrok-free.app",
    "*.ngrok.io",
  ]);
  for (const entries of Object.values(networkInterfaces())) {
    for (const entry of entries ?? []) {
      if (entry.family === "IPv4" && !entry.internal) addresses.add(entry.address);
    }
  }
  return [...addresses];
}

/**
 * Intestazioni di sicurezza, spedite con ogni pagina.
 *
 * Sono istruzioni al browser su cosa NON fare con il sito. Non servono finche'
 * gira solo sul computer di casa, ma dal giorno della pubblicazione sono la
 * prima difesa contro chi prova a incastrare il sito dentro una pagina sua.
 */
const securityHeaders = [
  // Nessuno puo' incorniciare il sito dentro una pagina propria e farci
  // cliccare sopra all'insaputa di chi guarda.
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  // Il browser rispetta il tipo dichiarato invece di indovinarlo: un file
  // caricato come immagine non puo' farsi eseguire come programma.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Uscendo dal sito si dice da quale dominio si arriva, non da quale pagina:
  // i codici stanza non finiscono nei registri dei siti visitati dopo.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Il sito non chiede posizione, microfono o telecamera: qui lo si dichiara,
  // cosi' il browser rifiuta a prescindere se qualcosa provasse a farlo.
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), interest-cohort=()" },
];

const nextConfig: NextConfig = {
  allowedDevOrigins: localAddresses(),
  // Niente file di istruzioni generati in automatico nella cartella del progetto.
  agentRules: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
