"use client";

import React, { useRef, useEffect, useState, useCallback } from "react";
import {
  FINISH_Y,
  PlayerState,
  initPlayers,
  tickPlayers,
  RACE_DURATION_MS,
  RACE_YEARS,
} from "@/lib/raceEngine";
// Career type used implicitly via PlayerState
import { PLAYERS } from "@/lib/players";

type Phase = "lobby" | "racing" | "finished";

// ── Layout ─────────────────────────────────────────────────────────────────
const HEADER_H  = 50;
const SKY_H     = 110;  // px from top of track to finish line
const BOTTOM_H  = 28;   // px below start line
const BABY_SIZE = 60;

// ── Palette ────────────────────────────────────────────────────────────────
const ZONES = [
  { progress: 0.78, label: "Has Strong Opinions About Wine", color: "#93c5fd" },
  { progress: 0.52, label: "LinkedIn Thought Leader",         color: "#9ca3af" },
  { progress: 0.26, label: "Ramen Budget, Champagne Dreams",  color: "#6b7280" },
] as const;

const PODIUM_COLORS = ["#fbbf24", "#94a3b8", "#cd7c3e"] as const;
const MEDALS        = ["🥇", "🥈", "🥉"] as const;

// ── Helpers ────────────────────────────────────────────────────────────────
function getProgress(s: PlayerState): number {
  return Math.min(s.y / FINISH_Y, 1);
}

function classLabel(p: number): string {
  if (p >= 0.78) return "Wine Opinions";
  if (p >= 0.52) return "LinkedIn Era";
  if (p >= 0.26) return "Ramen Dreams";
  return "Permanent Underclass";
}

// Maps baby progress (0→1) to a Y pixel position in the track container.
// progress=0 → near bottom, progress=1 → near top (finish line at SKY_H).
function babyScreenY(progress: number, trackH: number): number {
  return SKY_H + (1 - progress) * (trackH - SKY_H - BOTTOM_H);
}

function calcNetWorth(progress: number, speed: number): number {
  return Math.round(progress * progress * 2_000_000 * (0.5 + speed / 20));
}

function lerpColor(from: string, to: string, t: number): string {
  const f = parseInt(from.slice(1), 16);
  const e = parseInt(to.slice(1), 16);
  const r = Math.round(((f >> 16) & 0xff) * (1 - t) + ((e >> 16) & 0xff) * t);
  const g = Math.round(((f >>  8) & 0xff) * (1 - t) + ((e >>  8) & 0xff) * t);
  const b = Math.round(( f        & 0xff) * (1 - t) + ( e        & 0xff) * t);
  return `#${r.toString(16).padStart(2,"0")}${g.toString(16).padStart(2,"0")}${b.toString(16).padStart(2,"0")}`;
}

