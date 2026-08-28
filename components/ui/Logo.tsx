import { APP_NAME, APP_TAGLINE } from "@/lib/config";
import { cn } from "@/lib/utils";

/**
 * Marchio dell'app. Il badge vive in `public/logo.svg`: per usare il file
 * originale al posto della versione vettoriale basta sostituire quel file.
 */
export function LogoMark({ size = 40, className }: { size?: number; className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/logo.svg"
      alt=""
      width={size}
      height={size}
      className={cn("shrink-0", className)}
      style={{ width: size, height: size }}
    />
  );
}

/** Titolo con gradiente verde → ciano. */
export function LogoWordmark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "bg-gradient-to-r from-neon via-emerald-400 to-cyan-400 bg-clip-text text-transparent",
        className,
      )}
    >
      {APP_NAME}
    </span>
  );
}

export function Logo({
  size = 44,
  stacked = false,
  className,
}: {
  size?: number;
  stacked?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "flex min-w-0 items-center gap-2.5",
        stacked && "flex-col gap-3 text-center",
        className,
      )}
    >
      <LogoMark size={size} />
      <span className="min-w-0 leading-none">
        <LogoWordmark
          className={cn("block truncate font-black tracking-tight", stacked ? "text-4xl" : "text-sm")}
        />
        <span
          className={cn(
            "mt-1 block truncate uppercase tracking-[0.22em] text-violet",
            stacked ? "text-[11px]" : "text-[10px] text-faint",
          )}
        >
          {APP_TAGLINE}
        </span>
      </span>
    </span>
  );
}
