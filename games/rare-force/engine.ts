import { spriteFrame, type GenerationSprites, type SpriteFacing } from "@rarefriends/friendsdk/sprites";
import { LEVELS, type LevelDef, type Platform } from "./levels";

export const VIEW = { w: 960, h: 640 } as const;
const GRAVITY = 1650;
const RUN = 235;
const JUMP = -560;
const COYOTE = 0.09;
const BULLET = 520;
const PW = 28;
const PH = 36;

export type Mode = "solo" | "coop";
export type Phase = "title" | "intro" | "play" | "clear" | "dead" | "over" | "win";
export type Weapon = "standard" | "rapid" | "spread";

export type Hud = Readonly<{
  phase: Phase;
  level: number;
  levelName: string;
  lives: number;
  score: number;
  weapon: Weapon;
  shield: number;
  mode: Mode;
  intro: string;
}>;

type Actor = {
  kind: "hero" | "foe" | "shot" | "eshot" | "boss";
  x: number; y: number; vx: number; vy: number;
  w: number; h: number; hp: number; face: 1 | -1;
  grounded: boolean; coyote: number; shoot: number; flash: number;
  slot?: 0 | 1; ai?: boolean; foe?: "walker" | "flyer" | "turret" | "boss";
  dead?: boolean; walk?: boolean; t?: number;
};

export type Cue = "select" | "action-start" | "impact" | "reward" | "reveal-rare" | "anticipation";

export type EngineHooks = {
  play: (cue: Cue) => void;
  reducedMotion: () => boolean;
  paused: () => boolean;
};

function aabb(a: Actor, b: Actor) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function overPlatform(x: number, y: number, w: number, h: number, plats: readonly Platform[], ground: number, pits: LevelDef["pits"]) {
  const feet = y + h;
  const cx = x + w / 2;
  if (feet >= ground - 1 && feet <= ground + 18) {
    if (!pits.some(p => cx > p.x && cx < p.x + p.w)) return ground;
  }
  for (const p of plats) {
    if (cx > p.x && cx < p.x + p.w && feet >= p.y - 2 && feet <= p.y + 16 && y + h - 20 < p.y) return p.y;
  }
  return null;
}

function drawMask(
  ctx: CanvasRenderingContext2D, sprites: GenerationSprites, x: number, y: number,
  facing: SpriteFacing, walking: boolean, frame: number, scale: number, flash: boolean,
) {
  const rows = spriteFrame(sprites, facing, walking, frame, facing === "left" ? "left" : "right").frame.rows;
  const left = Math.round(x), top = Math.round(y);
  ctx.save();
  ctx.beginPath(); ctx.rect(left - 2, top - 2, 16 * scale + 4, 16 * scale + 4); ctx.clip();
  ctx.fillStyle = "#fff";
  rows.forEach((row, ry) => {
    for (let rx = 0; rx < row.length; rx++) {
      if (row[rx] === "#") ctx.fillRect(left + rx * scale - scale, top + ry * scale - scale, scale * 3, scale * 3);
    }
  });
  ctx.fillStyle = flash ? "#ffd36a" : "#000";
  rows.forEach((row, ry) => {
    for (let rx = 0; rx < row.length; rx++) {
      if (row[rx] === "#") ctx.fillRect(left + rx * scale, top + ry * scale, scale, scale);
    }
  });
  ctx.restore();
}

export class RareForceEngine {
  phase: Phase = "title";
  mode: Mode = "solo";
  levelIndex = 0;
  lives = 3;
  score = 0;
  weapon: Weapon = "standard";
  shield = 0;
  cameraX = 0;
  keys = new Set<string>();
  pointers = new Map<number, { role: string; x: number; y: number }>();
  private actors: Actor[] = [];
  private level!: LevelDef;
  private time = 0;
  private introT = 0;
  private clearT = 0;
  private shake = 0;
  private frame = 0;
  private checkpoint = 80;
  private message = "";

