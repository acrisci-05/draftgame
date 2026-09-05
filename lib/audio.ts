"use client";

/**
 * Effetti sonori sintetizzati con la Web Audio API: nessun file da scaricare,
 * nessuna richiesta di rete. Il contesto parte al primo tocco dell'utente.
 */

export type Sfx =
  | "bid"
  | "pass"
  | "tick"
  | "timeup"
  | "win"
  | "lose"
  | "mystery"
  | "start"
  | "gavel"
  | "fistbump";

let context: AudioContext | null = null;

type AudioWindow = Window & { webkitAudioContext?: typeof AudioContext };

function getContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!context) {
    const Ctor = window.AudioContext ?? (window as AudioWindow).webkitAudioContext;
    if (!Ctor) return null;
    context = new Ctor();
  }
  if (context.state === "suspended") void context.resume();
  return context;
}

interface ToneOptions {
  frequency: number;
  duration: number;
  type?: OscillatorType;
  gain?: number;
  delay?: number;
  sweepTo?: number;
}

function tone(ctx: AudioContext, options: ToneOptions) {
  const { frequency, duration, type = "sine", gain = 0.12, delay = 0, sweepTo } = options;
  const start = ctx.currentTime + delay;
  const oscillator = ctx.createOscillator();
  const envelope = ctx.createGain();

  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, start);
  if (sweepTo) oscillator.frequency.exponentialRampToValueAtTime(sweepTo, start + duration);

  envelope.gain.setValueAtTime(0.0001, start);
  envelope.gain.exponentialRampToValueAtTime(gain, start + 0.012);
  envelope.gain.exponentialRampToValueAtTime(0.0001, start + duration);

  oscillator.connect(envelope).connect(ctx.destination);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.02);
}

/**
 * Uno scoppio di rumore, cortissimo.
 *
 * Le note qui sopra sanno fare i suoni intonati, e un urto intonato non esiste:
 * legno che batte sul legno e' rumore su tutte le frequenze insieme, spento in
 * pochi millesimi. Senza questa parte il martello suonava come un campanello
 * grave, che e' il difetto che si sentiva.
 *
 * Il filtro decide di che materiale sembra: passa-basso stretto per il tonfo
 * sordo del pugno, aperto per lo schianto secco del martello.
 */
function noise(
  ctx: AudioContext,
  options: { duration: number; gain?: number; cutoff?: number; delay?: number; type?: BiquadFilterType },
) {
  const { duration, gain = 0.1, cutoff = 2000, delay = 0, type = "lowpass" } = options;
  const start = ctx.currentTime + delay;
  const frames = Math.max(1, Math.floor(ctx.sampleRate * duration));
  const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < frames; i += 1) {
    // Rumore che si spegne da solo: senza la rampa resterebbe un fruscio piatto.
    data[i] = (Math.random() * 2 - 1) * (1 - i / frames);
  }
  const source = ctx.createBufferSource();
  source.buffer = buffer;

  const filter = ctx.createBiquadFilter();
  filter.type = type;
  filter.frequency.setValueAtTime(cutoff, start);

  const envelope = ctx.createGain();
  envelope.gain.setValueAtTime(gain, start);
  envelope.gain.exponentialRampToValueAtTime(0.0001, start + duration);

  source.connect(filter).connect(envelope).connect(ctx.destination);
  source.start(start);
  source.stop(start + duration + 0.02);
}

