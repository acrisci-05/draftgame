"use client";

import { motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { playSfx } from "@/lib/audio";
import { useSettings } from "@/lib/settings";
import { cn, clamp } from "@/lib/utils";

interface TimerProps {
  deadline: number;
  totalSeconds: number;
  now: () => number;
  /** Sotto questa soglia scattano pulsazione rossa e ticchettio. */
  urgentAt?: number;
}

const CHAMBER_HEIGHT = 21;

export function Timer({ deadline, totalSeconds, now, urgentAt = 5 }: TimerProps) {
  const { sound } = useSettings();
  const [remaining, setRemaining] = useState(() => Math.max(0, deadline - now()));
  const lastSecondRef = useRef(-1);

  useEffect(() => {
    const update = () => setRemaining(Math.max(0, deadline - now()));
    update();
    const timer = setInterval(update, 100);
    return () => clearInterval(timer);
  }, [deadline, now]);

  const seconds = Math.ceil(remaining / 1000);
  const progress = clamp(remaining / (totalSeconds * 1000), 0, 1);
  const urgent = seconds <= urgentAt && seconds > 0;

  useEffect(() => {
    if (lastSecondRef.current === seconds) return;
    const previous = lastSecondRef.current;
    lastSecondRef.current = seconds;
    if (previous < 0) return;
    if (seconds > 0 && seconds <= urgentAt) playSfx("tick", sound);
  }, [seconds, urgentAt, sound]);

  const topSand = CHAMBER_HEIGHT * progress;
  const bottomSand = CHAMBER_HEIGHT * (1 - progress);
  const color = urgent ? "#ef4444" : seconds <= urgentAt * 2 ? "#f59e0b" : "#22c55e";

  return (
    <motion.div
      className="flex items-center gap-2"
      animate={urgent ? { scale: [1, 1.08, 1] } : { scale: 1 }}
      transition={urgent ? { duration: 1, repeat: Infinity } : { duration: 0.2 }}
    >
      <svg width="34" height="46" viewBox="0 0 48 64" aria-hidden>
        <defs>
          <clipPath id="pp-hourglass-top">
            <polygon points="9,9 39,9 24,30" />
          </clipPath>
          <clipPath id="pp-hourglass-bottom">
            <polygon points="24,34 39,55 9,55" />
          </clipPath>
        </defs>

        <rect x="6" y="3" width="36" height="5" rx="2.5" fill={color} opacity="0.85" />
        <rect x="6" y="56" width="36" height="5" rx="2.5" fill={color} opacity="0.85" />

        <polygon points="9,9 39,9 24,30" fill={color} opacity="0.12" />
        <polygon points="24,34 39,55 9,55" fill={color} opacity="0.12" />

        <g clipPath="url(#pp-hourglass-top)">
          <rect x="8" y={30 - topSand} width="32" height={topSand + 1} fill={color} />
        </g>
        <g clipPath="url(#pp-hourglass-bottom)">
          <rect x="8" y={55 - bottomSand} width="32" height={bottomSand + 1} fill={color} />
        </g>

        <motion.rect
          key={seconds}
          x="23"
          width="2"
          fill={color}
          initial={{ y: 29, height: 2, opacity: 0.9 }}
          animate={{ y: 33, height: 6, opacity: 0.2 }}
          transition={{ duration: 0.85, ease: "easeIn" }}
        />

        <path
          d="M9 9 L39 9 L24 30 L39 55 L9 55 L24 32 Z"
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinejoin="round"
          opacity="0.9"
        />
      </svg>

      <div className="leading-none">
        <motion.span
          key={seconds}
          initial={{ scale: urgent ? 1.3 : 1.08, opacity: 0.6 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.2 }}
          className={cn(
            "block font-mono text-3xl font-black tabular-nums",
            urgent ? "text-red-500" : seconds <= urgentAt * 2 ? "text-amber-500" : "text-neon",
          )}
        >
          {seconds}
        </motion.span>
        <span className="block text-[9px] uppercase tracking-[0.2em] text-faint">sec</span>
      </div>
    </motion.div>
  );
}
