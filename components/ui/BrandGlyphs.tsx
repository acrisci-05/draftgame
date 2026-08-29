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
