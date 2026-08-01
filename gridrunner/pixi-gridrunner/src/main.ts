import { Application, Container, Graphics } from "pixi.js";

type GameState = "menu" | "running" | "paused" | "upgrade" | "result";
type EnemyType = "drone" | "weaver" | "hunter";
type HazardType = "ramp" | "block";
type Random = () => number;

interface Track {
  id: string;
  name: string;
  bpm: number;
  duration: number;
  difficulty: string;
  color: string;
  accent: string;
  seed: number;
  curve: number[];
  locked?: boolean;
  custom?: boolean;
}

interface Meta {
  best: number;
  cores: number;
  wins: number;
  kills: number;
}

interface Mods {
  spread: number;
  fireRate: number;
  damage: number;
  pierce: number;
  homing: number;
  dashRate: number;
  maxHull: number;
  wallRun: number;
  wallCharge: number;
  trailBlast: number;
  syncGain: number;
}

interface WorldPoint {
  x: number;
  z: number;
}

interface Trail {
  id: string;
  color: string;
  points: WorldPoint[];
}

interface Player {
  x: number;
  vx: number;
  hull: number;
  cooldown: number;
  dash: number;
  invincible: number;
  airborne: number;
  lastTrailZ: number;
  lastAxis: number;
}

interface Bullet {
  x: number;
  z: number;
  vx: number;
  vz: number;
  damage: number;
  pierce: number;
  life: number;
}

interface EnemyBullet {
  x: number;
  z: number;
  vx: number;
  vz: number;
  radius: number;
  dead?: boolean;
}

interface Enemy {
  id: string;
  type: EnemyType;
  x: number;
  z: number;
  vx: number;
  hp: number;
  trail: Trail;
  trailGap: number;
  phase: number;
  dead: boolean;
}

interface Boss {
  x: number;
  z: number;
  hp: number;
  maxHp: number;
  phase: number;
}

interface Hazard {
  kind: HazardType;
  z: number;
  x: number;
  radius: number;
  used: boolean;
}

interface Particle {
  x: number;
  z: number;
  vx: number;
  vz: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

interface Run {
  track: Track;
  seed: number;
  rng: Random;
  speed: number;
  duration: number;
  time: number;
  distance: number;
  lastBeat: number;
  section: number;
  sections: number[];
  bossAt: number;
  bossSpawned: boolean;
  boss: Boss | null;
  score: number;
  kills: number;
  perfects: number;
  combo: number;
  sync: number;
  overdrive: number;
  shake: number;
  flash: number;
  mods: Mods;
  player: Player;
  bullets: Bullet[];
  enemyBullets: EnemyBullet[];
  enemies: Enemy[];
  trails: Trail[];
  playerTrail: Trail;
  hazards: Hazard[];
  particles: Particle[];
}

interface Upgrade {
  id: string;
  name: string;
  type: string;
  text: string;
  apply: (mods: Mods, run: Run) => void;
}

interface WeaponChoice {
  id: string;
  name: string;
  note: string;
  unlock: (meta: Meta) => boolean;
}

interface TrailChoice {
  id: string;
  name: string;
  note: string;
  color: string;
  unlock: (meta: Meta) => boolean;
}

interface Projection {
  x: number;
  y: number;
  scale: number;
  visible: boolean;
}

const TAU = Math.PI * 2;
const VIEW = 12;
const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));
const lerp = (from: number, to: number, amount: number): number =>
  from + (to - from) * amount;
const formatScore = (value: number): string =>
  Math.floor(value).toString().padStart(6, "0");
const formatTime = (seconds: number): string =>
  `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;

function byId<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing #${id}`);
  return element as T;
}

const ui = {
  container: byId<HTMLElement>("pixi-container"),
  menu: byId<HTMLElement>("menu"),
  metaLine: byId<HTMLElement>("metaLine"),
  tracks: byId<HTMLElement>("tracks"),
  dropZone: byId<HTMLElement>("dropZone"),
  dropCopy: byId<HTMLElement>("dropCopy"),
  audioFile: byId<HTMLInputElement>("audioFile"),
  clearCustom: byId<HTMLButtonElement>("clearCustom"),
  error: byId<HTMLElement>("error"),
  weapons: byId<HTMLElement>("weapons"),
  trails: byId<HTMLElement>("trails"),
  launch: byId<HTMLButtonElement>("launch"),
  hud: byId<HTMLElement>("hud"),
  score: byId<HTMLElement>("score"),
  multiplier: byId<HTMLElement>("multiplier"),
  trackReadout: byId<HTMLElement>("trackReadout"),
  time: byId<HTMLElement>("time"),
  progressFill: byId<HTMLElement>("progressFill"),
  integrity: byId<HTMLElement>("integrity"),
  beatRail: byId<HTMLElement>("beatRail"),
  syncText: byId<HTMLElement>("syncText"),
  syncFill: byId<HTMLElement>("syncFill"),
  announcement: byId<HTMLElement>("announcement"),
  upgradeModal: byId<HTMLElement>("upgradeModal"),
  choices: byId<HTMLElement>("choices"),
  resultModal: byId<HTMLElement>("resultModal"),
  resultEyebrow: byId<HTMLElement>("resultEyebrow"),
  resultTitle: byId<HTMLElement>("resultTitle"),
  resultCopy: byId<HTMLElement>("resultCopy"),
  resultScore: byId<HTMLElement>("resultScore"),
  resultKills: byId<HTMLElement>("resultKills"),
  resultPerfects: byId<HTMLElement>("resultPerfects"),
  resultCores: byId<HTMLElement>("resultCores"),
  retry: byId<HTMLButtonElement>("retry"),
  returnMenu: byId<HTMLButtonElement>("returnMenu"),
  mute: byId<HTMLButtonElement>("mute"),
  touchControls: byId<HTMLElement>("touchControls"),
  customAudio: byId<HTMLAudioElement>("customAudio"),
};

