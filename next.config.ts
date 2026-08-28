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

const nextConfig: NextConfig = {
  allowedDevOrigins: localAddresses(),
  // Niente file di istruzioni generati in automatico nella cartella del progetto.
  agentRules: false,
};

export default nextConfig;
