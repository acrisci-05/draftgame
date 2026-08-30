/**
 * Modalità manutenzione.
 *
 * Si accende da una variabile d'ambiente, non da un interruttore nel sito: così
 * resta accesa anche se il sito non parte, ed è l'unica cosa da toccare prima di
 * un aggiornamento importante. Su Vercel si cambia il valore e si ripubblica.
 *
 *   NEXT_PUBLIC_MAINTENANCE_MODE="true"   il sito mostra la schermata a tutti
 *   NEXT_PUBLIC_MAINTENANCE_MODE="false"  (o assente) tutto normale
 *
 * Chi ha la chiave del creatore continua a usare il sito per intero: serve a
 * provare le novità prima di riaprire le porte.
 */

const RAW = process.env.NEXT_PUBLIC_MAINTENANCE_MODE?.trim().toLowerCase() ?? "";

/** true solo con un "sì" esplicito: un valore storto non deve chiudere il sito. */
export const isMaintenance = RAW === "true" || RAW === "1" || RAW === "on";
