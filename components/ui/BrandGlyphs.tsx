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

/**
 * I marchi dei servizi con cui si puo' entrare.
 *
 * Google va disegnata con i suoi quattro colori: e' cosi' che le persone la
 * riconoscono, e le sue stesse linee guida chiedono di non ricolorarla. Apple e
 * Facebook ereditano invece il colore dal pulsante che le contiene.
 */
export function GoogleGlyph({ className }: GlyphProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path
        fill="#4285F4"
        d="M23.5 12.27c0-.79-.07-1.54-.2-2.27H12v4.51h6.47a5.53 5.53 0 0 1-2.4 3.63v3h3.87c2.26-2.09 3.56-5.17 3.56-8.87z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.08 7.94-2.91l-3.87-3c-1.08.72-2.45 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.96H1.27v3.09A12 12 0 0 0 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.27 14.28a7.2 7.2 0 0 1 0-4.56V6.63H1.27a12 12 0 0 0 0 10.74l4-3.09z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.23 0 12 0A12 12 0 0 0 1.27 6.63l4 3.09C6.22 6.86 8.87 4.75 12 4.75z"
      />
    </svg>
  );
}

export function AppleGlyph({ className }: GlyphProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M17.05 12.53c-.03-2.6 2.12-3.85 2.22-3.91-1.21-1.77-3.09-2.01-3.76-2.04-1.6-.16-3.12.94-3.93.94-.81 0-2.06-.92-3.39-.9-1.74.03-3.35 1.01-4.25 2.57-1.81 3.14-.46 7.79 1.3 10.34.86 1.25 1.89 2.65 3.24 2.6 1.3-.05 1.79-.84 3.36-.84 1.57 0 2.01.84 3.38.81 1.4-.02 2.28-1.27 3.13-2.53.99-1.45 1.4-2.86 1.42-2.93-.03-.01-2.72-1.04-2.72-4.11zM14.6 4.6c.71-.87 1.19-2.07 1.06-3.27-1.02.04-2.26.68-3 1.55-.66.76-1.24 1.99-1.09 3.16 1.14.09 2.31-.58 3.03-1.44z" />
    </svg>
  );
}

export function FacebookGlyph({ className }: GlyphProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.69 4.53-4.69 1.31 0 2.68.24 2.68.24v2.97h-1.51c-1.49 0-1.96.93-1.96 1.89v2.25h3.33l-.53 3.49h-2.8V24C19.61 23.1 24 18.1 24 12.07z" />
    </svg>
  );
}

/** La cornetta di WhatsApp, per il pulsante d'invito. */
export function WhatsappGlyph({ className }: GlyphProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.9 9.9 0 0 0 4.79 1.22h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2zm0 18.15h-.01a8.2 8.2 0 0 1-4.19-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.2 8.2 0 0 1-1.26-4.38c0-4.54 3.7-8.24 8.25-8.24 2.2 0 4.27.86 5.83 2.42a8.2 8.2 0 0 1 2.41 5.83c0 4.54-3.7 8.23-8.24 8.23zm4.52-6.16c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.13-.16.24-.64.8-.78.97-.15.16-.29.18-.53.06-.25-.12-1.05-.39-1.99-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.01-.38.11-.5.11-.11.25-.29.37-.43.13-.15.17-.25.25-.41.08-.17.04-.31-.02-.43-.06-.12-.56-1.34-.76-1.84-.2-.48-.4-.42-.56-.43h-.47c-.17 0-.43.06-.66.31-.22.25-.86.85-.86 2.07 0 1.22.89 2.4 1.01 2.56.12.17 1.75 2.67 4.23 3.74.59.26 1.05.41 1.41.52.59.19 1.13.16 1.56.1.48-.07 1.47-.6 1.68-1.18.21-.58.21-1.08.14-1.18-.06-.11-.22-.17-.47-.29z" />
    </svg>
  );
}