function mulberry32(seed: number): Random {
  return () => {
    let value = (seed += 0x6d2b79f5);
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function hash(value: number, seed: number): number {
  let mixed = Math.imul((value | 0) ^ seed, 0x45d9f3b);
  mixed = Math.imul(mixed ^ (mixed >>> 16), 0x45d9f3b);
  return ((mixed ^ (mixed >>> 16)) >>> 0) / 4294967295;
}

function noise(value: number, seed: number): number {
  const index = Math.floor(value);
  const fraction = value - index;
  const smooth = fraction * fraction * (3 - 2 * fraction);
  return lerp(hash(index, seed), hash(index + 1, seed), smooth) * 2 - 1;
}

function makeCurve(seed: number, intensity: number): number[] {
  return Array.from({ length: 256 }, (_, index) => {
    const progress = index / 255;
    const section =
      progress > 0.72
        ? 0.88
        : progress > 0.48
          ? 0.68
          : progress > 0.22
            ? 0.48
            : 0.3;
    const pulse =
      Math.max(0, Math.sin(progress * Math.PI * (8 + intensity))) ** 3 * 0.2;
    return clamp(section + pulse + noise(progress * 22, seed) * 0.1, 0.08, 1);
  });
}

const TRACKS: Track[] = [
  {
    id: "vector",
    name: "Vector Dawn",
    bpm: 108,
    duration: 62,
    difficulty: "FLOW",
    color: "#3df5ff",
    accent: "#8f64ff",
    seed: 1031,
    curve: makeCurve(1031, 1),
  },
  {
    id: "afterglow",
    name: "Afterglow Riot",
    bpm: 136,
    duration: 68,
    difficulty: "SURGE",
    color: "#ff3dbb",
    accent: "#ffd166",
    seed: 8177,
    curve: makeCurve(8177, 3),
  },
  {
    id: "redline",
    name: "Redline // Remix",
    bpm: 172,
    duration: 72,
    difficulty: "OVERDRIVE",
    color: "#ff5b55",
    accent: "#ff3dbb",
    seed: 4409,
    curve: makeCurve(4409, 6),
    locked: true,
  },
];

const WEAPONS: WeaponChoice[] = [
  {
    id: "pulse",
    name: "Pulse Cannon",
    note: "Reliable single beam",
    unlock: () => true,
  },
  {
    id: "twin",
    name: "Twin Array",
    note: "Two angled bolts // 30 data",
    unlock: (meta) => meta.cores >= 30,
  },
  {
    id: "lance",
    name: "Phase Lance",
    note: "Piercing heavy shot // 1 clear",
    unlock: (meta) => meta.wins >= 1,
  },
];

const TRAIL_CHOICES: TrailChoice[] = [
  {
    id: "cyan",
    name: "Ion Blue",
    note: "Base frequency",
    color: "#3df5ff",
    unlock: () => true,
  },
  {
    id: "pink",
    name: "Hot Magenta",
    note: "20 data",
    color: "#ff3dbb",
    unlock: (meta) => meta.cores >= 20,
  },
  {
    id: "gold",
    name: "Solar Gold",
    note: "2 clears",
    color: "#ffd166",
    unlock: (meta) => meta.wins >= 2,
  },
];

const UPGRADES: Upgrade[] = [
  {
    id: "spread",
    name: "Prism Array",
    type: "Weapon",
    text: "Add two angled projectiles.",
    apply: (mods) => mods.spread++,
  },
  {
    id: "rapid",
    name: "Clock Splitter",
    type: "Weapon",
    text: "Fire 22% faster.",
    apply: (mods) => (mods.fireRate *= 0.78),
  },
  {
    id: "power",
    name: "Hard Light",
    type: "Weapon",
    text: "Projectiles deal +1 damage.",
    apply: (mods) => mods.damage++,
  },
  {
    id: "pierce",
    name: "Ghost Rounds",
    type: "Weapon",
    text: "Shots pierce one more target.",
    apply: (mods) => mods.pierce++,
  },
  {
    id: "homing",
    name: "Signal Seeker",
    type: "Weapon",
    text: "Bolts bend toward hostile ships.",
    apply: (mods) => (mods.homing += 0.9),
  },
  {
    id: "dash",
    name: "Phase Capacitor",
    type: "Ship",
    text: "Dash recharges 35% faster.",
    apply: (mods) => (mods.dashRate *= 0.65),
  },
  {
    id: "hull",
    name: "Backup Chassis",
    type: "Ship",
    text: "Restore and add one integrity.",
    apply: (mods, activeRun) => {
      mods.maxHull++;
      activeRun.player.hull = mods.maxHull;
    },
  },
  {
    id: "wall",
    name: "Edge Protocol",
    type: "Ship",
    text: "Survive one track-edge impact per section.",
    apply: (mods) => {
      mods.wallRun++;
      mods.wallCharge++;
    },
  },
  {
    id: "trail",
    name: "Nova Trail",
    type: "Trail",
    text: "Trail kills detonate into nearby enemies.",
    apply: (mods) => (mods.trailBlast += 0.22),
  },
  {
    id: "sync",
    name: "Beat Engine",
    type: "Sync",
    text: "Perfect actions charge 45% more sync.",
    apply: (mods) => (mods.syncGain *= 1.45),
  },
];

function loadMeta(): Meta {
  const clean: Meta = { best: 0, cores: 0, wins: 0, kills: 0 };
  try {
    const saved: unknown = JSON.parse(
      localStorage.getItem("gridrunner-pulse-meta") ?? "null",
    );
    if (saved && typeof saved === "object") {
      const record = saved as Record<string, unknown>;
      for (const key of Object.keys(clean) as Array<keyof Meta>) {
        const value = record[key];
        if (typeof value === "number" && Number.isFinite(value) && value >= 0)
          clean[key] = Math.floor(value);
      }
    }
  } catch {
    // A blocked or malformed local save must not prevent a run.
  }
  return clean;
}

function saveMeta(): void {
  try {
    localStorage.setItem("gridrunner-pulse-meta", JSON.stringify(meta));
  } catch {
    // Private browsing can disable local storage.
  }
}

const meta = loadMeta();
let selectedTrack = TRACKS[0];
let selectedWeapon = "pulse";
let selectedTrail = "cyan";
let customTrack: Track | null = null;
let customUrl: string | null = null;
let state: GameState = "menu";
let run: Run | null = null;
let upgradeChoices: Upgrade[] = [];
let announceTimer = 0;
const keys = new Set<string>();

let app: Application;
let world: Container;
let backdropLayer: Graphics;
let trackLayer: Graphics;
let trailLayer: Graphics;
let entityLayer: Graphics;
let flashLayer: Graphics;

const stars = Array.from({ length: 110 }, (_, index) => ({
  x: hash(index, 91),
  y: hash(index, 117),
  size: 0.4 + hash(index, 301) * 1.5,
  phase: hash(index, 711) * TAU,
}));

type WebkitAudioWindow = Window & { webkitAudioContext?: typeof AudioContext };

const audio = {
  context: null as AudioContext | null,
  master: null as GainNode | null,
  noiseBuffer: null as AudioBuffer | null,
  muted: false,
  ensure(): AudioContext | null {
    if (!audio.context) {
      const AudioContextClass =
        window.AudioContext ?? (window as WebkitAudioWindow).webkitAudioContext;
      if (!AudioContextClass) return null;
      audio.context = new AudioContextClass();
      audio.master = audio.context.createGain();
      audio.master.gain.value = audio.muted ? 0 : 0.18;
      audio.master.connect(audio.context.destination);
    }
    if (audio.context.state === "suspended") void audio.context.resume();
    return audio.context;
  },
  tone(
    frequency: number,
    duration: number,
    volume: number,
    type: OscillatorType = "sine",
    slide: number | null = null,
  ): void {
    const context = audio.ensure();
    if (!context || !audio.master || audio.muted) return;
    const now = context.currentTime;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, now);
    if (slide)
      oscillator.frequency.exponentialRampToValueAtTime(
        Math.max(20, slide),
        now + duration,
      );
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    oscillator.connect(gain).connect(audio.master);
    oscillator.start(now);
    oscillator.stop(now + duration + 0.02);
  },
  noise(duration = 0.04, volume = 0.08): void {
    const context = audio.ensure();
    if (!context || !audio.master || audio.muted) return;
    if (!audio.noiseBuffer) {
      audio.noiseBuffer = context.createBuffer(
        1,
        context.sampleRate,
        context.sampleRate,
      );
      const data = audio.noiseBuffer.getChannelData(0);
      for (let index = 0; index < data.length; index++)
        data[index] = Math.random() * 2 - 1;
    }
    const now = context.currentTime;
    const source = context.createBufferSource();
    const gain = context.createGain();
    const filter = context.createBiquadFilter();
    source.buffer = audio.noiseBuffer;
    filter.type = "highpass";
    filter.frequency.value = 4800;
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    source.connect(filter).connect(gain).connect(audio.master);
    source.start(now);
    source.stop(now + duration);
  },
  beat(index: number, energy: number): void {
    // A custom track supplies its own beat. Gameplay shots and hit cues remain active.
    if (selectedTrack.custom) return;
    audio.tone(130, 0.14, 0.8, "sine", 42);
    if (index % 2) audio.noise(0.035, 0.08 + energy * 0.06);
    if (index % 4 === 0) {
      const notes = [55, 65.41, 73.42, 49];
      const note = notes[Math.floor(index / 4) % notes.length];
      audio.tone(note, 0.3, 0.32, "sawtooth", note * 0.72);
    }
  },
  shot(): void {
    audio.tone(470, 0.06, 0.12, "square", 180);
  },
  hit(): void {
    audio.tone(90, 0.11, 0.24, "sawtooth", 38);
  },
  perfect(): void {
    audio.tone(720, 0.08, 0.12, "sine", 1100);
  },
  toggle(): void {
    audio.muted = !audio.muted;
    if (audio.master) audio.master.gain.value = audio.muted ? 0 : 0.18;
    ui.customAudio.muted = audio.muted;
    ui.mute.textContent = `Audio // ${audio.muted ? "off" : "on"}`;
    ui.mute.setAttribute("aria-pressed", String(audio.muted));
  },
};

function getRun(): Run {
  if (!run) throw new Error("No active run");
  return run;
}

function escapeHtml(value: string): string {
  const element = document.createElement("div");
  element.textContent = value;
  return element.innerHTML;
}

function sampleEnergy(track: Track, progress: number): number {
  const at = clamp(progress, 0, 1) * (track.curve.length - 1);
  const index = Math.floor(at);
  return lerp(
    track.curve[index],
    track.curve[Math.min(track.curve.length - 1, index + 1)],
    at - index,
  );
}

function trackShape(
  context: Pick<Run, "speed" | "duration" | "track" | "seed">,
  z: number,
): { center: number; width: number; energy: number } {
  const total = context.speed * context.duration;
  const progress = clamp(z / total, 0, 1);
  const energy = sampleEnergy(context.track, progress);
  const bend = Math.sin(progress * TAU * 1.35 + context.seed * 0.001) * 0.12;
  const detail =
    noise(progress * 13, context.seed) * 0.16 +
    noise(progress * 31, context.seed + 7) * 0.045;
  const center = clamp(bend + detail, -0.31, 0.31);
  const difficulty = context.track.difficulty === "OVERDRIVE" ? 0.035 : 0;
  return {
    center,
    width: clamp(0.31 + energy * 0.17 - difficulty, 0.3, 0.5),
    energy,
  };
}

function makeRun(): Run {
  const seed = (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0;
  const speed = 0.62 + selectedTrack.bpm / 260;
  const mods: Mods = {
    spread: 0,
    fireRate: 0.23,
    damage: 1,
    pierce: 0,
    homing: 0,
    dashRate: 1.7,
    maxHull: 3,
    wallRun: 0,
    wallCharge: 0,
    trailBlast: 0,
    syncGain: 1,
  };
  if (selectedWeapon === "twin") mods.spread = 1;
  if (selectedWeapon === "lance") {
    mods.damage = 2;
    mods.pierce = 1;
    mods.fireRate = 0.34;
  }

  const trail =
    TRAIL_CHOICES.find((choice) => choice.id === selectedTrail) ??
    TRAIL_CHOICES[0];
  const activeRun: Run = {
    track: selectedTrack,
    seed,
    rng: mulberry32(seed),
    speed,
    duration: selectedTrack.duration,
    time: 0,
    distance: 0,
    lastBeat: -1,
    section: 0,
    sections: [0.23, 0.46, 0.69],
    bossAt: 0.78,
    bossSpawned: false,
    boss: null,
    score: 0,
    kills: 0,
    perfects: 0,
    combo: 0,
    sync: 0,
    overdrive: 0,
    shake: 0,
    flash: 0,
    mods,
    player: {
      x: 0,
      vx: 0,
      hull: mods.maxHull,
      cooldown: 0,
      dash: 0,
      invincible: 0,
      airborne: 0,
      lastTrailZ: -1,
      lastAxis: 0,
    },
    bullets: [],
    enemyBullets: [],
    enemies: [],
    trails: [],
    playerTrail: { id: "player", color: trail.color, points: [] },
    hazards: [],
    particles: [],
  };
  activeRun.player.x = trackShape(activeRun, 0).center;
  buildHazards(activeRun);
  return activeRun;
}

function buildHazards(activeRun: Run): void {
  const period = 60 / activeRun.track.bpm;
  for (let beat = 7; beat * period < activeRun.duration * 0.77; beat++) {
    const time = beat * period;
    const z = time * activeRun.speed;
    const shape = trackShape(activeRun, z);
    const previousEnergy = sampleEnergy(
      activeRun.track,
      Math.max(0, time / activeRun.duration - 0.018),
    );
    const rise = shape.energy - previousEnergy;
    if (rise > 0.08 || (beat % 12 === 0 && activeRun.rng() < 0.72)) {
      activeRun.hazards.push({
        kind: "ramp",
        z,
        x: shape.center + (activeRun.rng() * 2 - 1) * shape.width * 0.55,
        radius: 0.085,
        used: false,
      });
    } else if (beat % 4 === 0 && activeRun.rng() < 0.24 + shape.energy * 0.28) {
      activeRun.hazards.push({
        kind: "block",
        z,
        x: shape.center + (activeRun.rng() * 2 - 1) * shape.width * 0.66,
        radius: 0.075,
        used: false,
      });
    }
  }
}

function renderMenu(): void {
  ui.metaLine.textContent = `BEST ${formatScore(meta.best)} // ${meta.cores} DATA // ${meta.wins} CLEARS`;
  ui.tracks.replaceChildren();
  const tracks = customTrack ? [...TRACKS, customTrack] : TRACKS;
  for (const track of tracks) {
    const locked = Boolean(track.locked && meta.wins < 1);
    const button = document.createElement("button");
    button.type = "button";
    button.className = `track-card${selectedTrack.id === track.id ? " selected" : ""}`;
    button.style.setProperty("--track-color", track.color);
    button.disabled = locked;
    button.innerHTML = `<span class="track-name">${escapeHtml(track.name)}</span><span class="track-stats">${track.bpm} BPM // ${formatTime(track.duration)} // ${track.difficulty}</span>${locked ? '<span class="track-lock">Clear a signal to unlock</span>' : ""}`;
    button.addEventListener("click", () => {
      selectedTrack = track;
      renderMenu();
    });
    ui.tracks.append(button);
  }

  ui.weapons.replaceChildren();
  for (const weapon of WEAPONS) {
    const unlocked = weapon.unlock(meta);
    if (!unlocked && selectedWeapon === weapon.id) selectedWeapon = "pulse";
    const button = document.createElement("button");
    button.type = "button";
    button.className = `loadout-button${selectedWeapon === weapon.id ? " selected" : ""}`;
    button.disabled = !unlocked;
    button.innerHTML = `<strong>${weapon.name}</strong><span>${weapon.note}</span>`;
    button.addEventListener("click", () => {
      selectedWeapon = weapon.id;
      renderMenu();
    });
    ui.weapons.append(button);
  }

  ui.trails.replaceChildren();
  for (const trail of TRAIL_CHOICES) {
    const unlocked = trail.unlock(meta);
    if (!unlocked && selectedTrail === trail.id) selectedTrail = "cyan";
    const button = document.createElement("button");
    button.type = "button";
    button.className = `loadout-button${selectedTrail === trail.id ? " selected" : ""}`;
    button.style.setProperty("--track-color", trail.color);
    button.disabled = !unlocked;
    button.innerHTML = `<strong style="color:${trail.color}">${trail.name}</strong><span>${trail.note}</span>`;
    button.addEventListener("click", () => {
      selectedTrail = trail.id;
      renderMenu();
    });
    ui.trails.append(button);
  }
}

async function loadAudioFile(file?: File): Promise<void> {
  ui.error.textContent = "";
  if (
    !file ||
    (!file.type.startsWith("audio/") &&
      !/\.(mp3|wav|ogg|m4a|aac|flac)$/i.test(file.name))
  ) {
    ui.error.textContent = "Choose a supported audio file.";
    return;
  }
  if (file.size > 60 * 1024 * 1024) {
    ui.error.textContent = "That file is over the 60 MB browser limit.";
    return;
  }
  ui.launch.disabled = true;
  ui.launch.textContent = "Analyzing signal…";
  try {
    const context = audio.ensure();
    if (!context) throw new Error("Web Audio is unavailable in this browser.");
    const bytes = await file.arrayBuffer();
    const decoded = await context.decodeAudioData(bytes.slice(0));
    const bpm = estimateBpm(decoded);
    if (customUrl) URL.revokeObjectURL(customUrl);
    customUrl = URL.createObjectURL(file);
    ui.customAudio.src = customUrl;
    customTrack = {
      id: "custom",
      name: file.name.replace(/\.[^.]+$/, "").slice(0, 42) || "Local signal",
      bpm,
      duration: Math.max(8, decoded.duration),
      difficulty: "LOCAL",
      color: "#70ff9d",
      accent: "#3df5ff",
      seed: (file.size ^ Math.floor(decoded.duration * 1000)) >>> 0,
      curve: energyCurve(decoded),
      custom: true,
    };
    selectedTrack = customTrack;
    ui.dropCopy.textContent = `${bpm} BPM detected // ${formatTime(decoded.duration)}`;
    ui.clearCustom.hidden = false;
    renderMenu();
  } catch (error) {
    ui.error.textContent =
      error instanceof Error
        ? error.message
        : "The audio signal could not be decoded.";
  } finally {
    ui.launch.disabled = false;
    ui.launch.textContent = "Enter the grid";
  }
}

function energyCurve(buffer: AudioBuffer): number[] {
  const data = buffer.getChannelData(0);
  const bins = 256;
  const curve = new Array<number>(bins);
  let peak = 0;
  for (let bin = 0; bin < bins; bin++) {
    const start = Math.floor((bin * data.length) / bins);
    const end = Math.floor(((bin + 1) * data.length) / bins);
    const stride = Math.max(1, Math.floor((end - start) / 160));
    let sum = 0;
    let count = 0;
    for (let index = start; index < end; index += stride) {
      sum += data[index] * data[index];
      count++;
    }
    curve[bin] = Math.sqrt(sum / Math.max(1, count));
    peak = Math.max(peak, curve[bin]);
  }
  for (let index = 0; index < bins; index++) {
    const normalized = peak ? Math.sqrt(curve[index] / peak) : 0.35;
    curve[index] = clamp(normalized, 0.06, 1);
  }
  return curve;
}

function estimateBpm(buffer: AudioBuffer): number {
  const data = buffer.getChannelData(0);
  const envelopeRate = 100;
  const hop = Math.max(1, Math.floor(buffer.sampleRate / envelopeRate));
  const frames = Math.min(Math.floor(data.length / hop), envelopeRate * 180);
  const envelope = new Float32Array(frames);
  for (let frame = 0; frame < frames; frame++) {
    let sum = 0;
    let count = 0;
    const start = frame * hop;
    const stride = Math.max(1, Math.floor(hop / 24));
    for (
      let index = start;
      index < Math.min(data.length, start + hop);
      index += stride
    ) {
      sum += Math.abs(data[index]);
      count++;
    }
    envelope[frame] = sum / Math.max(1, count);
  }
  const onset = new Float32Array(frames);
  for (let index = 4; index < frames; index++) {
    const baseline =
      (envelope[index - 1] +
        envelope[index - 2] +
        envelope[index - 3] +
        envelope[index - 4]) /
      4;
    onset[index] = Math.max(0, envelope[index] - baseline);
  }
  let bestBpm = 120;
  let bestScore = -1;
  // ponytail: this lightweight detector covers the playable range; add half-time scoring if detection quality becomes a problem.
  for (let bpm = 80; bpm <= 180; bpm++) {
    const lag = Math.round((envelopeRate * 60) / bpm);
    let score = 0;
    for (let index = lag; index < frames; index++)
      score += onset[index] * onset[index - lag];
    if (score > bestScore) {
      bestScore = score;
      bestBpm = bpm;
    }
  }
  return bestScore > 0 ? bestBpm : 120;
}

function startRun(): void {
  audio.ensure();
  run = makeRun();
  state = "running";
  ui.menu.hidden = true;
  ui.resultModal.hidden = true;
  ui.upgradeModal.hidden = true;
  ui.hud.hidden = false;
  ui.touchControls.classList.add("active");
  ui.trackReadout.textContent = `${selectedTrack.name.toUpperCase()} // ${selectedTrack.bpm} BPM`;
  if (selectedTrack.custom) {
    ui.customAudio.currentTime = 0;
    ui.customAudio.muted = audio.muted;
    void ui.customAudio
      .play()
      .catch(() =>
        announce("Click to arm audio", "The run continues silently", 1700),
      );
  }
  announce(
    "Signal locked",
    `${selectedTrack.bpm} BPM // SEED ${run.seed.toString(16).toUpperCase()}`,
    1700,
  );
  app.canvas.focus();
}

function finishRun(victory: boolean, cause: string): void {
  if (!run || state === "result") return;
  state = "result";
  ui.customAudio.pause();
  const banked = Math.max(1, Math.floor(run.score / 1000));
  meta.best = Math.max(meta.best, Math.floor(run.score));
  meta.cores += banked;
  meta.kills += run.kills;
  if (victory) meta.wins++;
  saveMeta();
  ui.hud.hidden = true;
  ui.touchControls.classList.remove("active");
  ui.resultEyebrow.textContent = victory ? "Signal complete" : "Signal lost";
  ui.resultTitle.textContent = victory ? "Track conquered" : "Derezzed";
  ui.resultCopy.textContent = victory
    ? "The chorus broke before you did. A harder remix is now in the archive."
    : cause;
  ui.resultScore.textContent = formatScore(run.score);
  ui.resultKills.textContent = String(run.kills);
  ui.resultPerfects.textContent = String(run.perfects);
  ui.resultCores.textContent = `+${banked}`;
  ui.resultModal.hidden = false;
}

function returnToMenu(): void {
  state = "menu";
  ui.customAudio.pause();
  ui.resultModal.hidden = true;
  ui.upgradeModal.hidden = true;
  ui.hud.hidden = true;
  ui.touchControls.classList.remove("active");
  renderMenu();
  ui.menu.hidden = false;
}

function announce(title: string, subtitle = "", duration = 1100): void {
  const heading = ui.announcement.querySelector("strong");
  const copy = ui.announcement.querySelector("span");
  if (heading) heading.textContent = title;
  if (copy) copy.textContent = subtitle;
  ui.announcement.classList.add("show");
  announceTimer = duration / 1000;
}

function beatDistance(): number {
  if (!run) return Infinity;
  const period = 60 / run.track.bpm;
  const phase = run.time % period;
  return Math.min(phase, period - phase);
}

function perfectAction(label: string, amount = 13): boolean {
  const activeRun = getRun();
  if (beatDistance() > 0.105) return false;
  activeRun.perfects++;
  activeRun.combo = Math.min(24, activeRun.combo + 1);
  addSync(amount * activeRun.mods.syncGain);
  activeRun.score += 80 * (1 + Math.floor(activeRun.combo / 4));
  audio.perfect();
  announce("Perfect", label, 430);
  return true;
}

function addSync(amount: number): void {
  const activeRun = getRun();
  activeRun.sync += amount;
  if (activeRun.sync >= 100) {
    activeRun.sync -= 100;
    activeRun.overdrive = Math.max(activeRun.overdrive, 6);
    activeRun.score += 500;
    announce("Pulse overdrive", "Fire rate doubled // score amplified", 1200);
  }
}

function onBeat(index: number): void {
  const activeRun = getRun();
  const progress = activeRun.time / activeRun.duration;
  const energy = sampleEnergy(activeRun.track, progress);
  audio.beat(index, energy);
  activeRun.flash = 0.08 + energy * 0.08;
  addSync(1.15);
  if (
    !activeRun.bossSpawned &&
    index > 4 &&
    index % 2 === 0 &&
    activeRun.rng() < 0.12 + energy * 0.22
  )
    spawnEnemy(false);
  if (
    !activeRun.bossSpawned &&
    index > 10 &&
    index % 12 === 6 &&
    activeRun.rng() < 0.72
  )
    spawnEnemy(true);
  if (
    activeRun.boss &&
    index % (activeRun.boss.hp < activeRun.boss.maxHp * 0.45 ? 1 : 2) === 0
  )
    bossVolley(index);
  for (const enemy of activeRun.enemies) {
    if (
      !enemy.dead &&
      enemy.type !== "hunter" &&
      activeRun.rng() < 0.12 + energy * 0.12
    )
      enemyShoot(enemy);
  }
}

function spawnEnemy(hunter: boolean): void {
  const activeRun = getRun();
  const id = `${activeRun.lastBeat}-${Math.floor(activeRun.rng() * 1e6)}`;
  const z =
    activeRun.distance +
    (hunter ? -1.8 : VIEW * (0.72 + activeRun.rng() * 0.2));
  const shape = trackShape(activeRun, Math.max(0, z));
  const trail: Trail = {
    id,
    color: hunter ? "#ffd166" : "#ff3dbb",
    points: [],
  };
  const type: EnemyType = hunter
    ? "hunter"
    : activeRun.rng() < 0.28
      ? "weaver"
      : "drone";
  const enemy: Enemy = {
    id,
    type,
    x: shape.center + (activeRun.rng() * 2 - 1) * shape.width * 0.68,
    z,
    vx: 0,
    hp: hunter ? 2 : 2 + (activeRun.track.difficulty === "OVERDRIVE" ? 1 : 0),
    trail,
    trailGap: 0,
    phase: activeRun.rng() * TAU,
    dead: false,
  };
  activeRun.trails.push(trail);
  activeRun.enemies.push(enemy);
}

function spawnBoss(): void {
  const activeRun = getRun();
  const z = activeRun.distance + 7;
  const maxHp = 52 + Math.round(activeRun.track.bpm * 0.16);
  activeRun.bossSpawned = true;
  activeRun.boss = {
    x: trackShape(activeRun, z).center,
    z,
    hp: maxHp,
    maxHp,
    phase: 0,
  };
  activeRun.enemies.length = 0;
  announce("Chorus Guardian", "Break the carrier before the signal ends", 2100);
}

function bossVolley(index: number): void {
  const activeRun = getRun();
  const boss = activeRun.boss;
  if (!boss) return;
  const count = boss.hp < boss.maxHp * 0.45 ? 5 : 3;
  for (let shot = 0; shot < count; shot++) {
    const spread = (shot - (count - 1) / 2) * 0.19;
    activeRun.enemyBullets.push({
      x: boss.x,
      z: boss.z - 0.25,
      vx: spread,
      vz: -2.4 - (index % 4) * 0.14,
      radius: 0.026,
    });
  }
  activeRun.shake = Math.max(activeRun.shake, 0.08);
}

function enemyShoot(enemy: Enemy): void {
  const activeRun = getRun();
  const deltaZ = Math.max(0.5, enemy.z - activeRun.distance);
  const travel = deltaZ / 2.25;
  const vx = clamp((activeRun.player.x - enemy.x) / travel, -0.42, 0.42);
  activeRun.enemyBullets.push({
    x: enemy.x,
    z: enemy.z,
    vx,
    vz: -2.25,
    radius: 0.022,
  });
}

function fire(): void {
  const activeRun = getRun();
  const player = activeRun.player;
  const rate = activeRun.mods.fireRate * (activeRun.overdrive > 0 ? 0.5 : 1);
  if (player.cooldown > 0) return;
  player.cooldown = rate;
  const shots = activeRun.mods.spread ? [-1, 0, 1] : [0];
  for (const direction of shots) {
    activeRun.bullets.push({
      x: player.x + direction * 0.022,
      z: activeRun.distance + 0.14,
      vx: direction * (0.22 + activeRun.mods.spread * 0.035),
      vz: 7.6,
      damage: activeRun.mods.damage,
      pierce: activeRun.mods.pierce,
      life: 1.8,
    });
  }
  audio.shot();
}

function phaseDash(): void {
  if (!run || state !== "running" || run.player.dash > 0) return;
  const left = keys.has("ArrowLeft") || keys.has("KeyA");
  const right = keys.has("ArrowRight") || keys.has("KeyD");
  const direction = right ? 1 : left ? -1 : run.player.vx >= 0 ? 1 : -1;
  run.player.x += direction * 0.2;
  run.player.vx = direction * 0.42;
  run.player.dash = run.mods.dashRate;
  run.player.invincible = 0.3;
  burst(run.player.x, run.distance, run.playerTrail.color, 12);
  perfectAction("Phase dash", 16);
}

function openUpgrade(): void {
  const activeRun = getRun();
  state = "upgrade";
  ui.customAudio.pause();
  activeRun.mods.wallCharge = activeRun.mods.wallRun;
  upgradeChoices = pickUpgrades(activeRun.rng);
  ui.choices.replaceChildren();
  upgradeChoices.forEach((upgrade, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "choice-card";
    button.innerHTML = `<em>${index + 1}</em><strong>${upgrade.name}</strong><span>${upgrade.text}</span><span class="type">${upgrade.type} protocol</span>`;
    button.addEventListener("click", () => chooseUpgrade(index));
    ui.choices.append(button);
  });
  ui.upgradeModal.hidden = false;
}

function pickUpgrades(random: Random): Upgrade[] {
  const pool = [...UPGRADES];
  for (let index = pool.length - 1; index > 0; index--) {
    const other = Math.floor(random() * (index + 1));
    [pool[index], pool[other]] = [pool[other], pool[index]];
  }
  return pool.slice(0, 3);
}

function chooseUpgrade(index: number): void {
  const upgrade = upgradeChoices[index];
  if (state !== "upgrade" || !upgrade) return;
  const activeRun = getRun();
  upgrade.apply(activeRun.mods, activeRun);
  activeRun.score += 300;
  ui.upgradeModal.hidden = true;
  state = "running";
  if (selectedTrack.custom) void ui.customAudio.play().catch(() => undefined);
  announce(upgrade.name, `${upgrade.type.toUpperCase()} installed`, 1000);
  app.canvas.focus();
}

function update(delta: number): void {
  if (!run || state !== "running") return;
  const activeRun = run;
  const player = activeRun.player;
  if (activeRun.track.custom && !ui.customAudio.ended && !ui.customAudio.paused)
    activeRun.time = ui.customAudio.currentTime;
  else activeRun.time += delta;
  activeRun.distance = activeRun.speed * activeRun.time;
  const progress = activeRun.time / activeRun.duration;
  const beat = Math.floor(activeRun.time / (60 / activeRun.track.bpm));
  while (activeRun.lastBeat < beat) onBeat(++activeRun.lastBeat);

  if (!activeRun.bossSpawned && progress >= activeRun.bossAt) spawnBoss();
  if (
    activeRun.section < activeRun.sections.length &&
    progress >= activeRun.sections[activeRun.section]
  ) {
    activeRun.section++;
    openUpgrade();
    return;
  }

  const axis =
    (keys.has("ArrowRight") || keys.has("KeyD") ? 1 : 0) -
    (keys.has("ArrowLeft") || keys.has("KeyA") ? 1 : 0);
  if (axis && axis !== player.lastAxis) perfectAction("Pulse turn", 5);
  player.lastAxis = axis;
  player.vx += axis * 2.35 * delta;
  player.vx *= Math.exp(-5.2 * delta);
  player.x += player.vx * delta;
  player.cooldown = Math.max(0, player.cooldown - delta);
  player.dash = Math.max(0, player.dash - delta);
  player.invincible = Math.max(0, player.invincible - delta);
  player.airborne = Math.max(0, player.airborne - delta);
  activeRun.overdrive = Math.max(0, activeRun.overdrive - delta);
  activeRun.shake = Math.max(0, activeRun.shake - delta * 2.5);
  activeRun.flash = Math.max(0, activeRun.flash - delta);
  if (keys.has("Space")) fire();

  const shape = trackShape(activeRun, activeRun.distance);
  if (Math.abs(player.x - shape.center) > shape.width) {
    if (player.invincible > 0 || player.airborne > 0) {
      player.x =
        shape.center + Math.sign(player.x - shape.center) * shape.width * 0.95;
    } else if (activeRun.mods.wallCharge > 0) {
      activeRun.mods.wallCharge--;
      player.x =
        shape.center + Math.sign(player.x - shape.center) * shape.width * 0.88;
      player.vx *= -0.4;
      player.invincible = 0.7;
      announce(
        "Edge protocol",
        `${activeRun.mods.wallCharge} charges remain`,
        800,
      );
    } else {
      finishRun(
        false,
        "You left the generated track and dissolved into the grid.",
      );
      return;
    }
  }

  if (player.lastTrailZ < activeRun.distance - 0.075) {
    activeRun.playerTrail.points.push({ x: player.x, z: activeRun.distance });
    player.lastTrailZ = activeRun.distance;
  }
  activeRun.playerTrail.points = activeRun.playerTrail.points.filter(
    (point) => point.z > activeRun.distance - 4.2,
  );

  updateHazards();
  updateBullets(delta);
  updateEnemies(delta);
  updateEnemyBullets(delta);
  updateParticles(delta);
  checkHostileTrails();
  if (state !== "running") return;

  if (activeRun.boss) {
    const targetZ = activeRun.distance + 5.8;
    activeRun.boss.z = lerp(activeRun.boss.z, targetZ, 2.2 * delta);
    const bossShape = trackShape(activeRun, activeRun.boss.z);
    activeRun.boss.phase += delta;
    activeRun.boss.x =
      bossShape.center +
      Math.sin(activeRun.boss.phase * 1.8) * bossShape.width * 0.63;
  }
  if (activeRun.time >= activeRun.duration) {
    finishRun(
      false,
      "The signal ended before the Chorus Guardian was destroyed.",
    );
    return;
  }

  activeRun.trails = activeRun.trails.filter(
    (trail) =>
      trail.points.length &&
      trail.points.some((point) => point.z > activeRun.distance - 2.6),
  );
  activeRun.score +=
    delta *
    (22 + activeRun.track.bpm * 0.18) *
    (activeRun.overdrive > 0 ? 2 : 1);
  activeRun.combo = Math.max(0, activeRun.combo - delta * 0.36);
  updateHud();
}

function updateHazards(): void {
  const activeRun = getRun();
  for (const hazard of activeRun.hazards) {
    if (
      hazard.used ||
      Math.abs(hazard.z - activeRun.distance) > 0.14 ||
      Math.abs(hazard.x - activeRun.player.x) > hazard.radius
    )
      continue;
    hazard.used = true;
    if (hazard.kind === "ramp") {
      activeRun.player.airborne = 1.05;
      activeRun.player.invincible = 1.05;
      activeRun.score += 240;
      addSync(18 * activeRun.mods.syncGain);
      burst(hazard.x, hazard.z, "#70ff9d", 18);
      perfectAction("Bass ramp", 8);
    } else if (activeRun.player.invincible <= 0) {
      damagePlayer("A waveform hazard shattered your last integrity cell.");
    }
  }
}

function updateBullets(delta: number): void {
  const activeRun = getRun();
  for (const bullet of activeRun.bullets) {
    bullet.life -= delta;
    if (activeRun.mods.homing > 0) {
      let target: Pick<Enemy, "x" | "z"> | Boss | null = activeRun.boss;
      let nearest = target ? Math.abs(target.z - bullet.z) : Infinity;
      for (const enemy of activeRun.enemies) {
        if (enemy.dead || enemy.z < bullet.z - 0.1) continue;
        const distance = Math.abs(enemy.z - bullet.z);
        if (distance < nearest) {
          target = enemy;
          nearest = distance;
        }
      }
      if (target) {
        const desired = clamp((target.x - bullet.x) * 1.8, -0.75, 0.75);
        bullet.vx = lerp(
          bullet.vx,
          desired,
          clamp(activeRun.mods.homing * delta, 0, 1),
        );
      }
    }
    bullet.x += bullet.vx * delta;
    bullet.z += bullet.vz * delta;
    if (bullet.life <= 0) continue;

    if (
      activeRun.boss &&
      Math.abs(bullet.z - activeRun.boss.z) < 0.3 &&
      Math.abs(bullet.x - activeRun.boss.x) < 0.14
    ) {
      activeRun.boss.hp -= bullet.damage;
      activeRun.score += 35 * bullet.damage;
      burst(bullet.x, bullet.z, activeRun.track.accent, 5);
      audio.hit();
      if (bullet.pierce > 0) bullet.pierce--;
      else bullet.life = 0;
      if (activeRun.boss.hp <= 0) {
        const { x, z } = activeRun.boss;
        activeRun.boss = null;
        activeRun.score +=
          4000 +
          Math.max(0, Math.floor((activeRun.duration - activeRun.time) * 100));
        burst(x, z, "#ffffff", 42);
        finishRun(true, "");
        continue;
      }
    }

    if (bullet.life <= 0) continue;
    for (const enemy of activeRun.enemies) {
      if (
        enemy.dead ||
        Math.abs(bullet.z - enemy.z) >= 0.16 ||
        Math.abs(bullet.x - enemy.x) >= 0.07
      )
        continue;
      enemy.hp -= bullet.damage;
      burst(bullet.x, bullet.z, enemy.trail.color, 4);
      if (bullet.pierce > 0) bullet.pierce--;
      else bullet.life = 0;
      if (enemy.hp <= 0) destroyEnemy(enemy, "Beat kill");
      break;
    }
  }
  activeRun.bullets = activeRun.bullets.filter(
    (bullet) => bullet.life > 0 && bullet.z < activeRun.distance + VIEW + 2,
  );
}

function destroyEnemy(enemy: Enemy, label: string, canBlast = true): void {
  const activeRun = getRun();
  if (enemy.dead) return;
  enemy.dead = true;
  activeRun.kills++;
  activeRun.score +=
    (enemy.type === "hunter" ? 340 : 220) *
    (1 + Math.floor(activeRun.combo / 4));
  perfectAction(label, 11);
  burst(enemy.x, enemy.z, enemy.trail.color, 15);
  audio.hit();
  if (!canBlast || activeRun.mods.trailBlast <= 0) return;
  for (const other of activeRun.enemies) {
    if (
      other.dead ||
      Math.hypot(other.x - enemy.x, other.z - enemy.z) >
        activeRun.mods.trailBlast
    )
      continue;
    destroyEnemy(other, "Nova chain", false);
  }
}

function updateEnemies(delta: number): void {
  const activeRun = getRun();
  for (const enemy of activeRun.enemies) {
    if (enemy.dead) continue;
    const hunter = enemy.type === "hunter";
    enemy.z +=
      activeRun.speed *
      (hunter ? 1.58 : enemy.type === "weaver" ? 0.28 : 0.18) *
      delta;
    const shape = trackShape(activeRun, Math.max(0, enemy.z));
    const weave =
      Math.sin(activeRun.time * (hunter ? 2.8 : 1.7) + enemy.phase) *
      shape.width *
      (hunter ? 0.24 : 0.66);
    const target = hunter
      ? lerp(shape.center, activeRun.player.x, 0.72)
      : shape.center + weave;
    enemy.vx +=
      clamp(target - enemy.x, -0.4, 0.4) * (hunter ? 4.2 : 2.4) * delta;
    enemy.vx *= Math.exp(-(hunter ? 3.4 : 4.6) * delta);
    enemy.x = clamp(
      enemy.x + enemy.vx * delta,
      shape.center - shape.width * 0.9,
      shape.center + shape.width * 0.9,
    );
    enemy.trailGap -= delta;
    if (enemy.trailGap <= 0) {
      enemy.trail.points.push({ x: enemy.x, z: enemy.z });
      enemy.trailGap = 0.065;
    }
    enemy.trail.points = enemy.trail.points.filter(
      (point) => point.z > activeRun.distance - 3,
    );

    if (
      Math.abs(enemy.z - activeRun.distance) < 0.13 &&
      Math.abs(enemy.x - activeRun.player.x) < 0.065
    ) {
      damagePlayer("An enemy ship rammed through your light cycle.");
      enemy.dead = true;
      burst(enemy.x, enemy.z, enemy.trail.color, 12);
    } else if (
      enemy.z < activeRun.distance - 1.4 ||
      enemy.z > activeRun.speed * activeRun.duration + 2
    ) {
      enemy.dead = true;
    }
  }
  activeRun.enemies = activeRun.enemies.filter((enemy) => !enemy.dead);
}

function updateEnemyBullets(delta: number): void {
  const activeRun = getRun();
  for (const bullet of activeRun.enemyBullets) {
    bullet.x += bullet.vx * delta;
    bullet.z += bullet.vz * delta;
    if (
      Math.abs(bullet.z - activeRun.distance) < 0.1 &&
      Math.abs(bullet.x - activeRun.player.x) < 0.045
    ) {
      bullet.dead = true;
      damagePlayer(
        "A beat-synced hostile round shattered your last integrity cell.",
      );
    }
  }
  activeRun.enemyBullets = activeRun.enemyBullets.filter(
    (bullet) =>
      !bullet.dead &&
      bullet.z > activeRun.distance - 0.8 &&
      bullet.z < activeRun.distance + VIEW + 1,
  );
}

function checkHostileTrails(): void {
  const activeRun = getRun();
  // ponytail: linear scans fit the on-screen cap; use spatial bins only if entity counts grow.
  for (const trail of activeRun.trails) {
    const hit = trail.points.some(
      (point) =>
        Math.abs(point.z - activeRun.distance) < 0.06 &&
        Math.abs(point.x - activeRun.player.x) < 0.034,
    );
    if (hit) {
      damagePlayer("You crossed a hostile solid-light trail.");
      break;
    }
  }

  const trails = [activeRun.playerTrail, ...activeRun.trails];
  for (const enemy of activeRun.enemies) {
    if (enemy.dead) continue;
    const hit = trails.some(
      (trail) =>
        trail !== enemy.trail &&
        trail.points.some(
          (point) =>
            Math.abs(point.z - enemy.z) < 0.055 &&
            Math.abs(point.x - enemy.x) < 0.032,
        ),
    );
    if (hit) destroyEnemy(enemy, "Trail cut");
  }
  activeRun.enemies = activeRun.enemies.filter((enemy) => !enemy.dead);
}

function damagePlayer(cause: string): void {
  if (!run || state !== "running" || run.player.invincible > 0) return;
  run.player.hull--;
  run.player.invincible = 0.9;
  run.combo = 0;
  run.sync = Math.max(0, run.sync - 18);
  run.shake = 0.3;
  burst(run.player.x, run.distance, "#ff5b75", 24);
  audio.hit();
  if (run.player.hull <= 0) finishRun(false, cause);
  else announce("Integrity lost", `${run.player.hull} cells remain`, 850);
}

function burst(x: number, z: number, color: string, count: number): void {
  const activeRun = getRun();
  for (let index = 0; index < count; index++) {
    const life = 0.25 + activeRun.rng() * 0.5;
    activeRun.particles.push({
      x,
      z,
      vx: (activeRun.rng() * 2 - 1) * 0.42,
      vz: (activeRun.rng() * 2 - 1) * 1.8,
      life,
      maxLife: life,
      color,
      size: 1.2 + activeRun.rng() * 2.8,
    });
  }
}

function updateParticles(delta: number): void {
  const activeRun = getRun();
  for (const particle of activeRun.particles) {
    particle.life -= delta;
    particle.x += particle.vx * delta;
    particle.z += particle.vz * delta;
  }
  activeRun.particles = activeRun.particles.filter(
    (particle) => particle.life > 0,
  );
}

function updateHud(): void {
  const activeRun = getRun();
  const progress = clamp(activeRun.time / activeRun.duration, 0, 1);
  ui.score.textContent = formatScore(activeRun.score);
  ui.multiplier.textContent = `SYNC ×${1 + Math.floor(activeRun.combo / 4)}${activeRun.overdrive > 0 ? " // OVERDRIVE" : ""}`;
  ui.time.textContent = formatTime(
    Math.max(0, activeRun.duration - activeRun.time),
  );
  ui.progressFill.style.width = `${progress * 100}%`;
  ui.syncFill.style.width = `${activeRun.sync}%`;
  ui.syncText.textContent = `${Math.floor(activeRun.sync)}%`;
  ui.trackReadout.textContent = activeRun.boss
    ? `CHORUS GUARDIAN // ${Math.max(0, activeRun.boss.hp)} HP`
    : `${activeRun.track.name.toUpperCase()} // ${activeRun.track.bpm} BPM`;
  ui.integrity.innerHTML = Array.from(
    { length: activeRun.mods.maxHull },
    (_, index) =>
      `<i class="${index >= activeRun.player.hull ? "off" : ""}"></i>`,
  ).join("");
  const period = 60 / activeRun.track.bpm;
  const active = Math.floor(((activeRun.time % period) / period) * 8);
  [...ui.beatRail.children].forEach((bar, index) =>
    bar.classList.toggle("on", index === active),
  );
}

function project(x: number, z: number, lift = 0): Projection {
  const activeRun = getRun();
  const width = app.screen.width;
  const height = app.screen.height;
  const deltaZ = z - activeRun.distance;
  const amount = clamp(deltaZ / VIEW, 0, 1);
  const depth = amount ** 0.68;
  const scale = lerp(1.04, 0.13, depth);
  return {
    x: width * 0.5 + x * width * 0.82 * scale,
    y:
      deltaZ < 0
        ? height * 0.86 - deltaZ * height * 0.52
        : lerp(height * 0.86, height * 0.22, depth) -
          lift * height * 0.22 * scale,
    scale,
    visible: deltaZ > -1.3 && deltaZ < VIEW * 1.08,
  };
}

function drawBackdrop(now: number): void {
  const width = app.screen.width;
  const height = app.screen.height;
  backdropLayer.clear();
  backdropLayer.rect(0, 0, width, height).fill({ color: "#02050c" });
  backdropLayer
    .circle(width * 0.5, height * 0.3, Math.max(width, height) * 0.58)
    .fill({ color: "#0c1835", alpha: 0.64 });
  backdropLayer
    .circle(width * 0.5, height * 0.3, Math.max(width, height) * 0.31)
    .fill({ color: "#172d5b", alpha: 0.2 });
  const drift =
    (state !== "menu" && run ? run.time * 0.035 : now * 0.000006) % 1;
  for (const star of stars) {
    const y = ((star.y + drift * star.size) % 1) * height;
    const alpha = 0.2 + 0.5 * Math.sin(now * 0.0018 + star.phase) ** 2;
    backdropLayer
      .circle(star.x * width, y, star.size)
      .fill({ color: "#b9faff", alpha });
  }
}

function drawMenuGrid(now: number): void {
  const width = app.screen.width;
  const height = app.screen.height;
  const horizon = height * 0.62;
  for (let index = -10; index <= 10; index++) {
    trackLayer
      .moveTo(width * 0.5, horizon)
      .lineTo(width * 0.5 + index * width * 0.13, height)
      .stroke({ color: "#3df5ff", width: 1, alpha: 0.13 });
  }
  const phase = (now * 0.00008) % 1;
  for (let index = 0; index < 16; index++) {
    const amount = (index + phase) / 16;
    const y = lerp(horizon, height, amount * amount);
    trackLayer
      .moveTo(0, y)
      .lineTo(width, y)
      .stroke({ color: "#3df5ff", width: 1, alpha: amount * 0.25 });
  }
}

function drawTrack(): void {
  const activeRun = getRun();
  const segments = 58;
  for (let index = segments - 1; index >= 0; index--) {
    const nearZ = activeRun.distance + (index * VIEW) / segments;
    const farZ = activeRun.distance + ((index + 1) * VIEW) / segments;
    const near = trackShape(activeRun, nearZ);
    const far = trackShape(activeRun, farZ);
    const nearLeft = project(near.center - near.width, nearZ);
    const nearRight = project(near.center + near.width, nearZ);
    const farLeft = project(far.center - far.width, farZ);
    const farRight = project(far.center + far.width, farZ);
    trackLayer
      .poly(
        [
          nearLeft.x,
          nearLeft.y,
          nearRight.x,
          nearRight.y,
          farRight.x,
          farRight.y,
          farLeft.x,
          farLeft.y,
        ],
        true,
      )
      .fill({
        color: index % 2 ? "#081426" : "#0c1b30",
        alpha: index % 2 ? 0.78 : 0.84,
      });
  }

  const gridStep = 0.65;
  for (
    let z = Math.ceil(activeRun.distance / gridStep) * gridStep;
    z < activeRun.distance + VIEW;
    z += gridStep
  ) {
    const shape = trackShape(activeRun, z);
    const left = project(shape.center - shape.width, z);
    const right = project(shape.center + shape.width, z);
    trackLayer
      .moveTo(left.x, left.y)
      .lineTo(right.x, right.y)
      .stroke({
        color: activeRun.track.color,
        width: 1,
        alpha: 0.1 + left.scale * 0.28,
      });
  }

  for (const side of [-1, 1]) {
    const points: number[] = [];
    for (let index = 0; index <= segments; index++) {
      const z = activeRun.distance + (index * VIEW) / segments;
      const shape = trackShape(activeRun, z);
      const point = project(shape.center + side * shape.width, z);
      points.push(point.x, point.y);
    }
    trackLayer
      .poly(points, false)
      .stroke({ color: activeRun.track.color, width: 9, alpha: 0.07 });
    trackLayer
      .poly(points, false)
      .stroke({ color: activeRun.track.color, width: 2, alpha: 0.88 });
  }
}

function drawTrail(trail: Trail): void {
  const points = trail.points
    .map((point) => ({ point, projection: project(point.x, point.z) }))
    .filter(({ projection }) => projection.visible);
  if (points.length < 2) return;
  const path = points.flatMap(({ projection }) => [projection.x, projection.y]);
  trailLayer
    .poly(path, false)
    .stroke({ color: trail.color, width: 10, alpha: 0.08 });
  trailLayer
    .poly(path, false)
    .stroke({ color: trail.color, width: 2.2, alpha: 0.92 });
}

function drawShip(
  x: number,
  z: number,
  color: string,
  size = 0.03,
  reversed = false,
  lift = 0,
): void {
  const point = project(x, z, lift);
  if (!point.visible) return;
  const radius = Math.max(3, app.screen.width * size * point.scale);
  const direction = reversed ? -1 : 1;
  const tipY = point.y - radius * 1.35 * direction;
  const backY = point.y + radius * direction;
  const notchY = point.y + radius * 0.48 * direction;
  entityLayer
    .circle(point.x, point.y, radius * 1.8)
    .fill({ color, alpha: 0.08 });
  entityLayer
    .poly(
      [
        point.x,
        tipY,
        point.x + radius,
        backY,
        point.x,
        notchY,
        point.x - radius,
        backY,
      ],
      true,
    )
    .fill({ color });
  entityLayer
    .rect(
      point.x - radius * 0.18,
      point.y - radius * 0.36,
      radius * 0.36,
      radius * 0.7,
    )
    .fill({ color: "#eaffff" });
}

function drawWorld(): void {
  const activeRun = getRun();
  drawTrack();
  drawTrail(activeRun.playerTrail);
  for (const trail of activeRun.trails) drawTrail(trail);

  for (let index = activeRun.hazards.length - 1; index >= 0; index--) {
    const hazard = activeRun.hazards[index];
    if (
      hazard.used ||
      hazard.z < activeRun.distance - 0.2 ||
      hazard.z > activeRun.distance + VIEW
    )
      continue;
    const point = project(hazard.x, hazard.z);
    const size = Math.max(3, hazard.radius * app.screen.width * point.scale);
    const color = hazard.kind === "ramp" ? "#70ff9d" : "#ff5b75";
    entityLayer
      .circle(point.x, point.y, size * 1.5)
      .fill({ color, alpha: 0.08 });
    if (hazard.kind === "ramp") {
      entityLayer
        .poly(
          [
            point.x - size,
            point.y,
            point.x,
            point.y - size * 0.8,
            point.x + size,
            point.y,
          ],
          true,
        )
        .fill({ color });
    } else {
      entityLayer
        .rect(
          point.x - size * 0.7,
          point.y - size * 0.7,
          size * 1.4,
          size * 1.4,
        )
        .fill({ color });
    }
  }

  for (const enemy of activeRun.enemies)
    drawShip(
      enemy.x,
      enemy.z,
      enemy.trail.color,
      enemy.type === "hunter" ? 0.034 : 0.028,
      true,
    );
  if (activeRun.boss) {
    drawShip(
      activeRun.boss.x,
      activeRun.boss.z,
      activeRun.track.accent,
      0.075,
      true,
    );
    const point = project(activeRun.boss.x, activeRun.boss.z);
    const width = Math.max(45, app.screen.width * 0.13 * point.scale);
    entityLayer
      .rect(point.x - width / 2, point.y - 45 * point.scale, width, 3)
      .fill({ color: "#ffffff", alpha: 0.16 });
    entityLayer
      .rect(
        point.x - width / 2,
        point.y - 45 * point.scale,
        width * clamp(activeRun.boss.hp / activeRun.boss.maxHp, 0, 1),
        3,
      )
      .fill({ color: activeRun.track.accent });
  }

  for (const bullet of activeRun.bullets) {
    const point = project(bullet.x, bullet.z);
    entityLayer
      .moveTo(point.x, point.y + 8 * point.scale)
      .lineTo(point.x, point.y - 8 * point.scale)
      .stroke({
        color: "#d8ffff",
        width: Math.max(1, 3 * point.scale),
        alpha: 0.95,
      });
  }
  for (const bullet of activeRun.enemyBullets) {
    const point = project(bullet.x, bullet.z);
    entityLayer
      .circle(point.x, point.y, Math.max(2, 5 * point.scale))
      .fill({ color: "#ff5b75" });
  }

  for (const particle of activeRun.particles) {
    const point = project(particle.x, particle.z);
    entityLayer
      .rect(point.x, point.y, particle.size, particle.size)
      .fill({ color: particle.color, alpha: particle.life / particle.maxLife });
  }

  if (
    activeRun.player.invincible <= 0 ||
    Math.floor(activeRun.time * 18) % 2 === 0
  ) {
    const lift =
      activeRun.player.airborne > 0
        ? Math.sin(clamp(activeRun.player.airborne, 0, 1) * Math.PI) * 0.28
        : 0;
    if (lift > 0) {
      const shadow = project(activeRun.player.x, activeRun.distance);
      entityLayer
        .ellipse(shadow.x, shadow.y + 8, 24, 6)
        .fill({ color: "#70ff9d", alpha: 0.25 });
    }
    drawShip(
      activeRun.player.x,
      activeRun.distance + 0.02,
      activeRun.playerTrail.color,
      0.031,
      false,
      lift,
    );
  }

  if (activeRun.flash > 0) {
    flashLayer
      .rect(0, 0, app.screen.width, app.screen.height)
      .fill({ color: activeRun.track.color, alpha: activeRun.flash * 1.8 });
  }
}

function draw(now: number): void {
  drawBackdrop(now);
  trackLayer.clear();
  trailLayer.clear();
  entityLayer.clear();
  flashLayer.clear();
  if (run && state !== "menu") drawWorld();
  else drawMenuGrid(now);
  if (run && state !== "menu" && run.shake > 0) {
    world.position.set(
      (Math.random() * 2 - 1) * run.shake * 18,
      (Math.random() * 2 - 1) * run.shake * 12,
    );
  } else {
    world.position.set(0, 0);
  }
}

function togglePause(): void {
  if (state === "running") {
    state = "paused";
    ui.customAudio.pause();
    announce("Signal paused", "Press P to resume", Infinity);
  } else if (state === "paused") {
    state = "running";
    if (selectedTrack.custom) void ui.customAudio.play().catch(() => undefined);
    announce("Signal resumed", "", 650);
  }
}

function clearCustomTrack(): void {
  ui.customAudio.pause();
  ui.customAudio.removeAttribute("src");
  ui.customAudio.load();
  if (customUrl) URL.revokeObjectURL(customUrl);
  customUrl = null;
  if (selectedTrack === customTrack) selectedTrack = TRACKS[0];
  customTrack = null;
  ui.audioFile.value = "";
  ui.dropCopy.textContent = "Drop audio here or browse";
  ui.clearCustom.hidden = true;
  renderMenu();
}

function bindEvents(): void {
  ui.launch.addEventListener("click", startRun);
  ui.retry.addEventListener("click", startRun);
  ui.returnMenu.addEventListener("click", returnToMenu);
  ui.mute.addEventListener("click", audio.toggle);
  ui.clearCustom.addEventListener("click", clearCustomTrack);
  ui.audioFile.addEventListener(
    "change",
    () => void loadAudioFile(ui.audioFile.files?.[0]),
  );

  for (const type of ["dragenter", "dragover"]) {
    ui.dropZone.addEventListener(type, (event) => {
      event.preventDefault();
      ui.dropZone.classList.add("dragging");
    });
  }
  for (const type of ["dragleave", "drop"]) {
    ui.dropZone.addEventListener(type, (event) => {
      event.preventDefault();
      ui.dropZone.classList.remove("dragging");
      if (type === "drop" && event instanceof DragEvent)
        void loadAudioFile(event.dataTransfer?.files[0]);
    });
  }

  window.addEventListener("keydown", (event) => {
    keys.add(event.code);
    if (
      ["ArrowLeft", "ArrowRight", "Space", "ShiftLeft", "ShiftRight"].includes(
        event.code,
      ) &&
      state !== "menu"
    )
      event.preventDefault();
    if (event.code === "KeyP" && !event.repeat) togglePause();
    if (
      (event.code === "ShiftLeft" || event.code === "ShiftRight") &&
      !event.repeat
    )
      phaseDash();
    if (state === "upgrade" && /^Digit[1-3]$/.test(event.code))
      chooseUpgrade(Number(event.code.slice(-1)) - 1);
  });
  window.addEventListener("keyup", (event) => keys.delete(event.code));
  window.addEventListener("blur", () => {
    keys.clear();
    if (state === "running") togglePause();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && state === "running") togglePause();
  });

  for (const button of document.querySelectorAll<HTMLButtonElement>(
    ".touch-button",
  )) {
    const code = button.dataset.key;
    if (!code) continue;
    const release = (event: PointerEvent): void => {
      event.preventDefault();
      keys.delete(code);
    };
    button.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      keys.add(code);
      button.setPointerCapture(event.pointerId);
      if (code === "ShiftLeft") phaseDash();
    });
    button.addEventListener("pointerup", release);
    button.addEventListener("pointercancel", release);
  }
}

