"use client";

import { toPng } from "html-to-image";
import { Download, Loader2, Share2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useIsClient } from "@/lib/client-store";
import { START_BUDGET, rosterValue } from "@/lib/game";
import type { GameState } from "@/lib/types";
import { TIER_STYLES } from "@/lib/utils";
import { Button } from "@/components/ui/Button";

export const CARD_WIDTH = 1080;
export const CARD_HEIGHT = 1920;

const NEON = "#22c55e";
const VIOLET = "#a855f7";
const INK = "#09090b";

export function TikTokCard({ state }: { state: GameState }) {
  const cardRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.3);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
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

  const render = useCallback(async () => {
    if (!cardRef.current) throw new Error("Card non pronta");
    return toPng(cardRef.current, {
      width: CARD_WIDTH,
      height: CARD_HEIGHT,
      pixelRatio: 1,
      cacheBust: true,
      backgroundColor: INK,
      style: { transform: "none", transformOrigin: "top left", margin: "0" },
    });
  }, []);

  const fileName = `draft-${state.code}-${state.category.id}.png`;

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
      setError("Esportazione non riuscita. Riprova.");
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
        await navigator.share({ files: [file], title: `$20 Draft · ${state.category.name}` });
      } else {
        const link = document.createElement("a");
        link.download = fileName;
        link.href = dataUrl;
        link.click();
      }
    } catch {
      setError("Condivisione non riuscita. Usa il download.");
    } finally {
      setBusy(false);
    }
  };

  const columns = state.players.length <= 3 ? 1 : 2;

  return (
    <div className="flex flex-col gap-3">
      <div
        ref={wrapperRef}
        className="overflow-hidden rounded-2xl border border-line"
        style={{ height: CARD_HEIGHT * scale }}
      >
        <div
          ref={cardRef}
          style={{
            width: CARD_WIDTH,
            height: CARD_HEIGHT,
            transform: `scale(${scale})`,
            transformOrigin: "top left",
            backgroundColor: INK,
            color: "#f4f4f5",
            display: "flex",
            flexDirection: "column",
            padding: 64,
            boxSizing: "border-box",
            position: "relative",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: 0,
              backgroundImage: `radial-gradient(circle at 15% -5%, ${VIOLET}33, transparent 45%), radial-gradient(circle at 95% 8%, ${NEON}2b, transparent 42%)`,
            }}
          />

          <header style={{ position: "relative", flexShrink: 0 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span
                style={{
                  fontSize: 26,
                  letterSpacing: 6,
                  textTransform: "uppercase",
                  color: "#71717a",
                  fontWeight: 700,
                }}
              >
                Stanza {state.code}
              </span>
              <span
                style={{
                  fontSize: 24,
                  fontWeight: 700,
                  color: NEON,
                  border: `2px solid ${NEON}55`,
                  borderRadius: 999,
                  padding: "10px 22px",
                }}
              >
                ${START_BUDGET} BUDGET
              </span>
            </div>

            <h1
              style={{
                marginTop: 18,
                fontSize: 116,
                lineHeight: 0.92,
                fontWeight: 900,
                letterSpacing: -4,
              }}
            >
              <span style={{ color: NEON, textShadow: `0 0 42px ${NEON}88` }}>$20</span>{" "}
              <span>DRAFT</span>
            </h1>

            <p
              style={{
                marginTop: 18,
                fontSize: 40,
                fontWeight: 700,
                color: "#e4e4e7",
                display: "flex",
                alignItems: "center",
                gap: 14,
              }}
            >
              <span style={{ fontSize: 46 }}>{state.category.emoji}</span>
              {state.category.name}
            </p>

            <div
              style={{
                marginTop: 26,
                height: 4,
                width: "100%",
                background: `linear-gradient(90deg, ${NEON}, ${VIOLET}, transparent)`,
                borderRadius: 999,
              }}
            />
          </header>

          <main
            style={{
              position: "relative",
              flex: 1,
              marginTop: 34,
              display: "grid",
              gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
              gap: 22,
              alignContent: "start",
              overflow: "hidden",
            }}
          >
            {state.players.map((player, index) => {
              const accent = index % 2 === 0 ? NEON : VIOLET;
              return (
                <section
                  key={player.id}
                  style={{
                    border: `2px solid ${accent}40`,
                    borderRadius: 26,
                    backgroundColor: "#101014",
                    padding: 22,
                    display: "flex",
                    flexDirection: "column",
                    gap: 14,
                    minHeight: 0,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 12,
                    }}
                  >
                    <span
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        fontSize: 34,
                        fontWeight: 800,
                        minWidth: 0,
                        overflow: "hidden",
                        whiteSpace: "nowrap",
                        textOverflow: "ellipsis",
                      }}
                    >
                      <span style={{ fontSize: 34 }}>{player.emoji}</span>
                      {player.name}
                    </span>
                    <span
                      style={{
                        flexShrink: 0,
                        fontSize: 24,
                        fontWeight: 800,
                        color: accent,
                        border: `2px solid ${accent}55`,
                        backgroundColor: `${accent}14`,
                        borderRadius: 999,
                        padding: "8px 16px",
                      }}
                    >
                      ${player.budget} left
                    </span>
                  </div>

                  <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                    {player.roster.length === 0 ? (
                      <span style={{ fontSize: 24, color: "#52525b" }}>Nessun acquisto</span>
                    ) : (
                      player.roster.map((entry) => (
                        <span
                          key={entry.itemId}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 10,
                            border: `2px solid ${TIER_STYLES[entry.tier].hex}44`,
                            backgroundColor: "#17171d",
                            borderRadius: 16,
                            padding: "10px 16px",
                            fontSize: 26,
                            fontWeight: 600,
                          }}
                        >
                          <span
                            style={{
                              width: 12,
                              height: 12,
                              borderRadius: 999,
                              backgroundColor: TIER_STYLES[entry.tier].hex,
                            }}
                          />
                          {entry.name}
                          <span style={{ color: TIER_STYLES[entry.tier].hex, fontWeight: 800 }}>
                            ${entry.price}
                          </span>
                        </span>
                      ))
                    )}
                  </div>

                  <div
                    style={{
                      marginTop: "auto",
                      fontSize: 22,
                      color: "#71717a",
                      display: "flex",
                      justifyContent: "space-between",
                    }}
                  >
                    <span>{player.roster.length} elementi</span>
                    <span>${rosterValue(player)} spesi</span>
                  </div>
                </section>
              );
            })}
          </main>

          <footer
            style={{
              position: "relative",
              flexShrink: 0,
              marginTop: 26,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 16,
            }}
          >
            <span style={{ fontSize: 32, fontWeight: 800, color: VIOLET }}>
              Chi ha fatto il draft migliore?
            </span>
            <span
              style={{
                fontSize: 24,
                fontWeight: 700,
                letterSpacing: 3,
                textTransform: "uppercase",
                color: "#52525b",
              }}
            >
              draft game
            </span>
          </footer>
        </div>
      </div>

      {error ? <p className="text-center text-sm text-red-400">{error}</p> : null}

      <div className="grid grid-cols-2 gap-2">
        <Button onClick={download} disabled={busy}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
          Scarica immagine
        </Button>
        <Button variant="violet" onClick={share} disabled={busy || !canShare}>
          <Share2 className="size-4" />
          Condividi
        </Button>
      </div>
    </div>
  );
}