  constructor(
    private readonly ctx: CanvasRenderingContext2D,
    private readonly heroSprites: GenerationSprites,
    private readonly allySprites: GenerationSprites | null,
    private readonly hooks: EngineHooks,
  ) {
    this.loadLevel(0, true);
  }

  hud(): Hud {
    return {
      phase: this.phase, level: this.level.id, levelName: this.level.name, lives: this.lives,
      score: this.score, weapon: this.weapon, shield: this.shield, mode: this.mode, intro: this.message,
    };
  }

  applyDrop(name: string) {
    if (name === "Field ration") this.lives = Math.min(9, this.lives + 1);
    if (name === "Extra magazine") this.weapon = "rapid";
    if (name === "Spread kit") this.weapon = "spread";
    if (name === "Life medal") this.lives = Math.min(9, this.lives + 2);
    if (name === "Hero bounty") { this.shield = 3; this.score += 500; }
    this.hooks.play("reward");
  }

  start(mode: Mode) {
    this.mode = mode;
    this.lives = 3;
    this.score = 0;
    this.weapon = "standard";
    this.shield = 0;
    this.levelIndex = 0;
    this.loadLevel(0, true);
    this.phase = "intro";
    this.introT = 1.6;
    this.message = `${this.level.codename} · ${this.level.name}`;
    this.hooks.play("action-start");
  }

  retry() {
    if (this.lives <= 0) {
      this.phase = "title";
      this.loadLevel(0, true);
      return;
    }
    this.respawn();
    this.phase = "play";
  }

  nextLevel() {
    if (this.levelIndex >= LEVELS.length - 1) {
      this.phase = "win";
      this.hooks.play("reveal-rare");
      return;
    }
    this.levelIndex += 1;
    this.loadLevel(this.levelIndex, true);
    this.phase = "intro";
    this.introT = 1.6;
    this.message = `${this.level.codename} · ${this.level.name}`;
    this.hooks.play("action-start");
  }

  setKey(key: string, down: boolean) {
    const k = key.toLowerCase();
    if (down) this.keys.add(k); else this.keys.delete(k);
  }

  stopInput() { this.keys.clear(); this.pointers.clear(); }

  touch(role: string) {
    for (const p of this.pointers.values()) if (p.role === role) return true;
    return false;
  }

  private loadLevel(index: number, resetHeroes: boolean) {
    this.level = LEVELS[index];
    this.time = 0;
    this.cameraX = 0;
    this.checkpoint = 80;
    const keep = resetHeroes ? [] : this.actors.filter(a => a.kind === "hero");
    this.actors = keep;
    if (resetHeroes) {
      this.actors.push(this.makeHero(0, 90, this.level.ground - PH, false));
      this.actors.push(this.makeHero(1, 50, this.level.ground - PH, this.mode === "solo"));
    } else {
      for (const h of this.actors) {
        h.x = 80 + (h.slot === 1 ? -30 : 0);
        h.y = this.level.ground - h.h;
        h.vx = 0; h.vy = 0; h.flash = 1.2; h.dead = false; h.hp = 1;
      }
    }
    for (const s of this.level.spawns) {
      const h = s.kind === "flyer" ? 22 : 30;
      this.actors.push({
        kind: "foe", x: s.x, y: s.kind === "flyer" ? s.y : s.y - h,
        vx: s.kind === "walker" ? -50 : 0, vy: 0, w: s.kind === "turret" ? 28 : 26, h,
        hp: s.kind === "turret" ? 3 : 2, face: -1, grounded: true,
        coyote: 0, shoot: 0.4 + Math.random(), flash: 0, foe: s.kind, t: Math.random() * 6,
      });
    }
    if (this.level.boss) {
      const b = this.level.boss;
      this.actors.push({
        kind: "boss", x: b.x, y: b.y - 72, vx: -40, vy: 0, w: 72, h: 72,
        hp: b.hp, face: -1, grounded: true, coyote: 0, shoot: 1, flash: 0, foe: "boss", t: 0,
      });
    }
  }