function fmtMoney(n: number): string {
  if (n >= 1_000_000) return "$" + (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return "$" + Math.round(n / 1_000) + "k";
  return "$" + n;
}

// ── Cloud ──────────────────────────────────────────────────────────────────
function Cloud({ left, top, scale = 1, animDuration, animDir }: {
  left: string; top: number; scale?: number;
  animDuration: string; animDir: "cloudDrift" | "cloudDriftSlow";
}) {
  return (
    <div style={{ position: "absolute", left, top, transform: `scale(${scale})`, transformOrigin: "left center", animation: `${animDir} ${animDuration} ease-in-out infinite`, pointerEvents: "none" }}>
      <div style={{ position: "absolute", width: 44, height: 16, borderRadius: 20, background: "rgba(255,255,255,0.82)", top: 10, left: 0 }} />
      <div style={{ position: "absolute", width: 24, height: 22, borderRadius: "50%", background: "rgba(255,255,255,0.82)", top: 0, left: 8 }} />
      <div style={{ position: "absolute", width: 20, height: 18, borderRadius: "50%", background: "rgba(255,255,255,0.78)", top: 3, left: 22 }} />
      <div style={{ position: "absolute", width: 14, height: 14, borderRadius: "50%", background: "rgba(255,255,255,0.7)", top: 6, left: 34 }} />
    </div>
  );
}

// ── Component ──────────────────────────────────────────────────────────────
export default function RaceTrack() {
  const [phase, setPhase]               = useState<Phase>("lobby");
  const [playerStates, setPlayerStates] = useState<PlayerState[]>([]);
  const [finishOrder, setFinishOrder]   = useState<string[]>([]);
  const [timeLeftMs, setTimeLeftMs]     = useState(RACE_DURATION_MS);
  const [vpHeight, setVpHeight]         = useState(800);
  const [winnerFlash, setWinnerFlash]   = useState<{ id: string; place: number } | null>(null);

  const animRef        = useRef<number | null>(null);
  const lastTimeRef    = useRef<number | null>(null);
  const elapsedRef     = useRef(0);
  const statesRef      = useRef<PlayerState[]>([]);
  const finishOrderRef = useRef<string[]>([]);

  useEffect(() => {
    const update = () => setVpHeight(window.innerHeight);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const tick = useCallback((timestamp: number) => {
    if (lastTimeRef.current === null) lastTimeRef.current = timestamp;
    const dt = Math.min(timestamp - lastTimeRef.current, 32);
    lastTimeRef.current = timestamp;
    elapsedRef.current += dt;

    const remaining = Math.max(0, RACE_DURATION_MS - elapsedRef.current);
    setTimeLeftMs(remaining);

    const nextStates = tickPlayers(
      statesRef.current,
      PLAYERS,
      elapsedRef.current,
      finishOrderRef.current,
    );

    const newFinishers = nextStates
      .filter(s => s.finished && !finishOrderRef.current.includes(s.id))
      .sort((a, b) => (a.finishTime ?? 0) - (b.finishTime ?? 0));

    if (newFinishers.length > 0) {
      const prevLen = finishOrderRef.current.length;
      finishOrderRef.current = [...finishOrderRef.current, ...newFinishers.map(s => s.id)];
      setFinishOrder([...finishOrderRef.current]);
      if (prevLen < 3) {
        setWinnerFlash({ id: newFinishers[0].id, place: prevLen + 1 });
        setTimeout(() => setWinnerFlash(null), 3000);
      }
    }

    statesRef.current = nextStates;
    setPlayerStates([...nextStates]);

    if (remaining === 0 || nextStates.every(s => s.finished)) {
      setPhase("finished");
      return;
    }

    animRef.current = requestAnimationFrame(tick);
  }, []);

  const startRace = useCallback(() => {
    if (animRef.current) cancelAnimationFrame(animRef.current);
    const states = initPlayers(PLAYERS);
    statesRef.current      = states;
    finishOrderRef.current = [];
    elapsedRef.current     = 0;
    lastTimeRef.current    = null;
    setPlayerStates(states);
    setFinishOrder([]);
    setTimeLeftMs(RACE_DURATION_MS);
    setWinnerFlash(null);
    setPhase("racing");
    animRef.current = requestAnimationFrame(tick);
  }, [tick]);

  useEffect(() => () => { if (animRef.current) cancelAnimationFrame(animRef.current); }, []);

  // ── Derived values ─────────────────────────────────────────────────────
  const trackH       = vpHeight - HEADER_H;
  const timeLeftSec  = Math.ceil(timeLeftMs / 1000);
  const yearsElapsed = Math.round((1 - timeLeftMs / RACE_DURATION_MS) * RACE_YEARS);
  const N            = PLAYERS.length;
  const lanePct      = 100 / N;

  // Zone Y positions in the track
  const zoneYs = ZONES.map(z => ({ ...z, y: babyScreenY(z.progress, trackH) }));

  // Lane background (dynamic, based on trackH)
  const z0y = Math.round(zoneYs[0].y);
  const z1y = Math.round(zoneYs[1].y);
  const z2y = Math.round(zoneYs[2].y);
  // Hell zone — fades in over the last 15 seconds
  const hellProgress = Math.max(0, 1 - timeLeftMs / 15_000);
  const hellMid = Math.round(z2y + (trackH - z2y) * 0.45);
  const hellHot = Math.round(z2y + (trackH - z2y) * 0.78);
  const laneBg = `linear-gradient(to bottom,
    #87ceeb 0px,
    #5aa8d8 ${SKY_H}px,
    #1e5090 ${Math.round(z0y * 0.8)}px,
    #0d1a2e ${z0y}px,
    #111122 ${z1y}px,
    #0c0c18 ${z2y}px,
    ${lerpColor("#0c0c18", "#2a0404", hellProgress)} ${hellMid}px,
    ${lerpColor("#0c0c18", "#7a1200", hellProgress)} ${hellHot}px,
    ${lerpColor("#0c0c18", "#c84000", hellProgress)} ${trackH - 12}px,
    ${lerpColor("#0c0c18", "#ff6600", hellProgress)} ${trackH}px
  )`;


  return (
    <div style={{ height: "100vh", overflow: "hidden", background: "#050510", position: "relative", userSelect: "none", fontFamily: "monospace" }}>

      {/* ── LOBBY ─────────────────────────────────────────────────────────── */}
      {phase === "lobby" && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", gap: 32, padding: "0 16px" }}>
          <h1 style={{ fontSize: 44, fontWeight: "bold", color: "white", margin: 0 }}>Baby Race</h1>
          <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 13, textAlign: "center", maxWidth: 380, margin: 0, lineHeight: 1.6 }}>
            {N} babies. {RACE_YEARS} years. One ladder out of the underclass.
            <br />Who escapes before time runs out?
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8, maxWidth: 480 }}>
            {PLAYERS.map(p => (
              <div key={p.id} style={{ borderRadius: 12, padding: "10px 8px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                <div style={{ width: 48, height: 48, borderRadius: "50%", border: `2px solid ${p.color}`, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: "bold", color: p.color }}>
                  {p.avatar
                    ? <img src={p.avatar} alt={p.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    : p.name.slice(0, 3)}
                </div>
                <span style={{ fontSize: 8, color: "rgba(255,255,255,0.45)" }}>{p.name}</span>
              </div>
            ))}
          </div>
          <button onClick={startRace} style={{ padding: "16px 52px", background: "white", color: "black", fontWeight: "bold", fontSize: 16, borderRadius: 16, border: "none", cursor: "pointer" }}>
            START RACE
          </button>
        </div>
      )}

      {/* ── RACE ──────────────────────────────────────────────────────────── */}
      {phase !== "lobby" && (
        <>
          {/* Header: lane names + net worth */}
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: HEADER_H, zIndex: 40, background: "rgba(5,5,16,0.97)", borderBottom: "1px solid rgba(255,255,255,0.07)", display: "flex", alignItems: "stretch" }}>
            {PLAYERS.map((cfg) => {
              const state    = playerStates.find(s => s.id === cfg.id);
              const placeIdx = finishOrder.indexOf(cfg.id);
              return (
                <div key={cfg.id} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", borderRight: "1px solid rgba(255,255,255,0.05)", gap: 1, overflow: "hidden" }}>
                  <span style={{ color: state?.career ? "rgba(255,255,255,0.35)" : cfg.color, fontSize: 16, fontWeight: "bold", lineHeight: 1 }}>
                    {placeIdx >= 0 && placeIdx < 3 ? MEDALS[placeIdx] + " " : ""}{state?.career ? state.career.emoji : cfg.name.slice(0, 5)}
                  </span>
                </div>
              );
            })}

            {/* BIG RED CLOCK */}
            <div style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%, -50%)", background: "#1a0000", borderRadius: 8, padding: "3px 16px", border: "2px solid #ef4444", textAlign: "center", minWidth: 90, zIndex: 5 }}>
              <div style={{ fontSize: 22, fontWeight: "bold", color: "#ef4444", lineHeight: 1, letterSpacing: "0.05em" }}>
                {timeLeftSec}s
              </div>
              <div style={{ fontSize: 8, color: "rgba(239,68,68,0.6)", letterSpacing: "0.12em", marginTop: 1 }}>
                LIFE YEARS · {yearsElapsed}
              </div>
            </div>
          </div>

          {/* Track */}
          <div style={{ position: "absolute", top: HEADER_H, left: 0, right: 0, bottom: 0, overflow: "hidden" }}>

            {/* Lanes */}
            <div style={{ position: "absolute", inset: 0, display: "flex" }}>
              {PLAYERS.map((cfg, i) => {
                const state    = playerStates.find(s => s.id === cfg.id);
                const progress = state ? getProgress(state) : 0;
                const sy       = babyScreenY(progress, trackH);

                return (
                  <div key={cfg.id} style={{ flex: 1, position: "relative", height: trackH, borderRight: "1px solid rgba(255,255,255,0.05)", background: laneBg, overflow: "hidden" }}>
                    {/* Zone lines */}
                    {zoneYs.map(z => (
                      <div key={z.label} style={{ position: "absolute", top: z.y, left: 0, right: 0, height: 1, background: z.color, opacity: 0.22, zIndex: 2 }}>
                        {i === 0 && (
                          <span style={{ position: "absolute", left: 3, top: -12, fontSize: 6, color: z.color, opacity: 0.55, whiteSpace: "nowrap" }}>
                            {z.label}
                          </span>
                        )}
                      </div>
                    ))}

                    {/* Ladder rails */}
                    <div style={{ position: "absolute", top: SKY_H, bottom: BOTTOM_H, left: "calc(50% - 12px)", width: 2, background: "rgba(160,120,80,0.45)", zIndex: 3 }} />
                    <div style={{ position: "absolute", top: SKY_H, bottom: BOTTOM_H, left: "calc(50% + 10px)", width: 2, background: "rgba(160,120,80,0.45)", zIndex: 3 }} />
                    {/* Rungs every 40px */}
                    <div style={{ position: "absolute", top: SKY_H, bottom: BOTTOM_H, left: "calc(50% - 10px)", width: 20, backgroundImage: "repeating-linear-gradient(to bottom, transparent 0px, transparent 37px, rgba(160,120,80,0.42) 37px, rgba(160,120,80,0.42) 40px)", zIndex: 3 }} />

                    {/* Baby token */}
                    {state && (() => {
                      const hasCareer = state.career !== null;
                      const nw = calcNetWorth(getProgress(state), cfg.stats.speed);

                      return (
                        <div style={{
                          position: "absolute",
                          top: sy - BABY_SIZE / 2,
                          left: "50%",
                          transform: "translateX(-50%)",
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          zIndex: 6,
                          opacity: hasCareer ? 0.7 : 1,
                          transition: "opacity 0.4s",
                        }}>
                          {/* Circle token */}
                          <div style={{
                            width: BABY_SIZE,
                            height: BABY_SIZE,
                            borderRadius: "50%",
                            background: hasCareer ? "#1a1a1a" : "#10101e",
                            border: `2.5px solid ${hasCareer ? "rgba(255,255,255,0.2)" : cfg.color}`,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: hasCareer ? 16 : 8,
                            color: cfg.isAI ? "#fff" : cfg.color,
                            fontWeight: "bold",
                            overflow: "hidden",
                            boxShadow: state.slipping
                              ? "0 0 10px #ef444490"
                              : state.luckBoost > 1
                                ? `0 0 14px ${cfg.color}99`
                                : undefined,
                            transition: "box-shadow 0.15s",
                          }}>
                            {hasCareer
                              ? state.career!.emoji
                              : state.slipping
                                ? "😱"
                                : cfg.avatar
                                  ? <img src={cfg.avatar} alt={cfg.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                                  : cfg.name.slice(0, 3)}
                          </div>
                          {/* Net worth — follows the baby, drops when slipping */}
                          <span style={{ fontSize: 10, color: state.slipping ? "#ef4444" : "rgba(255,255,255,0.6)", marginTop: 2, whiteSpace: "nowrap", fontWeight: "bold" }}>
                            {fmtMoney(nw)}
                          </span>
                          {/* Career label */}
                          {hasCareer && (
                            <span style={{ fontSize: 9, color: "rgba(255,255,255,0.5)", whiteSpace: "nowrap" }}>
                              {state.career!.name}
                            </span>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                );
              })}
            </div>

            {/* Finish line (spans all lanes) */}
            <div style={{ position: "absolute", top: SKY_H - 1, left: 0, right: 0, height: 3, background: "#fbbf24", boxShadow: "0 0 12px #fbbf2480", zIndex: 15, pointerEvents: "none" }} />

            {/* NOT RULING CLASS label */}
            <div style={{ position: "absolute", top: SKY_H - 22, left: 0, right: 0, textAlign: "center", fontSize: 11, fontWeight: "bold", color: "white", textShadow: "0 1px 6px rgba(0,0,0,0.4)", zIndex: 16, pointerEvents: "none" }}>
              ☁️ &nbsp; RULING CLASS &nbsp; ☁️
            </div>

            {/* Clouds (sky zone overlay, spans all lanes) */}
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: SKY_H, zIndex: 14, overflow: "hidden", pointerEvents: "none" }}>
              <Cloud left="5%"  top={8}  scale={0.7} animDuration="9s"  animDir="cloudDrift" />
              <Cloud left="18%" top={30} scale={0.5} animDuration="13s" animDir="cloudDriftSlow" />
              <Cloud left="35%" top={12} scale={0.9} animDuration="11s" animDir="cloudDrift" />
              <Cloud left="52%" top={35} scale={0.6} animDuration="15s" animDir="cloudDriftSlow" />
              <Cloud left="65%" top={6}  scale={0.8} animDuration="10s" animDir="cloudDrift" />
              <Cloud left="78%" top={22} scale={0.55} animDuration="12s" animDir="cloudDriftSlow" />
              <Cloud left="88%" top={40} scale={0.7} animDuration="8s"  animDir="cloudDrift" />
            </div>
          </div>

          {/* Winner flash */}
          {winnerFlash && (() => {
            const cfg = PLAYERS.find(p => p.id === winnerFlash.id);
            if (!cfg) return null;
            const idx   = Math.min(winnerFlash.place - 1, 2);
            const color = PODIUM_COLORS[idx];
            const medal = MEDALS[idx];
            return (
              <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", background: "rgba(0,0,0,0.93)", border: `2px solid ${color}`, borderRadius: 20, padding: "28px 52px", zIndex: 60, textAlign: "center", boxShadow: `0 0 80px ${color}50`, pointerEvents: "none" }}>
                <div style={{ fontSize: 48, marginBottom: 8 }}>{medal}</div>
                <div style={{ fontSize: 22, fontWeight: "bold", color, marginBottom: 4 }}>{cfg.name} escapes!</div>
                <div style={{ fontSize: 15, color: "rgba(255,255,255,0.4)" }}>#{winnerFlash.place} to escape the permanent underclass</div>
              </div>
            );
          })()}
        </>
      )}

      {/* ── FINISH OVERLAY ────────────────────────────────────────────────── */}
      {phase === "finished" && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.88)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 70 }}>
          <div style={{ background: "#0d0d1e", border: "1px solid rgba(255,255,255,0.14)", borderRadius: 20, padding: "40px 48px", maxWidth: 500, width: "90%", textAlign: "center" }}>
            <div style={{ fontSize: 10, color: "#ef4444", letterSpacing: "0.2em", marginBottom: 6 }}>TIME&apos;S UP · AGE {RACE_YEARS}</div>
            <div style={{ fontSize: 26, fontWeight: "bold", color: "white", marginBottom: 28 }}>Race Over</div>

            <div style={{ marginBottom: 24, textAlign: "left" }}>
              <div style={{ fontSize: 9, color: "#4ade80", letterSpacing: "0.18em", marginBottom: 10 }}>✓ ESCAPED THE PERMANENT UNDERCLASS</div>
              {finishOrder.length === 0 ? (
                <div style={{ color: "rgba(255,255,255,0.25)", fontSize: 13, textAlign: "center", padding: "12px 0" }}>Nobody made it out.</div>
              ) : (
                finishOrder.slice(0, 3).map((id, i) => {
                  const cfg = PLAYERS.find(p => p.id === id)!;
                  const nw  = calcNetWorth(1, cfg.stats.speed);
                  return (
                    <div key={id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderRadius: 10, background: `${PODIUM_COLORS[i]}14`, border: `1px solid ${PODIUM_COLORS[i]}30`, marginBottom: 4 }}>
                      <span style={{ fontSize: 20 }}>{MEDALS[i]}</span>
                      <div style={{ width: 10, height: 10, borderRadius: "50%", background: cfg.color }} />
                      <span style={{ color: cfg.color, fontWeight: "bold", fontSize: 14 }}>{cfg.name}</span>
                      <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 11, marginLeft: "auto" }}>{fmtMoney(nw)}</span>
                    </div>
                  );
                })
              )}
            </div>

            <div style={{ marginBottom: 28, textAlign: "left" }}>
              <div style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", letterSpacing: "0.18em", marginBottom: 10 }}>✗ STUCK</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                {playerStates
                  .filter(s => !finishOrder.includes(s.id))
                  .sort((a, b) => getProgress(b) - getProgress(a))
                  .map(s => {
                    const cfg = PLAYERS.find(p => p.id === s.id)!;
                    const nw  = calcNetWorth(getProgress(s), cfg.stats.speed);
                    return (
                      <div key={s.id} style={{ padding: "4px 8px", borderRadius: 6, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
                        <span style={{ color: s.career ? "rgba(255,255,255,0.4)" : cfg.color, fontSize: 11 }}>
                          {s.career ? s.career.emoji + " " : ""}{cfg.name}
                        </span>
                        <span style={{ color: "rgba(255,255,255,0.25)", fontSize: 8, marginLeft: 5 }}>
                          {s.career ? s.career.name : classLabel(getProgress(s))} · {fmtMoney(nw)}
                        </span>
                      </div>
                    );
                  })}
              </div>
            </div>

            <button onClick={() => { if (animRef.current) cancelAnimationFrame(animRef.current); setPhase("lobby"); }} style={{ padding: "12px 36px", background: "white", color: "black", fontWeight: "bold", fontSize: 14, borderRadius: 12, border: "none", cursor: "pointer" }}>
              Race Again
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
