/**
 * Simboli dei social disegnati a mano.
 *
 * La libreria di icone che usiamo (lucide) dalla versione 1 non distribuisce più
 * i marchi commerciali, quindi Instagram e X li disegniamo qui con le stesse
 * proporzioni delle altre icone: tratto da 2, riquadro 24x24, colore ereditato.
 */

type GlyphProps = { className?: string };

export function InstagramGlyph({ className }: GlyphProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <rect width="20" height="20" x="2" y="2" rx="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
    </svg>
  );
}

/** La "P" di PayPal, semplificata: due fogli sovrapposti come nel marchio. */
export function PaypalGlyph({ className }: GlyphProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M8.6 3h6.02c2.9 0 4.72 1.5 4.3 4.3-.4 2.7-2.4 4.2-5.3 4.2h-2.1a.8.8 0 0 0-.79.67l-.7 4.4a.5.5 0 0 1-.49.43H6.2a.5.5 0 0 1-.5-.58L8.1 3.42a.5.5 0 0 1 .5-.42z" />
      <path
        opacity="0.7"
        d="M11.1 13.5h1.8c3.3 0 5.6-1.75 6.1-4.9a3.7 3.7 0 0 1 1.35 3.5c-.42 2.9-2.5 4.5-5.5 4.5h-1.5a.8.8 0 0 0-.79.68l-.55 3.3a.5.5 0 0 1-.5.42H8.4a.5.5 0 0 1-.5-.58l.63-4a.8.8 0 0 1 .78-.67z"
      />
    </svg>
  );
}

/** Il monogramma di Revolut: la R stilizzata, ridisegnata con lo stesso peso. */
export function RevolutGlyph({ className }: GlyphProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M5 2h7.4c3.2 0 5.6 2.3 5.6 5.4 0 2.7-1.8 4.8-4.4 5.3L19 22h-4.3l-4.9-9.2h-1V22H5V2zm3.8 3.2v4.5h3.3c1.5 0 2.5-.9 2.5-2.3s-1-2.2-2.5-2.2H8.8z" />
    </svg>
  );
}

export function XGlyph({ className }: GlyphProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      <path d="M13.98 10.62 21.06 2h-1.68l-6.15 7.48L8.32 2H2.66l7.43 10.9L2.66 22h1.68l6.5-7.9L16.02 22h5.66l-7.7-11.38zM11.7 13.03l-.75-1.1L4.95 3.3h2.58l4.84 7.1.75 1.1 6.29 9.22h-2.58l-5.13-7.7z" />
    </svg>
  );
}
