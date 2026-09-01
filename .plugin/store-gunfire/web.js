// game/util.ts
var TAU = Math.PI * 2;
function clamp(v, a, b) {
  return v < a ? a : v > b ? b : v;
}
function lerp(a, b, t) {
  return a + (b - a) * t;
}
function rand(a, b) {
  return a + Math.random() * (b - a);
}
function randInt(a, b) {
  return Math.floor(rand(a, b + 1));
}
function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}
function dist(ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  return Math.sqrt(dx * dx + dy * dy);
}
function angTo(ax, ay, bx, by) {
  return Math.atan2(by - ay, bx - ax);
}
function fmtScore(n) {
  return Math.floor(n).toLocaleString("en-US");
}

// game/audio.ts
var ctx = null;
var master = null;
var muted = false;
function ac() {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.32;
    master.connect(ctx.destination);
  }
  if (ctx.state === "suspended") ctx.resume().catch(() => {
  });
  return ctx;
}
function setMuted(m) {
  muted = m;
}
function isMuted() {
  return muted;
}
function tone(freq, dur, type, vol = 0.5, slideTo, delay = 0) {
  if (muted) return;
  const c = ac();
  if (!c || !master) return;
  const t0 = c.currentTime + delay;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t0 + dur);
  g.gain.setValueAtTime(vol, t0);
  g.gain.exponentialRampToValueAtTime(1e-4, t0 + dur);
  osc.connect(g);
  g.connect(master);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}
function noise(dur, vol = 0.5, lowpass = 1200, delay = 0) {
  if (muted) return;
  const c = ac();
  if (!c || !master) return;
  const t0 = c.currentTime + delay;
  const len = Math.max(1, Math.floor(c.sampleRate * dur));
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = buf;
  const filt = c.createBiquadFilter();
  filt.type = "lowpass";
  filt.frequency.value = lowpass;
  const g = c.createGain();
  g.gain.setValueAtTime(vol, t0);
  g.gain.exponentialRampToValueAtTime(1e-4, t0 + dur);
  src.connect(filt);
  filt.connect(g);
  g.connect(master);
  src.start(t0);
}
var sfx = {
  shootPistol() {
    tone(760, 0.09, "square", 0.22, 180);
    noise(0.05, 0.16, 2400);
  },
  shootSmg() {
    tone(520, 0.05, "square", 0.16, 160);
    noise(0.03, 0.12, 3200);
  },
  shootShotgun() {
    noise(0.22, 0.4, 900);
    tone(240, 0.16, "sawtooth", 0.26, 60);
  },
  shootRifle() {
    tone(880, 0.08, "sawtooth", 0.22, 200);
    noise(0.05, 0.2, 2800);
  },
  shootLaser() {
    tone(1500, 0.07, "sine", 0.16, 500);
  },
  shootRocket() {
    noise(0.25, 0.28, 700);
    tone(180, 0.3, "sawtooth", 0.2, 60);
  },
  hit() {
    tone(320, 0.05, "triangle", 0.14, 200);
  },
  kill() {
    noise(0.12, 0.22, 700);
    tone(300, 0.14, "triangle", 0.2, 80);
  },
  explode(big = false) {
    noise(big ? 0.7 : 0.4, big ? 0.6 : 0.42, big ? 500 : 800);
    tone(120, big ? 0.6 : 0.35, "sine", 0.5, 40);
  },
  pickup() {
    tone(660, 0.07, "sine", 0.22);
    tone(990, 0.1, "sine", 0.22, void 0, 0.06);
  },
  powerup() {
    tone(440, 0.09, "square", 0.2);
    tone(660, 0.09, "square", 0.2, void 0, 0.08);
    tone(880, 0.14, "square", 0.22, void 0, 0.16);
  },
  hurt() {
    tone(180, 0.16, "sawtooth", 0.3, 70);
    noise(0.1, 0.16, 500);
  },
  shieldBreak() {
    tone(520, 0.2, "sawtooth", 0.3, 90);
    noise(0.16, 0.2, 1200);
  },
  dash() {
    noise(0.12, 0.14, 1800);
    tone(220, 0.12, "sine", 0.12, 500);
  },
  waveStart() {
    tone(392, 0.12, "square", 0.2);
    tone(523, 0.12, "square", 0.2, void 0, 0.12);
    tone(659, 0.2, "square", 0.22, void 0, 0.24);
  },
  bossAlert() {
    tone(110, 0.5, "sawtooth", 0.34, 55);
    tone(110, 0.5, "sawtooth", 0.34, 55, 0.6);
  },
  levelUp() {
    tone(523, 0.09, "square", 0.2);
    tone(659, 0.09, "square", 0.2, void 0, 0.09);
    tone(784, 0.09, "square", 0.2, void 0, 0.18);
    tone(1046, 0.2, "square", 0.24, void 0, 0.27);
  },
  gameOver() {
    tone(392, 0.25, "sawtooth", 0.3, 300);
    tone(311, 0.25, "sawtooth", 0.3, void 0, 0.28);
    tone(233, 0.5, "sawtooth", 0.3, void 0, 0.56);
  }
};

// game/particles.ts
var Particles = class {
  list = [];
  max = 900;
  spawn(p) {
    if (this.list.length >= this.max) this.list.shift();
    this.list.push({
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      life: 0.5,
      maxLife: 0.5,
      size: 3,
      color: "#fff",
      drag: 0.9,
      gravity: 0,
      shrink: 1,
      glow: false,
      type: "dot",
      rot: 0,
      vrot: 0,
      ...p
    });
  }
  muzzle(x, y, ang, color) {
    for (let i = 0; i < 5; i++) {
      const a = ang + rand(-0.35, 0.35);
      const sp = rand(120, 340);
      this.spawn({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: rand(0.05, 0.14),
        size: rand(2, 4),
        color,
        drag: 0.82,
        glow: true,
        type: "spark"
      });
    }
  }
  shell(x, y, ang) {
    this.spawn({
      x,
      y,
      vx: Math.cos(ang + Math.PI / 2) * rand(40, 90) + rand(-20, 20),
      vy: Math.sin(ang + Math.PI / 2) * rand(40, 90) - rand(40, 90),
      life: rand(0.4, 0.7),
      size: rand(2, 3.2),
      color: "#ffcf7a",
      drag: 0.88,
      gravity: 520,
      shrink: 0.6,
      type: "shell",
      rot: rand(0, TAU),
      vrot: rand(-12, 12)
    });
  }
  explosion(x, y, radius, color = "#ff9f0a", count = 26) {
    for (let i = 0; i < count; i++) {
      const a = rand(0, TAU);
      const sp = rand(60, radius * 4);
      this.spawn({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: rand(0.25, 0.6),
        size: rand(2, 5),
        color,
        drag: 0.86,
        glow: true,
        type: i % 3 === 0 ? "spark" : "dot"
      });
    }
    this.spawn({
      x,
      y,
      life: 0.35,
      maxLife: 0.35,
      size: radius * 0.9,
      color: "#ffd60a",
      glow: true,
      type: "ring"
    });
    this.spawn({
      x,
      y,
      life: 0.55,
      maxLife: 0.55,
      size: radius * 1.6,
      color: "rgba(255,159,10,0.5)",
      type: "ring"
    });
    for (let i = 0; i < 8; i++) {
      const a = rand(0, TAU);
      const sp = rand(20, 90);
      this.spawn({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 20,
        life: rand(0.5, 0.9),
        size: rand(8, 16),
        color: "rgba(60,60,66,0.35)",
        drag: 0.9,
        shrink: 0.4
      });
    }
  }
  blood(x, y, ang) {
    for (let i = 0; i < 10; i++) {
      const a = ang + rand(-1, 1);
      const sp = rand(40, 200);
      this.spawn({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: rand(0.2, 0.5),
        size: rand(2, 4.5),
        color: "#e5484d",
        drag: 0.86,
        type: "dot"
      });
    }
  }
  hitSpark(x, y, ang, color) {
    for (let i = 0; i < 6; i++) {
      const a = ang + rand(-0.7, 0.7);
      const sp = rand(80, 260);
      this.spawn({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: rand(0.08, 0.2),
        size: rand(1.5, 3),
        color,
        drag: 0.8,
        glow: true,
        type: "spark"
      });
    }
  }
  floatText(x, y, text, color, size = 15) {
    this.spawn({
      x,
      y,
      vy: -46,
      vx: rand(-8, 8),
      life: 0.75,
      maxLife: 0.75,
      size,
      color,
      drag: 0.94,
      type: "dot",
      text
    });
  }
  trail(x, y, color) {
    this.spawn({
      x,
      y,
      life: 0.25,
      size: rand(3, 5),
      color,
      drag: 0.92,
      glow: true,
      vx: rand(-20, 20),
      vy: rand(-20, 20)
    });
  }
  update(dt) {
    const l = this.list;
    for (let i = l.length - 1; i >= 0; i--) {
      const p = l[i];
      p.life -= dt;
      if (p.life <= 0) {
        l.splice(i, 1);
        continue;
      }
      p.vx *= Math.pow(p.drag, dt * 60);
      p.vy *= Math.pow(p.drag, dt * 60);
      p.vy += p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vrot * dt;
    }
  }
  draw(ctx2) {
    for (const p of this.list) {
      const t = clamp(p.life / p.maxLife, 0, 1);
      const a = t;
      ctx2.globalAlpha = a;
      if (p.type === "ring") {
        const r = p.size * (1.6 - t * 0.6);
        ctx2.strokeStyle = p.color;
        ctx2.lineWidth = 3 * t + 1;
        ctx2.beginPath();
        ctx2.arc(p.x, p.y, Math.max(0.5, r), 0, TAU);
        ctx2.stroke();
      } else if (p.type === "shell") {
        ctx2.save();
        ctx2.translate(p.x, p.y);
        ctx2.rotate(p.rot);
        ctx2.fillStyle = p.color;
        ctx2.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 1.6);
        ctx2.restore();
      } else if (p.type === "dot" && p.text) {
        ctx2.font = `700 ${p.size}px -apple-system, "PingFang SC", sans-serif`;
        ctx2.textAlign = "center";
        ctx2.fillStyle = p.color;
        ctx2.fillText(p.text, p.x, p.y);
      } else {
        ctx2.fillStyle = p.color;
        const s = p.size * (p.shrink + (1 - p.shrink) * t);
        if (p.glow) {
          ctx2.shadowColor = p.color;
          ctx2.shadowBlur = 8;
        }
        ctx2.beginPath();
        ctx2.arc(p.x, p.y, Math.max(0.5, s), 0, TAU);
        ctx2.fill();
        ctx2.shadowBlur = 0;
      }
    }
    ctx2.globalAlpha = 1;
  }
  clear() {
    this.list.length = 0;
  }
};