function selfCheck(): void {
  console.assert(
    TRACKS.every((track) => track.curve.length === 256),
    "Every generated track needs a complete energy curve.",
  );
  const choices = pickUpgrades(mulberry32(1));
  console.assert(
    choices.length === 3 && new Set(choices).size === 3,
    "Upgrade choices must contain three unique mutations.",
  );
}

async function boot(): Promise<void> {
  app = new Application();
  await app.init({
    resizeTo: window,
    antialias: true,
    autoDensity: true,
    resolution: Math.min(window.devicePixelRatio || 1, 2),
    backgroundAlpha: 0,
    preference: "webgl",
  });
  app.canvas.tabIndex = 0;
  app.canvas.setAttribute("aria-label", "GRIDRUNNER Pulse game field");
  ui.container.appendChild(app.canvas);

  backdropLayer = new Graphics();
  world = new Container();
  trackLayer = new Graphics();
  trailLayer = new Graphics();
  entityLayer = new Graphics();
  flashLayer = new Graphics();
  world.addChild(trackLayer, trailLayer, entityLayer);
  app.stage.addChild(backdropLayer, world, flashLayer);

  bindEvents();
  renderMenu();
  selfCheck();
  app.ticker.add((ticker) => {
    const delta = Math.min(0.05, Math.max(0, ticker.deltaMS / 1000));
    if (state === "running") update(delta);
    if (Number.isFinite(announceTimer) && announceTimer > 0) {
      announceTimer -= delta;
      if (announceTimer <= 0) ui.announcement.classList.remove("show");
    }
    draw(performance.now());
  });
}

void boot().catch((error: unknown) => {
  ui.error.textContent =
    error instanceof Error ? error.message : "PixiJS could not start.";
  console.error(error);
});