  private makeHero(slot: 0 | 1, x: number, y: number, ai: boolean): Actor {
    return {
      kind: "hero", x, y, vx: 0, vy: 0, w: PW, h: PH, hp: 1, face: 1, grounded: true,
      coyote: 0, shoot: 0, flash: 1.4, slot, ai, walk: false,
    };
  }

  private heroes() { return this.actors.filter(a => a.kind === "hero" && !a.dead); }

  private respawn() {
    this.loadLevel(this.levelIndex, true);
    for (const h of this.heroes()) {
      h.x = this.checkpoint + (h.slot === 1 ? -28 : 8);
      h.y = this.level.ground - h.h;
      h.flash = 1.5;
    }
    this.cameraX = Math.max(0, this.checkpoint - 200);
  }

  private pressed(a: string, b?: string) {
    return this.keys.has(a) || (b ? this.keys.has(b) : false);
  }

  private control(slot: 0 | 1) {
    if (slot === 0) {
      if (this.mode === "solo") {
        return {
          moveLeft: this.pressed("a", "arrowleft") || this.touch("p1-left"),
          moveRight: this.pressed("d", "arrowright") || this.touch("p1-right"),
          jump: this.pressed("w", "arrowup") || this.pressed(" ") || this.touch("p1-jump"),
          fire: this.pressed("j") || this.pressed("z") || this.pressed("k") || this.pressed("enter") || this.touch("p1-fire"),
        };
      }
      return {
        moveLeft: this.pressed("a") || this.touch("p1-left"),
        moveRight: this.pressed("d") || this.touch("p1-right"),
        jump: this.pressed("w") || this.pressed(" ") || this.touch("p1-jump"),
        fire: this.pressed("j") || this.pressed("z") || this.pressed("k") || this.touch("p1-fire"),
      };
    }
    return {
      moveLeft: this.pressed("arrowleft") || this.touch("p2-left"),
      moveRight: this.pressed("arrowright") || this.touch("p2-right"),
      jump: this.pressed("arrowup") || this.touch("p2-jump"),
      fire: this.pressed("enter") || this.pressed("shift") || this.pressed(".") || this.touch("p2-fire"),
    };
  }

  update(dt: number) {
    if (this.hooks.paused()) return;
    dt = Math.min(dt, 0.033);
    this.time += dt;
    this.frame = Math.floor(this.time * 10) % 8;
    this.shake = Math.max(0, this.shake - dt * 8);
    if (this.phase === "intro") {
      this.introT -= dt;
      if (this.introT <= 0) this.phase = "play";
      this.scroll();
      return;
    }
    if (this.phase === "clear") {
      this.clearT -= dt;
      if (this.clearT <= 0) this.nextLevel();
      this.scroll();
      return;
    }
    if (this.phase !== "play") return;

    for (const h of this.heroes()) this.stepHero(h, dt);
    for (const a of this.actors) {
      if (a.kind === "foe" || a.kind === "boss") this.stepFoe(a, dt);
      if (a.kind === "shot" || a.kind === "eshot") {
        a.x += a.vx * dt; a.y += a.vy * dt; a.t = (a.t ?? 0) + dt;
        if (a.x < this.cameraX - 40 || a.x > this.cameraX + VIEW.w + 40 || a.y < -40 || a.y > VIEW.h + 40) a.dead = true;
      }
    }
    this.collide();
    this.actors = this.actors.filter(a => !a.dead);
    this.scroll();

    const heroes = this.heroes();
    if (heroes.length === 0) {
      this.lives -= 1;
      this.phase = this.lives <= 0 ? "over" : "dead";
      this.hooks.play("impact");
      return;
    }
    const lead = Math.max(...heroes.map(h => h.x));
    if (lead > this.checkpoint + 240) this.checkpoint = lead;
    const boss = this.actors.find(a => a.kind === "boss");
    const reached = lead > this.level.width - 140;
    if (!boss && reached) {
      this.phase = "clear";
      this.clearT = 1.4;
      this.score += 1000 * this.level.id;
      this.message = "STAGE CLEAR";
      this.hooks.play("reveal-rare");
    }
    if (boss && boss.hp <= 0) {
      boss.dead = true;
      this.phase = "clear";
      this.clearT = 1.8;
      this.score += 5000;
      this.message = "GUARDIAN DOWN";
      this.hooks.play("reveal-rare");
    }
  }