export function playSfx(name: Sfx, enabled = true) {
  if (!enabled) return;
  const ctx = getContext();
  if (!ctx) return;

  switch (name) {
    case "bid":
      tone(ctx, { frequency: 620, duration: 0.09, type: "triangle", gain: 0.14 });
      tone(ctx, { frequency: 940, duration: 0.12, type: "triangle", gain: 0.12, delay: 0.07 });
      break;
    case "pass":
      tone(ctx, { frequency: 300, duration: 0.14, type: "sine", gain: 0.08, sweepTo: 190 });
      break;
    case "tick":
      tone(ctx, { frequency: 1500, duration: 0.045, type: "square", gain: 0.06 });
      break;
    case "timeup":
      tone(ctx, { frequency: 420, duration: 0.35, type: "sawtooth", gain: 0.1, sweepTo: 140 });
      break;
    case "win":
      tone(ctx, { frequency: 660, duration: 0.16, type: "triangle", gain: 0.13 });
      tone(ctx, { frequency: 880, duration: 0.16, type: "triangle", gain: 0.13, delay: 0.12 });
      tone(ctx, { frequency: 1320, duration: 0.26, type: "triangle", gain: 0.12, delay: 0.24 });
      break;
    /*
     * La sconfitta: le stesse tre note della vittoria, al contrario e piu'
     * gravi. Deve far sorridere, non mortificare -- e' un gioco in cui si
     * perde spesso, e un suono davvero cupo a fine partita stanca alla terza.
     */
    case "lose":
      tone(ctx, { frequency: 520, duration: 0.16, type: "triangle", gain: 0.11 });
      tone(ctx, { frequency: 390, duration: 0.18, type: "triangle", gain: 0.11, delay: 0.13 });
      tone(ctx, { frequency: 260, duration: 0.3, type: "triangle", gain: 0.1, delay: 0.27, sweepTo: 180 });
      break;
    case "mystery":
      tone(ctx, { frequency: 520, duration: 0.1, type: "sine", gain: 0.1, sweepTo: 1040 });
      tone(ctx, { frequency: 780, duration: 0.14, type: "sine", gain: 0.1, delay: 0.1, sweepTo: 1560 });
      break;
    case "start":
      tone(ctx, { frequency: 320, duration: 0.3, type: "triangle", gain: 0.12, sweepTo: 880 });
      break;
    /*
     * Il martello del banditore: legno che batte sul legno.
     *
     * Un colpo di martello non e' una nota, e' un urto: tutta l'energia nei
     * primi millesimi e poi piu' niente. Si ottiene con tre suoni sovrapposti e
     * brevissimi -- lo schiocco acuto dell'impatto, il corpo grave del blocco,
     * e una coda che scende -- invece che con una nota tenuta, che suonerebbe
     * come un campanello.
     */
    case "gavel":
      // Lo schianto: rumore aperto e larghissimo, ma lungo venticinque
      // millesimi. E' quasi tutto il carattere del suono.
      noise(ctx, { duration: 0.025, gain: 0.3, cutoff: 7000, type: "highpass" });
      // Il colpo sul blocco: il corpo scuro del legno, subito sotto.
      noise(ctx, { duration: 0.07, gain: 0.22, cutoff: 900 });
      // La risonanza sorda che resta nel banco, e che cade in fretta.
      tone(ctx, { frequency: 170, duration: 0.17, type: "triangle", gain: 0.16, sweepTo: 72 });
      tone(ctx, { frequency: 96, duration: 0.22, type: "sine", gain: 0.11, delay: 0.01, sweepTo: 54 });
      break;
    /*
     * Il pugno che ne incontra un altro: un tonfo sordo e corto, senza coda.
     * Piu' morbido del martello, perche' e' un saluto e non una sentenza.
     */
    case "fistbump":
      // Il tonfo: due nocche sono carne e osso, quindi grave e senza coda.
      tone(ctx, { frequency: 150, duration: 0.11, type: "sine", gain: 0.2, sweepTo: 62 });
      noise(ctx, { duration: 0.045, gain: 0.16, cutoff: 500 });
      // Lo schiocco del contatto: appena accennato, o diventa uno schiaffo.
      noise(ctx, { duration: 0.018, gain: 0.08, cutoff: 5200, type: "highpass" });
      break;
  }
}

/** Da chiamare su un gesto dell'utente per sbloccare l'audio sui browser mobile. */
export function primeAudio() {
  getContext();
}
