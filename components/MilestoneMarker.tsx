"use client";

import React from "react";
import { FIELD_WIDTH } from "@/lib/raceEngine";

interface Props {
  y: number;
  label: string;
  reached: boolean;
}

export default function MilestoneMarker({ y, label, reached }: Props) {
  return (
    <g>
      <line
        x1={0}
        y1={y}
        x2={FIELD_WIDTH}
        y2={y}
        stroke={reached ? "#fbbf24" : "#ffffff"}
        strokeWidth={1}
        strokeOpacity={reached ? 0.6 : 0.2}
        strokeDasharray="8 6"
      />
      <rect
        x={FIELD_WIDTH / 2 - 50}
        y={y - 14}
        width={100}
        height={20}
        rx={4}
        fill={reached ? "#fbbf24" : "#ffffff"}
        fillOpacity={reached ? 0.15 : 0.08}
      />
      <text
        x={FIELD_WIDTH / 2}
        y={y - 1}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize={11}
        fill={reached ? "#fbbf24" : "#ffffff"}
        fillOpacity={reached ? 0.9 : 0.4}
        fontFamily="monospace"
        fontWeight="bold"
        pointerEvents="none"
      >
        {label}
      </text>
    </g>
  );
}
