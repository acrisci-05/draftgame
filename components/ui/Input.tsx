"use client";

import { Eye, EyeOff } from "lucide-react";
import { useState, type InputHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { useT } from "@/lib/settings";
import { cn } from "@/lib/utils";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
}

export function Input({ label, hint, className, id, type, ...props }: InputProps) {
  const t = useT();
  const [visible, setVisible] = useState(false);

  /*
   * Le password si scrivono coperte, ma su telefono una password lunga senza
   * poterla rileggere e' un invito a sbagliare: qui c'e' l'occhio per scoprirla
   * un momento. Compare da solo su ogni campo password, senza doverlo chiedere.
   */
  const isPassword = type === "password";
  const shown = isPassword && visible;

  return (
    <label className="block" htmlFor={id}>
      {label ? (
        <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-faint">
          {label}
        </span>
      ) : null}
      <span className="relative block">
        <input
          id={id}
          type={shown ? "text" : type}
          className={cn(
            "h-12 w-full rounded-xl border border-line bg-surface-2 px-4 text-base text-fg placeholder:text-faint/70",
            "transition-colors focus:border-neon/70 focus:outline-none",
          "disabled:cursor-not-allowed disabled:opacity-50",
            // Spazio per l'occhio, che sta dentro il campo.
            isPassword && "pe-12",
            className,
          )}
          {...props}
        />
        {isPassword ? (
          <button
            type="button"
            // Il campo non deve perdere il fuoco: si continua a scrivere.
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => setVisible((value) => !value)}
            aria-label={t(shown ? "auth.hidePassword" : "auth.showPassword")}
            aria-pressed={shown}
            title={t(shown ? "auth.hidePassword" : "auth.showPassword")}
            className="absolute inset-y-0 end-0 grid w-12 place-items-center text-faint transition-colors hover:text-fg"
          >
            {shown ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
          </button>
        ) : null}
      </span>
      {hint ? <span className="mt-1.5 block text-xs text-faint">{hint}</span> : null}
    </label>
  );
}

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
}

export function Textarea({ label, className, id, ...props }: TextareaProps) {
  return (
    <label className="block" htmlFor={id}>
      {label ? (
        <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-faint">
          {label}
        </span>
      ) : null}
      <textarea
        id={id}
        className={cn(
          "min-h-28 w-full rounded-xl border border-line bg-surface-2 p-3 text-sm text-fg placeholder:text-faint/70",
          "transition-colors focus:border-neon/70 focus:outline-none",
          "disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        {...props}
      />
    </label>
  );
}
