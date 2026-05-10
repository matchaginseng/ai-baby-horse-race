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
import { PLAYERS } from "@/lib/players";

type Phase = "lobby" | "racing" | "finished";

// ── Display world ──────────────────────────────────────────────────────────
const WORLD_HEIGHT = 5000;
const FINISH_WORLD_Y = 90;     // px from top of world where finish line sits
const START_WORLD_Y = WORLD_HEIGHT - 80;
const BABY_SIZE = 36;
const HEADER_H = 50;

// Class zone thresholds (progress 0→1 maps start→finish)
const ZONES = [
  { progress: 0.85, label: "Upper Middle Class", color: "#93c5fd" },
  { progress: 0.60, label: "Middle Class",       color: "#9ca3af" },
  { progress: 0.30, label: "Working Class",      color: "#6b7280" },
] as const;

const PODIUM_COLORS = ["#fbbf24", "#94a3b8", "#cd7c3e"] as const;
const MEDALS        = ["🥇", "🥈", "🥉"] as const;

// ── Helpers ────────────────────────────────────────────────────────────────
function progressToWorldY(progress: number): number {
  // progress 0 = bottom (start), 1 = top (finish)
  // worldY 0 = top of world, WORLD_HEIGHT = bottom
  return FINISH_WORLD_Y + (1 - progress) * (START_WORLD_Y - FINISH_WORLD_Y);
}

function getProgress(s: PlayerState): number {
  return Math.min(s.y / FINISH_Y, 1);
}

function classLabel(p: number): string {
  if (p >= 0.85) return "Upper Middle";
  if (p >= 0.60) return "Middle Class";
  if (p >= 0.30) return "Working Class";
  return "Born";
}

// Pre-compute zone worldY positions (constant across renders)
const zoneWorldYs = ZONES.map(z => ({
  ...z,
  worldY: Math.round(progressToWorldY(z.progress)),
}));

// Lane gradient: sky at top fading to underground
const upperY  = zoneWorldYs[0].worldY; // ~800
const middleY = zoneWorldYs[1].worldY; // ~1960
const workingY = zoneWorldYs[2].worldY; // ~3360
const LANE_BG = `linear-gradient(to bottom,
  #87ceeb 0px,
  #4a90d9 ${FINISH_WORLD_Y}px,
  #1e5090 ${Math.round(upperY * 0.75)}px,
  #0d1a2e ${upperY}px,
  #111122 ${middleY}px,
  #0c0c18 ${workingY}px,
  #070710 ${START_WORLD_Y}px
)`;

