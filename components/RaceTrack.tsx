"use client";

import React, { useRef, useEffect, useState, useCallback } from "react";
import {
  FIELD_WIDTH,
  FIELD_HEIGHT,
  FINISH_Y,
  PLAYER_SIZE,
  MILESTONES,
  PlayerState,
  initPlayers,
  tickPlayers,
} from "@/lib/raceEngine";
import { PLAYERS } from "@/lib/players";
import PlayerToken from "./PlayerToken";
import MilestoneMarker from "./MilestoneMarker";
import StatsBar from "./StatsBar";

type Phase = "lobby" | "racing" | "finished";

export default function RaceTrack() {
  const [phase, setPhase] = useState<Phase>("lobby");
  const [playerStates, setPlayerStates] = useState<PlayerState[]>([]);
  const [finishOrder, setFinishOrder] = useState<string[]>([]);
  const [elapsed, setElapsed] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number | null>(null);
  const elapsedRef = useRef(0);
  const statesRef = useRef<PlayerState[]>([]);
  const finishOrderRef = useRef<string[]>([]);

  // Auto-scroll state
  const autoScrollRef = useRef(true);
  const manualScrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleUserScroll = useCallback(() => {
    autoScrollRef.current = false;
    if (manualScrollTimeoutRef.current) clearTimeout(manualScrollTimeoutRef.current);
    manualScrollTimeoutRef.current = setTimeout(() => {
      autoScrollRef.current = true;
    }, 3000);
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener("wheel", handleUserScroll, { passive: true });
    el.addEventListener("touchmove", handleUserScroll, { passive: true });
    return () => {
      el.removeEventListener("wheel", handleUserScroll);
      el.removeEventListener("touchmove", handleUserScroll);
    };
  }, [handleUserScroll]);

  const tick = useCallback((timestamp: number) => {
    if (lastTimeRef.current === null) lastTimeRef.current = timestamp;
    const dt = Math.min(timestamp - lastTimeRef.current, 32); // cap at 32ms
    lastTimeRef.current = timestamp;
    elapsedRef.current += dt;

    const nextStates = tickPlayers(
      statesRef.current,
      PLAYERS,
      elapsedRef.current,
      finishOrderRef.current
    );

    // Collect new finishers
    const newFinishers = nextStates
      .filter(s => s.finished && !finishOrderRef.current.includes(s.id))
      .sort((a, b) => (a.finishTime ?? 0) - (b.finishTime ?? 0));

    if (newFinishers.length > 0) {
      finishOrderRef.current = [...finishOrderRef.current, ...newFinishers.map(s => s.id)];
      setFinishOrder([...finishOrderRef.current]);
    }

    statesRef.current = nextStates;
    setPlayerStates([...nextStates]);
    setElapsed(elapsedRef.current);

    // Auto-scroll: follow the leading player
    if (autoScrollRef.current && containerRef.current) {
      const leader = nextStates.reduce((best, s) => s.y > best.y ? s : best, nextStates[0]);
      const viewportH = window.innerHeight;
      const targetScrollTop = leader.y - viewportH * 0.4;
      containerRef.current.scrollTop = Math.max(0, targetScrollTop);
    }

    const allDone = nextStates.every(s => s.finished);
    if (allDone) {
      setPhase("finished");
      return;
    }

    animRef.current = requestAnimationFrame(tick);
  }, []);

  const startRace = useCallback(() => {
    const states = initPlayers(PLAYERS);
    statesRef.current = states;
    finishOrderRef.current = [];
    elapsedRef.current = 0;
    lastTimeRef.current = null;
    setPlayerStates(states);
    setFinishOrder([]);
    setElapsed(0);
    setPhase("racing");
    autoScrollRef.current = true;
    animRef.current = requestAnimationFrame(tick);
  }, [tick]);

  useEffect(() => {
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, []);

  // Which milestones have been passed by anyone
  const milestoneReached = MILESTONES.map(m =>
    playerStates.some(s => s.y >= m.y)
  );

  const winner = finishOrder[0] ? PLAYERS.find(p => p.id === finishOrder[0]) : null;

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      {/* Sidebar stats */}
      {phase !== "lobby" && (
        <StatsBar configs={PLAYERS} states={playerStates} />
      )}

      {/* Lobby */}
      {phase === "lobby" && (
        <div className="flex flex-col items-center justify-center min-h-screen gap-8 px-4">
          <h1 className="text-4xl font-bold tracking-tight">Horse Race</h1>
          <p className="text-white/50 text-sm max-w-md text-center">
            15 players race to the bottom. Stats visibly affect behavior.
            One player always wins.
          </p>

          {/* Player grid */}
          <div className="grid grid-cols-5 gap-3 max-w-xl w-full">
            {PLAYERS.map(p => (
              <div
                key={p.id}
                className={`rounded-xl p-3 flex flex-col items-center gap-2 ${
                  p.isAI
                    ? "bg-white/10 border border-white/30"
                    : "bg-white/5 border border-white/10"
                }`}
              >
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold border-2"
                  style={{ borderColor: p.color, color: p.isAI ? "#fff" : p.color }}
                >
                  {p.isAI ? "AI" : p.name.slice(0, 3)}
                </div>
                <span className="text-[10px] text-white/60">{p.name}</span>
                <div className="w-full flex flex-col gap-0.5">
                  {(["speed", "agility", "stamina", "luck", "focus"] as const).map(k => (
                    <div key={k} className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${p.stats[k] * 10}%`, backgroundColor: p.color }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={startRace}
            className="px-12 py-4 bg-white text-black font-bold text-lg rounded-2xl hover:bg-white/90 active:scale-95 transition-all"
          >
            START RACE
          </button>
        </div>
      )}

      {/* Race track */}
      {phase !== "lobby" && (
        <div
          ref={containerRef}
          className="overflow-y-scroll overflow-x-auto"
          style={{ height: "100vh", width: `calc(100vw - 224px)` }}
        >
          <svg
            width={FIELD_WIDTH}
            height={FIELD_HEIGHT}
            style={{ display: "block", background: "transparent" }}
          >
            {/* Background grid */}
            <defs>
              <pattern id="grid" width="60" height="60" patternUnits="userSpaceOnUse">
                <path d="M 60 0 L 0 0 0 60" fill="none" stroke="white" strokeOpacity="0.03" />
              </pattern>
            </defs>
            <rect width={FIELD_WIDTH} height={FIELD_HEIGHT} fill="url(#grid)" />

            {/* Start line */}
            <line x1={0} y1={20} x2={FIELD_WIDTH} y2={20} stroke="white" strokeOpacity={0.3} strokeWidth={1} />
            <text x={FIELD_WIDTH / 2} y={12} textAnchor="middle" fontSize={10} fill="white" fillOpacity={0.3} fontFamily="monospace">START</text>

            {/* Finish line */}
            <line x1={0} y1={FINISH_Y} x2={FIELD_WIDTH} y2={FINISH_Y} stroke="#fbbf24" strokeOpacity={0.8} strokeWidth={2} strokeDasharray="12 6" />
            <text x={FIELD_WIDTH / 2} y={FINISH_Y - 8} textAnchor="middle" fontSize={12} fill="#fbbf24" fillOpacity={0.9} fontFamily="monospace" fontWeight="bold">FINISH</text>

            {/* Milestones */}
            {MILESTONES.map((m, i) => (
              <MilestoneMarker key={m.label} y={m.y} label={m.label} reached={milestoneReached[i]} />
            ))}

            {/* Players */}
            {PLAYERS.map(cfg => {
              const state = playerStates.find(s => s.id === cfg.id);
              if (!state) return null;
              return <PlayerToken key={cfg.id} config={cfg} state={state} />;
            })}
          </svg>
        </div>
      )}

      {/* Finish overlay */}
      {phase === "finished" && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-30">
          <div className="bg-[#1a1a2e] border border-white/20 rounded-2xl p-8 flex flex-col items-center gap-6 max-w-sm w-full mx-4">
            <div className="text-5xl">🏆</div>
            <h2 className="text-2xl font-bold">Race Over!</h2>
            {winner && (
              <div className="flex flex-col items-center gap-1">
                <div
                  className="w-16 h-16 rounded-full flex items-center justify-center text-lg font-bold border-4"
                  style={{ borderColor: winner.color, color: winner.isAI ? "#fff" : winner.color }}
                >
                  {winner.isAI ? "AI" : winner.name.slice(0, 3)}
                </div>
                <span className="font-semibold text-lg" style={{ color: winner.color }}>
                  {winner.name} wins!
                </span>
              </div>
            )}
            <div className="w-full flex flex-col gap-1">
              {finishOrder.slice(0, 5).map((id, i) => {
                const cfg = PLAYERS.find(p => p.id === id)!;
                return (
                  <div key={id} className="flex items-center gap-3 text-sm">
                    <span className="text-white/40 w-4">{i + 1}.</span>
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: cfg.color }} />
                    <span style={{ color: cfg.color }}>{cfg.name}</span>
                  </div>
                );
              })}
            </div>
            <button
              onClick={() => {
                setPhase("lobby");
                if (animRef.current) cancelAnimationFrame(animRef.current);
              }}
              className="px-8 py-3 bg-white text-black font-bold rounded-xl hover:bg-white/90 active:scale-95 transition-all"
            >
              Race Again
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
