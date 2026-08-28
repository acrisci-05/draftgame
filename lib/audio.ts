"use client";

/**
 * Effetti sonori sintetizzati con la Web Audio API: nessun file da scaricare,
 * nessuna richiesta di rete. Il contesto parte al primo tocco dell'utente.
 */

export type Sfx = "bid" | "pass" | "tick" | "timeup" | "win" | "mystery" | "start";

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
    case "mystery":
      tone(ctx, { frequency: 520, duration: 0.1, type: "sine", gain: 0.1, sweepTo: 1040 });
      tone(ctx, { frequency: 780, duration: 0.14, type: "sine", gain: 0.1, delay: 0.1, sweepTo: 1560 });
      break;
    case "start":
      tone(ctx, { frequency: 320, duration: 0.3, type: "triangle", gain: 0.12, sweepTo: 880 });
      break;
  }
}

/** Da chiamare su un gesto dell'utente per sbloccare l'audio sui browser mobile. */
export function primeAudio() {
  getContext();
}
