export type EnemyKind = "walker" | "flyer" | "turret";

export type Platform = Readonly<{ x: number; y: number; w: number; h: number }>;
export type Pit = Readonly<{ x: number; w: number }>;
export type Spawn = Readonly<{ x: number; y: number; kind: EnemyKind }>;

export type LevelDef = Readonly<{
  id: number;
  name: string;
  codename: string;
  width: number;
  ground: number;
  platforms: readonly Platform[];
  pits: readonly Pit[];
  spawns: readonly Spawn[];
  boss: Readonly<{ x: number; y: number; hp: number }> | null;
  palette: Readonly<{
    sky: string; sky2: string; far: string; mid: string; ground: string; dirt: string; accent: string; water: string;
  }>;
}>;

const G = 520;

export const LEVELS: readonly LevelDef[] = [
  {
    id: 1, name: "Jungle Drop", codename: "STAGE 1", width: 3400, ground: G,
    platforms: [
      { x: 620, y: 400, w: 180, h: 18 }, { x: 980, y: 340, w: 160, h: 18 },
      { x: 1480, y: 390, w: 200, h: 18 }, { x: 1980, y: 320, w: 150, h: 18 },
      { x: 2460, y: 380, w: 220, h: 18 },
    ],
    pits: [{ x: 1180, w: 90 }, { x: 2210, w: 100 }],
    spawns: [
      { x: 520, y: G, kind: "walker" }, { x: 780, y: 400, kind: "walker" },
      { x: 1100, y: 180, kind: "flyer" }, { x: 1320, y: G, kind: "walker" },
      { x: 1560, y: 390, kind: "turret" }, { x: 1760, y: 160, kind: "flyer" },
      { x: 2080, y: G, kind: "walker" }, { x: 2380, y: 200, kind: "flyer" },
      { x: 2580, y: 380, kind: "walker" }, { x: 2920, y: G, kind: "walker" },
    ],
    boss: null,
    palette: { sky: "#163326", sky2: "#1e4a32", far: "#24553a", mid: "#2f6a44", ground: "#3d4a28", dirt: "#2a331c", accent: "#7acb4a", water: "#2a6b6e" },
  },
  {
    id: 2, name: "Waterfall Ascent", codename: "STAGE 2", width: 3800, ground: G,
    platforms: [
      { x: 280, y: 430, w: 140, h: 16 }, { x: 520, y: 350, w: 150, h: 16 },
      { x: 800, y: 280, w: 180, h: 16 }, { x: 1140, y: 360, w: 140, h: 16 },
      { x: 1480, y: 290, w: 200, h: 16 }, { x: 1860, y: 400, w: 160, h: 16 },
      { x: 2220, y: 310, w: 170, h: 16 }, { x: 2620, y: 250, w: 190, h: 16 },
      { x: 3040, y: 360, w: 160, h: 16 },
    ],
    pits: [{ x: 700, w: 80 }, { x: 1680, w: 110 }, { x: 2480, w: 90 }],
    spawns: [
      { x: 360, y: 430, kind: "walker" }, { x: 600, y: 350, kind: "turret" },
      { x: 880, y: 140, kind: "flyer" }, { x: 1220, y: 360, kind: "walker" },
      { x: 1540, y: 290, kind: "walker" }, { x: 1760, y: 120, kind: "flyer" },
      { x: 1940, y: 400, kind: "turret" }, { x: 2280, y: 310, kind: "walker" },
      { x: 2500, y: 160, kind: "flyer" }, { x: 2700, y: 250, kind: "walker" },
      { x: 3120, y: 360, kind: "turret" }, { x: 3360, y: G, kind: "walker" },
    ],
    boss: null,
    palette: { sky: "#143048", sky2: "#1b4564", far: "#1e5878", mid: "#24708f", ground: "#2d4638", dirt: "#1d2f28", accent: "#6ad4e0", water: "#2a8fb8" },
  },
  {
    id: 3, name: "Red Base", codename: "STAGE 3", width: 4000, ground: G,
    platforms: [
      { x: 400, y: 410, w: 220, h: 20 }, { x: 860, y: 330, w: 180, h: 20 },
      { x: 1260, y: 410, w: 200, h: 20 }, { x: 1680, y: 300, w: 160, h: 20 },
      { x: 2080, y: 390, w: 240, h: 20 }, { x: 2560, y: 310, w: 180, h: 20 },
      { x: 3000, y: 400, w: 220, h: 20 }, { x: 3440, y: 320, w: 160, h: 20 },
    ],
    pits: [{ x: 680, w: 70 }, { x: 1540, w: 80 }, { x: 2420, w: 70 }, { x: 3280, w: 70 }],
    spawns: [
      { x: 480, y: 410, kind: "turret" }, { x: 620, y: G, kind: "walker" },
      { x: 940, y: 330, kind: "walker" }, { x: 1100, y: 140, kind: "flyer" },
      { x: 1340, y: 410, kind: "turret" }, { x: 1760, y: 300, kind: "walker" },
      { x: 1920, y: 130, kind: "flyer" }, { x: 2160, y: 390, kind: "turret" },
      { x: 2340, y: G, kind: "walker" }, { x: 2640, y: 310, kind: "walker" },
      { x: 2800, y: 150, kind: "flyer" }, { x: 3080, y: 400, kind: "turret" },
      { x: 3520, y: 320, kind: "walker" }, { x: 3720, y: G, kind: "walker" },
    ],
    boss: null,
    palette: { sky: "#2a1418", sky2: "#3d1c22", far: "#5a242c", mid: "#6e3038", ground: "#3a3030", dirt: "#241c1c", accent: "#ff6b4a", water: "#6a3038" },
  },
  {
    id: 4, name: "Core Guardian", codename: "FINAL", width: 2200, ground: G,
    platforms: [
      { x: 260, y: 400, w: 180, h: 18 }, { x: 760, y: 340, w: 200, h: 18 },
      { x: 1280, y: 400, w: 180, h: 18 }, { x: 1760, y: 320, w: 160, h: 18 },
    ],
    pits: [{ x: 980, w: 70 }],
    spawns: [
      { x: 420, y: 400, kind: "turret" }, { x: 640, y: G, kind: "walker" },
      { x: 900, y: 160, kind: "flyer" }, { x: 1360, y: 400, kind: "turret" },
      { x: 1580, y: 140, kind: "flyer" },
    ],
    boss: { x: 1880, y: G, hp: 42 },
    palette: { sky: "#120818", sky2: "#241030", far: "#3a1848", mid: "#4c2060", ground: "#2a2438", dirt: "#181422", accent: "#e8c84a", water: "#6a40a0" },
  },
];
