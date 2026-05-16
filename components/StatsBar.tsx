"use client";

import React from "react";
import { PlayerConfig } from "@/lib/players";
import { PlayerState } from "@/lib/raceEngine";

interface Props {
  configs: PlayerConfig[];
  states: PlayerState[];
}

const STAT_KEYS = ["speed", "agility", "stamina", "luck", "focus"] as const;

function StatBar({ value, color }: { value: number; color: string }) {
  return (
    <div className="flex items-center gap-1">
      <div className="w-16 h-1.5 bg-white/10 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${value * 10}%`, backgroundColor: color }}
        />
      </div>
      <span className="text-[10px] text-white/40 w-3">{value}</span>
    </div>
  );
}

export default function StatsBar({ configs, states }: Props) {
  // Sort by Y descending (furthest down = leading)
  const ranked = [...states]
    .sort((a, b) => b.y - a.y)
    .map(s => ({ state: s, config: configs.find(c => c.id === s.id)! }));

  return (
    <div className="fixed right-0 top-0 bottom-0 w-56 bg-black/70 backdrop-blur-sm border-l border-white/10 overflow-y-auto z-20 p-2 flex flex-col gap-1">
      <div className="text-xs text-white/50 uppercase tracking-widest mb-2 px-1">Standings</div>
      {ranked.map(({ state, config }, i) => (
        <div
          key={config.id}
          className={`rounded-lg p-2 ${config.isAI ? "bg-white/10 border border-white/20" : "bg-white/5"}`}
        >
          <div className="flex items-center gap-2 mb-1">
            <span className="text-white/30 text-xs w-4">{i + 1}</span>
            {config.avatar
              ? <img src={config.avatar} alt={config.name} className="w-6 h-6 rounded-full flex-shrink-0 object-cover" style={{ border: `1px solid ${config.color}` }} />
              : <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: config.color }} />
            }
            <span
              className="text-xs font-medium truncate"
              style={{ color: config.isAI ? "#fff" : config.color }}
            >
              {config.name}
            </span>
            {state.luckBoost > 1 && (
              <span className="text-yellow-400 text-xs ml-auto">⚡</span>
            )}
            {state.finished && (
              <span className="text-green-400 text-xs ml-auto">✓</span>
            )}
          </div>
          <div className="pl-5 flex flex-col gap-0.5">
            {STAT_KEYS.map(key => (
              <div key={key} className="flex items-center gap-1">
                <span className="text-[9px] text-white/30 w-12 capitalize">{key}</span>
                <StatBar value={config.stats[key]} color={config.color} />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
