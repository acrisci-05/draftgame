"use client";

import { toPng } from "html-to-image";
import { Download, Loader2, Share2 } from "lucide-react";
import QRCode from "qrcode";
import { useCallback, useEffect, useRef, useState } from "react";
import { categoryName } from "@/lib/catalog";
import { useIsClient } from "@/lib/client-store";
import { APP_NAME, SITE_DOMAIN } from "@/lib/config";
import { coverPalette } from "@/lib/covers";
import { useItemImage } from "@/lib/images";
import { rosterValue, standings } from "@/lib/game";
import { useSettings } from "@/lib/settings";
import type { CurrencyCode, GameState, RosterEntry } from "@/lib/types";
import { hashString, initials, money } from "@/lib/utils";
import { AvatarGlyph } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";

/**
 * Misure della card in base a quanti giocano: con otto roster da mostrare tutto
 * si stringe, ma niente deve uscire dai 1080x1920 né mangiarsi il piede pagina.
 */
function layoutFor(playerCount: number) {
  if (playerCount <= 2) {
    return { columns: 1, tile: 150, name: 32, avatar: 44, itemName: 18, price: 20, gap: 20 };
  }
  if (playerCount <= 4) {
    return { columns: 2, tile: 118, name: 28, avatar: 40, itemName: 17, price: 19, gap: 18 };
  }
  if (playerCount <= 6) {
    return { columns: 2, tile: 96, name: 25, avatar: 34, itemName: 15, price: 17, gap: 14 };
  }
  return { columns: 3, tile: 74, name: 21, avatar: 28, itemName: 13, price: 15, gap: 12 };
}

type CardLayout = ReturnType<typeof layoutFor>;

/** Tassello di un elemento vinto: foto, prezzo di aggiudicazione e nome. */
function RosterTile({
  entry,
  currency,
  layout,
  hint,
  auto,
}: {
  entry: RosterEntry;
  currency: CurrencyCode;
  layout: CardLayout;
  hint?: string;
  auto: boolean;
}) {
  const palette = coverPalette(entry.itemId + entry.name);
  const width = layout.tile;
  const { src, onError } = useItemImage(entry, hint, auto);

  return (
    <div style={{ width, display: "flex", flexDirection: "column", gap: 6 }}>
      <div
        style={{
          position: "relative",
          width: "100%",
          aspectRatio: "1 / 1",
          borderRadius: 16,
          border: "2px solid #ffffff1f",
          backgroundImage: `linear-gradient(140deg, ${palette.from}, ${palette.to})`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
        }}
      >
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt=""
            crossOrigin="anonymous"
            referrerPolicy="no-referrer"
            onError={onError}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          <span style={{ fontSize: width / 3, fontWeight: 900, color: "#ffffffdd" }}>
            {entry.emoji ?? initials(entry.name)}
          </span>
        )}
        {/* Unico badge sulla foto: il prezzo a cui è stato aggiudicato. */}
        <span
          style={{
            position: "absolute",
            top: 5,
            right: 5,
            backgroundColor: GOLD,
            color: "#3f2d00",
            fontSize: layout.price,
            fontWeight: 900,
            borderRadius: 999,
            padding: "3px 9px",
            boxShadow: "0 2px 10px rgba(0,0,0,0.45)",
          }}
        >
          {money(entry.price, currency)}
        </span>
      </div>
      <span
        style={{
          fontSize: layout.itemName,
          fontWeight: 600,
          lineHeight: 1.15,
          color: "#e4e4e7",
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
        }}
      >
        {entry.name}
      </span>
    </div>
  );
}

export const CARD_WIDTH = 1080;
export const CARD_HEIGHT = 1920;

/** Moltiplicatore dell'esportazione: 2 = niente sgranature sui display retina. */
const EXPORT_SCALE = 2;

const NEON = "#22c55e";
const VIOLET = "#a855f7";
const GOLD = "#fbbf24";
const INK = "#09090b";
const CARD_BG = "#101014";

