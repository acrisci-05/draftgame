"use client";

import { HelpCircle } from "lucide-react";
import { useState } from "react";
import { coverContent } from "@/lib/covers";
import { useItemImage } from "@/lib/images";
import type { CatalogItem, RosterEntry } from "@/lib/types";
import { cn } from "@/lib/utils";

type CoverSize = "xs" | "sm" | "md" | "lg" | "xl";

const SIZES: Record<CoverSize, string> = {
  xs: "size-9 rounded-lg text-[11px]",
  sm: "size-12 rounded-xl text-sm",
  md: "size-20 rounded-2xl text-xl",
  lg: "size-28 rounded-2xl text-3xl",
  /*
   * Su telefono la copertina si ferma a un terzo dello schermo.
   *
   * A tutta larghezza su un 390px il quadrato e' alto 390px, cioe' quasi
   * meta' della pagina: i tasti di rilancio finivano sotto la piega e per
   * arrivarci bisognava scorrere mentre il cronometro correva. Il tetto
   * vale su entrambi i lati, cosi' resta quadrata e centrata.
   */
  xl: "mx-auto aspect-square w-full max-h-[34dvh] max-w-[34dvh] rounded-3xl text-7xl sm:max-h-none sm:max-w-none",
};

const FALLBACK_ICON: Record<CoverSize, string> = {
  xs: "size-5",
  sm: "size-6",
  md: "size-8",
  lg: "size-12",
  xl: "size-24",
};

interface ItemCoverProps {
  item: CatalogItem | RosterEntry | null;
  size?: CoverSize;
  /**
   * Asta al buio: l'elemento non si deve vedere né leggere. Non basta sfocare
   * l'immagine, perché indirizzo e testo alternativo resterebbero nella pagina:
   * qui non viene proprio disegnata.
   */
  covered?: boolean;
  mystery?: boolean;
  /** Cerca online una foto reale quando l'elemento non ne ha già una. */
  auto?: boolean;
  /** Nome della categoria: rende più precisa la ricerca automatica. */
  hint?: string;
  /**
   * L'immagine e' un marchio, non una foto.
   *
   * I loghi sono quasi sempre neri su sfondo trasparente: sul fondo scuro
   * delle card sparirebbero. Qui vanno su una lastra chiara e per intero,
   * senza ritaglio -- meta' di un marchio non e' riconoscibile.
   */
  logo?: boolean;
  className?: string;
}