  private stepHero(h: Actor, dt: number) {
    h.flash = Math.max(0, h.flash - dt);
    h.shoot = Math.max(0, h.shoot - dt);
    let left = false, right = false, jump = false, fire = false;
    if (h.ai && this.mode === "solo") {
      const lead = this.actors.find(a => a.kind === "hero" && a.slot === 0 && !a.dead);
      if (lead) {
        const target = lead.x - 46;
        if (h.x < target - 8) right = true;
        if (h.x > target + 18) left = true;
        if (lead.y + 8 < h.y && lead.grounded === false) jump = true;
        const foe = this.nearestFoe(h);
        if (foe) {
          h.face = foe.x >= h.x ? 1 : -1;
          fire = Math.abs(foe.x - h.x) < 420 && Math.abs(foe.y - h.y) < 90;
        }
        if (this.level.pits.some(p => h.x + (h.face > 0 ? 36 : -8) > p.x && h.x < p.x + p.w && h.grounded)) jump = true;
      }
    } else if (h.slot !== undefined) {
      const c = this.control(h.slot);
      left = c.moveLeft; right = c.moveRight; jump = c.jump; fire = c.fire;
    }
    h.vx = (Number(right) - Number(left)) * RUN;
    if (h.vx > 0) h.face = 1;
    if (h.vx < 0) h.face = -1;
    h.walk = Math.abs(h.vx) > 8 && h.grounded;
    if (h.grounded) h.coyote = COYOTE; else h.coyote = Math.max(0, h.coyote - dt);
    if (jump && h.coyote > 0 && h.vy >= -40) {
      h.vy = JUMP;
      h.grounded = false;
      h.coyote = 0;
    }
    h.vy += GRAVITY * dt;
    this.moveBody(h, dt);
    if (h.y > VIEW.h + 40) { h.dead = true; return; }
    const cd = this.weapon === "rapid" ? 0.1 : 0.22;
    if (fire && h.shoot <= 0) {
      this.fireWeapon(h);
      h.shoot = cd;
    }
  }

  private fireWeapon(h: Actor) {
    const muzzleX = h.face > 0 ? h.x + h.w : h.x - 8;
    const muzzleY = h.y + 12;
    const mk = (vy: number) => this.actors.push({
      kind: "shot", x: muzzleX, y: muzzleY, vx: BULLET * h.face, vy, w: 10, h: 4,
      hp: 1, face: h.face, grounded: false, coyote: 0, shoot: 0, flash: 0, t: 0,
    });
    if (this.weapon === "spread") { mk(-90); mk(0); mk(90); } else mk(0);
    this.hooks.play("select");
  }

  private nearestFoe(h: Actor) {
    let best: Actor | null = null, bestD = 1e9;
    for (const a of this.actors) {
      if ((a.kind !== "foe" && a.kind !== "boss") || a.dead) continue;
      const d = Math.hypot(a.x - h.x, a.y - h.y);
      if (d < bestD) { bestD = d; best = a; }
    }
    return best;
  }