// ── Component ──────────────────────────────────────────────────────────────
export default function RaceTrack() {
  const [phase, setPhase]               = useState<Phase>("lobby");
  const [playerStates, setPlayerStates] = useState<PlayerState[]>([]);
  const [finishOrder, setFinishOrder]   = useState<string[]>([]);
  const [timeLeftMs, setTimeLeftMs]     = useState(RACE_DURATION_MS);
  const [cameraOffset, setCameraOffset] = useState(0);
  const [vpHeight, setVpHeight]         = useState(800);
  const [winnerFlash, setWinnerFlash]   = useState<{ id: string; place: number } | null>(null);

  const animRef       = useRef<number | null>(null);
  const lastTimeRef   = useRef<number | null>(null);
  const elapsedRef    = useRef(0);
  const statesRef     = useRef<PlayerState[]>([]);
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

    // Collect new finishers in this tick
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

    // Camera: keep leader at ~65% from top of container
    const leader = nextStates.reduce(
      (best, s) => getProgress(s) > getProgress(best) ? s : best,
      nextStates[0],
    );
    const leaderWorldY  = progressToWorldY(getProgress(leader));
    const containerH    = window.innerHeight - HEADER_H;
    const targetOffset  = leaderWorldY - containerH * 0.65;
    const clampedOffset = Math.max(0, Math.min(WORLD_HEIGHT - containerH, targetOffset));
    setCameraOffset(clampedOffset);

    if (remaining === 0 || nextStates.every(s => s.finished)) {
      setPhase("finished");
      return;
    }

    animRef.current = requestAnimationFrame(tick);
  }, []);

  const startRace = useCallback(() => {
    if (animRef.current) cancelAnimationFrame(animRef.current);
    const states = initPlayers(PLAYERS);
    statesRef.current    = states;
    finishOrderRef.current = [];
    elapsedRef.current   = 0;
    lastTimeRef.current  = null;
    setPlayerStates(states);
    setFinishOrder([]);
    setTimeLeftMs(RACE_DURATION_MS);
    setWinnerFlash(null);
    setPhase("racing");
    animRef.current = requestAnimationFrame(tick);
  }, [tick]);

  useEffect(() => () => {
    if (animRef.current) cancelAnimationFrame(animRef.current);
  }, []);

  const timeLeftSec  = Math.ceil(timeLeftMs / 1000);
  const yearsElapsed = Math.round((1 - timeLeftMs / RACE_DURATION_MS) * RACE_YEARS);
  const containerH   = vpHeight - HEADER_H;
  const N            = PLAYERS.length;
  const lanePct      = 100 / N;

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
                <div style={{ width: 34, height: 34, borderRadius: "50%", border: `2px solid ${p.color}`, color: p.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: "bold" }}>
                  {p.name.slice(0, 3)}
                </div>
                <span style={{ fontSize: 8, color: "rgba(255,255,255,0.45)" }}>{p.name}</span>
              </div>
            ))}
          </div>

          <button
            onClick={startRace}
            style={{ padding: "16px 52px", background: "white", color: "black", fontWeight: "bold", fontSize: 16, borderRadius: 16, border: "none", cursor: "pointer" }}
          >
            START RACE
          </button>
        </div>
      )}

      {/* ── RACE ──────────────────────────────────────────────────────────── */}
      {phase !== "lobby" && (
        <>
          {/* Fixed header: lane labels + countdown clock */}
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: HEADER_H, zIndex: 40, background: "rgba(5,5,16,0.96)", borderBottom: "1px solid rgba(255,255,255,0.07)", display: "flex", alignItems: "stretch" }}>
            {PLAYERS.map((cfg, i) => (
              <div key={cfg.id} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", borderRight: "1px solid rgba(255,255,255,0.05)", gap: 2 }}>
                <span style={{ color: cfg.color, fontSize: 8, fontWeight: "bold", lineHeight: 1 }}>
                  {cfg.name.slice(0, 5)}
                </span>
                {finishOrder.includes(cfg.id) && (
                  <span style={{ fontSize: 7, color: PODIUM_COLORS[Math.min(finishOrder.indexOf(cfg.id), 2)] ?? "#4ade80" }}>
                    #{finishOrder.indexOf(cfg.id) + 1}
                  </span>
                )}
              </div>
            ))}

            {/* Countdown clock — centered, floats above lane headers */}
            <div style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%, -50%)", background: "rgba(0,0,0,0.75)", borderRadius: 8, padding: "4px 14px", border: "1px solid rgba(255,255,255,0.13)", textAlign: "center", minWidth: 72, zIndex: 5 }}>
              <div style={{ fontSize: 20, fontWeight: "bold", color: timeLeftSec <= 10 ? "#ef4444" : timeLeftSec <= 20 ? "#fbbf24" : "#ffffff", lineHeight: 1 }}>
                {timeLeftSec}s
              </div>
              <div style={{ fontSize: 8, color: "rgba(255,255,255,0.35)", marginTop: 1 }}>
                Age {yearsElapsed}
              </div>
            </div>
          </div>

          {/* Race container */}
          <div style={{ position: "absolute", top: HEADER_H, left: 0, right: 0, bottom: 0, overflow: "hidden" }}>

            {/* Translated world */}
            <div style={{ position: "absolute", top: 0, left: 0, width: "100%", height: WORLD_HEIGHT, transform: `translateY(${-cameraOffset}px)`, display: "flex" }}>

              {/* Lane columns */}
              {PLAYERS.map((cfg, i) => {
                const state    = playerStates.find(s => s.id === cfg.id);
                const progress = state ? getProgress(state) : 0;
                const worldY   = progressToWorldY(progress);

                return (
                  <div key={cfg.id} style={{ flex: 1, position: "relative", height: WORLD_HEIGHT, borderRight: "1px solid rgba(255,255,255,0.05)", background: LANE_BG, overflow: "hidden" }}>

                    {/* "UPPER CLASS" sky label — fixed at finish zone */}
                    {i === Math.floor(N / 2) && (
                      <div style={{ position: "absolute", top: FINISH_WORLD_Y - 38, left: "50%", transform: "translateX(-50%)", whiteSpace: "nowrap", fontSize: 11, fontWeight: "bold", color: "white", textShadow: "0 1px 6px rgba(0,0,0,0.5)", zIndex: 6 }}>
                        ☁️ UPPER CLASS ☁️
                      </div>
                    )}

                    {/* Finish line */}
                    <div style={{ position: "absolute", top: FINISH_WORLD_Y, left: 0, right: 0, height: 3, background: "#fbbf24", boxShadow: "0 0 10px #fbbf2470", zIndex: 5 }} />

                    {/* Zone separator lines */}
                    {zoneWorldYs.map(z => (
                      <div key={z.label} style={{ position: "absolute", top: z.worldY, left: 0, right: 0, height: 1, background: z.color, opacity: 0.25, zIndex: 4 }}>
                        {i === 0 && (
                          <span style={{ position: "absolute", left: 4, top: -13, fontSize: 7, color: z.color, opacity: 0.6, whiteSpace: "nowrap" }}>
                            {z.label}
                          </span>
                        )}
                      </div>
                    ))}

                    {/* Ladder rails */}
                    <div style={{ position: "absolute", top: FINISH_WORLD_Y, bottom: 0, left: "calc(50% - 13px)", width: 2, background: "rgba(160,120,80,0.45)", zIndex: 3 }} />
                    <div style={{ position: "absolute", top: FINISH_WORLD_Y, bottom: 0, left: "calc(50% + 11px)", width: 2, background: "rgba(160,120,80,0.45)", zIndex: 3 }} />

                    {/* Ladder rungs via repeating gradient */}
                    <div style={{ position: "absolute", top: FINISH_WORLD_Y, bottom: 0, left: "calc(50% - 11px)", width: 22, backgroundImage: "repeating-linear-gradient(to bottom, transparent 0px, transparent 56px, rgba(160,120,80,0.4) 56px, rgba(160,120,80,0.4) 60px)", zIndex: 3 }} />

                    {/* Baby token */}
                    {state && (
                      <div style={{
                        position: "absolute",
                        top: worldY - BABY_SIZE / 2,
                        left: "50%",
                        transform: "translateX(-50%)",
                        width: BABY_SIZE,
                        height: BABY_SIZE,
                        borderRadius: "50%",
                        background: "#10101e",
                        border: `2.5px solid ${cfg.color}`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 8,
                        color: cfg.isAI ? "#fff" : cfg.color,
                        fontWeight: "bold",
                        zIndex: 6,
                        boxShadow: state.luckBoost > 1 ? `0 0 14px ${cfg.color}99` : undefined,
                        transition: "box-shadow 0.2s",
                      }}>
                        {cfg.name.slice(0, 3)}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Carrot overlay — not translated, stays pinned to viewport bottom */}
            <div style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 30 }}>
              {PLAYERS.map((cfg, i) => {
                const state = playerStates.find(s => s.id === cfg.id);
                if (!state) return null;
                const progress = getProgress(state);
                const worldY   = progressToWorldY(progress);
                const viewportY = worldY - cameraOffset;

                // Only show carrot when baby is below the visible area
                if (viewportY <= containerH - BABY_SIZE - 16) return null;

                return (
                  <div key={`carrot-${cfg.id}`} style={{ position: "absolute", bottom: 10, left: `${i * lanePct}%`, width: `${lanePct}%`, display: "flex", flexDirection: "column", alignItems: "center", gap: 1 }}>
                    <span style={{ fontSize: 14 }}>🥕</span>
                    <span style={{ fontSize: 6, color: cfg.color, opacity: 0.8 }}>
                      {Math.round(progress * 100)}%
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Winner flash — centered modal, auto-dismisses */}
          {winnerFlash && (() => {
            const cfg   = PLAYERS.find(p => p.id === winnerFlash.id);
            if (!cfg) return null;
            const idx   = Math.min(winnerFlash.place - 1, 2);
            const color = PODIUM_COLORS[idx];
            const medal = MEDALS[idx];
            return (
              <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", background: "rgba(0,0,0,0.93)", border: `2px solid ${color}`, borderRadius: 20, padding: "28px 52px", zIndex: 60, textAlign: "center", boxShadow: `0 0 80px ${color}50`, pointerEvents: "none" }}>
                <div style={{ fontSize: 48, marginBottom: 8 }}>{medal}</div>
                <div style={{ fontSize: 22, fontWeight: "bold", color, marginBottom: 4 }}>
                  {cfg.name} escapes!
                </div>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)" }}>
                  #{winnerFlash.place} to reach Upper Class
                </div>
              </div>
            );
          })()}
        </>
      )}

      {/* ── FINISH OVERLAY ────────────────────────────────────────────────── */}
      {phase === "finished" && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.88)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 70 }}>
          <div style={{ background: "#0d0d1e", border: "1px solid rgba(255,255,255,0.14)", borderRadius: 20, padding: "40px 48px", maxWidth: 500, width: "90%", textAlign: "center" }}>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", letterSpacing: "0.2em", marginBottom: 6 }}>
              TIME&apos;S UP — AGE {RACE_YEARS}
            </div>
            <div style={{ fontSize: 26, fontWeight: "bold", color: "white", marginBottom: 28 }}>
              Race Over
            </div>

            {/* Escaped column */}
            <div style={{ marginBottom: 24, textAlign: "left" }}>
              <div style={{ fontSize: 9, color: "#4ade80", letterSpacing: "0.18em", marginBottom: 10 }}>
                ✓ ESCAPED TO UPPER CLASS
              </div>
              {finishOrder.length === 0 ? (
                <div style={{ color: "rgba(255,255,255,0.25)", fontSize: 13, textAlign: "center", padding: "12px 0" }}>
                  Nobody made it out.
                </div>
              ) : (
                finishOrder.slice(0, 3).map((id, i) => {
                  const cfg = PLAYERS.find(p => p.id === id)!;
                  return (
                    <div key={id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderRadius: 10, background: `${PODIUM_COLORS[i]}14`, border: `1px solid ${PODIUM_COLORS[i]}30`, marginBottom: 4 }}>
                      <span style={{ fontSize: 20 }}>{MEDALS[i]}</span>
                      <div style={{ width: 10, height: 10, borderRadius: "50%", background: cfg.color }} />
                      <span style={{ color: cfg.color, fontWeight: "bold", fontSize: 14 }}>{cfg.name}</span>
                    </div>
                  );
                })
              )}
            </div>

            {/* Stuck column */}
            <div style={{ marginBottom: 28, textAlign: "left" }}>
              <div style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", letterSpacing: "0.18em", marginBottom: 10 }}>
                ✗ STUCK
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                {playerStates
                  .filter(s => !finishOrder.includes(s.id))
                  .sort((a, b) => getProgress(b) - getProgress(a))
                  .map(s => {
                    const cfg = PLAYERS.find(p => p.id === s.id)!;
                    return (
                      <div key={s.id} style={{ padding: "4px 8px", borderRadius: 6, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
                        <span style={{ color: cfg.color, fontSize: 11 }}>{cfg.name}</span>
                        <span style={{ color: "rgba(255,255,255,0.25)", fontSize: 8, marginLeft: 5 }}>
                          {classLabel(getProgress(s))}
                        </span>
                      </div>
                    );
                  })}
              </div>
            </div>

            <button
              onClick={() => {
                if (animRef.current) cancelAnimationFrame(animRef.current);
                setPhase("lobby");
              }}
              style={{ padding: "12px 36px", background: "white", color: "black", fontWeight: "bold", fontSize: 14, borderRadius: 12, border: "none", cursor: "pointer" }}
            >
              Race Again
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