export function ItemCover({
  item,
  size = "md",
  covered = false,
  mystery = false,
  auto = false,
  hint,
  logo = false,
  className,
}: ItemCoverProps) {
  const hide = mystery || covered || !item;
  // Con il lotto coperto non si cerca nemmeno la foto: nessuna richiesta, nessun
  // indirizzo che passi dalla pagina prima del tempo.
  const { src, onError } = useItemImage(item, hint, auto && !hide);

  /*
   * Lo scheletro dura finche' la foto non e' arrivata.
   *
   * Si tiene l'indirizzo che ha finito di caricare, non un si'/no: cosi' al
   * lotto dopo -- indirizzo diverso -- il riflesso riparte da solo, senza
   * bisogno di un effetto che azzeri niente. Sta qui sopra e non piu' in basso
   * perche' i ganci vanno chiamati sempre, anche quando il lotto e' coperto:
   * saltarli su un ramo e non sull'altro cambia il loro ordine fra un disegno
   * e l'altro, ed e' il tipo di guasto che si manifesta a caso.
   */
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null);
  const segnaCaricata = () => setLoadedSrc(src ?? null);

  if (hide) {
    return (
      <div
        aria-label="?"
        className={cn(
          "grid shrink-0 place-items-center border",
          mystery
            ? "border-violet/50 bg-violet/15 text-violet"
            : "border-line bg-zinc-950 text-zinc-600",
          SIZES[size],
          className,
        )}
      >
        <HelpCircle className={FALLBACK_ICON[size]} />
      </div>
    );
  }

  const cover = coverContent(item);
  const large = size === "xl";
  // Solo sul formato grande: venti miniature che luccicano insieme sarebbero
  // un disturbo, non un'informazione.
  const skeleton = large && Boolean(src) && loadedSrc !== src;


  // La lastra chiara vale solo quando c'e' davvero un'immagine: senza, resta
  // il riquadro colorato con l'emoji, che sul chiaro si leggerebbe male.
  const plate = logo && Boolean(src);

  /*
   * Immagine probabilmente ritagliata sul trasparente.
   *
   * Non si puo' sapere davvero se un file ha il canale alfa senza scaricarlo e
   * guardarlo, ma l'estensione basta a indovinare quasi sempre: PNG, SVG e WEBP
   * sono i formati che si usano per i ritagli, JPG no -- un JPG uno sfondo ce
   * l'ha per forza.
   *
   * Serve a decidere due cose: non ritagliare l'immagine, e darle l'alone. Un
   * soggetto scuro su trasparente, appoggiato su fondo scuro, sparisce -- ed e'
   * proprio il caso segnalato.
   */
  const ritagliata = /[.](png|svg|webp)([?]|$)/i.test(src ?? "");

  return (
    <div
      style={large || plate ? undefined : cover.style}
      className={cn(
        "relative shrink-0 overflow-hidden border",
        /*
         * Grigio profondo, non nero pieno.
         *
         * Su nero assoluto un ritaglio con i contorni scuri non ha piu' un
         * bordo: la sagoma finisce e non comincia niente, e l'oggetto
         * scompare. Bastano pochi punti di luminosita' perche' il nero del
         * soggetto torni a essere un nero *sopra* qualcosa.
         */
        plate
          ? "border-white/15 bg-white"
          : large
            ? "border-line bg-neutral-900"
            : "border-white/10",
        SIZES[size],
        className,
      )}
    >
      {skeleton ? (
        <span
          aria-hidden
          className="skeleton-shimmer absolute inset-0 z-10 block rounded-[inherit] bg-surface-2"
        />
      ) : null}

      {/*
        Lo sfondo sfocato che riempie il nero.

        Le foto del catalogo hanno tutte le forme: una locandina e' alta e
        stretta, un logo e' largo e basso, una fotografia e' quadrata. Dentro un
        riquadro quadrato l'immagine intera lascia due bande nere, e il lotto
        sembra piccolo e ritagliato male.

        La stessa immagine, ingrandita e sfocata sotto, riempie quelle bande
        con i colori del soggetto: il riquadro si tinge di quello che c'e'
        dentro invece di restare nero. E' la tecnica delle copertine sui
        lettori musicali, e funziona per la stessa ragione -- l'occhio legge un
        blocco solo invece di una figura appoggiata su un vuoto.

        Non si fa sui marchi: quelli stanno su una lastra bianca apposta,
        perche' un logo nero su fondo colorato non si legge.
      */}
      {large && src && !plate ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          aria-hidden
          crossOrigin="anonymous"
          referrerPolicy="no-referrer"
          className="pointer-events-none absolute inset-0 size-full scale-125 object-cover opacity-30 blur-xl"
        />
      ) : null}

      {/*
        Il punto luce dietro il soggetto.

        Sta sopra lo sfondo sfocato e sotto l'immagine: e' un alone chiaro al
        centro, dove il soggetto sta quasi sempre. Serve a dare al ritaglio un
        fondo su cui staccarsi -- senza, un contorno scuro finisce nel niente e
        l'oggetto sembra mangiato dalla card.

        Non si mette sulla lastra dei marchi: li' il fondo e' gia' bianco, e
        schiarirlo ancora non aggiunge nulla.
      */}
      {large && !plate ? (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 z-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-white/[0.14] via-transparent to-transparent"
        />
      ) : null}

      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={item.name}
          loading="lazy"
          crossOrigin="anonymous"
          referrerPolicy="no-referrer"
          onLoad={segnaCaricata}
          onError={() => {
            // Anche la foto che non arriva smette di "star caricando": senza,
            // il riflesso resterebbe acceso per sempre su un lotto rotto.
            segnaCaricata();
            onError();
          }}
          className={cn(
            large
              ? // Intera e centrata, mai tagliata: su una locandina il ritaglio
                // porterebbe via il titolo, e su una foto di gruppo mezza faccia.
                "relative z-[1] h-full w-full object-contain p-6 transition-all duration-300 hover:scale-105"
              : "size-full object-cover",
            /*
             * L'alone e' chiaro, non scuro, e va solo sui ritagli.
             *
             * Prima c'era un'ombra nera: su un fondo scuro e' invisibile per
             * definizione, e non ha mai fatto niente. Un alone bianco invece
             * disegna il bordo del soggetto, come il contorno delle figurine.
             *
             * Ma solo dove serve. Una fotografia e' un rettangolo pieno: non
             * sparisce, e un alone le disegnerebbe attorno un'aureola
             * rettangolare che si vede e non si spiega. Un ritaglio invece
             * finisce nel niente, ed e' li' che il bordo va restituito.
             */
            large && !plate && ritagliata && "drop-shadow-[0_0_14px_rgba(255,255,255,0.45)]",
            // Un marchio non si ritaglia mai, nemmeno nelle miniature.
            plate && !large && "size-full object-contain p-1.5",
            /*
             * Un ritaglio nelle miniature non si taglia e non si appiccica ai
             * bordi: senza respiro attorno, la sagoma tocca la cornice e non
             * si capisce piu' dove finisce l'oggetto e dove comincia la card.
             */
            ritagliata && !large && !plate && "size-full object-contain p-1",
            ritagliata &&
              !large &&
              !plate &&
              "drop-shadow-[0_0_4px_rgba(255,255,255,0.35)]",
          )}
        />
      ) : (
        <div
          style={large ? cover.style : undefined}
          className="grid size-full place-items-center font-black text-white/90"
        >
          <span
            className={cn(
              large &&
                "grid size-28 place-items-center rounded-3xl border border-white/15 bg-black/30 backdrop-blur-sm",
            )}
          >
            {cover.emoji ?? cover.label}
          </span>
        </div>
      )}

      {/*
        Un velo scuro appoggiato in basso.

        Serve a due cose insieme: appoggia l'immagine sul riquadro invece di
        lasciarla galleggiare, e tiene sotto controllo lo sfondo sfocato quando
        il soggetto e' chiaro -- una foto su fondo bianco, sfocata al 30%,
        schiarisce tutto il riquadro e il nome sotto perde contrasto. E' appena
        accennato e non tocca il centro, dove sta il soggetto.
      */}
      {large && src ? (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 z-[2] h-1/3 bg-gradient-to-t from-black/50 via-black/15 to-transparent"
        />
      ) : null}
    </div>
  );
}