  private stepFoe(a: Actor, dt: number) {
    a.t = (a.t ?? 0) + dt;
    a.flash = Math.max(0, a.flash - dt);
    a.shoot = Math.max(0, a.shoot - dt);
    const lead = this.heroes().sort((p, q) => Math.abs(p.x - a.x) - Math.abs(q.x - a.x))[0];
    if (lead) a.face = lead.x >= a.x ? 1 : -1;
    if (a.foe === "walker" || a.kind === "boss") {
      if (a.kind === "boss") a.vx = Math.sin(a.t * 0.7) * 70;
      a.vy += GRAVITY * dt;
      this.moveBody(a, dt);
      if (a.grounded && this.level.pits.some(p => a.x + a.w / 2 > p.x && a.x + a.w / 2 < p.x + p.w)) {
        a.vx *= -1;
        a.x += a.vx * dt * 2;
      }
    } else if (a.foe === "flyer") {
      a.y += Math.sin((a.t + a.x) * 1.6) * 28 * dt;
      a.x += Math.sin(a.t * 0.5) * 20 * dt;
    }
    const range = a.kind === "boss" ? 640 : 420;
    if (lead && Math.abs(lead.x - a.x) < range && a.shoot <= 0) {
      const aimY = (lead.y + 10 - (a.y + 10));
      const aimX = lead.x - a.x;
      const len = Math.hypot(aimX, aimY) || 1;
      const speed = a.kind === "boss" ? 260 : 200;
      this.actors.push({
        kind: "eshot", x: a.x + a.w / 2, y: a.y + 12,
        vx: (aimX / len) * speed, vy: (aimY / len) * speed * 0.35,
        w: a.kind === "boss" ? 12 : 8, h: a.kind === "boss" ? 12 : 8,
        hp: 1, face: a.face, grounded: false, coyote: 0, shoot: 0, flash: 0, t: 0,
      });
      a.shoot = a.kind === "boss" ? 0.55 : a.foe === "turret" ? 1.1 : 1.6;
    }
  }

  private moveBody(a: Actor, dt: number) {
    a.x += a.vx * dt;
    a.x = Math.max(8, Math.min(this.level.width - a.w - 8, a.x));
    a.y += a.vy * dt;
    const land = overPlatform(a.x, a.y, a.w, a.h, this.level.platforms, this.level.ground, this.level.pits);
    if (a.vy >= 0 && land !== null && a.y + a.h >= land && a.y + a.h <= land + Math.max(18, a.vy * dt + 4)) {
      a.y = land - a.h;
      a.vy = 0;
      a.grounded = true;
    } else {
      a.grounded = false;
    }
  }

  private collide() {
    const shots = this.actors.filter(a => a.kind === "shot");
    const foes = this.actors.filter(a => a.kind === "foe" || a.kind === "boss");
    const eshots = this.actors.filter(a => a.kind === "eshot");
    const heroes = this.heroes();
    for (const s of shots) for (const f of foes) {
      if (s.dead || f.dead) continue;
      if (!aabb(s, f)) continue;
      s.dead = true;
      f.hp -= 1;
      f.flash = 0.12;
      this.score += f.kind === "boss" ? 80 : 25;
      if (f.hp <= 0) {
        f.dead = true;
        this.score += f.kind === "boss" ? 2000 : 75;
        this.hooks.play("impact");
      }
    }
    for (const h of heroes) {
      if (h.flash > 0) continue;
      let hit = false;
      for (const e of eshots) if (!e.dead && aabb(h, e)) { e.dead = true; hit = true; }
      for (const f of foes) if (!f.dead && aabb(h, f)) hit = true;
      if (!hit) continue;
      if (this.shield > 0) { this.shield -= 1; h.flash = 1; this.hooks.play("impact"); continue; }
      h.dead = true;
      this.shake = 0.35;
      this.hooks.play("impact");
    }
  }

  private scroll() {
    const heroes = this.heroes();
    if (!heroes.length) return;
    const focus = Math.max(...heroes.map(h => h.x + h.w / 2));
    const target = Math.max(0, Math.min(this.level.width - VIEW.w, focus - 280));
    const ease = this.hooks.reducedMotion() ? 1 : 0.12;
    this.cameraX += (target - this.cameraX) * ease;
  }