// game/weapons.ts
var WEAPONS = [
  {
    key: "pistol",
    name: "\u624B\u67AA",
    icon: "\u{1F52B}",
    color: "#ffd60a",
    cooldown: 0.24,
    damage: 14,
    speed: 640,
    spread: 0.03,
    pellets: 1,
    pierce: 1,
    aoe: 0,
    knock: 40,
    auto: false,
    desc: "\u5747\u8861\u53EF\u9760\uFF0C\u968F\u65F6\u5F00\u706B"
  },
  {
    key: "smg",
    name: "\u51B2\u950B\u67AA",
    icon: "\u{1F4A5}",
    color: "#ff9f0a",
    cooldown: 0.075,
    damage: 6,
    speed: 720,
    spread: 0.09,
    pellets: 1,
    pierce: 1,
    aoe: 0,
    knock: 22,
    auto: true,
    desc: "\u9AD8\u5C04\u901F\u5F39\u96E8\uFF0C\u538B\u5236\u5168\u573A"
  },
  {
    key: "shotgun",
    name: "\u9730\u5F39\u67AA",
    icon: "\u{1F4A3}",
    color: "#ff453a",
    cooldown: 0.62,
    damage: 8,
    speed: 560,
    spread: 0.3,
    pellets: 7,
    pierce: 1,
    aoe: 0,
    knock: 90,
    auto: false,
    desc: "\u6247\u5F62\u6563\u5F39\uFF0C\u8FD1\u8EAB\u6BC1\u706D\u8005"
  },
  {
    key: "rifle",
    name: "\u7A81\u51FB\u6B65\u67AA",
    icon: "\u{1F3AF}",
    color: "#30d158",
    cooldown: 0.13,
    damage: 18,
    speed: 860,
    spread: 0.035,
    pellets: 1,
    pierce: 5,
    aoe: 0,
    knock: 30,
    auto: true,
    desc: "\u9AD8\u901F\u7A7F\u7532\uFF0C\u4E00\u7A7F\u4E94"
  },
  {
    key: "laser",
    name: "\u6FC0\u5149\u67AA",
    icon: "\u26A1",
    color: "#64d2ff",
    cooldown: 0.05,
    damage: 5,
    speed: 1100,
    spread: 0.012,
    pellets: 1,
    pierce: 99,
    aoe: 0,
    knock: 12,
    auto: true,
    desc: "\u5149\u901F\u8FDE\u5C04\uFF0C\u65E0\u9650\u7A7F\u900F"
  },
  {
    key: "rocket",
    name: "\u706B\u7BAD\u7B52",
    icon: "\u{1F680}",
    color: "#ff375f",
    cooldown: 0.85,
    damage: 55,
    speed: 420,
    spread: 0.02,
    pellets: 1,
    pierce: 0,
    aoe: 95,
    knock: 220,
    auto: false,
    desc: "\u8303\u56F4\u7206\u7834\uFF0C\u6E05\u573A\u795E\u5668"
  }
];
function nextWeapon(current) {
  const i = WEAPONS.findIndex((w) => w.key === current);
  return WEAPONS[(i + 1) % WEAPONS.length];
}

// game/entities.ts
var ENEMIES = {
  wanderer: {
    key: "wanderer",
    name: "\u6E38\u8361\u8005",
    hp: 22,
    speed: 62,
    radius: 12,
    contact: 8,
    score: 10,
    color: "#5e5ce6",
    dark: "#3f3d9e"
  },
  chaser: {
    key: "chaser",
    name: "\u8FFD\u8E2A\u8005",
    hp: 34,
    speed: 100,
    radius: 13,
    contact: 10,
    score: 15,
    color: "#bf5af2",
    dark: "#7a2fb0"
  },
  shooter: {
    key: "shooter",
    name: "\u72D9\u51FB\u624B",
    hp: 24,
    speed: 58,
    radius: 12,
    contact: 8,
    score: 20,
    color: "#ff9f0a",
    dark: "#b06a00",
    ranged: true,
    range: 340,
    shootCd: 1.6,
    shootDmg: 12,
    bulletSpeed: 380
  },
  rusher: {
    key: "rusher",
    name: "\u51B2\u950B\u8005",
    hp: 16,
    speed: 96,
    radius: 11,
    contact: 12,
    score: 18,
    color: "#ff453a",
    dark: "#b0181a",
    rusher: true,
    windup: 0.55
  },
  tank: {
    key: "tank",
    name: "\u91CD\u88C5\u5766\u514B",
    hp: 190,
    speed: 36,
    radius: 24,
    contact: 18,
    score: 60,
    color: "#8e8e93",
    dark: "#4a4a50"
  }
};
var UNLOCK = [
  [1, "wanderer"],
  [2, "chaser"],
  [3, "shooter"],
  [4, "rusher"],
  [6, "tank"]
];
function poolForWave(wave) {
  const pool = [];
  for (const [w, k] of UNLOCK) if (wave >= w) pool.push(k);
  return pool;
}
function waveBudget(wave) {
  return 6 + Math.floor(wave * 2.6);
}
function hpScale(wave) {
  return 1 + (wave - 1) * 0.16;
}
var DROPS = {
  medkit: { key: "medkit", color: "#30d158", icon: "\u271A", weight: 14 },
  shield: { key: "shield", color: "#64d2ff", icon: "\u25C8", weight: 12 },
  weapon: { key: "weapon", color: "#ffd60a", icon: "\u2605", weight: 7 },
  nuke: { key: "nuke", color: "#ff375f", icon: "\u2622", weight: 3 },
  star: { key: "star", color: "#ffd60a", icon: "\u2726", weight: 100 }
};
function rollDrop() {
  const entries = Object.entries(DROPS);
  let total = 0;
  for (const [, d] of entries) total += d.weight;
  let r = Math.random() * total;
  for (const [k, d] of entries) {
    r -= d.weight;
    if (r <= 0) return k;
  }
  return "star";
}

