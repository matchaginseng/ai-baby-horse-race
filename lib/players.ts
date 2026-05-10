export interface PlayerStats {
  speed: number;     // 1-10: base movement velocity
  agility: number;   // 1-10: turn frequency
  stamina: number;   // 1-10: resistance to late-race slowdown
  luck: number;      // 1-10: chance of random speed bursts
  focus: number;     // 1-10: path straightness (low = wide wandering)
}

export interface PlayerConfig {
  id: string;
  name: string;
  color: string;
  isAI: boolean;
  stats: PlayerStats;
}

const COLORS = [
  "#e74c3c", "#e67e22", "#f1c40f", "#2ecc71", "#1abc9c",
  "#3498db", "#9b59b6", "#e91e63", "#00bcd4", "#8bc34a",
  "#ff5722", "#607d8b", "#795548", "#9c27b0", "#ff9800",
];

export const PLAYERS: PlayerConfig[] = [
  {
    id: "ai",
    name: "AI",
    color: "#ffffff",
    isAI: true,
    stats: { speed: 9, agility: 5, stamina: 9, luck: 8, focus: 10 },
  },
  {
    id: "p1",
    name: "Blaze",
    color: COLORS[0],
    isAI: false,
    stats: { speed: 8, agility: 5, stamina: 6, luck: 4, focus: 7 },
  },
  {
    id: "p2",
    name: "Nova",
    color: COLORS[1],
    isAI: false,
    stats: { speed: 6, agility: 9, stamina: 5, luck: 7, focus: 3 },
  },
  {
    id: "p3",
    name: "Dash",
    color: COLORS[2],
    isAI: false,
    stats: { speed: 7, agility: 4, stamina: 8, luck: 3, focus: 9 },
  },
  {
    id: "p4",
    name: "Spark",
    color: COLORS[3],
    isAI: false,
    stats: { speed: 5, agility: 7, stamina: 7, luck: 8, focus: 5 },
  },
  {
    id: "p5",
    name: "Rex",
    color: COLORS[4],
    isAI: false,
    stats: { speed: 9, agility: 3, stamina: 4, luck: 5, focus: 8 },
  },
  {
    id: "p6",
    name: "Luna",
    color: COLORS[5],
    isAI: false,
    stats: { speed: 4, agility: 8, stamina: 9, luck: 6, focus: 4 },
  },
  {
    id: "p7",
    name: "Comet",
    color: COLORS[6],
    isAI: false,
    stats: { speed: 7, agility: 6, stamina: 5, luck: 9, focus: 6 },
  },
  {
    id: "p8",
    name: "Bolt",
    color: COLORS[7],
    isAI: false,
    stats: { speed: 8, agility: 7, stamina: 3, luck: 7, focus: 5 },
  },
  {
    id: "p9",
    name: "Storm",
    color: COLORS[8],
    isAI: false,
    stats: { speed: 6, agility: 5, stamina: 8, luck: 4, focus: 7 },
  },
  {
    id: "p10",
    name: "Ace",
    color: COLORS[9],
    isAI: false,
    stats: { speed: 5, agility: 9, stamina: 6, luck: 8, focus: 2 },
  },
  {
    id: "p11",
    name: "Titan",
    color: COLORS[10],
    isAI: false,
    stats: { speed: 7, agility: 2, stamina: 10, luck: 3, focus: 9 },
  },
  {
    id: "p12",
    name: "Pixel",
    color: COLORS[11],
    isAI: false,
    stats: { speed: 4, agility: 10, stamina: 5, luck: 9, focus: 1 },
  },
  {
    id: "p13",
    name: "Echo",
    color: COLORS[12],
    isAI: false,
    stats: { speed: 6, agility: 6, stamina: 7, luck: 5, focus: 6 },
  },
  {
    id: "p14",
    name: "Flux",
    color: COLORS[13],
    isAI: false,
    stats: { speed: 8, agility: 4, stamina: 6, luck: 6, focus: 7 },
  },
];
