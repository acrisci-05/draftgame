"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { cn, clamp } from "@/lib/utils";

interface TimerProps {
  deadline: number;
  totalSeconds: number;
  now: () => number;
  size?: number;
}

export function Timer({ deadline, totalSeconds, now, size = 88 }: TimerProps) {
  const [remaining, setRemaining] = useState(() => Math.max(0, deadline - now()));

  useEffect(() => {
    const update = () => setRemaining(Math.max(0, deadline - now()));
    update();
    const timer = setInterval(update, 100);
    return () => clearInterval(timer);
  }, [deadline, now]);

  const seconds = Math.ceil(remaining / 1000);
  const progress = clamp(remaining / (totalSeconds * 1000), 0, 1);
  const radius = size / 2 - 6;
  const circumference = 2 * Math.PI * radius;
  const urgent = seconds <= 3;
  const warning = seconds <= 6;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={6}
          className="stroke-line"
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={6}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - progress)}
          className={cn(
            "transition-colors duration-300",
            urgent ? "stroke-red-500" : warning ? "stroke-amber-400" : "stroke-neon",
          )}
        />
      </svg>
      <motion.div
        key={seconds}
        initial={{ scale: urgent ? 1.25 : 1.05, opacity: 0.7 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.18 }}
        className={cn(
          "absolute inset-0 flex flex-col items-center justify-center font-mono font-bold",
          urgent ? "text-red-400" : warning ? "text-amber-300" : "text-neon",
        )}
      >
        <span style={{ fontSize: size * 0.34, lineHeight: 1 }}>{seconds}</span>
        <span className="text-[9px] uppercase tracking-widest text-zinc-500">sec</span>
      </motion.div>
    </div>
  );
}