// game/engine.ts
var VIEW_W = 960;
var VIEW_H = 600;
var LS_BEST = "gunfire_best";
function readBest() {
  try {
    const v = typeof window !== "undefined" ? window.localStorage.getItem(LS_BEST) : null;
    return Number(v || 0);
  } catch {
    return 0;
  }
}
function writeBest(v) {
  try {
    if (typeof window !== "undefined") window.localStorage.setItem(LS_BEST, String(Math.floor(v)));
  } catch {
  }
}
var GunfireGame = class {
  canvas;
  ctx;
  ev;
  raf = 0;
  last = 0;
  running = false;
  // 输入
  keys = /* @__PURE__ */ new Set();
  mouse = { x: VIEW_W / 2, y: VIEW_H / 2, down: false };
  touchMode = false;
  // 世界
  px = VIEW_W / 2;
  py = VIEW_H / 2;
  pvx = 0;
  pvy = 0;
  hp = 100;
  maxHp = 100;
  shield = 0;
  maxShield = 40;
  weaponIdx = 0;
  shootCd = 0;
  dashCd = 0;
  dashT = 0;
  dashDx = 0;
  dashDy = 0;
  invuln = 0;
  hurtT = 0;
  aimAng = 0;
  muzzleT = 0;
  wave = 0;
  waveState = "intermission";
  waveT = 0;
  spawnQueue = [];
  spawnT = 0;
  bossActive = false;
  boss = null;
  bossActions = [];
  enemies = [];
  bullets = [];
  drops = [];
  bloods = [];
  particles = new Particles();
  score = 0;
  kills = 0;
  combo = 0;
  comboT = 0;
  playTime = 0;
  shake = 0;
  hitstop = 0;
  flash = 0;
  over = false;
  paused = false;
  boundKeyDown;
  boundKeyUp;
  boundMouseMove;
  boundMouseDown;
  boundMouseUp;
  boundTouch;
  boundBlur;
  boundResize;
  constructor(canvas, ev = {}) {
    this.canvas = canvas;
    this.ev = ev;
    const ctx2 = canvas.getContext("2d");
    if (!ctx2) throw new Error("no 2d context");
    this.ctx = ctx2;
    this.boundKeyDown = (e) => this.onKey(e, true);
    this.boundKeyUp = (e) => this.onKey(e, false);
    this.boundMouseMove = (e) => this.onMouseMove(e);
    this.boundMouseDown = (e) => this.onMouseDown(e);
    this.boundMouseUp = () => {
      this.mouse.down = false;
    };
    this.boundTouch = (e) => this.onTouch(e);
    this.boundBlur = () => {
      if (this.running && !this.over && !this.paused) this.setPaused(true);
    };
    this.boundResize = () => this.fit();
    window.addEventListener("keydown", this.boundKeyDown);
    window.addEventListener("keyup", this.boundKeyUp);
    canvas.addEventListener("mousemove", this.boundMouseMove);
    canvas.addEventListener("mousedown", this.boundMouseDown);
    window.addEventListener("mouseup", this.boundMouseUp);
    canvas.addEventListener("touchstart", this.boundTouch, { passive: false });
    canvas.addEventListener("touchmove", this.boundTouch, { passive: false });
    canvas.addEventListener("touchend", this.boundTouch, { passive: false });
    window.addEventListener("blur", this.boundBlur);
    window.addEventListener("resize", this.boundResize);
    this.fit();
    this.reset();
    this.last = performance.now();
    this.running = true;
    const loop = (t) => {
      if (!this.running) return;
      this.frame(t);
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }
  // ---------- 生命周期 ----------
  destroy() {
    this.running = false;
    cancelAnimationFrame(this.raf);
    window.removeEventListener("keydown", this.boundKeyDown);
    window.removeEventListener("keyup", this.boundKeyUp);
    this.canvas.removeEventListener("mousemove", this.boundMouseMove);
    this.canvas.removeEventListener("mousedown", this.boundMouseDown);
    window.removeEventListener("mouseup", this.boundMouseUp);
    this.canvas.removeEventListener("touchstart", this.boundTouch);
    this.canvas.removeEventListener("touchmove", this.boundTouch);
    this.canvas.removeEventListener("touchend", this.boundTouch);
    window.removeEventListener("blur", this.boundBlur);
    window.removeEventListener("resize", this.boundResize);
  }
  start() {
    this.reset();
    this.paused = false;
  }
  togglePause() {
    if (this.over) return;
    this.paused = !this.paused;
  }
  resize() {
    this.fit();
  }
  setPaused(p) {
    if (!this.over) this.paused = p;
  }
  isPaused() {
    return this.paused;
  }
  isOver() {
    return this.over;
  }
  isMuted() {
    return isMuted();
  }
  toggleMute() {
    setMuted(!isMuted());
  }
  reset() {
    this.px = VIEW_W / 2;
    this.py = VIEW_H / 2;
    this.pvx = 0;
    this.pvy = 0;
    this.hp = this.maxHp;
    this.shield = 0;
    this.weaponIdx = 0;
    this.shootCd = 0;
    this.dashCd = 0;
    this.dashT = 0;
    this.invuln = 1.2;
    this.hurtT = 0;
    this.wave = 0;
    this.waveState = "intermission";
    this.waveT = 1.6;
    this.enemies = [];
    this.bullets = [];
    this.drops = [];
    this.bloods = [];
    this.particles.clear();
    this.boss = null;
    this.bossActive = false;
    this.score = 0;
    this.kills = 0;
    this.combo = 0;
    this.comboT = 0;
    this.playTime = 0;
    this.shake = 0;
    this.hitstop = 0;
    this.flash = 0;
    this.over = false;
    this.paused = false;
    this.spawnQueue = [];
  }
  fit() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const rect = this.canvas.parentElement?.getBoundingClientRect();
    const w = rect?.width || 480;
    const h = rect?.height || 360;
    this.canvas.width = w * dpr;
    this.canvas.height = h * dpr;
    this.canvas.style.width = w + "px";
    this.canvas.style.height = h + "px";
    this.canvas.style.touchAction = "none";
  }
  // ---------- 输入 ----------
  onKey(e, down) {
    const k = e.key.toLowerCase();
    if (["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(k)) e.preventDefault();
    if (down && (k === "p" || k === "escape")) {
      this.togglePause();
      return;
    }
    if (down && k === "m") {
      this.toggleMute();
      return;
    }
    if (down && k === " ") {
      this.tryDash();
    }
    if (down) this.keys.add(k);
    else this.keys.delete(k);
  }
  onMouseMove(e) {
    const p = this.toWorld(e.clientX, e.clientY);
    if (p) {
      this.mouse.x = p.x;
      this.mouse.y = p.y;
    }
  }
  onMouseDown(e) {
    const p = this.toWorld(e.clientX, e.clientY);
    if (p) {
      this.mouse.x = p.x;
      this.mouse.y = p.y;
    }
    this.mouse.down = true;
    if (e.button === 0 && !this.touchMode && this.paused) this.setPaused(false);
  }
  onTouch(e) {
    e.preventDefault();
    this.touchMode = true;
    if (e.touches.length > 0) {
      const t = e.touches[0];
      const p = this.toWorld(t.clientX, t.clientY);
      if (p) {
        this.mouse.x = p.x;
        this.mouse.y = p.y;
      }
      this.mouse.down = true;
      if (this.paused) this.setPaused(false);
    } else {
      this.mouse.down = false;
    }
  }
  toWorld(clientX, clientY) {
    const r = this.canvas.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return null;
    const scale = Math.min(r.width / VIEW_W, r.height / VIEW_H);
    const offX = (r.width - VIEW_W * scale) / 2;
    const offY = (r.height - VIEW_H * scale) / 2;
    return {
      x: (clientX - r.left - offX) / scale,
      y: (clientY - r.top - offY) / scale
    };
  }
  tryDash() {
    if (this.dashCd > 0 || this.dashT > 0 || this.over || this.paused) return;
    let dx = 0, dy = 0;
    if (this.keys.has("w") || this.keys.has("arrowup")) dy -= 1;
    if (this.keys.has("s") || this.keys.has("arrowdown")) dy += 1;
    if (this.keys.has("a") || this.keys.has("arrowleft")) dx -= 1;
    if (this.keys.has("d") || this.keys.has("arrowright")) dx += 1;
    if (dx === 0 && dy === 0) {
      dx = Math.cos(this.aimAng);
      dy = Math.sin(this.aimAng);
    }
    const len = Math.hypot(dx, dy) || 1;
    this.dashDx = dx / len;
    this.dashDy = dy / len;
    this.dashT = 0.16;
    this.dashCd = 1.15;
    this.invuln = Math.max(this.invuln, 0.32);
    sfx.dash();
  }
  // ---------- 主循环 ----------
  frame(t) {
    let dt = Math.min(0.05, (t - this.last) / 1e3);
    this.last = t;
    if (this.paused || this.over) {
      this.draw();
      return;
    }
    if (this.hitstop > 0) {
      this.hitstop -= dt;
      dt = 0;
    }
    this.update(dt);
    this.draw();
  }
  update(dt) {
    this.playTime += dt;
    this.comboT -= dt;
    if (this.comboT <= 0) this.combo = 0;
    this.shake = Math.max(0, this.shake - dt * 26);
    this.flash = Math.max(0, this.flash - dt * 3);
    this.invuln = Math.max(0, this.invuln - dt);
    this.dashCd = Math.max(0, this.dashCd - dt);
    this.hurtT = Math.max(0, this.hurtT - dt);
    this.muzzleT = Math.max(0, this.muzzleT - dt);
    this.shootCd -= dt;
    this.updateWave(dt);
    this.updatePlayer(dt);
    this.updateEnemies(dt);
    this.updateBullets(dt);
    this.updateDrops(dt);
    this.particles.update(dt);
    for (let i = this.bloods.length - 1; i >= 0; i--) {
      const b = this.bloods[i];
      b.a -= dt * 0.5;
      if (b.a <= 0) this.bloods.splice(i, 1);
    }
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      b.life -= dt;
      if (b.life <= 0 || b.x < -40 || b.x > VIEW_W + 40 || b.y < -40 || b.y > VIEW_H + 40) {
        this.bullets.splice(i, 1);
      }
    }
    for (let i = this.drops.length - 1; i >= 0; i--) {
      const d = this.drops[i];
      d.life -= dt;
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      d.vx *= 0.92;
      d.vy *= 0.92;
      if (d.life <= 0) this.drops.splice(i, 1);
    }
    if (this.drops.length > 40) this.drops.splice(0, this.drops.length - 40);
  }
  // ---------- 波次 ----------
  updateWave(dt) {
    if (this.waveState === "intermission") {
      this.waveT -= dt;
      if (this.waveT <= 0) {
        this.wave++;
        const isBoss = this.wave % 5 === 0;
        this.waveState = "active";
        if (isBoss) {
          this.spawnBoss(this.wave);
        } else {
          const pool = poolForWave(this.wave);
          const n = waveBudget(this.wave);
          this.spawnQueue = [];
          for (let i = 0; i < n; i++) this.spawnQueue.push(pick(pool));
          this.spawnT = 0.5;
        }
        this.ev.onWave?.(this.wave, isBoss);
        sfx.waveStart();
        if (isBoss) sfx.bossAlert();
      }
    } else {
      if (this.bossActive) {
      } else if (this.spawnQueue.length > 0) {
        this.spawnT -= dt;
        if (this.spawnT <= 0) {
          this.spawnT = Math.max(0.16, 0.9 - this.wave * 0.03);
          const kind = this.spawnQueue.shift();
          this.spawnEnemy(kind);
        }
      } else if (this.enemies.length === 0) {
        this.waveState = "intermission";
        this.waveT = 2.6;
        this.combo = 0;
      }
    }
  }
  spawnEnemy(kind) {
    const def = ENEMIES[kind];
    let x = 0, y = 0;
    for (let i = 0; i < 12; i++) {
      const side = randInt(0, 3);
      if (side === 0) {
        x = rand(-30, VIEW_W + 30);
        y = -30;
      } else if (side === 1) {
        x = rand(-30, VIEW_W + 30);
        y = VIEW_H + 30;
      } else if (side === 2) {
        x = -30;
        y = rand(-30, VIEW_H + 30);
      } else {
        x = VIEW_W + 30;
        y = rand(-30, VIEW_H + 30);
      }
      if (dist(x, y, this.px, this.py) > 140) break;
    }
    const scale = hpScale(this.wave);
    this.enemies.push({
      kind,
      x,
      y,
      vx: 0,
      vy: 0,
      hp: def.hp * scale,
      maxHp: def.hp * scale,
      r: def.radius,
      cd: rand(0.5, 1.2),
      windup: 0,
      hurtT: 0,
      hitCd: 0,
      angle: rand(0, TAU),
      speed: def.speed,
      boss: false,
      phase: 0,
      born: 0.4
    });
  }
  spawnBoss(wave) {
    const hp = 850 + wave * 130;
    this.boss = {
      kind: "tank",
      x: VIEW_W / 2,
      y: 90,
      vx: 0,
      vy: 0,
      hp,
      maxHp: hp,
      r: 44,
      cd: 1,
      windup: 0,
      hurtT: 0,
      hitCd: 0,
      angle: Math.PI / 2,
      speed: 70,
      boss: true,
      phase: 0,
      born: 1.2
    };
    this.bossActive = true;
    this.enemies.push(this.boss);
    this.bossActions = [
      { kind: "ring", t: 0.6 },
      { kind: "fan", t: 2.2 },
      { kind: "summon", t: 3.6 },
      { kind: "charge", t: 5 }
    ];
    this.shake = 8;
    this.flash = 0.5;
  }
  // ---------- 玩家 ----------
  updatePlayer(dt) {
    let dx = 0, dy = 0;
    if (this.keys.has("w") || this.keys.has("arrowup")) dy -= 1;
    if (this.keys.has("s") || this.keys.has("arrowdown")) dy += 1;
    if (this.keys.has("a") || this.keys.has("arrowleft")) dx -= 1;
    if (this.keys.has("d") || this.keys.has("arrowright")) dx += 1;
    if (this.dashT > 0) {
      this.dashT -= dt;
      const sp = 780;
      this.pvx = this.dashDx * sp;
      this.pvy = this.dashDy * sp;
    } else {
      const len = Math.hypot(dx, dy);
      const speed = 235;
      if (len > 0) {
        const nx = dx / len, ny = dy / len;
        this.pvx = lerp(this.pvx, nx * speed, 1 - Math.pow(1e-4, dt));
        this.pvy = lerp(this.pvy, ny * speed, 1 - Math.pow(1e-4, dt));
      } else {
        this.pvx *= Math.pow(1e-3, dt);
        this.pvy *= Math.pow(1e-3, dt);
      }
    }
    this.px = clamp(this.px + this.pvx * dt, 16, VIEW_W - 16);
    this.py = clamp(this.py + this.pvy * dt, 16, VIEW_H - 16);
    this.aimAng = angTo(this.px, this.py, this.mouse.x, this.mouse.y);
    const w = WEAPONS[this.weaponIdx];
    if (this.mouse.down && this.shootCd <= 0) {
      this.fire(w);
    }
  }
  fire(w) {
    this.shootCd = w.cooldown;
    this.muzzleT = 0.06;
    const mx = this.px + Math.cos(this.aimAng) * 22;
    const my = this.py + Math.sin(this.aimAng) * 22;
    for (let i = 0; i < w.pellets; i++) {
      const a = this.aimAng + (i - (w.pellets - 1) / 2) * w.spread * 0.6 + rand(-w.spread, w.spread) * 0.5;
      this.bullets.push({
        x: mx,
        y: my,
        vx: Math.cos(a) * w.speed,
        vy: Math.sin(a) * w.speed,
        dmg: w.damage,
        r: w.key === "rocket" ? 6 : 3.5,
        pierce: w.pierce,
        hit: /* @__PURE__ */ new Set(),
        aoe: w.aoe,
        knock: w.knock,
        color: w.color,
        from: "player",
        life: 1.6,
        trail: 0
      });
    }
    this.particles.muzzle(mx, my, this.aimAng, w.color);
    if (w.key !== "laser") this.particles.shell(mx, my, this.aimAng);
    this.pvx -= Math.cos(this.aimAng) * w.knock * 0.25;
    this.pvy -= Math.sin(this.aimAng) * w.knock * 0.25;
    const s = sfx;
    (s["shoot" + w.key[0].toUpperCase() + w.key.slice(1)] || s.shootPistol)();
  }
  hurtPlayer(dmg, fromX, fromY) {
    if (this.invuln > 0 || this.over) return;
    let rest = dmg;
    if (this.shield > 0) {
      const absorbed = Math.min(this.shield, rest);
      this.shield -= absorbed;
      rest -= absorbed;
      if (this.shield === 0) sfx.shieldBreak();
    }
    if (rest > 0) {
      this.hp -= rest;
      this.invuln = 0.9;
      this.hurtT = 0.25;
      this.shake = 6;
      this.hitstop = 0.045;
      this.flash = 0.3;
      sfx.hurt();
      if (this.hp <= 0) {
        this.hp = 0;
        this.gameOver();
      }
    }
  }
  gameOver() {
    this.over = true;
    this.particles.explosion(this.px, this.py, 90, "#ff453a", 50);
    this.shake = 14;
    sfx.gameOver();
    const best = readBest();
    if (this.score > best) writeBest(this.score);
    this.ev.onGameOver?.({
      score: this.score,
      wave: this.wave,
      kills: this.kills,
      weapon: WEAPONS[this.weaponIdx].name,
      playTime: this.playTime
    });
  }
  // ---------- 敌人 ----------
  updateEnemies(dt) {
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      e.born = Math.max(0, e.born - dt);
      e.hurtT = Math.max(0, e.hurtT - dt);
      e.hitCd = Math.max(0, e.hitCd - dt);
      e.cd -= dt;
      const def = ENEMIES[e.kind];
      const d = dist(e.x, e.y, this.px, this.py);
      if (e.boss) {
        this.updateBoss(e, dt, d);
      } else {
        let targetAng = angTo(e.x, e.y, this.px, this.py);
        let sp = e.speed;
        if (def.rusher && e.windup > 0) {
          e.windup -= dt;
          sp = 0;
          if (e.windup <= 0) {
            e.vx = Math.cos(targetAng) * 360;
            e.vy = Math.sin(targetAng) * 360;
          }
        } else if (def.rusher && e.cd <= 0 && d < 430) {
          e.windup = def.windup;
          e.cd = rand(1.6, 2.6);
          e.angle = targetAng;
        } else if (def.ranged && d < def.range && d > 170) {
          const strafe = Math.sin(this.playTime * 1.4 + e.x) > 0 ? 1 : -1;
          targetAng = angTo(e.x, e.y, this.px, this.py) + Math.PI / 2 * strafe;
          sp *= 0.7;
          if (e.cd <= 0) {
            e.cd = def.shootCd;
            const ba = angTo(e.x, e.y, this.px, this.py);
            this.enemyShoot(e, ba, def.shootDmg, def.bulletSpeed);
            e.angle = ba;
          }
        } else if (d < 60) {
          sp *= 0.4;
        }
        e.angle = lerp(e.angle, angTo(e.x, e.y, this.px, this.py), 1 - Math.pow(0.01, dt));
        if (!(def.rusher && e.windup > 0)) {
          e.vx = Math.cos(targetAng) * sp;
          e.vy = Math.sin(targetAng) * sp;
        }
        for (let j = i + 1; j < this.enemies.length; j++) {
          const o = this.enemies[j];
          if (o.boss) continue;
          const dd = dist(e.x, e.y, o.x, o.y);
          const min = e.r + o.r;
          if (dd > 0 && dd < min) {
            const push = (min - dd) / 2;
            const ax = (e.x - o.x) / dd, ay = (e.y - o.y) / dd;
            e.x += ax * push;
            e.y += ay * push;
            o.x -= ax * push;
            o.y -= ay * push;
          }
        }
        e.x += e.vx * dt;
        e.y += e.vy * dt;
        e.x = clamp(e.x, -20, VIEW_W + 20);
        e.y = clamp(e.y, -20, VIEW_H + 20);
        if (e.hitCd <= 0 && dist(e.x, e.y, this.px, this.py) < e.r + 14) {
          e.hitCd = 0.75;
          this.hurtPlayer(def.contact, e.x, e.y);
        }
      }
      if (e.hp <= 0) this.killEnemy(i);
    }
  }
  enemyShoot(e, ang, dmg, speed) {
    this.bullets.push({
      x: e.x + Math.cos(ang) * e.r,
      y: e.y + Math.sin(ang) * e.r,
      vx: Math.cos(ang) * speed,
      vy: Math.sin(ang) * speed,
      dmg,
      r: 5,
      pierce: 1,
      hit: /* @__PURE__ */ new Set(),
      aoe: 0,
      knock: 0,
      color: "#ff453a",
      from: "enemy",
      life: 4,
      trail: 0
    });
  }
  updateBoss(e, dt, d) {
    const want = angTo(e.x, e.y, this.px, this.py);
    let mx = 0, my = 0;
    if (d > 320) {
      mx = Math.cos(want);
      my = Math.sin(want);
    } else if (d < 200) {
      mx = -Math.cos(want);
      my = -Math.sin(want);
    }
    const orb = Math.cos(this.playTime * 0.6) > 0 ? 1 : -1;
    const ox = Math.cos(want + Math.PI / 2 * orb);
    const oy = Math.sin(want + Math.PI / 2 * orb);
    e.vx = lerp(e.vx, (mx * 0.6 + ox * 0.5) * e.speed, 1 - Math.pow(0.05, dt));
    e.vy = lerp(e.vy, (my * 0.6 + oy * 0.5) * e.speed, 1 - Math.pow(0.05, dt));
    e.x = clamp(e.x + e.vx * dt, 60, VIEW_W - 60);
    e.y = clamp(e.y + e.vy * dt, 70, VIEW_H - 60);
    if (e.phase === 1) {
      e.vx = Math.cos(e.angle) * 330;
      e.vy = Math.sin(e.angle) * 330;
      e.x = clamp(e.x + e.vx * dt, 20, VIEW_W - 20);
      e.y = clamp(e.y + e.vy * dt, 20, VIEW_H - 20);
      if (e.hitCd <= 0 && dist(e.x, e.y, this.px, this.py) < e.r + 16) {
        e.hitCd = 0.6;
        this.hurtPlayer(20, e.x, e.y);
      }
      if (e.cd <= 0) {
        e.phase = 0;
        e.cd = 1.4;
      }
      return;
    }
    for (let i = this.bossActions.length - 1; i >= 0; i--) {
      const a = this.bossActions[i];
      a.t -= dt;
      if (a.t <= 0) {
        this.bossActions.splice(i, 1);
        this.doBossAction(e, a.kind);
      }
    }
    if (this.bossActions.length === 0) {
      this.bossActions = [
        { kind: "ring", t: 0.7 },
        { kind: "fan", t: 2 },
        { kind: "summon", t: 3.4 },
        { kind: "charge", t: 4.8 }
      ];
    }
    if (e.hitCd <= 0 && dist(e.x, e.y, this.px, this.py) < e.r + 14) {
      e.hitCd = 0.7;
      this.hurtPlayer(16, e.x, e.y);
    }
  }
  doBossAction(e, kind) {
    const bx = e.x, by = e.y;
    if (kind === "ring") {
      const n = 18;
      const base = Math.random() * TAU;
      for (let i = 0; i < n; i++) {
        const a = base + i / n * TAU;
        this.enemyShoot(e, a, 10, 260);
      }
      sfx.shootShotgun();
    } else if (kind === "fan") {
      const aim = angTo(bx, by, this.px, this.py);
      for (let s = -1; s <= 1; s++) {
        const base = aim + s * 0.34;
        for (let i = 0; i < 5; i++) {
          const a = base + (i - 2) * 0.12;
          this.enemyShoot(e, a, 12, 330);
        }
      }
      sfx.shootSmg();
    } else if (kind === "summon") {
      for (let i = 0; i < 3; i++) {
        const k = pick(["chaser", "rusher", "shooter"]);
        this.spawnEnemy(k);
      }
      sfx.powerup();
    } else if (kind === "charge") {
      e.phase = 1;
      e.angle = angTo(bx, by, this.px, this.py);
      e.cd = 1.1;
      this.shake = 5;
      sfx.bossAlert();
    }
  }
  killEnemy(idx) {
    const e = this.enemies[idx];
    this.enemies.splice(idx, 1);
    const def = ENEMIES[e.kind];
    const isBoss = e.boss;
    this.kills++;
    this.combo++;
    this.comboT = 5;
    const mult = 1 + Math.min(4, this.combo * 0.1);
    const gained = Math.round(def.score * mult * (isBoss ? 10 : 1));
    this.score += gained;
    this.particles.floatText(e.x, e.y - e.r, `+${gained}`, isBoss ? "#ffd60a" : "#fff", isBoss ? 20 : 13);
    if (isBoss) {
      this.bossActive = false;
      this.boss = null;
      this.particles.explosion(e.x, e.y, 130, "#ff9f0a", 70);
      this.particles.explosion(e.x, e.y, 80, "#ff453a", 40);
      this.shake = 16;
      this.hitstop = 0.1;
      sfx.explode(true);
      for (let i = 0; i < 10; i++) {
        const kind = i < 3 ? "medkit" : i < 5 ? "shield" : i === 5 ? "nuke" : i === 6 ? "weapon" : "star";
        this.spawnDrop(kind, e.x + rand(-80, 80), e.y + rand(-60, 60));
      }
      this.score += 500;
      this.particles.floatText(e.x, e.y - 60, "BOSS \u51FB\u7834 +500", "#ffd60a", 20);
    } else {
      this.particles.explosion(e.x, e.y, e.r * 2.6, def.color, 16);
      this.particles.blood(e.x, e.y, e.angle);
      this.bloods.push({ x: e.x, y: e.y, r: e.r * 1.5, a: 0.5 });
      sfx.kill();
      if (Math.random() < 0.16) {
        this.spawnDrop(rollDrop(), e.x, e.y);
      } else if (Math.random() < 0.12) {
        this.spawnDrop("star", e.x, e.y);
      }
    }
  }
  spawnDrop(kind, x, y) {
    this.drops.push({
      kind,
      x,
      y,
      vx: rand(-40, 40),
      vy: rand(-40, 40),
      life: 14,
      pulse: rand(0, TAU)
    });
  }
  // ---------- 子弹 ----------
  updateBullets(dt) {
    for (const b of this.bullets) {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.trail -= dt;
      if (b.from === "player" && b.trail <= 0) {
        b.trail = 0.03;
        this.particles.trail(b.x, b.y, b.color);
      }
      if (b.from === "enemy" && b.trail <= 0) {
        b.trail = 0.05;
        this.particles.trail(b.x, b.y, "rgba(255,69,58,0.6)");
      }
      if (b.from === "player") {
        for (let i = this.enemies.length - 1; i >= 0; i--) {
          const e = this.enemies[i];
          if (b.hit.has(e)) continue;
          if (dist(b.x, b.y, e.x, e.y) < e.r + b.r) {
            b.hit.add(e);
            this.damageEnemy(e, b.dmg, b.x, b.y, b.aoe, b.knock, b.color);
            if (b.aoe > 0) {
              sfx.explode();
              this.shake = Math.max(this.shake, 5);
              b.life = 0;
            } else if (b.pierce > 0) {
              b.pierce--;
              if (b.pierce <= 0) b.life = 0;
            } else {
              b.life = 0;
            }
            break;
          }
        }
      } else {
        if (dist(b.x, b.y, this.px, this.py) < 14 + b.r) {
          this.hurtPlayer(b.dmg, b.x, b.y);
          this.particles.hitSpark(this.px, this.py, Math.atan2(-b.vy, -b.vx), "#ff453a");
          b.life = 0;
        }
      }
    }
  }
  damageEnemy(e, dmg, x, y, aoe, knock, color) {
    if (aoe > 0) {
      const list = [e, ...this.enemies];
      const seen = /* @__PURE__ */ new Set();
      for (const t of this.enemies) {
        if (seen.has(t)) continue;
        const d = dist(x, y, t.x, t.y);
        if (d < aoe + t.r) {
          seen.add(t);
          t.hp -= dmg;
          t.hurtT = 0.15;
          const k = knock * (1 - d / (aoe + t.r));
          const a = angTo(t.x, t.y, x, y);
          t.x += Math.cos(a) * k * 0.1;
          t.y += Math.sin(a) * k * 0.1;
          this.particles.hitSpark(t.x, t.y, a, color);
        }
      }
      this.particles.explosion(x, y, aoe, color, 30);
      this.shake = Math.max(this.shake, 6);
    } else {
      e.hp -= dmg;
      e.hurtT = 0.12;
      const a = angTo(e.x, e.y, x, y);
      e.x += Math.cos(a) * knock * 0.04;
      e.y += Math.sin(a) * knock * 0.04;
      this.particles.hitSpark(x, y, a, color);
      sfx.hit();
    }
  }
  // ---------- 掉落拾取 ----------
  updateDrops(dt) {
    for (let i = this.drops.length - 1; i >= 0; i--) {
      const d = this.drops[i];
      d.pulse += dt * 3;
      if (dist(d.x, d.y, this.px, this.py) < 34) {
        this.drops.splice(i, 1);
        this.applyDrop(d.kind, d.x, d.y);
      }
    }
  }
  applyDrop(kind, x, y) {
    if (kind === "medkit") {
      this.hp = Math.min(this.maxHp, this.hp + 30);
      this.particles.floatText(x, y, "+30 HP", "#30d158", 14);
    } else if (kind === "shield") {
      this.shield = Math.min(this.maxShield, this.shield + 30);
      this.particles.floatText(x, y, "+30 \u62A4\u76FE", "#64d2ff", 14);
    } else if (kind === "nuke") {
      this.nuke();
    } else if (kind === "weapon") {
      const next = nextWeapon(WEAPONS[this.weaponIdx].key);
      this.weaponIdx = WEAPONS.findIndex((w) => w.key === next.key);
      this.particles.floatText(x, y, `\u6B66\u5668\u5347\u7EA7\uFF1A${next.name}`, "#ffd60a", 16);
      sfx.levelUp();
      this.flash = 0.4;
    } else {
      this.score += 25;
      this.particles.floatText(x, y, "+25", "#ffd60a", 12);
    }
    sfx.pickup();
  }
  nuke() {
    this.shake = 18;
    this.hitstop = 0.12;
    this.flash = 1;
    sfx.explode(true);
    const list = [...this.enemies];
    for (const e of list) {
      if (e.boss) {
        e.hp -= 300;
        this.particles.floatText(e.x, e.y - e.r, "-300", "#ff453a", 18);
      } else {
        this.damageEnemy(e, 9999, e.x, e.y, 0, 0, "#ffd60a");
      }
    }
    this.particles.explosion(this.px, this.py, 200, "#ffd60a", 80);
  }
  // ---------- 渲染 ----------
  draw() {
    const ctx2 = this.ctx;
    const cw = this.canvas.width;
    const ch = this.canvas.height;
    const dpr = cw / this.canvas.getBoundingClientRect().width || 1;
    ctx2.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx2.clearRect(0, 0, cw / dpr, ch / dpr);
    const scale = Math.min(cw / dpr / VIEW_W, ch / dpr / VIEW_H);
    const offX = (cw / dpr - VIEW_W * scale) / 2;
    const offY = (ch / dpr - VIEW_H * scale) / 2;
    ctx2.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * offX, dpr * offY);
    if (this.shake > 0) {
      ctx2.translate(rand(-this.shake, this.shake) * 0.6, rand(-this.shake, this.shake) * 0.6);
    }
    this.drawBackground(ctx2);
    for (const b of this.bloods) {
      ctx2.globalAlpha = b.a;
      ctx2.fillStyle = "#5a1a1d";
      ctx2.beginPath();
      ctx2.arc(b.x, b.y, b.r, 0, TAU);
      ctx2.fill();
    }
    ctx2.globalAlpha = 1;
    for (const d of this.drops) {
      this.drawDrop(ctx2, d);
    }
    for (const e of this.enemies) {
      if (e.born > 0) {
        ctx2.globalAlpha = e.born * 2;
        ctx2.strokeStyle = e.boss ? "#ff375f" : ENEMIES[e.kind].color;
        ctx2.lineWidth = 2;
        ctx2.beginPath();
        ctx2.arc(e.x, e.y, e.r + 10, 0, TAU);
        ctx2.stroke();
        ctx2.globalAlpha = 1;
      }
    }
    for (const e of this.enemies) this.drawEnemy(ctx2, e);
    this.drawPlayer(ctx2);
    for (const b of this.bullets) this.drawBullet(ctx2, b);
    this.particles.draw(ctx2);
    this.drawHUD(ctx2);
    if (this.flash > 0) {
      ctx2.globalAlpha = this.flash * 0.35;
      ctx2.fillStyle = "#ff2d2d";
      ctx2.fillRect(-30, -30, VIEW_W + 60, VIEW_H + 60);
      ctx2.globalAlpha = 1;
    }
    if (this.waveState === "intermission" && !this.over) {
      this.drawWaveBanner(ctx2);
    }
    if (this.paused) this.drawPause(ctx2);
  }
  drawBackground(ctx2) {
    const g = ctx2.createRadialGradient(VIEW_W / 2, VIEW_H / 2, 80, VIEW_W / 2, VIEW_H / 2, 640);
    g.addColorStop(0, "#232326");
    g.addColorStop(1, "#101012");
    ctx2.fillStyle = g;
    ctx2.fillRect(-30, -30, VIEW_W + 60, VIEW_H + 60);
    ctx2.strokeStyle = "rgba(255,255,255,0.05)";
    ctx2.lineWidth = 1;
    const grid = 48;
    for (let x = 0; x <= VIEW_W; x += grid) {
      ctx2.beginPath();
      ctx2.moveTo(x, 0);
      ctx2.lineTo(x, VIEW_H);
      ctx2.stroke();
    }
    for (let y = 0; y <= VIEW_H; y += grid) {
      ctx2.beginPath();
      ctx2.moveTo(0, y);
      ctx2.lineTo(VIEW_W, y);
      ctx2.stroke();
    }
    ctx2.strokeStyle = "rgba(255,255,255,0.12)";
    ctx2.strokeRect(0, 0, VIEW_W, VIEW_H);
  }
  drawEnemy(ctx2, e) {
    const def = ENEMIES[e.kind];
    const flash = e.hurtT > 0;
    ctx2.save();
    ctx2.translate(e.x, e.y);
    if (e.boss) {
      const pulse = 1 + Math.sin(this.playTime * 3) * 0.03;
      const g2 = ctx2.createRadialGradient(0, 0, 4, 0, 0, e.r);
      g2.addColorStop(0, "#ff5f5f");
      g2.addColorStop(0.55, "#c91f2e");
      g2.addColorStop(1, "#5c0d14");
      ctx2.fillStyle = g2;
      ctx2.beginPath();
      ctx2.arc(0, 0, e.r * pulse, 0, TAU);
      ctx2.fill();
      ctx2.strokeStyle = "rgba(255,120,120,0.5)";
      ctx2.lineWidth = 3;
      ctx2.stroke();
      ctx2.rotate(this.playTime * 1.2);
      ctx2.strokeStyle = "rgba(255,90,90,0.35)";
      ctx2.lineWidth = 5;
      for (let i = 0; i < 8; i++) {
        const a = i / 8 * TAU;
        ctx2.beginPath();
        ctx2.moveTo(Math.cos(a) * e.r * 0.7, Math.sin(a) * e.r * 0.7);
        ctx2.lineTo(Math.cos(a) * e.r * 1.15, Math.sin(a) * e.r * 1.15);
        ctx2.stroke();
      }
      ctx2.rotate(-this.playTime * 1.2);
      const ea2 = angTo(0, 0, this.px - e.x, this.py - e.y);
      ctx2.fillStyle = "#ffd60a";
      ctx2.beginPath();
      ctx2.arc(Math.cos(ea2) * e.r * 0.4, Math.sin(ea2) * e.r * 0.4, 7, 0, TAU);
      ctx2.fill();
      ctx2.fillStyle = "#000";
      ctx2.beginPath();
      ctx2.arc(Math.cos(ea2) * e.r * 0.45, Math.sin(ea2) * e.r * 0.45, 3.4, 0, TAU);
      ctx2.fill();
      if (e.phase === 1) {
        ctx2.strokeStyle = "rgba(255,255,255,0.4)";
        ctx2.lineWidth = 2;
        ctx2.setLineDash([6, 6]);
        ctx2.beginPath();
        ctx2.moveTo(0, 0);
        ctx2.lineTo(Math.cos(e.angle) * 130, Math.sin(e.angle) * 130);
        ctx2.stroke();
        ctx2.setLineDash([]);
      }
      this.drawBar(ctx2, -e.r, -e.r - 16, e.r * 2, 7, e.hp / e.maxHp, "#ff453a");
      ctx2.restore();
      return;
    }
    const body = flash ? "#ffffff" : def.color;
    const g = ctx2.createRadialGradient(-e.r * 0.3, -e.r * 0.3, 2, 0, 0, e.r);
    g.addColorStop(0, lighten(body));
    g.addColorStop(1, def.dark);
    ctx2.fillStyle = g;
    ctx2.beginPath();
    ctx2.arc(0, 0, e.r, 0, TAU);
    ctx2.fill();
    ctx2.strokeStyle = "rgba(0,0,0,0.35)";
    ctx2.lineWidth = 2;
    ctx2.stroke();
    const ea = angTo(0, 0, this.px - e.x, this.py - e.y);
    ctx2.fillStyle = "#fff";
    ctx2.beginPath();
    ctx2.arc(Math.cos(ea) * e.r * 0.35, Math.sin(ea) * e.r * 0.35, e.r * 0.28, 0, TAU);
    ctx2.fill();
    ctx2.fillStyle = "#111";
    ctx2.beginPath();
    ctx2.arc(Math.cos(ea) * e.r * 0.42, Math.sin(ea) * e.r * 0.42, e.r * 0.14, 0, TAU);
    ctx2.fill();
    if (def.ranged) {
      ctx2.strokeStyle = "#333";
      ctx2.lineWidth = 2;
      ctx2.beginPath();
      ctx2.arc(0, 0, e.r * 0.5, 0, TAU);
      ctx2.stroke();
      ctx2.beginPath();
      ctx2.moveTo(-e.r * 0.5, 0);
      ctx2.lineTo(e.r * 0.5, 0);
      ctx2.stroke();
      ctx2.beginPath();
      ctx2.moveTo(0, -e.r * 0.5);
      ctx2.lineTo(0, e.r * 0.5);
      ctx2.stroke();
    } else if (def.rusher) {
      ctx2.fillStyle = flash ? "#fff" : def.dark;
      for (let i = 0; i < 4; i++) {
        const a = i / 4 * TAU + e.angle;
        ctx2.beginPath();
        ctx2.moveTo(Math.cos(a) * e.r * 1.35, Math.sin(a) * e.r * 1.35);
        ctx2.lineTo(Math.cos(a + 0.5) * e.r * 0.7, Math.sin(a + 0.5) * e.r * 0.7);
        ctx2.lineTo(Math.cos(a - 0.5) * e.r * 0.7, Math.sin(a - 0.5) * e.r * 0.7);
        ctx2.closePath();
        ctx2.fill();
      }
      if (e.windup > 0) {
        const tw = Math.sin(this.playTime * 40) * 2;
        ctx2.fillStyle = "rgba(255,69,58,0.7)";
        ctx2.beginPath();
        ctx2.arc(0 + tw, 0, e.r * 1.2, 0, TAU);
        ctx2.fill();
      }
    } else if (def.key === "tank") {
      ctx2.strokeStyle = "rgba(255,255,255,0.25)";
      ctx2.lineWidth = 3;
      ctx2.beginPath();
      ctx2.arc(0, 0, e.r * 0.62, 0, TAU);
      ctx2.stroke();
      ctx2.beginPath();
      ctx2.arc(0, 0, e.r * 0.3, 0, TAU);
      ctx2.stroke();
    }
    if (e.hp < e.maxHp) {
      this.drawBar(ctx2, -e.r, -e.r - 9, e.r * 2, 4, e.hp / e.maxHp, def.color);
    }
    ctx2.restore();
  }
  drawPlayer(ctx2) {
    const blink = this.invuln > 0 && Math.floor(this.playTime * 20) % 2 === 0;
    ctx2.save();
    ctx2.translate(this.px, this.py);
    if (this.dashT > 0) {
      ctx2.globalAlpha = 0.4;
      ctx2.fillStyle = "#64d2ff";
      ctx2.beginPath();
      ctx2.arc(-this.dashDx * 26, -this.dashDy * 26, 12, 0, TAU);
      ctx2.fill();
      ctx2.globalAlpha = 1;
    }
    if (this.shield > 0) {
      ctx2.strokeStyle = `rgba(100,210,255,${0.5 + Math.sin(this.playTime * 4) * 0.2})`;
      ctx2.lineWidth = 3;
      ctx2.beginPath();
      ctx2.arc(0, 0, 19, 0, TAU);
      ctx2.stroke();
    }
    if (!blink) {
      const g = ctx2.createRadialGradient(-4, -4, 2, 0, 0, 15);
      g.addColorStop(0, "#8fe3ff");
      g.addColorStop(0.5, "#4db8ff");
      g.addColorStop(1, "#0a6fd6");
      ctx2.fillStyle = g;
      ctx2.beginPath();
      ctx2.arc(0, 0, 13, 0, TAU);
      ctx2.fill();
      ctx2.strokeStyle = "rgba(255,255,255,0.6)";
      ctx2.lineWidth = 2;
      ctx2.stroke();
      ctx2.save();
      ctx2.rotate(this.aimAng);
      const w = WEAPONS[this.weaponIdx];
      ctx2.fillStyle = w.color;
      ctx2.fillRect(4, -3.5, 24, 7);
      ctx2.fillStyle = "#fff";
      ctx2.fillRect(4, -1.2, 24, 2.4);
      if (this.muzzleT > 0) {
        ctx2.fillStyle = "rgba(255,255,255,0.9)";
        ctx2.beginPath();
        ctx2.arc(28, 0, 6, 0, TAU);
        ctx2.fill();
      }
      ctx2.restore();
      ctx2.fillStyle = "#fff";
      ctx2.beginPath();
      ctx2.arc(3, 0, 4, 0, TAU);
      ctx2.fill();
      ctx2.fillStyle = "#0a6fd6";
      ctx2.beginPath();
      ctx2.arc(4.5, 0, 2, 0, TAU);
      ctx2.fill();
    }
    ctx2.restore();
    if (this.dashCd > 0 && this.dashT <= 0) {
      ctx2.strokeStyle = "rgba(255,255,255,0.18)";
      ctx2.lineWidth = 3;
      ctx2.beginPath();
      ctx2.arc(this.px, this.py, 21, -Math.PI / 2, -Math.PI / 2 + (1 - this.dashCd / 1.15) * TAU);
      ctx2.stroke();
    }
  }
  drawBullet(ctx2, b) {
    ctx2.save();
    ctx2.translate(b.x, b.y);
    ctx2.rotate(Math.atan2(b.vy, b.vx));
    ctx2.shadowColor = b.color;
    ctx2.shadowBlur = 10;
    if (b.from === "enemy") {
      ctx2.fillStyle = b.color;
      ctx2.beginPath();
      ctx2.arc(0, 0, b.r, 0, TAU);
      ctx2.fill();
    } else {
      const len = b.aoe > 0 ? 14 : 11;
      ctx2.fillStyle = b.color;
      ctx2.fillRect(-len / 2, -b.r / 2, len, b.r);
      ctx2.fillStyle = "rgba(255,255,255,0.85)";
      ctx2.fillRect(-len / 2, -b.r / 4, len, b.r / 2);
    }
    ctx2.shadowBlur = 0;
    ctx2.restore();
  }
  drawDrop(ctx2, d) {
    const def = DROPS[d.kind];
    const bob = Math.sin(d.pulse) * 3;
    const x = d.x, y = d.y + bob;
    ctx2.save();
    ctx2.shadowColor = def.color;
    ctx2.shadowBlur = 12;
    ctx2.fillStyle = "rgba(20,20,24,0.85)";
    ctx2.strokeStyle = def.color;
    ctx2.lineWidth = 2;
    const r = 11;
    ctx2.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = i / 6 * TAU + d.pulse * 0.4;
      const px = x + Math.cos(a) * r;
      const py = y + Math.sin(a) * r;
      if (i === 0) ctx2.moveTo(px, py);
      else ctx2.lineTo(px, py);
    }
    ctx2.closePath();
    ctx2.fill();
    ctx2.stroke();
    ctx2.shadowBlur = 0;
    ctx2.fillStyle = def.color;
    ctx2.font = `700 12px -apple-system, "PingFang SC", sans-serif`;
    ctx2.textAlign = "center";
    ctx2.textBaseline = "middle";
    ctx2.fillText(def.icon, x, y + 0.5);
    ctx2.restore();
  }
  drawBar(ctx2, x, y, w, h, ratio, color) {
    ctx2.fillStyle = "rgba(0,0,0,0.55)";
    ctx2.fillRect(x - 1, y - 1, w + 2, h + 2);
    const r = clamp(ratio, 0, 1);
    if (r > 0) {
      ctx2.fillStyle = color;
      ctx2.fillRect(x, y, w * r, h);
    }
  }
  drawHUD(ctx2) {
    ctx2.save();
    ctx2.textBaseline = "alphabetic";
    this.drawBar(ctx2, 20, 22, 190, 12, this.hp / this.maxHp, this.hp > 35 ? "#30d158" : "#ff453a");
    ctx2.fillStyle = "#fff";
    ctx2.font = '700 12px -apple-system, "PingFang SC", sans-serif';
    ctx2.textAlign = "left";
    ctx2.fillText(`HP ${Math.ceil(this.hp)}`, 22, 16);
    if (this.shield > 0) {
      this.drawBar(ctx2, 20, 40, 120, 8, this.shield / this.maxShield, "#64d2ff");
      ctx2.fillText(`\u76FE ${Math.ceil(this.shield)}`, 22, 52);
    }
    const w = WEAPONS[this.weaponIdx];
    ctx2.fillStyle = w.color;
    ctx2.font = '700 13px -apple-system, "PingFang SC", sans-serif';
    ctx2.fillText(`${w.icon} ${w.name}`, 22, 74);
    ctx2.fillStyle = "rgba(255,255,255,0.5)";
    ctx2.font = '11px -apple-system, "PingFang SC", sans-serif';
    ctx2.fillText(w.desc, 22, 89);
    ctx2.textAlign = "right";
    ctx2.fillStyle = "#ffd60a";
    ctx2.font = '700 26px -apple-system, "PingFang SC", sans-serif';
    ctx2.fillText(fmtScore(this.score), VIEW_W - 20, 36);
    if (this.combo >= 2) {
      ctx2.fillStyle = "#ff9f0a";
      ctx2.font = '700 13px -apple-system, "PingFang SC", sans-serif';
      ctx2.fillText(`\u8FDE\u6740 x${this.combo}  (\u500D\u7387 x${(1 + Math.min(4, this.combo * 0.1)).toFixed(1)})`, VIEW_W - 20, 54);
    }
    ctx2.fillStyle = "rgba(255,255,255,0.6)";
    ctx2.font = '12px -apple-system, "PingFang SC", sans-serif';
    ctx2.fillText(`\u51FB\u6740 ${this.kills}`, VIEW_W - 20, 74);
    ctx2.textAlign = "center";
    ctx2.fillStyle = "rgba(255,255,255,0.75)";
    ctx2.font = '700 15px -apple-system, "PingFang SC", sans-serif';
    const waveLabel = this.bossActive ? `\u7B2C ${this.wave} \u6CE2 \xB7 BOSS` : `\u7B2C ${this.wave} \u6CE2`;
    ctx2.fillText(waveLabel, VIEW_W / 2, 26);
    if (!this.bossActive && this.spawnQueue.length > 0) {
      ctx2.fillStyle = "rgba(255,255,255,0.35)";
      ctx2.font = '11px -apple-system, "PingFang SC", sans-serif';
      ctx2.fillText(`\u5269\u4F59\u654C\u4EBA ${this.spawnQueue.length + this.enemies.length}`, VIEW_W / 2, 42);
    }
    if (this.bossActive && this.boss) {
      const bw = 420;
      ctx2.fillStyle = "rgba(0,0,0,0.6)";
      ctx2.fillRect(VIEW_W / 2 - bw / 2 - 2, 48, bw + 4, 16);
      const r = clamp(this.boss.hp / this.boss.maxHp, 0, 1);
      const g = ctx2.createLinearGradient(VIEW_W / 2 - bw / 2, 0, VIEW_W / 2 + bw / 2, 0);
      g.addColorStop(0, "#ff375f");
      g.addColorStop(1, "#ff9f0a");
      ctx2.fillStyle = g;
      ctx2.fillRect(VIEW_W / 2 - bw / 2, 50, bw * r, 12);
      ctx2.fillStyle = "#fff";
      ctx2.font = '700 11px -apple-system, "PingFang SC", sans-serif';
      ctx2.fillText(`\u2620 BOSS \xB7 \u6DF7\u6C8C\u5DE8\u50CF`, VIEW_W / 2, 60);
    }
    ctx2.textAlign = "left";
    ctx2.fillStyle = "rgba(255,255,255,0.35)";
    ctx2.font = '11px -apple-system, "PingFang SC", sans-serif';
    ctx2.fillText("WASD \u79FB\u52A8 \xB7 \u9F20\u6807\u7784\u51C6 \xB7 \u5DE6\u952E\u5C04\u51FB \xB7 \u7A7A\u683C\u7FFB\u6EDA \xB7 P \u6682\u505C", 20, VIEW_H - 14);
    ctx2.restore();
  }
  drawWaveBanner(ctx2) {
    const t = this.waveT;
    const alpha = t > 2.2 ? (2.6 - t) / 0.4 : t < 0.5 ? t / 0.5 : 1;
    const nextWave = this.wave + 1;
    const isBoss = nextWave % 5 === 0;
    ctx2.save();
    ctx2.globalAlpha = clamp(alpha, 0, 1);
    ctx2.textAlign = "center";
    ctx2.fillStyle = "rgba(0,0,0,0.4)";
    ctx2.fillRect(VIEW_W / 2 - 150, VIEW_H / 2 - 44, 300, 88);
    ctx2.fillStyle = isBoss ? "#ff375f" : "#ffd60a";
    ctx2.font = '700 20px -apple-system, "PingFang SC", sans-serif';
    ctx2.fillText(isBoss ? `\u26A0 \u7B2C ${nextWave} \u6CE2 \xB7 BOSS \u6765\u88AD \u26A0` : `\u7B2C ${nextWave} \u6CE2`, VIEW_W / 2, VIEW_H / 2 - 8);
    ctx2.fillStyle = "rgba(255,255,255,0.8)";
    ctx2.font = '700 26px -apple-system, "PingFang SC", sans-serif';
    ctx2.fillText(Math.ceil(t).toString(), VIEW_W / 2, VIEW_H / 2 + 26);
    ctx2.restore();
  }
  drawPause(ctx2) {
    ctx2.fillStyle = "rgba(0,0,0,0.6)";
    ctx2.fillRect(-30, -30, VIEW_W + 60, VIEW_H + 60);
    ctx2.fillStyle = "#fff";
    ctx2.textAlign = "center";
    ctx2.font = '700 30px -apple-system, "PingFang SC", sans-serif';
    ctx2.fillText("\u5DF2\u6682\u505C", VIEW_W / 2, VIEW_H / 2 - 16);
    ctx2.fillStyle = "rgba(255,255,255,0.6)";
    ctx2.font = '14px -apple-system, "PingFang SC", sans-serif';
    ctx2.fillText("P / ESC \u7EE7\u7EED \xB7 R \u91CD\u5F00\uFF08\u5728\u6309\u94AE\u4E0A\uFF09", VIEW_W / 2, VIEW_H / 2 + 16);
  }
};
function lighten(hex) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, (n >> 16 & 255) + 60);
  const g = Math.min(255, (n >> 8 & 255) + 60);
  const b = Math.min(255, (n & 255) + 60);
  return `rgb(${r},${g},${b})`;
}

