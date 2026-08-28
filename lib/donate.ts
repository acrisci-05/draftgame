/**
 * Donazioni: importi proposti e costruzione dei link di pagamento.
 * Il progetto non tratta pagamenti in proprio, si limita a rimandare al servizio esterno.
 */

export const DONATION_AMOUNTS = [5, 10, 20, 30, 40, 50, 100] as const;

export const DONATION_MIN = 1;
export const DONATION_MAX = 1000;

export const REVOLUT_USER =
  process.env.NEXT_PUBLIC_REVOLUT_USER?.trim() || "acrisci05";

export const REVOLUT_URL = `https://revolut.me/${REVOLUT_USER}`;

/** Impostare NEXT_PUBLIC_PAYPAL_USER per attivare il pulsante PayPal. */
export const PAYPAL_USER = process.env.NEXT_PUBLIC_PAYPAL_USER?.trim() || "";

export const isPaypalConfigured = PAYPAL_USER.length > 0;

export function clampDonation(amount: number): number {
  if (!Number.isFinite(amount)) return DONATION_AMOUNTS[0];
  return Math.min(DONATION_MAX, Math.max(DONATION_MIN, Math.round(amount)));
}

/** revolut.me accetta l'importo nel percorso, es. /acrisci05/10eur. */
export function revolutUrl(amount: number): string {
  const value = clampDonation(amount);
  return `${REVOLUT_URL}/${value}eur`;
}

/** paypal.me con lo stesso schema: attivo solo quando l'utente PayPal è configurato. */
export function paypalUrl(amount: number): string | null {
  if (!isPaypalConfigured) return null;
  return `https://paypal.me/${PAYPAL_USER}/${clampDonation(amount)}EUR`;
}