  draw() {
    const ctx = this.ctx;
    const L = this.level;
    const cam = this.cameraX + (this.hooks.reducedMotion() ? 0 : Math.sin(this.time * 40) * this.shake * 5);
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, VIEW.w, VIEW.h);
    this.paintBg(ctx, L, cam);
    ctx.save();
    ctx.translate(-Math.round(cam), 0);
    this.paintWorld(ctx, L);
    for (const a of this.actors) this.paintActor(ctx, a);
    ctx.restore();
    this.paintHud(ctx);
  }

  private paintBg(ctx: CanvasRenderingContext2D, L: LevelDef, cam: number) {
    const g = ctx.createLinearGradient(0, 0, 0, VIEW.h);
    g.addColorStop(0, L.palette.sky);
    g.addColorStop(1, L.palette.sky2);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, VIEW.w, VIEW.h);
    const par = cam * 0.25;
    ctx.fillStyle = L.palette.far;
    for (let i = 0; i < 12; i++) {
      const x = ((i * 280 - par) % (VIEW.w + 280)) - 80;
      ctx.beginPath();
      ctx.moveTo(x, 360);
      ctx.lineTo(x + 140, 210);
      ctx.lineTo(x + 280, 360);
      ctx.fill();
    }
    const par2 = cam * 0.45;
    ctx.fillStyle = L.palette.mid;
    for (let i = 0; i < 14; i++) {
      const x = ((i * 210 - par2) % (VIEW.w + 210)) - 60;
      ctx.fillRect(x, 300 + (i % 3) * 16, 90, 240);
    }
  }

  private paintWorld(ctx: CanvasRenderingContext2D, L: LevelDef) {
    ctx.fillStyle = L.palette.dirt;
    ctx.fillRect(0, L.ground + 8, L.width, VIEW.h);
    ctx.fillStyle = L.palette.ground;
    let cursor = 0;
    const pits = [...L.pits].sort((a, b) => a.x - b.x);
    for (const pit of pits) {
      ctx.fillRect(cursor, L.ground, pit.x - cursor, VIEW.h - L.ground);
      ctx.fillStyle = L.palette.water;
      ctx.fillRect(pit.x, L.ground + 28, pit.w, VIEW.h - L.ground);
      ctx.fillStyle = L.palette.ground;
      cursor = pit.x + pit.w;
    }
    ctx.fillRect(cursor, L.ground, L.width - cursor, VIEW.h - L.ground);
    ctx.fillStyle = L.palette.accent;
    ctx.fillRect(0, L.ground, L.width, 4);
    for (const p of L.pits) ctx.clearRect(p.x, L.ground, p.w, 4);
    for (const p of L.platforms) {
      ctx.fillStyle = L.palette.ground;
      ctx.fillRect(p.x, p.y, p.w, p.h);
      ctx.fillStyle = L.palette.accent;
      ctx.fillRect(p.x, p.y, p.w, 3);
    }
    ctx.fillStyle = L.palette.accent;
    ctx.fillRect(L.width - 48, 80, 10, L.ground - 80);
    ctx.fillRect(L.width - 70, 80, 54, 12);
  }

  private paintActor(ctx: CanvasRenderingContext2D, a: Actor) {
    if (a.kind === "shot") {
      ctx.fillStyle = "#fff8a8";
      ctx.fillRect(Math.round(a.x), Math.round(a.y), a.w, a.h);
      ctx.fillStyle = "#ff9a3c";
      ctx.fillRect(Math.round(a.x) + (a.face > 0 ? -4 : a.w), Math.round(a.y), 4, a.h);
      return;
    }
    if (a.kind === "eshot") {
      ctx.fillStyle = "#ff5a5a";
      ctx.beginPath();
      ctx.arc(a.x + a.w / 2, a.y + a.h / 2, a.w / 2 + 1, 0, Math.PI * 2);
      ctx.fill();
      return;
    }
    if (a.kind === "foe" || a.kind === "boss") {
      const flash = a.flash > 0;
      const x = Math.round(a.x), y = Math.round(a.y);
      if (a.kind === "boss") {
        ctx.fillStyle = flash ? "#fff" : "#3a1020";
        ctx.fillRect(x, y, a.w, a.h);
        ctx.fillStyle = "#e8c84a";
        ctx.fillRect(x + 8, y + 12, 16, 10);
        ctx.fillRect(x + a.w - 24, y + 12, 16, 10);
        ctx.fillStyle = "#ff4d4d";
        ctx.fillRect(x + 12, y - 10, Math.max(4, (a.hp / 42) * (a.w - 24)), 6);
        ctx.fillStyle = "#fff";
        ctx.font = "bold 10px ui-monospace,monospace";
        ctx.fillText("CORE", x + 22, y + 48);
        return;
      }
      if (a.foe === "flyer") {
        ctx.fillStyle = flash ? "#fff" : "#6a2040";
        ctx.beginPath();
        ctx.ellipse(x + a.w / 2, y + a.h / 2, 16, 10, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#ffd36a";
        ctx.fillRect(x + 8, y + 6, 4, 4);
        ctx.fillRect(x + 16, y + 6, 4, 4);
        return;
      }
      if (a.foe === "turret") {
        ctx.fillStyle = flash ? "#fff" : "#4a3030";
        ctx.fillRect(x, y + 12, a.w, a.h - 12);
        ctx.fillStyle = "#8a2020";
        ctx.fillRect(x + 6, y, 16, 16);
        ctx.fillStyle = "#ccc";
        ctx.fillRect(a.face > 0 ? x + 18 : x - 8, y + 6, 16, 4);
        return;
      }
      ctx.fillStyle = flash ? "#fff" : "#5a1c28";
      ctx.fillRect(x + 4, y + 8, a.w - 8, a.h - 8);
      ctx.fillStyle = "#2a1014";
      ctx.fillRect(x + 6, y, 14, 12);
      ctx.fillStyle = "#ff6b4a";
      ctx.fillRect(a.face > 0 ? x + a.w - 6 : x - 4, y + 16, 8, 3);
      return;
    }
    if (a.kind === "hero") {
      const sprites = a.slot === 0 ? this.heroSprites : this.allySprites;
      const scale = 4;
      const facing: SpriteFacing = a.face < 0 ? "left" : "right";
      const walkFrame = this.hooks.reducedMotion() ? 0 : this.frame;
      const drawX = a.x + a.w / 2 - 8 * scale;
      const drawY = a.y + a.h - 16 * scale + 2;
      if (sprites) {
        drawMask(ctx, sprites, drawX, drawY, facing, Boolean(a.walk), walkFrame, scale, a.flash > 0 && Math.floor(this.time * 20) % 2 === 0);
      } else {
        ctx.fillStyle = a.slot === 0 ? "#ccff00" : "#7ad4ff";
        ctx.fillRect(Math.round(a.x), Math.round(a.y), a.w, a.h);
      }
      ctx.fillStyle = a.slot === 0 ? "#ccff00" : "#7ad4ff";
      ctx.font = "bold 9px ui-monospace,monospace";
      ctx.fillText(a.slot === 0 ? "P1" : a.ai ? "AI" : "P2", a.x - 2, a.y - 6);
    }
  }

  private paintHud(ctx: CanvasRenderingContext2D) {
    if (this.phase === "intro" || this.phase === "clear") {
      ctx.fillStyle = "rgba(0,0,0,0.35)";
      ctx.fillRect(0, 250, VIEW.w, 90);
      ctx.fillStyle = "#fff";
      ctx.textAlign = "center";
      ctx.font = "bold 28px ui-monospace,monospace";
      ctx.fillText(this.message, VIEW.w / 2, 292);
      ctx.font = "14px ui-monospace,monospace";
      ctx.fillStyle = "#ccff00";
      ctx.fillText(this.phase === "intro" ? "GET READY" : "ADVANCE", VIEW.w / 2, 320);
      ctx.textAlign = "left";
    }
    if (this.phase === "title") {
      ctx.fillStyle = "rgba(8,12,8,0.45)";
      ctx.fillRect(0, 0, VIEW.w, VIEW.h);
    }
  }
}