// web.tsx
var React = globalThis.React;
var { useState, useEffect, useRef, useCallback } = React;
var name = "store-gunfire";
var inject = ["slots"];
var FONT = '-apple-system, BlinkMacSystemFont, "SF Pro Text", "PingFang SC", "Hiragino Sans GB", sans-serif';
var LS_BEST2 = "gunfire_best";
function readBest2() {
  try {
    return Number(localStorage.getItem(LS_BEST2) || 0);
  } catch {
    return 0;
  }
}
function panel() {
  return {
    background: "linear-gradient(180deg, #2c2c2e 0%, #1c1c1e 100%)",
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,.09)",
    boxShadow: "0 8px 28px rgba(0,0,0,.45)",
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
    width: "100%",
    maxWidth: "none"
  };
}
function btnStyle(kind) {
  const base = {
    border: "none",
    borderRadius: 999,
    padding: "9px 22px",
    fontSize: 14,
    fontWeight: 700,
    letterSpacing: "-0.01em",
    cursor: "pointer",
    fontFamily: FONT,
    transition: "transform .08s ease, opacity .15s ease"
  };
  if (kind === "primary") {
    base.background = "linear-gradient(180deg, #ff9f0a 0%, #ff375f 100%)";
    base.color = "#fff";
    base.boxShadow = "0 2px 10px rgba(255,55,95,.4)";
  } else {
    base.background = "rgba(255,255,255,.08)";
    base.color = "#f5f5f7";
  }
  return base;
}
function MenuScreen(props) {
  return React.createElement(
    "div",
    {
      style: {
        position: "absolute",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(16,16,18,.88)",
        textAlign: "center",
        padding: "20px",
        backdropFilter: "blur(2px)"
      }
    },
    React.createElement("div", { style: { fontSize: 40, lineHeight: 1.2 } }, "\u{1F52B}"),
    React.createElement("div", {
      style: {
        fontSize: 27,
        fontWeight: 800,
        letterSpacing: "-0.03em",
        background: "linear-gradient(90deg,#ffd60a,#ff9f0a,#ff375f)",
        WebkitBackgroundClip: "text",
        backgroundClip: "text",
        color: "transparent",
        marginTop: 6
      }
    }, "\u67AA\u706B\u6218\u573A"),
    React.createElement("div", {
      style: { fontSize: 12.5, color: "#98989d", marginTop: 6, maxWidth: 460 }
    }, "\u4FEF\u89C6\u89D2\u6CE2\u6B21\u751F\u5B58\u5C04\u51FB \xB7 6 \u79CD\u6B66\u5668 \xB7 6 \u7C7B\u654C\u4EBA \xB7 BOSS \u6218 \xB7 \u97F3\u6548\u5168\u90E8\u5B9E\u65F6\u5408\u6210"),
    React.createElement(
      "div",
      {
        style: {
          display: "flex",
          justifyContent: "center",
          gap: "6px 18px",
          margin: "16px 0 20px",
          color: "#98989d",
          fontSize: 12,
          flexWrap: "wrap",
          maxWidth: 520
        }
      },
      React.createElement("div", null, "\u{1F579} WASD \u79FB\u52A8"),
      React.createElement("div", null, "\u{1F5B1} \u7784\u51C6 \xB7 \u5DE6\u952E\u5C04\u51FB"),
      React.createElement("div", null, "\u26A1 \u7A7A\u683C\u7FFB\u6EDA"),
      React.createElement("div", null, "\u23F8 P \u6682\u505C"),
      React.createElement("div", null, "\u271A \u62FE\u53D6\u6389\u843D\u5347\u7EA7")
    ),
    React.createElement(
      "div",
      { style: { display: "flex", alignItems: "center", justifyContent: "center", gap: 14, flexWrap: "wrap" } },
      React.createElement(
        "button",
        { type: "button", onClick: props.onStart, style: btnStyle("primary") },
        "\u25B6 \u5F00\u59CB\u6218\u6597"
      ),
      props.best > 0 ? React.createElement(
        "div",
        { style: { fontSize: 13, color: "#ffd60a", fontWeight: 700 } },
        `\u{1F3C6} \u6700\u9AD8\u5206 ${fmtScore(props.best)}`
      ) : null
    )
  );
}
function OverScreen(props) {
  const s = props.stats;
  const rows = [
    ["\u5230\u8FBE\u6CE2\u6B21", `${s.wave}`],
    ["\u51FB\u6740\u6570", `${s.kills}`],
    ["\u6700\u7EC8\u6B66\u5668", s.weapon],
    ["\u5B58\u6D3B\u65F6\u95F4", `${Math.floor(s.playTime)}s`]
  ];
  return React.createElement(
    "div",
    {
      style: {
        position: "absolute",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(16,16,18,.82)",
        textAlign: "center",
        padding: "20px"
      }
    },
    React.createElement("div", { style: { fontSize: 13, fontWeight: 800, letterSpacing: ".18em", color: "#ff453a" } }, "YOU DIED"),
    React.createElement("div", {
      style: {
        fontSize: 42,
        fontWeight: 800,
        letterSpacing: "-0.03em",
        color: "#ffd60a",
        margin: "4px 0 2px"
      }
    }, fmtScore(s.score)),
    props.isNewBest ? React.createElement(
      "div",
      { style: { fontSize: 13, color: "#30d158", fontWeight: 700, marginBottom: 8 } },
      "\u2605 \u65B0\u7EAA\u5F55\uFF01"
    ) : React.createElement(
      "div",
      { style: { fontSize: 12, color: "#98989d", marginBottom: 8 } },
      `\u6700\u9AD8\u5206 ${fmtScore(props.best)}`
    ),
    React.createElement(
      "div",
      {
        style: {
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "4px 24px",
          margin: "10px 0 16px",
          textAlign: "left"
        }
      },
      rows.map(
        ([k, v]) => React.createElement(
          "div",
          { key: k, style: { display: "flex", justifyContent: "space-between", gap: 16 } },
          React.createElement("span", { style: { color: "#98989d", fontSize: 13 } }, k),
          React.createElement("span", { style: { color: "#f5f5f7", fontSize: 13, fontWeight: 700 } }, v)
        )
      )
    ),
    React.createElement(
      "div",
      { style: { display: "flex", justifyContent: "center", gap: 10 } },
      React.createElement("button", { type: "button", onClick: props.onRetry, style: btnStyle("primary") }, "\u21BB \u518D\u6765\u4E00\u5C40"),
      React.createElement("button", { type: "button", onClick: props.onMenu, style: btnStyle("ghost") }, "\u8FD4\u56DE\u83DC\u5355")
    )
  );
}
function GunfireCard() {
  const canvasRef = useRef(null);
  const areaRef = useRef(null);
  const gameRef = useRef(null);
  const [screen, setScreen] = useState("menu");
  const [stats, setStats] = useState(null);
  const [best, setBest] = useState(readBest2);
  const [muted2, setMutedState] = useState(false);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const game = new GunfireGame(canvas, {
      onGameOver: (s) => {
        setBest(readBest2());
        setStats(s);
        setScreen("over");
      }
    });
    gameRef.current = game;
    setMutedState(game.isMuted());
    return () => {
      game.destroy();
      gameRef.current = null;
    };
  }, []);
  useEffect(() => {
    const el = areaRef.current;
    if (!el) return;
    const apply2 = () => {
      const w = el.clientWidth;
      if (w <= 0) return;
      const vh = typeof window !== "undefined" ? window.innerHeight : 800;
      const cap = Math.max(420, Math.round(vh * 0.86));
      const h = Math.max(420, Math.min(cap, Math.round(w * (600 / 960))));
      el.style.height = h + "px";
      gameRef.current?.resize();
    };
    apply2();
    let ro = null;
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(apply2);
      ro.observe(el);
    }
    window.addEventListener("resize", apply2);
    return () => {
      ro?.disconnect();
      window.removeEventListener("resize", apply2);
    };
  }, []);
  useEffect(() => {
    if (screen === "playing" && gameRef.current) {
      gameRef.current.start();
      setPaused(false);
    }
  }, [screen]);
  const toMenu = useCallback(() => {
    setBest(readBest2());
    setScreen("menu");
  }, []);
  const onPause = useCallback(() => {
    const g = gameRef.current;
    if (!g) return;
    g.togglePause();
    setPaused(g.isPaused());
  }, []);
  const onMute = useCallback(() => {
    const g = gameRef.current;
    if (!g) return;
    g.toggleMute();
    setMutedState(g.isMuted());
  }, []);
  const isNewBest = stats !== null && stats.score > 0 && stats.score >= best;
  return React.createElement(
    "div",
    { style: panel() },
    // 内容区：canvas 常驻 + overlay
    React.createElement(
      "div",
      {
        ref: areaRef,
        style: {
          position: "relative",
          width: "100%",
          height: 420,
          background: "#101012"
        }
      },
      React.createElement("canvas", {
        ref: canvasRef,
        style: {
          position: "absolute",
          inset: 0,
          display: "block",
          cursor: "crosshair",
          width: "100%",
          height: "100%"
        }
      }),
      screen === "menu" ? React.createElement(MenuScreen, { best, onStart: () => setScreen("playing") }) : screen === "over" && stats ? React.createElement(OverScreen, {
        stats,
        best,
        isNewBest,
        onRetry: () => setScreen("playing"),
        onMenu: toMenu
      }) : null,
      // 悬浮控制（右上角，不占导航栏）
      screen === "playing" ? React.createElement(
        "div",
        {
          style: {
            position: "absolute",
            top: 10,
            right: 10,
            display: "flex",
            gap: 8,
            zIndex: 5
          }
        },
        React.createElement("button", {
          type: "button",
          onClick: onMute,
          title: "\u9759\u97F3 (M)",
          style: {
            width: 38,
            height: 38,
            borderRadius: "50%",
            border: "1px solid rgba(255,255,255,.18)",
            background: "rgba(0,0,0,.45)",
            color: "#fff",
            fontSize: 16,
            cursor: "pointer",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center"
          }
        }, muted2 ? "\u{1F507}" : "\u{1F50A}"),
        React.createElement("button", {
          type: "button",
          onClick: onPause,
          title: "\u6682\u505C (P)",
          style: {
            width: 38,
            height: 38,
            borderRadius: "50%",
            border: "1px solid rgba(255,255,255,.18)",
            background: "rgba(0,0,0,.45)",
            color: "#fff",
            fontSize: 15,
            cursor: "pointer",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center"
          }
        }, paused ? "\u25B6" : "\u23F8")
      ) : null
    )
  );
}
function apply(ctx2) {
  ctx2.slots.place("plugin-store-extras", GunfireCard, { key: "store-gunfire", order: 5 });
}
export {
  apply,
  inject,
  name
};
