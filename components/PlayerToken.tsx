"use client";

import React from "react";
import { PlayerConfig } from "@/lib/players";
import { PlayerState, PLAYER_SIZE } from "@/lib/raceEngine";

interface Props {
  config: PlayerConfig;
  state: PlayerState;
}

export default function PlayerToken({ config, state }: Props) {
  const half = PLAYER_SIZE / 2;

  return (
    <g>
      {/* Trail */}
      {state.trail.length > 1 && (
        <polyline
          points={state.trail.map(p => `${p.x},${p.y}`).join(" ")}
          fill="none"
          stroke={config.color}
          strokeWidth={2}
          strokeOpacity={0.25}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}

      {/* Luck burst glow */}
      {state.luckBoost > 1 && (
        <circle
          cx={state.x}
          cy={state.y}
          r={half + 8}
          fill={config.color}
          opacity={0.25}
        />
      )}

      {/* Avatar circle */}
      <circle
        cx={state.x}
        cy={state.y}
        r={half}
        fill={config.isAI ? "#1a1a2e" : "#1e1e2e"}
        stroke={config.color}
        strokeWidth={config.isAI ? 3 : 2}
      />

      {/* Initials / name */}
      <text
        x={state.x}
        y={state.y + 1}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize={config.isAI ? 11 : 10}
        fontWeight={config.isAI ? "bold" : "normal"}
        fill={config.isAI ? "#fff" : config.color}
        fontFamily="monospace"
        pointerEvents="none"
      >
        {config.isAI ? "AI" : config.name.slice(0, 3)}
      </text>
    </g>
  );
}
