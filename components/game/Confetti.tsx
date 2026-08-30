"use client";

import { useEffect, useMemo, useState } from "react";

/**
 * Coriandoli di fine partita.
 *
 * Nessuna libreria: una manciata di rettangoli che cadono con un'animazione CSS,
 * smontati da soli dopo qualche secondo. Chi ha chiesto al telefono di ridurre
 * le animazioni non li vede affatto.
 */

const COLORS = ["#22c55e", "#a855f7", "#fbbf24", "#38bdf8", "#f472b6"];
const PIECES = 46;
const DURATION_MS = 4200;

/**
 * Numero fra 0 e 1 ricavato dall'indice: sembra casuale ma è sempre lo stesso,
 * così il disegno resta identico fra server e browser e non serve estrarre
 * numeri a caso durante il render.
 */
function spread(index: number, seed: number): number {
  const value = Math.sin((index + 1) * seed) * 10000;
  return value - Math.floor(value);
}

export function Confetti({ run = true }: { run?: boolean }) {
  const [visible, setVisible] = useState(run);

  const pieces = useMemo(
    () =>
      Array.from({ length: PIECES }, (_, index) => ({
        id: index,
        left: spread(index, 12.9898) * 100,
        delay: spread(index, 43.233) * 0.9,
        duration: 2.6 + spread(index, 78.233) * 1.4,
        size: 7 + spread(index, 4.1414) * 8,
        color: COLORS[index % COLORS.length],
        drift: Math.round((spread(index, 21.9898) - 0.5) * 120),
        spin: Math.round(180 + spread(index, 33.719) * 540),
      })),
    [],
  );

  useEffect(() => {
    if (!run) return;
    const timer = setTimeout(() => setVisible(false), DURATION_MS);
    return () => clearTimeout(timer);
  }, [run]);

  if (!run || !visible) return null;

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-50 overflow-hidden motion-reduce:hidden"
    >
      {pieces.map((piece) => (
        <span
          key={piece.id}
          className="confetti-piece"
          style={{
            left: `${piece.left}%`,
            width: piece.size,
            height: piece.size * 1.6,
            backgroundColor: piece.color,
            animationDelay: `${piece.delay}s`,
            animationDuration: `${piece.duration}s`,
            ["--drift" as string]: `${piece.drift}px`,
            ["--spin" as string]: `${piece.spin}deg`,
          }}
        />
      ))}
    </div>
  );
}