export function TikTokCard({ state, voteUrl }: { state: GameState; voteUrl?: string | null }) {
  const { locale, autoImages, t } = useSettings();
  const cardRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.3);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Il QR resta legato al proprio link: così non serve azzerarlo quando il link cambia. */
  const [qr, setQr] = useState<{ url: string; data: string } | null>(null);
  const isClient = useIsClient();
  const canShare = isClient && typeof navigator !== "undefined" && Boolean(navigator.canShare);

  useEffect(() => {
    const element = wrapperRef.current;
    if (!element) return;
    const update = () => setScale(element.clientWidth / CARD_WIDTH);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!voteUrl) return;
    let active = true;
    QRCode.toDataURL(voteUrl, { width: 320, margin: 1 })
      .then((data) => {
        if (active) setQr({ url: voteUrl, data });
      })
      .catch(() => {
        /* senza QR la card mostra solo il dominio */
      });
    return () => {
      active = false;
    };
  }, [voteUrl]);

  /**
   * L'immagine esce a 2160x3840: il doppio dei 1080x1920 di progetto, così
   * resta nitida sugli schermi ad alta densità e quando i social la ricomprimono.
   */
  const render = useCallback(async () => {
    if (!cardRef.current) throw new Error("card-not-ready");
    return toPng(cardRef.current, {
      width: CARD_WIDTH,
      height: CARD_HEIGHT,
      pixelRatio: EXPORT_SCALE,
      cacheBust: true,
      backgroundColor: INK,
      style: { transform: "none", transformOrigin: "top left", margin: "0" },
    });
  }, []);

  const fileName = `pick-and-pay-${state.code}.png`;

  const download = async () => {
    setBusy(true);
    setError(null);
    try {
      const dataUrl = await render();
      const link = document.createElement("a");
      link.download = fileName;
      link.href = dataUrl;
      link.click();
    } catch {
      setError(t("results.exportError"));
    } finally {
      setBusy(false);
    }
  };

  const share = async () => {
    setBusy(true);
    setError(null);
    try {
      const dataUrl = await render();
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], fileName, { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `${APP_NAME} · ${categoryName(state.category, locale)}`,
        });
      } else {
        const link = document.createElement("a");
        link.download = fileName;
        link.href = dataUrl;
        link.click();
      }
    } catch {
      setError(t("results.shareError"));
    } finally {
      setBusy(false);
    }
  };

  const currency = state.config.currency;
  const layout = layoutFor(state.players.length);
  const backdrop = coverPalette(state.category.id + state.code);
  const pledge = state.config.pledge?.trim();
  // Il primo in classifica prende la corona, ma solo se c'è qualcuno da battere.
  const winnerId = state.players.length > 1 ? (standings(state)[0]?.id ?? null) : null;

  return (
    <div className="flex flex-col gap-3">
      <div
        ref={wrapperRef}
        className="overflow-hidden rounded-2xl border border-line"
        style={{ height: CARD_HEIGHT * scale }}
      >
        <div
          ref={cardRef}
          /* La card esportata resta sempre in layout LTR, anche con l'interfaccia in arabo. */
          dir="ltr"
          style={{
            width: CARD_WIDTH,
            height: CARD_HEIGHT,
            transform: `scale(${scale})`,
            transformOrigin: "top left",
            backgroundColor: INK,
            backgroundImage: `radial-gradient(circle at 12% -6%, ${backdrop.from}, transparent 46%), radial-gradient(circle at 92% 4%, ${VIOLET}30, transparent 42%), radial-gradient(circle at 60% 108%, ${NEON}22, transparent 46%)`,
            color: "#f4f4f5",
            display: "flex",
            flexDirection: "column",
            padding: 56,
            boxSizing: "border-box",
            overflow: "hidden",
          }}
        >
          <header style={{ flexShrink: 0 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span
                style={{
                  fontSize: 24,
                  letterSpacing: 6,
                  textTransform: "uppercase",
                  color: "#a1a1aa",
                  fontWeight: 700,
                }}
              >
                Room {state.code}
              </span>
              <span
                style={{
                  fontSize: 22,
                  fontWeight: 800,
                  color: NEON,
                  border: `2px solid ${NEON}55`,
                  borderRadius: 999,
                  padding: "9px 20px",
                }}
              >
                {money(state.config.budget, currency)} · {state.config.slots} PICK
              </span>
            </div>

            <h1
              style={{
                marginTop: 14,
                fontSize: 104,
                lineHeight: 0.9,
                fontWeight: 900,
                letterSpacing: -4,
              }}
            >
              <span style={{ color: NEON, textShadow: `0 0 42px ${NEON}88` }}>PICK</span>
              <span style={{ color: "#52525b" }}> & </span>
              <span style={{ color: VIOLET, textShadow: `0 0 42px ${VIOLET}88` }}>PAY</span>
            </h1>

            <p
              style={{
                marginTop: 14,
                fontSize: 38,
                fontWeight: 700,
                display: "flex",
                alignItems: "center",
                gap: 14,
              }}
            >
              <span style={{ fontSize: 44 }}>{state.category.emoji}</span>
              {categoryName(state.category, locale)}
            </p>

            <div
              style={{
                marginTop: 22,
                height: 4,
                background: `linear-gradient(90deg, ${NEON}, ${VIOLET}, transparent)`,
                borderRadius: 999,
              }}
            />
          </header>

          <main
            style={{
              flex: 1,
              minHeight: 0,
              marginTop: 26,
              display: "grid",
              gridTemplateColumns: `repeat(${layout.columns}, minmax(0, 1fr))`,
              gridAutoRows: "1fr",
              gap: layout.gap,
            }}
          >
            {state.players.map((player, index) => {
              const isWinner = player.id === winnerId;
              const accent = isWinner ? GOLD : index % 2 === 0 ? NEON : VIOLET;
              return (
                <section
                  key={player.id}
                  style={{
                    position: "relative",
                    border: isWinner ? `3px solid ${GOLD}` : `2px solid ${accent}45`,
                    boxShadow: isWinner ? `0 0 34px ${GOLD}44` : "none",
                    borderRadius: 26,
                    backgroundColor: CARD_BG,
                    padding: layout.columns === 3 ? 14 : 20,
                    paddingTop: isWinner ? 30 : layout.columns === 3 ? 14 : 20,
                    display: "flex",
                    flexDirection: "column",
                    gap: layout.columns === 3 ? 10 : 14,
                    minHeight: 0,
                    overflow: "hidden",
                  }}
                >
                  {isWinner ? (
                    <span
                      style={{
                        position: "absolute",
                        top: -2,
                        left: "50%",
                        transform: "translateX(-50%)",
                        backgroundColor: GOLD,
                        color: "#3f2d00",
                        fontSize: layout.columns === 3 ? 15 : 19,
                        fontWeight: 900,
                        letterSpacing: 1,
                        borderRadius: "0 0 14px 14px",
                        padding: "4px 16px",
                        whiteSpace: "nowrap",
                      }}
                    >
                      👑 {t("card.winner")}
                    </span>
                  ) : null}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 12,
                      flexShrink: 0,
                    }}
                  >
                    <span
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        fontSize: layout.name,
                        fontWeight: 800,
                        minWidth: 0,
                        overflow: "hidden",
                        whiteSpace: "nowrap",
                        textOverflow: "ellipsis",
                      }}
                    >
                      <span
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          width: layout.avatar,
                          height: layout.avatar,
                          borderRadius: 999,
                          backgroundColor: "#27272a",
                          color: accent,
                          flexShrink: 0,
                        }}
                      >
                        <AvatarGlyph id={player.emoji} size={Math.round(layout.avatar * 0.55)} />
                      </span>
                      {player.name}
                    </span>
                    <span
                      style={{
                        flexShrink: 0,
                        fontSize: layout.price,
                        fontWeight: 800,
                        color: accent,
                        border: `2px solid ${accent}55`,
                        backgroundColor: `${accent}14`,
                        borderRadius: 999,
                        padding: "7px 15px",
                      }}
                    >
                      {money(player.budget, currency)} left
                    </span>
                  </div>

                  <div
                    style={{
                      flex: 1,
                      minHeight: 0,
                      display: "flex",
                      flexDirection: "column",
                      gap: 10,
                    }}
                  >
                    {player.roster.length === 0 ? (
                      <span style={{ fontSize: 24, color: "#52525b" }}>—</span>
                    ) : (
                      /* I lotti in una griglia sola, dal più pagato al meno:
                         niente più righe per fascia di prezzo. */
                      <div
                        style={{
                          display: "flex",
                          flexWrap: "wrap",
                          gap: layout.columns === 3 ? 8 : 10,
                          alignContent: "flex-start",
                        }}
                      >
                        {[...player.roster]
                          .sort((a, b) => b.price - a.price)
                          .map((entry) => (
                            <RosterTile
                              key={entry.itemId}
                              entry={entry}
                              currency={currency}
                              layout={layout}
                              hint={state.category.name}
                              auto={autoImages}
                            />
                          ))}
                      </div>
                    )}
                  </div>

                  <div
                    style={{
                      flexShrink: 0,
                      fontSize: layout.columns === 3 ? 15 : 20,
                      color: "#71717a",
                      display: "flex",
                      justifyContent: "space-between",
                      borderTop: "1px solid #26262e",
                      paddingTop: 10,
                    }}
                  >
                    <span>
                      {player.roster.length}/{state.config.slots}
                    </span>
                    <span>{money(rosterValue(player), currency)} spent</span>
                  </div>
                </section>
              );
            })}
          </main>

          {pledge ? (
            <div
              style={{
                flexShrink: 0,
                marginTop: 18,
                border: `2px solid ${GOLD}66`,
                backgroundColor: `${GOLD}14`,
                borderRadius: 20,
                padding: "14px 22px",
                display: "flex",
                alignItems: "center",
                gap: 14,
                minWidth: 0,
              }}
            >
              <span style={{ fontSize: 30, flexShrink: 0 }}>🎯</span>
              <span style={{ minWidth: 0 }}>
                <span
                  style={{
                    display: "block",
                    fontSize: 18,
                    fontWeight: 900,
                    letterSpacing: 3,
                    textTransform: "uppercase",
                    color: GOLD,
                  }}
                >
                  {t("card.pledge")}
                </span>
                <span
                  style={{
                    display: "block",
                    marginTop: 2,
                    fontSize: 28,
                    fontWeight: 800,
                    color: "#f4f4f5",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {pledge}
                </span>
              </span>
            </div>
          ) : null}

          <footer
            style={{
              flexShrink: 0,
              marginTop: 22,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 18,
            }}
          >
            <div style={{ minWidth: 0 }}>
              <p style={{ fontSize: 30, fontWeight: 900, color: GOLD }}>
                {state.players.length > 1 ? t("card.question") : t("card.solo")}
              </p>
              <p style={{ marginTop: 6, fontSize: 24, fontWeight: 700, color: "#a1a1aa" }}>
                {APP_NAME} • {t("card.footer", { domain: SITE_DOMAIN })}
              </p>
            </div>
            {qr && qr.url === voteUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={qr.data}
                alt=""
                style={{
                  width: 120,
                  height: 120,
                  borderRadius: 14,
                  backgroundColor: "#fff",
                  padding: 6,
                  flexShrink: 0,
                }}
              />
            ) : (
              <span
                style={{
                  fontSize: 20,
                  fontWeight: 800,
                  letterSpacing: 3,
                  textTransform: "uppercase",
                  color: "#3f3f46",
                  flexShrink: 0,
                }}
              >
                {hashString(state.code) % 2 === 0 ? "draft night" : "game night"}
              </span>
            )}
          </footer>
        </div>
      </div>

      {error ? <p className="text-center text-sm text-red-500">{error}</p> : null}

      <div className="grid grid-cols-2 gap-2">
        <Button onClick={download} disabled={busy}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
          {t("results.download")}
        </Button>
        <Button variant="violet" onClick={share} disabled={busy || !canShare}>
          <Share2 className="size-4" />
          {t("common.share")}
        </Button>
      </div>
    </div>
  );
}
