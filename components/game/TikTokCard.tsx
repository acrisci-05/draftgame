"use client";

import { toPng } from "html-to-image";
import { Download, Loader2, Share2 } from "lucide-react";
import QRCode from "qrcode";
import { useCallback, useEffect, useRef, useState } from "react";
import { categoryName } from "@/lib/catalog";
import { useIsClient } from "@/lib/client-store";
import { APP_NAME, SITE_DOMAIN } from "@/lib/config";
import { coverPalette } from "@/lib/covers";
import { rosterValue } from "@/lib/game";
import { useSettings } from "@/lib/settings";
import type { CurrencyCode, GameState, RosterEntry } from "@/lib/types";
import { TIER_ORDER, TIER_STYLES, hashString, initials, money } from "@/lib/utils";
import { Button } from "@/components/ui/Button";

/** Tassello di un elemento vinto, con badge dorato del prezzo pagato. */
function RosterTile({
  entry,
  currency,
  width,
}: {
  entry: RosterEntry;
  currency: CurrencyCode;
  width: number;
}) {
  const palette = coverPalette(entry.itemId + entry.name);
  const tint = TIER_STYLES[entry.tier].hex;

  return (
    <div style={{ width, display: "flex", flexDirection: "column", gap: 6 }}>
      <div
        style={{
          position: "relative",
          width: "100%",
          aspectRatio: "1 / 1",
          borderRadius: 16,
          border: `2px solid ${tint}66`,
          backgroundImage: `linear-gradient(140deg, ${palette.from}, ${palette.to})`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
        }}
      >
        {entry.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={entry.image}
            alt=""
            crossOrigin="anonymous"
            referrerPolicy="no-referrer"
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          <span style={{ fontSize: 34, fontWeight: 900, color: "#ffffffdd" }}>
            {entry.emoji ?? initials(entry.name)}
          </span>
        )}
        <span
          style={{
            position: "absolute",
            top: 6,
            right: 6,
            backgroundColor: GOLD,
            color: "#3f2d00",
            fontSize: 20,
            fontWeight: 900,
            borderRadius: 999,
            padding: "3px 10px",
            boxShadow: "0 2px 10px rgba(0,0,0,0.45)",
          }}
        >
          {money(entry.price, currency)}
        </span>
      </div>
      <span
        style={{
          fontSize: 18,
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

const NEON = "#22c55e";
const VIOLET = "#a855f7";
const GOLD = "#fbbf24";
const INK = "#09090b";
const CARD_BG = "#101014";

export function TikTokCard({ state, voteUrl }: { state: GameState; voteUrl?: string | null }) {
  const { locale, t } = useSettings();
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

  const render = useCallback(async () => {
    if (!cardRef.current) throw new Error("card-not-ready");
    return toPng(cardRef.current, {
      width: CARD_WIDTH,
      height: CARD_HEIGHT,
      pixelRatio: 1,
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
  const columns = state.players.length <= 3 ? 1 : 2;
  const tileWidth = columns === 1 ? 150 : 118;
  const backdrop = coverPalette(state.category.id + state.code);

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
              gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
              gridAutoRows: "1fr",
              gap: 20,
            }}
          >
            {state.players.map((player, index) => {
              const accent = index % 2 === 0 ? NEON : VIOLET;
              return (
                <section
                  key={player.id}
                  style={{
                    border: `2px solid ${accent}45`,
                    borderRadius: 26,
                    backgroundColor: CARD_BG,
                    padding: 20,
                    display: "flex",
                    flexDirection: "column",
                    gap: 14,
                    minHeight: 0,
                    overflow: "hidden",
                  }}
                >
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
                        fontSize: 32,
                        fontWeight: 800,
                        minWidth: 0,
                        overflow: "hidden",
                        whiteSpace: "nowrap",
                        textOverflow: "ellipsis",
                      }}
                    >
                      <span>{player.emoji}</span>
                      {player.name}
                    </span>
                    <span
                      style={{
                        flexShrink: 0,
                        fontSize: 22,
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
                      // Roster ordinato per fascia: i 5 in alto, gli 1 in fondo.
                      TIER_ORDER.map((tier) => {
                        const entries = player.roster.filter((entry) => entry.tier === tier);
                        if (entries.length === 0) return null;
                        const tint = TIER_STYLES[tier].hex;
                        return (
                          <div
                            key={tier}
                            style={{ display: "flex", alignItems: "flex-start", gap: 10 }}
                          >
                            <span
                              style={{
                                flexShrink: 0,
                                width: 32,
                                height: 32,
                                marginTop: 4,
                                borderRadius: 10,
                                border: `2px solid ${tint}66`,
                                backgroundColor: `${tint}20`,
                                color: tint,
                                fontSize: 17,
                                fontWeight: 900,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                              }}
                            >
                              {TIER_STYLES[tier].letter}
                            </span>
                            <div
                              style={{
                                display: "flex",
                                flexWrap: "wrap",
                                gap: 10,
                                flex: 1,
                                minWidth: 0,
                              }}
                            >
                              {entries.map((entry) => (
                                <RosterTile
                                  key={entry.itemId}
                                  entry={entry}
                                  currency={currency}
                                  width={tileWidth}
                                />
                              ))}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  <div
                    style={{
                      flexShrink: 0,
                      fontSize: 20,
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
