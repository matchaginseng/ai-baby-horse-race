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

export const CAREER_OPTIONS = [
  { emoji: "🎨", name: "Artist" },
  { emoji: "💆", name: "Acupuncturist" },
  { emoji: "🎵", name: "Musician" },
  { emoji: "👨‍🍳", name: "Chef" },
  { emoji: "🧘", name: "Yoga Teacher" },
  { emoji: "🎭", name: "Actor" },
  { emoji: "📚", name: "Writer" },
  { emoji: "🌿", name: "Herbalist" },
  { emoji: "🏄", name: "Surfer" },
  { emoji: "🎸", name: "Guitarist" },
];

export type Career = typeof CAREER_OPTIONS[number];

export interface PlayerState {
  id: string;
  x: number;
  y: number;
  segments: Segment[];
  segIndex: number;
  segProgress: number;
  speed: number;
  finished: boolean;
  finishTime: number | null;
  luckCooldown: number;
  luckBoost: number;
  trail: { x: number; y: number }[];
  slipping: boolean;
  slipFrames: number;
  career: Career | null;   // null = still on the ladder; set = frozen in place
}

const BASE_SPEED    = 1.0;
const TICK_MS       = 16;
const SLIP_CHANCE   = 0.0018;
const SLIP_FRAMES   = 50;
const SLIP_SPEED    = 2.5;
const CAREER_CHANCE = 0.0003;

function seededRand(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function buildSegments(stats: PlayerStats, rand: () => number): Segment[] {
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

  return segments;
}

export function initPlayers(configs: PlayerConfig[]): PlayerState[] {
  const spacing = FIELD_WIDTH / (configs.length + 1);

  return configs.map((cfg, i) => {
    const rand = seededRand(i * 9999 + 1);
    const segments = buildSegments(cfg.stats, rand);
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
      slipping: false,
      slipFrames: 0,
      career: null,
    };
  });
}

export function tickPlayers(
  states: PlayerState[],
  configs: PlayerConfig[],
  elapsed: number,
  finishOrder: string[]
): PlayerState[] {
  const raceProgress = elapsed / RACE_DURATION_MS;

  return states.map((state) => {
    // Frozen in place after a career change
    if (state.career !== null) return state;

    if (state.finished) return state;

    const cfg = configs.find(c => c.id === state.id)!;
    const stats = cfg.stats;

    // Stamina: slow down in last 40% of race (raceProgress based on wall-clock time)
    const staminaFactor = raceProgress > 0.6
      ? Math.min(1, 0.5 + (stats.stamina / 10) * 0.7)
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

    const effectiveSpeed = state.speed * staminaFactor * luckBoost * (TICK_MS / 16);

    // Career-change mechanic — AI immune; higher luck = less likely
    if (!cfg.isAI && state.career === null) {
      const careerProb = CAREER_CHANCE * (1 - (stats.luck / 10) * 0.6);
      if (Math.random() < careerProb) {
        const career = CAREER_OPTIONS[Math.floor(Math.random() * CAREER_OPTIONS.length)];
        return { ...state, career };
      }
    }

    // Slip mechanic — AI never slips; higher luck = less frequent slips
    let { slipping, slipFrames } = state;
    if (!cfg.isAI) {
      if (slipping) {
        slipFrames = Math.max(0, slipFrames - 1);
        if (slipFrames === 0) slipping = false;
      } else {
        const slipProb = SLIP_CHANCE * (1 - (stats.luck / 10) * 0.6);
        if (Math.random() < slipProb) {
          slipping = true;
          slipFrames = SLIP_FRAMES;
        }
      }
    }

    let { segIndex, segProgress, x, y } = state;

    if (slipping) {
      // Slide backward on the ladder
      y = Math.max(0, y - SLIP_SPEED * (TICK_MS / 16));
    } else {
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
    }

    const finished = !slipping && (y >= FINISH_Y || segIndex >= state.segments.length);

    // Keep a short trail for rendering
    const trail = [...state.trail, { x: state.x, y: state.y }].slice(-20);

    const career = (finished && !state.finished)
      ? CAREER_OPTIONS[Math.floor(Math.random() * CAREER_OPTIONS.length)]
      : state.career;

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
      slipping,
      slipFrames,
      career,
    };
  });
}
