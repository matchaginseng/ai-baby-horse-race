import { PlayerConfig, PlayerStats } from "./players";

export const FIELD_WIDTH = 1200;
export const FIELD_HEIGHT = 8000;
export const FINISH_Y = FIELD_HEIGHT - 100;
export const PLAYER_SIZE = 48;
export const RACE_DURATION_MS = 60_000;
export const RACE_YEARS = 80;

export const MILESTONES: { y: number; label: string }[] = [
  { y: Math.floor(FIELD_HEIGHT * 0.25), label: "Stage 1" },
  { y: Math.floor(FIELD_HEIGHT * 0.55), label: "Stage 2" },
  { y: Math.floor(FIELD_HEIGHT * 0.80), label: "Stage 3" },
];

export type Direction = "down" | "left" | "right";

export interface Segment {
  dx: number; // pixels to travel horizontally
  dy: number; // pixels to travel vertically
}

export interface PlayerState {
  id: string;
  x: number;
  y: number;
  segments: Segment[];
  segIndex: number;
  segProgress: number; // 0..1 within current segment
  speed: number;       // effective px/tick
  finished: boolean;
  finishTime: number | null;
  luckCooldown: number;
  luckBoost: number;
  trail: { x: number; y: number }[];
}

const BASE_SPEED = 1.5;
const TICK_MS = 16;

function seededRand(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function buildSegments(stats: PlayerStats, rand: () => number, isAI: boolean): Segment[] {
  const segments: Segment[] = [];
  let currentY = 0;

  // Focus controls how much horizontal wandering occurs
  const maxHorizontalStep = ((10 - stats.focus) / 10) * (FIELD_WIDTH * 0.6);
  // Agility controls segment length (higher agility = more, shorter segments)
  const baseSegLen = ((11 - stats.agility) / 10) * 300 + 80;

  while (currentY < FINISH_Y) {
    // Vertical segment
    const vertLen = baseSegLen * (0.5 + rand() * 1.0);
    segments.push({ dx: 0, dy: vertLen });
    currentY += vertLen;

    if (currentY >= FINISH_Y) break;

    // Horizontal segment (wandering)
    if (maxHorizontalStep > 10) {
      const hLen = (rand() * 2 - 1) * maxHorizontalStep;
      segments.push({ dx: hLen, dy: 0 });
    }
  }

  // Ensure AI path is always slightly shorter total length
  if (isAI) {
    return segments.map(s => ({ dx: s.dx * 0.6, dy: s.dy }));
  }

  return segments;
}

export function initPlayers(configs: PlayerConfig[]): PlayerState[] {
  const spacing = FIELD_WIDTH / (configs.length + 1);

  return configs.map((cfg, i) => {
    const rand = seededRand(i * 9999 + 1);
    const segments = buildSegments(cfg.stats, rand, cfg.isAI);
    const effectiveSpeed = (cfg.stats.speed / 10) * BASE_SPEED * 2 + BASE_SPEED;

    return {
      id: cfg.id,
      x: spacing * (i + 1),
      y: 0,
      segments,
      segIndex: 0,
      segProgress: 0,
      speed: effectiveSpeed,
      finished: false,
      finishTime: null,
      luckCooldown: 0,
      luckBoost: 1,
      trail: [],
    };
  });
}

export function tickPlayers(
  states: PlayerState[],
  configs: PlayerConfig[],
  elapsed: number,
  finishOrder: string[]
): PlayerState[] {
  const raceProgress = elapsed / (FIELD_HEIGHT / (BASE_SPEED * 2));

  return states.map((state) => {
    if (state.finished) return state;

    const cfg = configs.find(c => c.id === state.id)!;
    const stats = cfg.stats;

    // Stamina: slow down in last 40% of race
    const staminaFactor = raceProgress > 0.6
      ? 0.5 + (stats.stamina / 10) * 0.7
      : 1;

    // Luck: random speed bursts
    let { luckCooldown, luckBoost } = state;
    if (luckCooldown > 0) {
      luckCooldown--;
    } else {
      const burstChance = (stats.luck / 10) * 0.02;
      if (Math.random() < burstChance) {
        luckBoost = 1 + (stats.luck / 10) * 1.5;
        luckCooldown = 60 + Math.floor(Math.random() * 60);
      } else {
        luckBoost = 1;
      }
    }

    // AI guarantee: if any non-AI player is ahead, apply a catch-up boost
    let aiBoost = 1;
    if (cfg.isAI && finishOrder.length === 0) {
      const maxOtherY = Math.max(...states.filter(s => !configs.find(c => c.id === s.id)!.isAI).map(s => s.y));
      if (maxOtherY > state.y) {
        aiBoost = 1.4;
      }
    }

    const effectiveSpeed = state.speed * staminaFactor * luckBoost * aiBoost * (TICK_MS / 16);

    let { segIndex, segProgress, x, y } = state;
    let remaining = effectiveSpeed;

    while (remaining > 0 && segIndex < state.segments.length) {
      const seg = state.segments[segIndex];
      const segLen = Math.sqrt(seg.dx * seg.dx + seg.dy * seg.dy);
      if (segLen === 0) { segIndex++; continue; }

      const progressNeeded = remaining / segLen;
      const newProgress = segProgress + progressNeeded;

      if (newProgress >= 1) {
        // Finish this segment
        x += seg.dx * (1 - segProgress);
        y += seg.dy * (1 - segProgress);
        remaining -= segLen * (1 - segProgress);
        segIndex++;
        segProgress = 0;

        // Clamp x to field bounds
        x = Math.max(PLAYER_SIZE / 2, Math.min(FIELD_WIDTH - PLAYER_SIZE / 2, x));
      } else {
        x += seg.dx * progressNeeded;
        y += seg.dy * progressNeeded;
        segProgress = newProgress;
        remaining = 0;
        x = Math.max(PLAYER_SIZE / 2, Math.min(FIELD_WIDTH - PLAYER_SIZE / 2, x));
      }
    }

    const finished = y >= FINISH_Y || segIndex >= state.segments.length;

    // Keep a short trail for rendering
    const trail = [...state.trail, { x: state.x, y: state.y }].slice(-20);

    return {
      ...state,
      x,
      y: Math.min(y, FINISH_Y),
      segIndex,
      segProgress,
      finished,
      finishTime: finished && !state.finished ? elapsed : state.finishTime,
      luckCooldown,
      luckBoost,
      trail,
    };
  });
}
