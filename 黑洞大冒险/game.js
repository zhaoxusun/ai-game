(() => {
  'use strict';

  // ============================================================
  // Constants & utilities
  // ============================================================
  const TAU = Math.PI * 2;
  const MAX_LEVEL = 15;
  const RECORD_KEY = 'blackhole-odyssey-records-v1';
  const PREF_KEY = 'blackhole-odyssey-prefs-v1';

  const LEVEL_THRESHOLDS = [0, 35, 95, 185, 310, 490, 730, 1040, 1430, 1910, 2490, 3200, 4060, 5080, 6280];
  const LEVEL_RADII = [20, 26, 33, 41, 50, 60, 71, 83, 96, 110, 125, 141, 158, 176, 195];

  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const damp = (a, b, k, dt) => lerp(a, b, 1 - Math.exp(-k * dt));
  const dist2 = (x1, y1, x2, y2) => (x1 - x2) * (x1 - x2) + (y1 - y2) * (y1 - y2);
  const dist = (x1, y1, x2, y2) => Math.sqrt(dist2(x1, y1, x2, y2));
  const choice = (arr) => arr[(Math.random() * arr.length) | 0];
  const pad2 = (n) => String(n).padStart(2, '0');
  const fmtInt = (n) => Math.round(n).toLocaleString('en-US');
  const fmtDist = (n) => `${Math.round(n).toLocaleString('en-US')}m`;

  function mulberry32(seed) {
    let a = seed >>> 0;
    return function random() {
      a |= 0;
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function hash2(x, y, seed) {
    let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(seed | 0, 1442695041);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return (h ^ (h >>> 16)) >>> 0;
  }

  function formatTime(seconds) {
    if (!Number.isFinite(seconds)) return '--:--.-';
    const s = Math.max(0, seconds);
    const min = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    const tenth = Math.floor((s * 10) % 10);
    return `${pad2(min)}:${pad2(sec)}.${tenth}`;
  }

  function roundedRect(ctx, x, y, w, h, r) {
    const rr = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  }

  function loadJSON(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (err) {
      return fallback;
    }
  }

  function saveJSON(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (err) {
      /* storage can be unavailable in private mode */
    }
  }

  // ============================================================
  // Game data
  // ============================================================
  const MAPS = [
    {
      id: 0,
      name: '霓虹旧城',
      en: 'NEON OLD TOWN',
      tagline: '低矮街区、霓虹招牌，只有 1 个猎手，适合第一次扩张。',
      seed: 0x1a2b3c4d,
      cols: 4,
      rows: 3,
      margin: 140,
      blockW: 680,
      blockH: 650,
      roadW: 104,
      towerCol: 2,
      towerRow: 0,
      spawnCol: 2,
      spawnRow: 2,
      hunters: 1,
      enemySpeed: 0.8,
      enemySpawnDist: 1040,
      majorTiers: [3, 3, 3, 4, 4, 4, 5, 5, 6, 7],
      minorTiers: [2, 2, 2, 2, 3, 3, 4],
      scatter: { small: 4, green: 2 },
      theme: {
        key: 'neon',
        hueBase: 208,
        hueSpread: 44,
        glassTint: '#4aa6dc',
        windowWarm: 56
      },
      palette: {
        void: '#04060c',
        mapEdge: 'rgba(98, 190, 255, 0.2)',
        ground: '#0a111d',
        block: '#101a2a',
        blockAlt: '#0d1725',
        sidewalk: '#202d43',
        road: '#070c15',
        line: 'rgba(190, 216, 255, 0.17)',
        grass: '#10251f',
        accent: '#4de1ff',
        accent2: '#ff5d9b',
        glow: '#ff8d4a',
        beam: 'rgba(255, 196, 90, 0.75)'
      }
    },
    {
      id: 1,
      name: '钢铁港湾',
      en: 'IRON HARBOR',
      tagline: '锈色码头与集装箱，2 个猎手巡逻，猎手更快。',
      seed: 0x77c1e3a9,
      cols: 5,
      rows: 4,
      margin: 150,
      blockW: 680,
      blockH: 660,
      roadW: 118,
      towerCol: 2,
      towerRow: 0,
      spawnCol: 2,
      spawnRow: 3,
      hunters: 2,
      enemySpeed: 0.91,
      enemySpawnDist: 940,
      majorTiers: [3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 6, 6, 6, 7, 7, 7, 5],
      minorTiers: [2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 5],
      scatter: { small: 3, green: 2 },
      theme: {
        key: 'harbor',
        hueBase: 34,
        hueSpread: 28,
        glassTint: '#6fb3a3',
        windowWarm: 74,
        smallPool: ['barrel', 'trash', 'cone', 'lamp', 'person', 'barrel', 'bench', 'hydrant'],
        greenPool: ['barrel', 'container', 'planter', 'bush'],
        vehiclePool: ['van', 'van', 'car', 'bus', 'car'],
        decor: [
          { type: 'crane', count: 4 },
          { type: 'container', count: 7 }
        ]
      },
      palette: {
        void: '#07070b',
        mapEdge: 'rgba(255, 176, 92, 0.24)',
        ground: '#12151a',
        block: '#1c1f24',
        blockAlt: '#181b20',
        sidewalk: '#2d3036',
        road: '#0a0b0d',
        line: 'rgba(255, 208, 156, 0.18)',
        grass: '#1d2620',
        accent: '#ffb454',
        accent2: '#4fe0c8',
        glow: '#ff9a4d',
        beam: 'rgba(255, 205, 112, 0.78)'
      }
    },
    {
      id: 2,
      name: '云端都会',
      en: 'SKYLINE METRO',
      tagline: '高空玻璃都市，3 个猎手围猎，几乎与你同速。',
      seed: 0xc0ffee42,
      cols: 6,
      rows: 4,
      margin: 130,
      blockW: 650,
      blockH: 680,
      roadW: 112,
      towerCol: 3,
      towerRow: 0,
      spawnCol: 3,
      spawnRow: 3,
      hunters: 3,
      enemySpeed: 1.01,
      enemySpawnDist: 860,
      majorTiers: [3, 3, 3, 4, 4, 4, 4, 4, 5, 5, 5, 5, 5, 5, 6, 6, 6, 6, 7, 7, 7, 7],
      minorTiers: [2, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5],
      scatter: { small: 3, green: 1 },
      theme: {
        key: 'sky',
        hueBase: 272,
        hueSpread: 36,
        glassTint: '#b06bff',
        windowWarm: 30,
        smallPool: ['person', 'cone', 'lamp', 'trash', 'bench', 'planter'],
        greenPool: ['planter', 'bush', 'holo', 'planter'],
        vehiclePool: ['car', 'car', 'van', 'bus'],
        decor: [{ type: 'holo', count: 4 }]
      },
      palette: {
        void: '#070612',
        mapEdge: 'rgba(196, 120, 255, 0.24)',
        ground: '#0f0d1f',
        block: '#181633',
        blockAlt: '#141129',
        sidewalk: '#2b2850',
        road: '#0a0916',
        line: 'rgba(224, 196, 255, 0.18)',
        grass: '#1b1740',
        accent: '#c46bff',
        accent2: '#5cf0ff',
        glow: '#ff62c4',
        beam: 'rgba(255, 208, 122, 0.8)'
      }
    }
  ];

  // Hunter rings must stay clear of the player ring, which is tinted with each
  // map's `glow` (orange on maps 1–2, magenta on map 3). The third tint only
  // appears on map 3, so it can stay warm.
  const ENEMY_TINTS = [
    { primary: '#ff3b5c', secondary: '#ff8fa6' },
    { primary: '#2fd9b8', secondary: '#8ff6e6' },
    { primary: '#ffab2e', secondary: '#ffd79a' }
  ];

  const BUILDINGS = {
    2: [
      { key: 'cottage', style: 'house', r: 46, h: 64, points: 85, name: '小屋' },
      { key: 'diner', style: 'shop', r: 44, h: 72, points: 90, name: '小餐馆' },
      { key: 'clinic', style: 'modern', r: 48, h: 82, points: 100, name: '诊所' }
    ],
    3: [
      { key: 'house', style: 'house', r: 56, h: 96, points: 160, name: '住宅' },
      { key: 'boutique', style: 'shop', r: 62, h: 118, points: 190, name: '商店' },
      { key: 'workshop', style: 'warehouse', r: 68, h: 88, points: 210, name: '工坊' }
    ],
    4: [
      { key: 'lowrise', style: 'modern', r: 80, h: 172, points: 360, name: '矮楼' },
      { key: 'apartment', style: 'modern', r: 90, h: 214, points: 430, name: '公寓' },
      { key: 'mall', style: 'mall', r: 96, h: 122, points: 400, name: '商场' }
    ],
    5: [
      { key: 'midrise', style: 'glass', r: 104, h: 282, points: 800, name: '中塔' },
      { key: 'office', style: 'modern', r: 116, h: 328, points: 950, name: '写字楼' }
    ],
    6: [
      { key: 'hotel', style: 'artdeco', r: 132, h: 418, points: 1300, name: '酒店' },
      { key: 'towerb', style: 'glass', r: 148, h: 498, points: 1600, name: '观光塔' }
    ],
    7: [
      { key: 'skyscraper', style: 'glass', r: 164, h: 596, points: 2300, name: '摩天楼' },
      { key: 'landmark', style: 'landmark', r: 182, h: 676, points: 2800, name: '地标塔' }
    ]
  };

  const PROPS = {
    person: { r: 7, h: 30, points: 6, style: 'person' },
    trash: { r: 10, h: 24, points: 7, style: 'trash' },
    cone: { r: 6, h: 15, points: 4, style: 'cone' },
    hydrant: { r: 7, h: 18, points: 5, style: 'hydrant' },
    mailbox: { r: 8, h: 24, points: 6, style: 'mailbox' },
    bench: { r: 15, h: 14, points: 9, style: 'bench' },
    lamp: { r: 6, h: 58, points: 8, style: 'lamp' },
    planter: { r: 16, h: 22, points: 12, style: 'planter' },
    bush: { r: 13, h: 30, points: 12, style: 'bush' },
    tree: { r: 22, h: 72, points: 28, style: 'tree' },
    car: { r: 26, h: 24, points: 35, style: 'car' },
    van: { r: 30, h: 32, points: 42, style: 'van' },
    dumpster: { r: 20, h: 30, points: 18, style: 'dumpster' },
    bus: { r: 38, h: 38, points: 70, style: 'bus' },
    kiosk: { r: 34, h: 48, points: 76, style: 'kiosk' },
    fountain: { r: 44, h: 28, points: 100, style: 'fountain' },
    statue: { r: 35, h: 82, points: 90, style: 'statue' },
    barrel: { r: 9, h: 22, points: 8, style: 'barrel' },
    container: { r: 30, h: 38, points: 58, style: 'container' },
    crane: { r: 54, h: 244, points: 340, style: 'crane' },
    holo: { r: 24, h: 120, points: 78, style: 'holo' }
  };

  const SMALL_POOL = ['person', 'trash', 'cone', 'hydrant', 'mailbox', 'bench', 'lamp', 'planter'];
  const GREEN_POOL = ['tree', 'bush', 'planter', 'tree', 'bush'];
  const VEHICLE_POOL = ['car', 'car', 'car', 'van', 'bus'];

  const PREF_DEFAULT = { sound: true, map: 0 };
  const prefs = Object.assign({}, PREF_DEFAULT, loadJSON(PREF_KEY, {}));
  const records = Object.assign({}, loadJSON(RECORD_KEY, {}));

  // ============================================================
  // Sound
  // ============================================================
  class SoundEngine {
    constructor() {
      this.ctx = null;
      this.master = null;
      this.enabled = prefs.sound !== false;
      this.lastEat = 0;
    }

    init() {
      if (!this.enabled) return;
      try {
        if (!this.ctx) {
          const AC = window.AudioContext || window.webkitAudioContext;
          if (!AC) return;
          this.ctx = new AC();
          this.master = this.ctx.createGain();
          this.master.gain.value = 0.16;
          this.master.connect(this.ctx.destination);
        }
        if (this.ctx.state === 'suspended') this.ctx.resume();
      } catch (err) {
        this.ctx = null;
      }
    }

    tone(freq, duration, type, volume, slideTo) {
      if (!this.enabled) return;
      this.init();
      if (!this.ctx || !this.master) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type || 'sine';
      osc.frequency.setValueAtTime(freq, now);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), now + duration);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, volume), now + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
      osc.connect(gain);
      gain.connect(this.master);
      osc.start(now);
      osc.stop(now + duration + 0.03);
    }

    eat(size) {
      if (!this.enabled) return;
      const now = performance.now();
      if (now - this.lastEat < 36) return;
      this.lastEat = now;
      const pitch = clamp(560 - size * 2.5, 120, 540);
      this.tone(pitch + Math.random() * 40, 0.095, 'sine', 0.055, pitch * 0.55);
      if (size > 24) this.tone(86 + Math.random() * 18, 0.2, 'triangle', 0.04, 48);
    }

    levelUp() {
      if (!this.enabled) return;
      [0, 90, 180, 300].forEach((delay, i) => {
        window.setTimeout(() => this.tone(330 * Math.pow(1.26, i), 0.24, 'triangle', 0.07, 660), delay);
      });
    }

    danger() {
      if (!this.enabled) return;
      this.tone(145, 0.22, 'sawtooth', 0.035, 92);
    }

    win() {
      if (!this.enabled) return;
      [0, 140, 280, 440, 650].forEach((delay, i) => {
        window.setTimeout(() => this.tone([262, 330, 392, 523, 659][i], 0.48, 'triangle', 0.075, 0), delay);
      });
    }

    lose() {
      if (!this.enabled) return;
      this.tone(210, 0.8, 'sawtooth', 0.06, 48);
      this.tone(104, 1.05, 'triangle', 0.04, 32);
    }

    click() {
      if (!this.enabled) return;
      this.tone(720, 0.05, 'sine', 0.035, 540);
    }
  }

  const sound = new SoundEngine();

  // ============================================================
  // DOM
  // ============================================================
  const $ = (id) => document.getElementById(id);
  const dom = {
    canvas: $('game'),
    hud: $('hud'),
    levelOrb: $('level-orb'),
    hudLevel: $('hud-level'),
    hudLevelName: $('hud-level-name'),
    hudScore: $('hud-score'),
    hudNext: $('hud-next'),
    xpFill: $('xp-fill'),
    hudTimer: $('hud-timer'),
    hudBest: $('hud-best'),
    hudMap: $('hud-map'),
    objectiveLevel: $('objective-level'),
    objectiveDistance: $('objective-distance'),
    objectiveState: $('objective-state'),
    threatPanel: $('threat-panel'),
    threatText: $('threat-text'),
    threatDistance: $('threat-distance'),
    minimap: $('minimap'),
    minimapMap: $('minimap-map'),
    menu: $('screen-menu'),
    pause: $('screen-pause'),
    result: $('screen-result'),
    btnStart: $('btn-start'),
    btnPause: $('btn-pause'),
    btnSound: $('btn-sound'),
    btnResume: $('btn-resume'),
    btnPauseRestart: $('btn-pause-restart'),
    btnPauseMenu: $('btn-pause-menu'),
    pauseLevel: $('pause-level'),
    pauseTime: $('pause-time'),
    resultCard: document.querySelector('.result-card'),
    resultKicker: $('result-kicker'),
    resultEmblem: $('result-emblem'),
    resultTitle: $('result-title'),
    resultSub: $('result-sub'),
    resultLevel: $('result-level'),
    resultScore: $('result-score'),
    resultTime: $('result-time'),
    resultBest: $('result-best'),
    newRecord: $('new-record'),
    btnResultNext: $('btn-result-next'),
    btnResultRetry: $('btn-result-retry'),
    btnResultMenu: $('btn-result-menu'),
    toastLayer: $('toast-layer'),
    levelup: $('levelup'),
    levelupLevel: $('levelup-level'),
    levelupText: $('levelup-text'),
    hint: $('hint')
  };

  // The main drawing context. It is temporarily swapped while baking the
  // static ground layer into an offscreen canvas (see buildGroundCache).
  let ctx = dom.canvas.getContext('2d');
  const miniCtx = dom.minimap.getContext('2d');
  const mapCards = Array.from(document.querySelectorAll('.map-card'));

  let W = window.innerWidth;
  let H = window.innerHeight;
  let DPR = 1;
  let viewScale = 1;
  let needsRender = true;

  // Canvas 2D is fill-rate bound on high-DPI displays, so cap the backing
  // store at a ~1.9 MP budget instead of trusting devicePixelRatio blindly.
  function preferredDPR() {
    const raw = window.devicePixelRatio || 1;
    const budget = 1900000;
    const adaptive = Math.sqrt(budget / Math.max(1, W * H));
    return Math.max(1, Math.min(raw, 1.5, adaptive));
  }

  function resize() {
    W = window.innerWidth;
    H = window.innerHeight;
    DPR = preferredDPR();
    dom.canvas.width = Math.round(W * DPR);
    dom.canvas.height = Math.round(H * DPR);
    dom.canvas.style.width = W + 'px';
    dom.canvas.style.height = H + 'px';
    viewScale = clamp(Math.min(W / 1280, H / 800), 0.72, 1.12);
    if (game.camera) {
      game.camera.zoom = getTargetZoom(game.player);
    }
    needsRender = true;
  }

  window.addEventListener('resize', resize);

  // ============================================================
  // State
  // ============================================================
  const game = {
    mode: 'menu',
    selectedMap: clamp(Number(prefs.map) || 0, 0, MAPS.length - 1),
    map: null,
    world: null,
    player: null,
    enemies: [],
    killer: null,
    tower: null,
    camera: { x: 0, y: 0, zoom: 1, shake: 0, shakeX: 0, shakeY: 0 },
    objects: [],
    effects: [],
    particles: [],
    floaters: [],
    runTime: 0,
    finalTime: 0,
    levelUpCooldown: 0,
    lastHintAt: -99,
    lastDangerBeep: -99,
    deathTimer: 0,
    winTimer: 0,
    stateTime: 0,
    hudClock: 0,
    minimapClock: 0,
    result: null,
    timeNow: 0,
    started: false,
    toastTimers: []
  };

  // ============================================================
  // Map generation
  // ============================================================
  let nextObjectId = 1;

  function getGrid(def) {
    const xs = [];
    const ys = [];
    for (let c = 0; c <= def.cols; c++) xs.push(def.margin + c * def.blockW);
    for (let r = 0; r <= def.rows; r++) ys.push(def.margin + r * def.blockH);
    const width = 2 * def.margin + def.cols * def.blockW;
    const height = 2 * def.margin + def.rows * def.blockH;
    const blocks = [];
    for (let row = 0; row < def.rows; row++) {
      for (let col = 0; col < def.cols; col++) {
        const x1 = xs[col] + def.roadW / 2 + 15;
        const x2 = xs[col + 1] - def.roadW / 2 - 15;
        const y1 = ys[row] + def.roadW / 2 + 15;
        const y2 = ys[row + 1] - def.roadW / 2 - 15;
        blocks.push({
          row, col,
          x1, y1, x2, y2,
          cx: (x1 + x2) / 2,
          cy: (y1 + y2) / 2,
          w: x2 - x1,
          h: y2 - y1
        });
      }
    }
    return { xs, ys, width, height, blocks };
  }

  function makeBuilding(template, x, y, def, rng) {
    const theme = def.theme || {};
    const hueBase = theme.hueBase == null ? 205 : theme.hueBase;
    const hueSpread = theme.hueSpread == null ? 80 : theme.hueSpread;
    const hue = hueBase + (rng() * hueSpread - hueSpread / 2);
    return {
      id: nextObjectId++,
      kind: 'building',
      typeKey: template.key,
      name: template.name,
      style: template.style,
      x, y,
      r: template.r,
      h: template.h,
      points: template.points,
      hue,
      seed: 1 + ((rng() * 99999) | 0),
      neon: rng() < 0.28 ? def.palette.accent2 : def.palette.accent,
      glassTint: theme.glassTint || '#4aa6dc',
      windowWarm: theme.windowWarm == null ? 56 : theme.windowWarm,
      eaten: false,
      goal: false,
      angle: 0
    };
  }

  function makeProp(typeKey, x, y, rng, home) {
    const t = PROPS[typeKey];
    const hues = {
      person: [188, 28, 44, 12, 320],
      car: [4, 198, 42, 125, 286, 38],
      van: [205, 30, 220],
      bus: [48, 8, 196],
      tree: [110, 138, 92],
      bush: [126, 142, 104],
      fountain: [191],
      statue: [44],
      barrel: [16, 42, 205],
      container: [18, 36, 196, 150],
      crane: [30, 205],
      holo: [286, 196, 322]
    };
    const hueArr = hues[typeKey] || [210];
    return {
      id: nextObjectId++,
      kind: 'prop',
      typeKey,
      style: t.style,
      x, y,
      ox: home ? x : 0,
      oy: home ? y : 0,
      r: t.r,
      h: t.h,
      points: t.points,
      hue: hueArr[(rng() * hueArr.length) | 0] + (rng() * 22 - 11),
      seed: 1 + ((rng() * 99999) | 0),
      phase: rng() * TAU,
      moving: typeKey === 'person',
      walkAngle: rng() * TAU,
      walkTimer: rng() * 4,
      bob: rng() * TAU,
      angle: typeKey === 'car' || typeKey === 'van' || typeKey === 'bus' ? (rng() < 0.5 ? 0 : Math.PI) : 0,
      eaten: false,
      goal: false
    };
  }

  function generateMap(def) {
    const rng = mulberry32(def.seed);
    const grid = getGrid(def);
    const objects = [];
    const occupied = [];
    const reserved = [];
    const theme = def.theme || {};
    const smallPool = theme.smallPool || SMALL_POOL;
    const greenPool = theme.greenPool || GREEN_POOL;
    const vehiclePool = theme.vehiclePool || VEHICLE_POOL;

    const towerBlock = grid.blocks[def.towerRow * def.cols + def.towerCol];
    const spawnBlock = grid.blocks[def.spawnRow * def.cols + def.spawnCol];
    const spawn = { x: spawnBlock.cx, y: spawnBlock.cy + spawnBlock.h * 0.08 };
    const tower = {
      id: nextObjectId++,
      kind: 'goal',
      typeKey: 'goalTower',
      name: '30层高塔',
      style: 'goal',
      x: towerBlock.cx,
      y: towerBlock.cy + 20,
      r: 196,
      h: 760,
      points: 0,
      seed: 93517,
      hue: 38,
      eaten: false,
      goal: true,
      unlocked: false,
      angle: 0
    };
    objects.push(tower);
    occupied.push({ x: tower.x, y: tower.y, r: tower.r + 32 });
    reserved.push({ x: tower.x, y: tower.y, r: 242 });
    reserved.push({ x: spawn.x, y: spawn.y, r: 50 });

    const candidates = grid.blocks.filter((b) => b !== towerBlock && b !== spawnBlock);
    candidates.sort((a, b) => {
      const da = dist2(a.cx, a.cy, spawn.x, spawn.y);
      const db = dist2(b.cx, b.cy, spawn.x, spawn.y);
      return da - db;
    });

    const isFree = (x, y, r, padding) => {
      const p = padding == null ? 10 : padding;
      for (let i = 0; i < occupied.length; i++) {
        const o = occupied[i];
        if (dist2(x, y, o.x, o.y) < (r + o.r + p) * (r + o.r + p)) return false;
      }
      for (let i = 0; i < reserved.length; i++) {
        const o = reserved[i];
        if (dist2(x, y, o.x, o.y) < (r + o.r + p) * (r + o.r + p)) return false;
      }
      return true;
    };

    const addBuilding = (template, block, tierIndex) => {
      let x = block.cx;
      let y = block.cy;
      const jx = Math.max(0, block.w / 2 - template.r - 24);
      const jy = Math.max(0, block.h / 2 - template.r - 24);
      for (let attempt = 0; attempt < 18; attempt++) {
        const tx = block.cx + (rng() * 2 - 1) * jx * 0.62;
        const ty = block.cy + (rng() * 2 - 1) * jy * 0.62;
        if (isFree(tx, ty, template.r, 14)) {
          x = tx;
          y = ty;
          break;
        }
      }
      if (!isFree(x, y, template.r, 12)) return null;
      const building = makeBuilding(template, x, y, def, rng);
      building.tierIndex = tierIndex;
      objects.push(building);
      occupied.push({ x, y, r: template.r });
      return building;
    };

    // Major buildings — lowest tiers near spawn, landmarks farther away.
    const usedBlocks = [];
    const majorCount = Math.min(candidates.length, def.majorTiers.length);
    for (let i = 0; i < majorCount; i++) {
      const block = candidates[i];
      const tier = def.majorTiers[Math.min(i, def.majorTiers.length - 1)];
      const roster = BUILDINGS[tier];
      const template = roster[(rng() * roster.length) | 0];
      const b = addBuilding(template, block, tier);
      if (b) usedBlocks.push({ block, main: b });
    }

    // Minor buildings fill empty corners and make the map feel dense.
    let minorIndex = 0;
    for (let i = 0; i < usedBlocks.length && minorIndex < def.minorTiers.length; i++) {
      const entry = usedBlocks[i];
      if (entry.main.r > 102) continue;
      const tier = def.minorTiers[minorIndex++];
      const roster = BUILDINGS[tier];
      const template = roster[(rng() * roster.length) | 0];
      const block = entry.block;
      const corners = [
        { x: block.cx - block.w * 0.25, y: block.cy - block.h * 0.25 },
        { x: block.cx + block.w * 0.25, y: block.cy - block.h * 0.25 },
        { x: block.cx - block.w * 0.25, y: block.cy + block.h * 0.25 },
        { x: block.cx + block.w * 0.25, y: block.cy + block.h * 0.25 }
      ];
      for (let k = 0; k < 4; k++) {
        const c = corners[(k + i) % 4];
        if (isFree(c.x, c.y, template.r, 12)) {
          const b = makeBuilding(template, c.x, c.y, def, rng);
          objects.push(b);
          occupied.push({ x: c.x, y: c.y, r: template.r });
          break;
        }
      }
    }

    // General props inside blocks.
    const addProp = (typeKey, x, y, padding) => {
      const t = PROPS[typeKey];
      if (!isFree(x, y, t.r, padding == null ? 8 : padding)) return null;
      const p = makeProp(typeKey, x, y, rng, true);
      objects.push(p);
      occupied.push({ x, y, r: t.r });
      return p;
    };

    for (let i = 0; i < grid.blocks.length; i++) {
      const block = grid.blocks[i];
      if (block === spawnBlock) continue;
      const smallCount = def.scatter.small + ((rng() * 3) | 0);
      for (let k = 0; k < smallCount; k++) {
        const type = smallPool[(rng() * smallPool.length) | 0];
        const r = PROPS[type].r;
        for (let attempt = 0; attempt < 8; attempt++) {
          const x = block.x1 + r + 8 + rng() * (block.w - r * 2 - 16);
          const y = block.y1 + r + 8 + rng() * (block.h - r * 2 - 16);
          if (addProp(type, x, y, 4)) break;
        }
      }
      const greenCount = def.scatter.green + (rng() < 0.45 ? 1 : 0);
      for (let k = 0; k < greenCount; k++) {
        const type = greenPool[(rng() * greenPool.length) | 0];
        const r = PROPS[type].r;
        for (let attempt = 0; attempt < 10; attempt++) {
          const x = block.x1 + r + 10 + rng() * (block.w - r * 2 - 20);
          const y = block.y1 + r + 10 + rng() * (block.h - r * 2 - 20);
          if (addProp(type, x, y, 6)) break;
        }
      }
      if (rng() < 0.42) {
        const type = rng() < 0.14 ? 'fountain' : (rng() < 0.5 ? 'kiosk' : 'statue');
        const r = PROPS[type].r;
        for (let attempt = 0; attempt < 8; attempt++) {
          const x = block.x1 + r + 12 + rng() * (block.w - r * 2 - 24);
          const y = block.y1 + r + 12 + rng() * (block.h - r * 2 - 24);
          if (addProp(type, x, y, 8)) break;
        }
      }
    }

    // A starter ring of tiny snacks around the spawn plaza.
    const starterTypes = ['person', 'person', 'trash', 'cone', 'hydrant', 'mailbox', 'bench', 'person', 'trash', 'planter', 'person', 'lamp', 'bench', 'trash', 'person', 'cone'];
    for (let i = 0; i < starterTypes.length; i++) {
      const angle = (i / starterTypes.length) * TAU + rng() * 0.35;
      const radius = 64 + rng() * 122;
      const x = clamp(spawn.x + Math.cos(angle) * radius, 30, grid.width - 30);
      const y = clamp(spawn.y + Math.sin(angle) * radius, 30, grid.height - 30);
      addProp(starterTypes[i], x, y, 2);
    }

    // A few early vehicles/trees just outside the plaza.
    const early = [['tree', 0.3], ['car', 0.45], ['tree', 0.7], ['van', 1.2], ['car', 1.7], ['tree', 2.2]];
    for (let i = 0; i < early.length; i++) {
      const a = early[i][1] * Math.PI + rng() * 0.5;
      const radius = 245 + rng() * 130;
      const type = early[i][0];
      const x = clamp(spawn.x + Math.cos(a + 1.2) * radius, 40, grid.width - 40);
      const y = clamp(spawn.y + Math.sin(a + 1.2) * radius * 0.82, 40, grid.height - 40);
      addProp(type, x, y, 4);
    }

    // Parked / moving-looking vehicles along the road grid.
    for (let c = 0; c <= def.cols; c++) {
      for (let r = 0; r < def.rows; r++) {
        if (rng() < 0.28) continue;
        const y = grid.ys[r] + def.roadW * 0.55 + rng() * (def.blockH - def.roadW * 1.1);
        const x = grid.xs[c] + (rng() < 0.5 ? -1 : 1) * def.roadW * 0.23;
        const type = vehiclePool[(rng() * vehiclePool.length) | 0];
        const p = addProp(type, x, y, 3);
        if (p) p.angle = rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2;
      }
    }
    for (let r = 0; r <= def.rows; r++) {
      for (let c = 0; c < def.cols; c++) {
        if (rng() < 0.34) continue;
        const x = grid.xs[c] + def.roadW * 0.55 + rng() * (def.blockW - def.roadW * 1.1);
        const y = grid.ys[r] + (rng() < 0.5 ? -1 : 1) * def.roadW * 0.23;
        const type = vehiclePool[(rng() * vehiclePool.length) | 0];
        const p = addProp(type, x, y, 3);
        if (p) p.angle = rng() < 0.5 ? 0 : Math.PI;
      }
    }

    // A couple of pedestrians on the plaza.
    for (let i = 0; i < 4; i++) {
      const angle = rng() * TAU;
      const radius = 60 + rng() * 115;
      addProp('person', spawn.x + Math.cos(angle) * radius, spawn.y + Math.sin(angle) * radius, 2);
    }

    // Theme landmarks: harbor cranes and shipping containers, sky holo pylons.
    const decor = theme.decor || [];
    for (let d = 0; d < decor.length; d++) {
      const entry = decor[d];
      const spec = PROPS[entry.type];
      if (!spec) continue;
      let placed = 0;
      for (let attempt = 0; attempt < 260 && placed < entry.count; attempt++) {
        const block = candidates[(rng() * candidates.length) | 0];
        const x = block.x1 + spec.r + 12 + rng() * Math.max(0, block.w - spec.r * 2 - 24);
        const y = block.y1 + spec.r + 12 + rng() * Math.max(0, block.h - spec.r * 2 - 24);
        if (addProp(entry.type, x, y, entry.type === 'crane' ? 56 : 12)) placed++;
      }
    }

    const enemySpawns = pickEnemySpawns(def, grid, spawn, tower, def.hunters || 1);

    return {
      def,
      grid,
      objects,
      spawn,
      tower,
      enemySpawns,
      width: grid.width,
      height: grid.height,
      palette: def.palette
    };
  }

  function pickEnemySpawns(def, grid, spawn, tower, count) {
    const total = Math.max(1, count || 1);
    const baseAngle = -1.9 + (def.id * 0.55);
    const out = [];
    for (let i = 0; i < total; i++) {
      let spot = null;
      for (let attempt = 0; attempt < 48; attempt++) {
        const angle = baseAngle + (i * TAU) / total + (Math.random() * 0.9 - 0.45);
        const radius = def.enemySpawnDist * (0.88 + Math.random() * 0.3);
        const x = clamp(spawn.x + Math.cos(angle) * radius, 170, grid.width - 170);
        const y = clamp(spawn.y + Math.sin(angle) * radius, 170, grid.height - 170);
        if (dist(x, y, spawn.x, spawn.y) < 620) continue;
        if (dist(x, y, tower.x, tower.y) < 340) continue;
        if (out.some((o) => dist2(o.x, o.y, x, y) < 560 * 560)) continue;
        spot = { x, y };
        break;
      }
      if (!spot) {
        const angle = baseAngle + (i * TAU) / total + 0.35;
        spot = {
          x: clamp(spawn.x + Math.cos(angle) * def.enemySpawnDist, 170, grid.width - 170),
          y: clamp(spawn.y + Math.sin(angle) * def.enemySpawnDist, 170, grid.height - 170)
        };
      }
      out.push(spot);
    }
    return out;
  }

  // ============================================================
  // Player / enemy helpers
  // ============================================================
  function levelForScore(score) {
    let level = 1;
    for (let i = 1; i < LEVEL_THRESHOLDS.length; i++) {
      if (score >= LEVEL_THRESHOLDS[i]) level = i + 1;
      else break;
    }
    return Math.min(level, MAX_LEVEL);
  }

  function targetRadiusForScore(score, level) {
    const idx = Math.min(level, MAX_LEVEL) - 1;
    if (idx >= MAX_LEVEL - 1) return LEVEL_RADII[MAX_LEVEL - 1];
    const base = LEVEL_RADII[idx];
    const next = LEVEL_RADII[idx + 1];
    const a = LEVEL_THRESHOLDS[idx];
    const b = LEVEL_THRESHOLDS[idx + 1];
    const p = clamp((score - a) / Math.max(1, b - a), 0, 1);
    return base + (next - base) * p * 0.55;
  }

  function getTargetZoom(player) {
    if (!player) return 1;
    const screenRadius = 30 + (player.level - 1) * 3.5;
    return clamp(screenRadius / Math.max(20, player.targetRadius || player.radius), 0.36, 1.75) * viewScale;
  }

  function createPlayer(spawn) {
    return {
      x: spawn.x,
      y: spawn.y,
      vx: 0,
      vy: 0,
      radius: LEVEL_RADII[0],
      targetRadius: LEVEL_RADII[0],
      level: 1,
      score: 0,
      eatenCount: 0,
      angle: 0,
      pulse: 0,
      flash: 0,
      beingEaten: false,
      swallowed: 0
    };
  }

  function createEnemy(spawn, level, def, index) {
    const tint = ENEMY_TINTS[index % ENEMY_TINTS.length];
    return {
      x: spawn.x,
      y: spawn.y,
      vx: 0,
      vy: 0,
      radius: LEVEL_RADII[level - 1],
      targetRadius: LEVEL_RADII[level - 1],
      level,
      angle: Math.PI,
      pulse: 0,
      flash: 0,
      waypoint: null,
      retarget: 0,
      speedFactor: def.enemySpeed,
      index: index || 0,
      tint: tint.primary,
      tint2: tint.secondary,
      beingEaten: false,
      swallowed: 0,
      frozen: false
    };
  }

  // ============================================================
  // UI, lifecycle & persistance
  // ============================================================
  let hintTimer = 0;
  let levelupTimer = 0;

  function bestForMap(id) {
    const v = Number(records[id]);
    return Number.isFinite(v) && v > 0 ? v : null;
  }

  function updateMenuRecords() {
    mapCards.forEach((card) => {
      const id = Number(card.dataset.map);
      const best = bestForMap(id);
      const label = card.querySelector(`[data-best="${id}"]`);
      if (label) label.textContent = best ? formatTime(best) : '尚无记录';
    });
  }

  function selectMap(id) {
    game.selectedMap = clamp(Number(id) || 0, 0, MAPS.length - 1);
    prefs.map = game.selectedMap;
    saveJSON(PREF_KEY, prefs);
    mapCards.forEach((card) => {
      const active = Number(card.dataset.map) === game.selectedMap;
      card.classList.toggle('is-selected', active);
      card.setAttribute('aria-checked', active ? 'true' : 'false');
    });
  }

  function setHUDVisible(visible) {
    dom.hud.classList.toggle('is-hidden', !visible);
  }

  function hideAllScreens() {
    dom.menu.classList.add('is-hidden');
    dom.pause.classList.add('is-hidden');
    dom.result.classList.add('is-hidden');
  }

  function updateSoundButton() {
    document.body.classList.toggle('sound-off', !sound.enabled);
    dom.btnSound.setAttribute('aria-label', sound.enabled ? '关闭声音' : '开启声音');
    dom.btnSound.title = sound.enabled ? '关闭声音' : '开启声音';
  }

  function toggleSound() {
    sound.enabled = !sound.enabled;
    prefs.sound = sound.enabled;
    saveJSON(PREF_KEY, prefs);
    updateSoundButton();
    if (sound.enabled) {
      sound.init();
      sound.click();
    }
  }

  function showToast(text, tone, duration) {
    const el = document.createElement('div');
    el.className = 'toast' + (tone ? ' ' + tone : '');
    const mark = document.createElement('span');
    mark.className = 'toast-mark';
    mark.textContent = tone === 'danger' ? '!' : tone === 'cyan' ? '↯' : '✦';
    const content = document.createElement('span');
    content.textContent = text;
    el.appendChild(mark);
    el.appendChild(content);
    dom.toastLayer.appendChild(el);
    while (dom.toastLayer.children.length > 3) {
      dom.toastLayer.removeChild(dom.toastLayer.firstChild);
    }
    const life = duration == null ? 3000 : duration;
    if (life > 0) {
      window.setTimeout(() => {
        el.classList.add('is-out');
        window.setTimeout(() => el.remove(), 300);
      }, life);
    }
    return el;
  }

  function showLevelUp(level) {
    dom.levelupLevel.textContent = String(level);
    if (level >= 15) dom.levelupText.textContent = '最终形态 · 30层高塔解锁';
    else if (level >= 11) dom.levelupText.textContent = '反杀时刻 · 猎手不再是威胁';
    else dom.levelupText.textContent = '事件视界扩张';
    dom.levelup.classList.remove('show');
    void dom.levelup.offsetWidth;
    dom.levelup.classList.add('show');
    window.clearTimeout(levelupTimer);
    levelupTimer = window.setTimeout(() => dom.levelup.classList.remove('show'), 1800);
    dom.levelOrb.classList.remove('level-pulse');
    void dom.levelOrb.offsetWidth;
    dom.levelOrb.classList.add('level-pulse');
  }

  function showHint() {
    dom.hint.classList.remove('is-hidden');
    window.clearTimeout(hintTimer);
    hintTimer = window.setTimeout(() => hideHint(), 6800);
  }

  function hideHint() {
    window.clearTimeout(hintTimer);
    dom.hint.classList.add('is-hidden');
  }

  function updateHUD() {
    if (!game.player) return;
    const p = game.player;
    const idx = Math.min(p.level, MAX_LEVEL) - 1;
    const currentNeed = LEVEL_THRESHOLDS[idx];
    const nextNeed = p.level >= MAX_LEVEL ? currentNeed : LEVEL_THRESHOLDS[idx + 1];
    const progress = p.level >= MAX_LEVEL
      ? 100
      : clamp((p.score - currentNeed) / Math.max(1, nextNeed - currentNeed), 0, 1) * 100;

    dom.hudLevel.textContent = String(p.level);
    dom.hudLevelName.textContent = `LV.${p.level}`;
    dom.hudScore.textContent = `积分 ${fmtInt(p.score)}`;
    dom.hudNext.textContent = p.level >= MAX_LEVEL
      ? 'MAX LEVEL'
      : `${fmtInt(Math.max(0, p.score - currentNeed))} / ${fmtInt(nextNeed - currentNeed)}`;
    dom.xpFill.style.width = progress.toFixed(1) + '%';
    dom.levelOrb.style.setProperty('--pct', progress.toFixed(1));
    dom.hudTimer.textContent = formatTime(game.runTime);
    const best = bestForMap(game.selectedMap);
    dom.hudBest.textContent = best ? formatTime(best) : '--:--.-';
    dom.hudMap.textContent = `${pad2(game.selectedMap + 1)} · ${MAPS[game.selectedMap].name}`;
    dom.minimapMap.textContent = pad2(game.selectedMap + 1);

    if (game.tower) {
      const goalDist = dist(p.x, p.y, game.tower.x, game.tower.y);
      dom.objectiveDistance.textContent = `高塔 ${fmtDist(goalDist)}`;
      if (p.level >= MAX_LEVEL) {
        dom.objectiveLevel.textContent = '目标已解锁';
        dom.objectiveState.textContent = '冲进高塔底部，完成吞噬';
      } else {
        dom.objectiveLevel.textContent = `目标 LV.${MAX_LEVEL}`;
        if (p.level >= 11) dom.objectiveState.textContent = game.enemies.length ? '你已比猎手更大，可以反杀' : '猎手已被吞噬，专注高塔';
        else if (p.level >= 8) dom.objectiveState.textContent = '继续扩张，甩开猎手';
        else dom.objectiveState.textContent = '先吃小东西，慢慢变大';
      }
    }

    const alive = game.enemies.filter((e) => !e.beingEaten);
    if (alive.length) {
      let nearest = alive[0];
      let nearestDist = dist(p.x, p.y, nearest.x, nearest.y);
      for (let i = 1; i < alive.length; i++) {
        const d = dist(p.x, p.y, alive[i].x, alive[i].y);
        if (d < nearestDist) {
          nearest = alive[i];
          nearestDist = d;
        }
      }
      dom.threatPanel.classList.toggle('is-safe', p.level >= 11);
      if (p.level >= 11) {
        dom.threatText.textContent = alive.length > 1 ? `可反杀猎手 ×${alive.length}` : '可反杀猎手';
      } else if (nearestDist < 420) {
        dom.threatText.textContent = alive.length > 1 ? `猎手 ×${alive.length} 正在靠近` : '猎手正在靠近';
      } else {
        dom.threatText.textContent = alive.length > 1 ? `猎手 ×${alive.length} 游荡中` : `猎手 LV.${nearest.level} 游荡中`;
      }
      dom.threatDistance.textContent = fmtDist(nearestDist);
      dom.threatPanel.classList.remove('is-hidden');
    } else {
      dom.threatPanel.classList.add('is-hidden');
    }
  }

  function startGame(mapId) {
    const id = clamp(Number(mapId), 0, MAPS.length - 1);
    game.selectedMap = id;
    selectMap(id);
    sound.init();
    sound.click();

    hideAllScreens();
    hideHint();
    window.clearTimeout(hintTimer);
    dom.toastLayer.innerHTML = '';
    dom.toastLayer.classList.remove('is-hidden');
    dom.levelup.classList.remove('show');

    const world = generateMap(MAPS[id]);
    const player = createPlayer(world.spawn);
    const enemyLevel = Math.min(10, player.level + 3);
    const enemies = world.enemySpawns.map((sp, i) => createEnemy(sp, enemyLevel, MAPS[id], i));

    game.map = MAPS[id];
    game.world = world;
    game.objects = world.objects;
    game.tower = world.tower;
    game.player = player;
    game.enemies = enemies;
    game.killer = null;
    game.effects = [];
    game.particles = [];
    game.floaters = [];
    game.camera.x = player.x;
    game.camera.y = player.y;
    game.camera.zoom = getTargetZoom(player);
    game.camera.shake = 0;
    game.camera.shakeX = 0;
    game.camera.shakeY = 0;
    game.runTime = 0;
    game.finalTime = 0;
    game.stateTime = 0;
    game.hudClock = 0;
    game.minimapClock = 0;
    game.deathTimer = 0;
    game.winTimer = 0;
    game.levelUpCooldown = 0;
    game.lastHintAt = -99;
    game.lastDangerBeep = -99;
    game.result = null;
    game.mode = 'playing';
    game.started = true;
    needsRender = true;
    // Soft-light film grain is a full-screen blend over the animated canvas;
    // it is by far the most expensive compositing layer. Keep it on static
    // screens only so the action stays smooth.
    document.body.classList.add('is-playing');

    setHUDVisible(true);
    updateSoundButton();
    updateHUD();
    drawMinimap();

    window.setTimeout(() => {
      if (game.mode === 'playing') showHint();
    }, 600);
    window.setTimeout(() => {
      if (game.mode === 'playing') {
        showToast('吃掉比你小的物体，向 30 层高塔前进。', 'good', 3600);
      }
    }, 950);
    window.setTimeout(() => {
      if (game.mode === 'playing') {
        const label = enemies.length > 1 ? `${enemies.length} 个猎手黑洞 LV.${enemyLevel}` : `猎手黑洞 LV.${enemyLevel}`;
        showToast(`${label} 已进入街区，小心被完全罩住。`, 'danger', 4200);
      }
    }, 3900);
  }

  function pauseGame() {
    if (game.mode !== 'playing') return;
    game.mode = 'paused';
    needsRender = true;
    document.body.classList.remove('is-playing');
    hideHint();
    dom.pauseLevel.textContent = game.player ? `LV.${game.player.level}` : 'LV.1';
    dom.pauseTime.textContent = formatTime(game.runTime);
    dom.toastLayer.classList.add('is-hidden');
    dom.pause.classList.remove('is-hidden');
    if (sound.enabled) sound.click();
  }

  function resumeGame() {
    if (game.mode !== 'paused') return;
    game.mode = 'playing';
    needsRender = true;
    document.body.classList.add('is-playing');
    dom.toastLayer.classList.remove('is-hidden');
    dom.pause.classList.add('is-hidden');
    if (sound.enabled) sound.click();
  }

  function showMenu() {
    game.mode = 'menu';
    game.started = false;
    needsRender = true;
    document.body.classList.remove('is-playing');
    game.world = null;
    game.player = null;
    game.enemies = [];
    game.killer = null;
    game.tower = null;
    game.objects = [];
    game.effects = [];
    game.particles = [];
    game.floaters = [];
    hideHint();
    setHUDVisible(false);
    hideAllScreens();
    dom.menu.classList.remove('is-hidden');
    dom.levelup.classList.remove('show');
    dom.toastLayer.innerHTML = '';
    updateMenuRecords();
    updateSoundButton();
  }

  function finishRun(victory, reason) {
    if (!game.player) return;
    game.mode = victory ? 'victory' : 'gameover';
    needsRender = true;
    document.body.classList.remove('is-playing');
    game.finalTime = game.runTime;
    hideHint();
    const bestBefore = bestForMap(game.selectedMap);
    let isNewRecord = false;
    if (victory) {
      if (bestBefore == null || game.finalTime < bestBefore) {
        records[game.selectedMap] = game.finalTime;
        saveJSON(RECORD_KEY, records);
        isNewRecord = true;
      }
    }
    const best = bestForMap(game.selectedMap);
    game.result = { victory, reason, isNewRecord, best };

    dom.resultCard.classList.toggle('is-loss', !victory);
    dom.resultKicker.textContent = victory ? 'RUN COMPLETE' : 'RUN TERMINATED';
    dom.resultEmblem.textContent = victory ? '◎' : '×';
    dom.resultTitle.textContent = victory ? '吞噬高塔！' : '被猎手吞噬';
    dom.resultSub.textContent = victory
      ? '整座城市的灯光，都落进了你的事件视界。'
      : '你的黑洞被完整罩住。下一次，别让猎手贴得太近。';
    dom.resultLevel.textContent = `LV.${game.player.level}`;
    dom.resultScore.textContent = fmtInt(game.player.score);
    dom.resultTime.textContent = formatTime(game.finalTime);
    dom.resultBest.textContent = best ? formatTime(best) : '--:--.-';
    dom.newRecord.classList.toggle('is-hidden', !isNewRecord);
    dom.btnResultNext.classList.toggle('is-hidden', !victory || game.selectedMap >= MAPS.length - 1);
    dom.result.classList.remove('is-hidden');
    dom.hud.classList.remove('is-hidden');
    dom.toastLayer.classList.add('is-hidden');
    updateMenuRecords();
    updateHUD();
    if (victory) sound.win();
    else sound.lose();
  }

  function restartCurrent() {
    if (game.mode === 'menu') {
      startGame(game.selectedMap);
      return;
    }
    startGame(game.selectedMap);
  }

  function nextMap() {
    if (game.selectedMap < MAPS.length - 1) startGame(game.selectedMap + 1);
  }

  // ============================================================
  // Menu thumbnails
  // ============================================================
  function drawMapThumb(canvas, def) {
    const c = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    const p = def.palette;
    const themeKey = (def.theme && def.theme.key) || 'neon';
    const rng = mulberry32(def.seed ^ 0xa55a5a);

    const bg = c.createLinearGradient(0, 0, w, h);
    bg.addColorStop(0, p.void);
    bg.addColorStop(0.54, p.ground);
    bg.addColorStop(1, p.void);
    c.fillStyle = bg;
    c.fillRect(0, 0, w, h);

    if (themeKey === 'sky') {
      const aurora = c.createLinearGradient(0, 0, 0, h * 0.5);
      aurora.addColorStop(0, 'rgba(180, 110, 255, 0)');
      aurora.addColorStop(0.55, 'rgba(180, 110, 255, 0.14)');
      aurora.addColorStop(1, 'rgba(120, 240, 255, 0)');
      c.fillStyle = aurora;
      c.fillRect(0, 0, w, h * 0.5);
    }

    const glow = c.createRadialGradient(w * 0.72, h * 0.25, 0, w * 0.72, h * 0.25, w * 0.52);
    glow.addColorStop(0, p.accent + '2c');
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = glow;
    c.fillRect(0, 0, w, h);

    for (let i = 0; i < 45; i++) {
      const x = rng() * w;
      const y = rng() * h * 0.7;
      c.globalAlpha = 0.15 + rng() * 0.55;
      c.fillStyle = i % 7 === 0 ? p.accent : '#d8e8ff';
      c.fillRect(x, y, 1 + rng() * 1.4, 1 + rng() * 1.4);
    }
    c.globalAlpha = 1;

    // distant skyline
    c.globalAlpha = 0.34;
    for (let i = 0; i < 28; i++) {
      const bw = 10 + rng() * 28;
      const bh = 14 + rng() * 74;
      const x = rng() * w;
      const y = h * 0.86 - bh;
      c.fillStyle = i % 5 === 0 ? p.accent : p.blockAlt;
      c.fillRect(x, y, bw, bh);
    }
    c.globalAlpha = 1;

    // road
    c.fillStyle = p.road;
    c.fillRect(0, h * 0.78, w, h * 0.12);
    c.fillStyle = p.sidewalk;
    c.fillRect(0, h * 0.75, w, 5);
    c.fillRect(0, h * 0.9, w, 3);
    c.strokeStyle = p.line;
    c.lineWidth = 1.2;
    c.setLineDash([14, 10]);
    c.beginPath();
    c.moveTo(0, h * 0.84);
    c.lineTo(w, h * 0.84);
    c.stroke();
    c.setLineDash([]);

    if (themeKey === 'harbor') {
      const water = c.createLinearGradient(0, h * 0.9, 0, h);
      water.addColorStop(0, '#0b2f34');
      water.addColorStop(1, '#061b21');
      c.fillStyle = water;
      c.fillRect(0, h * 0.9, w, h * 0.1);
      c.strokeStyle = 'rgba(79, 224, 200, 0.22)';
      c.lineWidth = 1;
      for (let i = 0; i < 7; i++) {
        const y = h * 0.92 + i * 4;
        c.beginPath();
        c.moveTo((i * 73) % w, y);
        c.lineTo(((i * 73) % w) + 30 + (i % 3) * 18, y);
        c.stroke();
      }
    }

    // foreground buildings
    for (let i = 0; i < 13; i++) {
      const bw = 22 + rng() * 50;
      const bh = 28 + rng() * 92;
      const x = rng() * w;
      const y = h * 0.88 - bh;
      c.fillStyle = i % 4 === 0 ? p.block : p.blockAlt;
      c.fillRect(x, y, bw, bh);
      const lit = 0.1 + rng() * 0.45;
      c.fillStyle = p.accent;
      c.globalAlpha = lit;
      for (let wy = y + 7; wy < h * 0.87 - 4; wy += 9) {
        for (let wx = x + 5; wx < x + bw - 4; wx += 8) {
          if (rng() > 0.45) c.fillRect(wx, wy, 2.5, 3.5);
        }
      }
      c.globalAlpha = 1;
    }

    // tower beacon
    const tx = w * (0.58 + rng() * 0.2);
    const th = h * 0.57;
    c.fillStyle = '#142238';
    c.fillRect(tx - 10, h * 0.84 - th, 20, th);
    c.fillStyle = p.accent + '55';
    c.fillRect(tx - 3, h * 0.84 - th + 8, 6, th - 15);
    const beam = c.createLinearGradient(0, 0, 0, h * 0.8);
    beam.addColorStop(0, 'rgba(255,214,130,0)');
    beam.addColorStop(0.5, 'rgba(255,214,130,0.14)');
    beam.addColorStop(1, 'rgba(255,214,130,0)');
    c.fillStyle = beam;
    c.fillRect(tx - 2, 0, 4, h * 0.84);
    c.fillStyle = p.beam;
    c.shadowColor = p.beam;
    c.shadowBlur = 14;
    c.beginPath();
    c.arc(tx, h * 0.26, 3.5, 0, TAU);
    c.fill();
    c.shadowBlur = 0;

    // little black hole
    const hx = w * 0.23;
    const hy = h * 0.82;
    c.save();
    c.translate(hx, hy);
    c.scale(1, 0.62);
    const halo = c.createRadialGradient(0, 0, 8, 0, 0, 34);
    halo.addColorStop(0, 'rgba(0,0,0,0)');
    halo.addColorStop(0.48, p.glow + 'bb');
    halo.addColorStop(0.56, p.glow + '44');
    halo.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = halo;
    c.beginPath();
    c.arc(0, 0, 34, 0, TAU);
    c.fill();
    c.fillStyle = '#000';
    c.beginPath();
    c.arc(0, 0, 17, 0, TAU);
    c.fill();
    c.restore();
  }

  function initMenuThumbs() {
    mapCards.forEach((card) => {
      const id = Number(card.dataset.map);
      const canvas = card.querySelector('.map-thumb');
      if (canvas) drawMapThumb(canvas, MAPS[id]);
    });
  }

  // ============================================================
  // Input
  // ============================================================
  const input = {
    keys: new Set(),
    joy: { active: false, id: null, ox: 0, oy: 0, x: 0, y: 0, dx: 0, dy: 0 }
  };

  function movementVector() {
    let x = 0;
    let y = 0;
    if (input.keys.has('ArrowLeft') || input.keys.has('KeyA')) x -= 1;
    if (input.keys.has('ArrowRight') || input.keys.has('KeyD')) x += 1;
    if (input.keys.has('ArrowUp') || input.keys.has('KeyW')) y -= 1;
    if (input.keys.has('ArrowDown') || input.keys.has('KeyS')) y += 1;
    if (input.joy.active) {
      x += input.joy.dx;
      y += input.joy.dy;
    }
    const len = Math.hypot(x, y);
    if (len > 1) {
      x /= len;
      y /= len;
    }
    return { x, y, mag: Math.min(1, len) };
  }

  function resetJoystick() {
    input.joy.active = false;
    input.joy.id = null;
    input.joy.dx = 0;
    input.joy.dy = 0;
  }

  window.addEventListener('keydown', (e) => {
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space'].includes(e.code)) {
      e.preventDefault();
    }
    if (e.repeat) {
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'KeyW', 'KeyA', 'KeyS', 'KeyD'].includes(e.code)) {
        input.keys.add(e.code);
      }
      return;
    }
    if (game.mode === 'menu') {
      if (e.code === 'Enter') {
        startGame(game.selectedMap);
        return;
      }
      if (e.code === 'ArrowLeft' || e.code === 'ArrowUp') {
        selectMap((game.selectedMap + MAPS.length - 1) % MAPS.length);
        return;
      }
      if (e.code === 'ArrowRight' || e.code === 'ArrowDown') {
        selectMap((game.selectedMap + 1) % MAPS.length);
        return;
      }
    }
    if (e.code === 'Escape') {
      if (game.mode === 'playing') pauseGame();
      else if (game.mode === 'paused') resumeGame();
      return;
    }
    if (e.code === 'KeyM') {
      toggleSound();
      return;
    }
    if ((game.mode === 'paused' || game.mode === 'gameover' || game.mode === 'victory') && e.code === 'KeyR') {
      restartCurrent();
      return;
    }
    if (game.mode === 'playing') {
      input.keys.add(e.code);
      if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) hideHint();
    }
  });

  window.addEventListener('keyup', (e) => {
    input.keys.delete(e.code);
  });

  window.addEventListener('blur', () => {
    input.keys.clear();
    resetJoystick();
    if (game.mode === 'playing') pauseGame();
  });

  dom.canvas.addEventListener('pointerdown', (e) => {
    if (game.mode !== 'playing') return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault();
    sound.init();
    input.joy.active = true;
    input.joy.id = e.pointerId;
    input.joy.ox = e.clientX;
    input.joy.oy = e.clientY;
    input.joy.x = e.clientX;
    input.joy.y = e.clientY;
    input.joy.dx = 0;
    input.joy.dy = 0;
    try { dom.canvas.setPointerCapture(e.pointerId); } catch (err) { /* noop */ }
    hideHint();
  });

  window.addEventListener('pointermove', (e) => {
    if (!input.joy.active || e.pointerId !== input.joy.id) return;
    const max = Math.max(46, Math.min(W, H) * 0.085);
    let dx = (e.clientX - input.joy.ox) / max;
    let dy = (e.clientY - input.joy.oy) / max;
    const len = Math.hypot(dx, dy);
    if (len > 1) {
      dx /= len;
      dy /= len;
    }
    input.joy.x = e.clientX;
    input.joy.y = e.clientY;
    input.joy.dx = dx;
    input.joy.dy = dy;
  });

  function pointerEnd(e) {
    if (e.pointerId === input.joy.id) resetJoystick();
  }
  window.addEventListener('pointerup', pointerEnd);
  window.addEventListener('pointercancel', pointerEnd);

  // ============================================================
  // Buttons & menu events
  // ============================================================
  mapCards.forEach((card) => {
    card.addEventListener('click', () => {
      if (game.mode !== 'menu') return;
      selectMap(Number(card.dataset.map));
      if (sound.enabled) sound.click();
    });
  });

  dom.btnStart.addEventListener('click', () => startGame(game.selectedMap));
  dom.btnPause.addEventListener('click', pauseGame);
  dom.btnSound.addEventListener('click', toggleSound);
  dom.btnResume.addEventListener('click', resumeGame);
  dom.btnPauseRestart.addEventListener('click', restartCurrent);
  dom.btnPauseMenu.addEventListener('click', showMenu);
  dom.btnResultRetry.addEventListener('click', restartCurrent);
  dom.btnResultMenu.addEventListener('click', showMenu);
  dom.btnResultNext.addEventListener('click', nextMap);

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && game.mode === 'playing') pauseGame();
  });

  // ============================================================
  // Game simulation
  // ============================================================
  function addShake(amount) {
    game.camera.shake = Math.min(1.6, game.camera.shake + amount);
  }

  function addFloater(x, y, text, color, size) {
    game.floaters.push({
      x, y,
      text,
      color: color || '#ffd6a0',
      t: 0,
      life: 1.15,
      size: size || 14,
      vy: -34 - Math.random() * 18
    });
  }

  function spawnBurst(x, y, count, color, speed, size) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * TAU;
      const v = (speed || 90) * (0.3 + Math.random() * 0.8);
      game.particles.push({
        x, y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v,
        life: 0.45 + Math.random() * 0.75,
        maxLife: 1.2,
        size: (size || 2.5) * (0.45 + Math.random()),
        color: color || '#ffc06e',
        drag: 1.8,
        gravity: 0,
        glow: true
      });
    }
  }

  function spawnSuckParticles(x, y, targetX, targetY, count, color, spread) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * TAU;
      const r = Math.random() * (spread || 26);
      const px = x + Math.cos(a) * r;
      const py = y + Math.sin(a) * r;
      const d = Math.max(30, dist(px, py, targetX, targetY));
      const speed = 110 + Math.random() * 200;
      game.particles.push({
        x: px,
        y: py,
        vx: (targetX - px) / d * speed,
        vy: (targetY - py) / d * speed,
        life: 0.25 + Math.random() * 0.35,
        maxLife: 0.6,
        size: 1 + Math.random() * 2.6,
        color: color || '#ffc777',
        drag: 0.12,
        gravity: 0,
        glow: true
      });
    }
  }

  function spawnShockwave(x, y, r0, r1, color, duration) {
    game.effects.push({
      type: 'shockwave',
      x, y, r0, r1,
      t: 0,
      dur: duration || 0.9,
      color: color || 'rgba(255, 176, 88, 0.8)'
    });
  }

  function recomputeLevel() {
    const p = game.player;
    const nextLevel = levelForScore(p.score);
    p.targetRadius = targetRadiusForScore(p.score, nextLevel);
    if (nextLevel > p.level) {
      const oldLevel = p.level;
      p.level = nextLevel;
      p.pulse = 1;
      p.flash = 1;
      syncEnemyLevel();
      onLevelUp(oldLevel);
    }
    return nextLevel;
  }

  function syncEnemyLevel() {
    const player = game.player;
    if (!player || !game.enemies.length) return;
    const needed = player.level <= 7 ? player.level + 3 : 10;
    const targetLevel = clamp(needed, 1, 10);
    let upgraded = 0;
    for (let i = 0; i < game.enemies.length; i++) {
      const enemy = game.enemies[i];
      if (enemy.beingEaten) continue;
      if (targetLevel > enemy.level) {
        enemy.level = targetLevel;
        enemy.targetRadius = LEVEL_RADII[targetLevel - 1];
        enemy.pulse = 1;
        upgraded++;
      }
    }
    if (upgraded > 1) {
      showToast(`猎手 ×${upgraded} 吸收暗物质，升到了 LV.${targetLevel}。`, 'danger', 2600);
    } else if (upgraded === 1) {
      showToast(`猎手吸收暗物质，升到了 LV.${targetLevel}。`, 'danger', 2600);
    }
  }

  function onLevelUp(oldLevel) {
    const p = game.player;
    showLevelUp(p.level);
    sound.levelUp();
    addShake(0.34);
    spawnShockwave(p.x, p.y, p.radius * 0.55, p.radius * 3.5, 'rgba(255, 178, 84, 0.72)', 1.05);
    spawnBurst(p.x, p.y, 34, '#ffb458', 190, 3.4);
    if (p.level >= MAX_LEVEL) {
      game.tower.unlocked = true;
      showToast('LV.15 · 30层高塔已解锁，立刻前往塔底！', 'good', 4800);
    } else if (p.level >= 11 && oldLevel < 11) {
      showToast('LV.11 · 你已比猎手更大，现在可以吞掉它。', 'cyan', 4500);
    } else if (p.level === 8) {
      showToast('猎手停止成长了。继续扩张，到 LV.11 反杀。', 'cyan', 3800);
    }
    updateHUD();
  }

  function gainScore(points, sourceX, sourceY, color) {
    const p = game.player;
    if (!p || p.beingEaten) return;
    p.score += points;
    addFloater(p.x + (Math.random() * 30 - 15), p.y - p.radius - 14, `+${fmtInt(points)}`, color || '#ffd09a', points >= 500 ? 19 : 14);
    recomputeLevel();
  }

  function eatObject(o) {
    if (!o || o.eaten || !game.player) return;
    const p = game.player;
    o.eaten = true;
    p.eatenCount++;
    p.pulse = Math.max(p.pulse, 0.28);
    game.effects.push({
      type: 'suck',
      object: o,
      x0: o.x,
      y0: o.y,
      t: 0,
      dur: 0.5,
      spin: (Math.random() < 0.5 ? -1 : 1) * (0.7 + Math.random() * 1.1)
    });
    spawnSuckParticles(o.x, o.y, p.x, p.y, Math.min(18, 4 + Math.round(o.r / 7)), o.r > 60 ? '#ffd88b' : '#ffc06e', o.r * 1.2);
    spawnShockwave(o.x, o.y, Math.max(3, o.r * 0.2), Math.max(12, o.r * 1.15), 'rgba(255, 170, 82, 0.45)', 0.45);
    addShake(clamp(o.r / 155, 0.018, 0.42));
    sound.eat(o.r);
    gainScore(o.points, o.x, o.y, o.r >= 100 ? '#ffe3a2' : '#ffd09a');
  }

  function startTowerWin() {
    if (game.mode !== 'playing') return;
    game.mode = 'winning';
    game.winTimer = 0;
    game.finalTime = game.runTime;
    game.player.targetRadius = 220;
    resetJoystick();
    input.keys.clear();
    hideHint();
    addShake(0.85);
    spawnShockwave(game.tower.x, game.tower.y, 40, 560, 'rgba(255, 205, 109, 0.72)', 1.8);
    spawnBurst(game.tower.x, game.tower.y - 80, 80, '#ffd77d', 280, 4.2);
    showToast('30层高塔开始坍塌，整座城市正在向你坠落。', 'good', 3800);
    sound.levelUp();
  }

  function completeTowerWin() {
    const p = game.player;
    p.score += 5000;
    game.tower.eaten = true;
    addFloater(p.x, p.y - p.radius - 30, '+5000', '#ffe5a8', 26);
    spawnBurst(p.x, p.y, 90, '#ffd98a', 330, 5);
    addShake(0.7);
    finishRun(true, 'tower');
  }

  function startPlayerDeath(killer) {
    if (game.mode !== 'playing' || !game.player) return;
    let enemy = killer && !killer.beingEaten ? killer : null;
    if (!enemy) {
      const p = game.player;
      for (let i = 0; i < game.enemies.length; i++) {
        const e = game.enemies[i];
        if (e.beingEaten) continue;
        if (!enemy || dist(p.x, p.y, e.x, e.y) < dist(p.x, p.y, enemy.x, enemy.y)) enemy = e;
      }
    }
    if (!enemy) return;
    game.killer = enemy;
    game.mode = 'dying';
    game.deathTimer = 0;
    game.finalTime = game.runTime;
    game.player.beingEaten = true;
    game.player.deathStartRadius = game.player.radius;
    enemy.frozen = true;
    resetJoystick();
    input.keys.clear();
    hideHint();
    addShake(1.15);
    const killedBy = game.enemies.length > 1 ? `猎手 ${enemy.index + 1}` : '猎手黑洞';
    spawnBurst(game.player.x, game.player.y, 45, enemy.tint || '#ff3b5c', 180, 3.4);
    spawnShockwave(enemy.x, enemy.y, enemy.radius * 0.5, enemy.radius * 2.2, hexToRgba(enemy.tint || '#ff3b5c', 0.62), 1.2);
    showToast(`你被${killedBy}完全罩住了。`, 'danger', 2200);
    sound.danger();
  }

  function startEnemyEaten(e) {
    if (!e || e.beingEaten) return;
    e.beingEaten = true;
    e.swallowed = 0;
    addShake(0.65);
    spawnShockwave(e.x, e.y, e.radius * 0.5, e.radius * 2.4, 'rgba(92, 234, 255, 0.62)', 1.2);
    spawnBurst(e.x, e.y, 55, e.tint2 || '#73efff', 230, 3.8);
    const label = game.enemies.length > 1 ? `反杀！猎手 ${e.index + 1} 正在被拖入你的事件视界。` : '反杀！猎手正在被拖入你的事件视界。';
    showToast(label, 'cyan', 3200);
    sound.levelUp();
  }

  function finishEnemyEaten(e) {
    const p = game.player;
    if (!p) return;
    const idx = game.enemies.indexOf(e);
    if (idx >= 0) game.enemies.splice(idx, 1);
    const targetLevel = Math.min(MAX_LEVEL, p.level + 1);
    if (p.level < MAX_LEVEL) {
      p.score = Math.max(p.score + 350, LEVEL_THRESHOLDS[targetLevel - 1] + 12);
      const old = p.level;
      p.level = levelForScore(p.score);
      p.targetRadius = targetRadiusForScore(p.score, p.level);
      if (p.level > old) {
        p.pulse = 1;
        p.flash = 1;
        onLevelUp(old);
      }
    } else {
      p.score += 1200;
    }
    const label = game.enemies.length ? `猎手 ×1 · 剩 ${game.enemies.length}` : '猎手清空';
    addFloater(p.x, p.y - p.radius - 26, label, '#8ff4ff', 22);
    spawnShockwave(p.x, p.y, p.radius * 0.6, p.radius * 4, 'rgba(94, 234, 255, 0.72)', 1.4);
    spawnBurst(p.x, p.y, 65, '#83f2ff', 260, 4.6);
    addShake(0.8);
    updateHUD();
  }

  function updatePlayer(dt) {
    const p = game.player;
    if (!p || p.beingEaten) return;
    const move = movementVector();
    const zoom = game.camera.zoom || 1;
    const speed = 344 / Math.max(0.33, zoom);
    const targetVx = move.x * speed;
    const targetVy = move.y * speed;
    p.vx = damp(p.vx, targetVx, 12, dt);
    p.vy = damp(p.vy, targetVy, 12, dt);
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.x = clamp(p.x, 24, game.world.width - 24);
    p.y = clamp(p.y, 24, game.world.height - 24);
    p.angle += dt * (0.35 + p.radius * 0.004);
    p.pulse = Math.max(0, p.pulse - dt * 2.8);
    p.flash = Math.max(0, p.flash - dt * 2.4);
    p.radius = damp(p.radius, p.targetRadius, 7.5, dt);
  }

  function updateEnemies(dt) {
    if (!game.player) return;
    const list = game.enemies.slice();
    for (let i = 0; i < list.length; i++) {
      updateEnemy(dt, list[i]);
    }
  }

  function updateEnemy(dt, e) {
    const p = game.player;
    if (!e || !p) return;

    if (e.beingEaten) {
      e.swallowed += dt;
      const t = clamp(e.swallowed / 1.15, 0, 1);
      e.x = damp(e.x, p.x, 5, dt);
      e.y = damp(e.y, p.y, 5, dt);
      e.radius = lerp(e.radius, 0, dt * 4.2);
      e.pulse = Math.max(0, e.pulse - dt * 3);
      if (t >= 1) finishEnemyEaten(e);
      return;
    }

    if (e.frozen) {
      e.pulse = Math.max(0, e.pulse - dt * 2);
      return;
    }

    const dToPlayer = dist(e.x, e.y, p.x, p.y);
    const playerIsBigger = p.level >= 11 && p.radius > e.radius * 1.02;
    const fleeing = playerIsBigger && dToPlayer < 720;
    const speed = (330 * e.speedFactor * (fleeing ? 0.87 : 1)) / Math.max(0.34, game.camera.zoom);

    e.retarget -= dt;
    if (!e.waypoint || e.retarget <= 0 || dist(e.x, e.y, e.waypoint.x, e.waypoint.y) < 34) {
      let wx;
      let wy;
      if (fleeing) {
        const ang = Math.atan2(e.y - p.y, e.x - p.x) + (Math.random() * 0.7 - 0.35);
        wx = clamp(e.x + Math.cos(ang) * 760, 130, game.world.width - 130);
        wy = clamp(e.y + Math.sin(ang) * 760, 130, game.world.height - 130);
        e.retarget = 0.65 + Math.random() * 0.55;
      } else {
        for (let attempt = 0; attempt < 12; attempt++) {
          wx = 160 + Math.random() * (game.world.width - 320);
          wy = 160 + Math.random() * (game.world.height - 320);
          if (dist(wx, wy, e.x, e.y) > 300) break;
        }
        e.retarget = 2.3 + Math.random() * 3.8;
      }
      e.waypoint = { x: wx, y: wy };
    }

    const dx = e.waypoint.x - e.x;
    const dy = e.waypoint.y - e.y;
    const len = Math.max(0.001, Math.hypot(dx, dy));
    const targetVx = dx / len * speed;
    const targetVy = dy / len * speed;
    e.vx = damp(e.vx, targetVx, 2.8, dt);
    e.vy = damp(e.vy, targetVy, 2.8, dt);
    e.x = clamp(e.x + e.vx * dt, 80, game.world.width - 80);
    e.y = clamp(e.y + e.vy * dt, 80, game.world.height - 80);
    e.angle += dt * 0.6;
    e.pulse = Math.max(0, e.pulse - dt * 2.4);
    e.radius = damp(e.radius, e.targetRadius, 4.8, dt);

    // Little dust motes spiralling into the hunter.
    if (Math.random() < dt * 7) {
      const a = Math.random() * TAU;
      const rr = e.radius * (1.05 + Math.random() * 0.75);
      game.particles.push({
        x: e.x + Math.cos(a) * rr,
        y: e.y + Math.sin(a) * rr,
        vx: -Math.cos(a) * 60,
        vy: -Math.sin(a) * 60,
        life: 0.45 + Math.random() * 0.4,
        maxLife: 0.8,
        size: 0.8 + Math.random() * 1.5,
        color: e.tint || '#ff5f80',
        drag: 0.2,
        gravity: 0,
        glow: true
      });
    }
  }

  function checkEnemyCollision() {
    const p = game.player;
    if (!p || game.mode !== 'playing') return;
    for (let i = 0; i < game.enemies.length; i++) {
      const e = game.enemies[i];
      if (!e || e.beingEaten) continue;
      const d = dist(p.x, p.y, e.x, e.y);

      if (p.level >= 11 && p.radius > e.radius * 1.01) {
        if (d + e.radius * 0.68 < p.radius) {
          startEnemyEaten(e);
          continue;
        }
      }

      if (d + p.radius * 0.86 < e.radius) {
        startPlayerDeath(e);
        return;
      }

      if (d < 520 && game.mode === 'playing') {
        if (performance.now() - game.lastDangerBeep > 2600) {
          game.lastDangerBeep = performance.now();
          sound.danger();
        }
      }
    }
  }

  function checkObjectCollisions() {
    const p = game.player;
    if (!p || p.beingEaten) return;
    const p2 = p.radius;
    for (let i = 0; i < game.objects.length; i++) {
      const o = game.objects[i];
      if (o.eaten) continue;
      const d = dist(p.x, p.y, o.x, o.y);
      if (o.goal) {
        if (p.level >= MAX_LEVEL) {
          if (d < p.radius * 0.92) startTowerWin();
        } else if (d < p.radius + o.r * 0.45) {
          const now = performance.now();
          if (now - game.lastHintAt > 5000) {
            game.lastHintAt = now;
            showToast(`高塔被锁定：需要 LV.${MAX_LEVEL} 才能吞噬它。`, 'danger', 2700);
          }
        }
        continue;
      }
      if (o.r >= p2 * 0.985) continue;
      if (d < p2 + o.r * 0.08) eatObject(o);
    }
  }

  function updateTowerHint() {
    if (!game.tower || !game.player) return;
    if (game.player.level >= MAX_LEVEL) game.tower.unlocked = true;
  }

  function updateEffects(dt) {
    for (let i = game.effects.length - 1; i >= 0; i--) {
      const fx = game.effects[i];
      fx.t += dt;
      if (fx.t >= fx.dur) game.effects.splice(i, 1);
    }
    for (let i = game.particles.length - 1; i >= 0; i--) {
      const p = game.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        game.particles.splice(i, 1);
        continue;
      }
      p.vx *= Math.pow(1 - clamp(p.drag, 0, 0.98), dt * 8);
      p.vy *= Math.pow(1 - clamp(p.drag, 0, 0.98), dt * 8);
      p.vy += (p.gravity || 0) * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    for (let i = game.floaters.length - 1; i >= 0; i--) {
      const f = game.floaters[i];
      f.t += dt;
      f.y += f.vy * dt;
      if (f.t >= f.life) game.floaters.splice(i, 1);
    }
  }

  function updateCamera(dt) {
    if (!game.player) return;
    const targetZoom = getTargetZoom(game.player);
    game.camera.x = damp(game.camera.x, game.player.x, 9.5, dt);
    game.camera.y = damp(game.camera.y, game.player.y - (game.mode === 'winning' ? 60 : 0), 9.5, dt);
    game.camera.zoom = damp(game.camera.zoom, targetZoom, 3.4, dt);
    game.camera.shake = Math.max(0, game.camera.shake - dt * 2.35);
    const s = game.camera.shake * game.camera.shake;
    game.camera.shakeX = (Math.random() * 2 - 1) * s * 16;
    game.camera.shakeY = (Math.random() * 2 - 1) * s * 16;
  }

  function updateDying(dt) {
    game.deathTimer += dt;
    const p = game.player;
    const e = game.killer;
    if (p && e) {
      const t = clamp(game.deathTimer / 1.25, 0, 1);
      p.x = damp(p.x, e.x, 3.2, dt);
      p.y = damp(p.y, e.y, 3.2, dt);
      p.radius = Math.max(1, game.player.deathStartRadius * (1 - t * t));
      e.pulse = Math.max(0.2, 0.8 - t * 0.5);
      e.radius = damp(e.radius, e.targetRadius * 1.05, 2.5, dt);
      if (Math.random() < dt * 18) {
        const a = Math.random() * TAU;
        const rr = e.radius * (0.55 + Math.random() * 0.4);
        game.particles.push({
          x: e.x + Math.cos(a) * rr,
          y: e.y + Math.sin(a) * rr,
          vx: -Math.cos(a) * 120,
          vy: -Math.sin(a) * 120,
          life: 0.4 + Math.random() * 0.5,
          maxLife: 0.9,
          size: 1 + Math.random() * 2.2,
          color: e.tint || '#ff3b5c',
          drag: 0.2,
          gravity: 0,
          glow: true
        });
      }
    }
    if (game.deathTimer >= 1.55) {
      finishRun(false, 'hunter');
    }
  }

  function updateWinning(dt) {
    game.winTimer += dt;
    const p = game.player;
    const tower = game.tower;
    if (p) {
      p.angle += dt * 1.2;
      p.radius = damp(p.radius, p.targetRadius, 3.2, dt);
      p.pulse = 0.9;
      if (game.winTimer > 0.5 && game.winTimer < 2.5 && Math.random() < dt * 26) {
        const a = Math.random() * TAU;
        const rr = tower.r * (0.55 + Math.random() * 0.9);
        game.particles.push({
          x: tower.x + Math.cos(a) * rr,
          y: tower.y + Math.sin(a) * rr - Math.random() * 400,
          vx: (p.x - tower.x) * 0.38,
          vy: (p.y - tower.y) * 0.38,
          life: 0.45 + Math.random() * 0.7,
          maxLife: 1.1,
          size: 1 + Math.random() * 3,
          color: Math.random() < 0.5 ? '#ffd87a' : '#ff9b56',
          drag: 0.15,
          gravity: 0,
          glow: true
        });
      }
    }
    if (game.winTimer > 2.8) completeTowerWin();
  }

  function update(dt) {
    if (game.mode === 'playing') {
      game.runTime += dt;
      game.stateTime += dt;
      updatePlayer(dt);
      updateEnemies(dt);
      checkObjectCollisions();
      if (game.mode === 'playing') checkEnemyCollision();
      updateTowerHint();
      updateCamera(dt);
      updateEffects(dt);
      game.hudClock += dt;
      game.minimapClock += dt;
      if (game.hudClock > 0.07) {
        game.hudClock = 0;
        updateHUD();
      }
      if (game.minimapClock > 0.09) {
        game.minimapClock = 0;
        drawMinimap();
      }
    } else if (game.mode === 'dying') {
      updateDying(dt);
      updateCamera(dt);
      updateEffects(dt);
      game.hudClock += dt;
      if (game.hudClock > 0.07) {
        game.hudClock = 0;
        updateHUD();
      }
    } else if (game.mode === 'winning') {
      updateWinning(dt);
      updateCamera(dt);
      updateEffects(dt);
      game.hudClock += dt;
      if (game.hudClock > 0.07) {
        game.hudClock = 0;
        updateHUD();
      }
      if (game.mode === 'winning') {
        game.minimapClock += dt;
        if (game.minimapClock > 0.09) {
          game.minimapClock = 0;
          drawMinimap();
        }
      }
    } else if (game.mode === 'paused') {
      updateEffects(dt * 0.2);
    } else if (game.mode === 'victory' || game.mode === 'gameover') {
      updateEffects(dt);
      updateCamera(dt);
    }
  }

  // ============================================================
  // Rendering helpers
  // ============================================================
  const menuStars = [];
  const skyStars = [];
  (function seedStars() {
    const rng = mulberry32(0x91ac77);
    for (let i = 0; i < 190; i++) {
      menuStars.push({ x: rng(), y: rng(), r: 0.4 + rng() * 1.8, a: 0.18 + rng() * 0.7, p: rng() * TAU });
    }
    for (let i = 0; i < 130; i++) {
      skyStars.push({ x: rng(), y: rng(), r: 0.35 + rng() * 1.45, a: 0.12 + rng() * 0.5, p: rng() * TAU, z: 0.3 + rng() * 0.8 });
    }
  })();

  function worldToScreen(x, y) {
    const cam = game.camera;
    return {
      x: W / 2 + (x - cam.x) * cam.zoom + cam.shakeX,
      y: H / 2 + (y - cam.y) * cam.zoom + cam.shakeY
    };
  }

  function inView(x, y, r, h) {
    const cam = game.camera;
    const pad = 100;
    const left = cam.x - W / (2 * cam.zoom) - pad;
    const right = cam.x + W / (2 * cam.zoom) + pad;
    const top = cam.y - H / (2 * cam.zoom) - pad;
    const bottom = cam.y + H / (2 * cam.zoom) + pad;
    return x + r > left && x - r < right && y + r > top && y - h < bottom;
  }

  function drawSky(time) {
    const p = game.world.palette;
    const themeKey = (game.world.def.theme && game.world.def.theme.key) || 'neon';
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, p.void);
    grad.addColorStop(0.58, p.void);
    grad.addColorStop(1, '#02040a');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    if (themeKey === 'harbor') {
      // Amber port haze sitting on the horizon.
      const haze = ctx.createLinearGradient(0, H * 0.42, 0, H);
      haze.addColorStop(0, 'rgba(255, 150, 60, 0)');
      haze.addColorStop(0.55, 'rgba(255, 142, 58, 0.055)');
      haze.addColorStop(1, 'rgba(255, 166, 84, 0.02)');
      ctx.fillStyle = haze;
      ctx.fillRect(0, 0, W, H);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 3; i++) {
        const y = H * (0.62 + i * 0.1) + Math.sin(time * 0.25 + i) * 10;
        const fog = ctx.createLinearGradient(0, y - 40, 0, y + 40);
        fog.addColorStop(0, 'rgba(255, 180, 110, 0)');
        fog.addColorStop(0.5, `rgba(255, 176, 108, ${0.02 + i * 0.006})`);
        fog.addColorStop(1, 'rgba(255, 180, 110, 0)');
        ctx.fillStyle = fog;
        ctx.fillRect(0, y - 40, W, 80);
      }
      ctx.restore();
    } else if (themeKey === 'sky') {
      // Aurora ribbons above the skyline.
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (let band = 0; band < 3; band++) {
        const baseY = H * (0.12 + band * 0.07);
        const color = band === 0 ? '180, 110, 255' : band === 1 ? '255, 110, 220' : '90, 240, 255';
        const ribbon = ctx.createLinearGradient(0, baseY - 60, 0, baseY + 90);
        ribbon.addColorStop(0, `rgba(${color}, 0)`);
        ribbon.addColorStop(0.45, `rgba(${color}, 0.05)`);
        ribbon.addColorStop(1, `rgba(${color}, 0)`);
        ctx.fillStyle = ribbon;
        ctx.beginPath();
        ctx.moveTo(0, baseY);
        for (let x = 0; x <= W; x += 48) {
          const y = baseY + Math.sin(x * 0.004 + time * 0.25 + band * 1.7) * 34;
          ctx.lineTo(x, y);
        }
        for (let x = W; x >= 0; x -= 48) {
          const y = baseY + 70 + Math.sin(x * 0.0032 + time * 0.18 + band) * 26;
          ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }

    const neb = ctx.createRadialGradient(W * 0.74, H * 0.22, 0, W * 0.74, H * 0.22, Math.max(W, H) * 0.52);
    neb.addColorStop(0, p.accent + '09');
    neb.addColorStop(0.45, p.accent2 + '05');
    neb.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = neb;
    ctx.fillRect(0, 0, W, H);

    const cam = game.camera;
    for (let i = 0; i < skyStars.length; i++) {
      const s = skyStars[i];
      let x = s.x * W - (cam.x * 0.022 * s.z) % W;
      let y = s.y * H - (cam.y * 0.018 * s.z) % H;
      if (x < 0) x += W;
      if (y < 0) y += H;
      const tw = 0.58 + Math.sin(time * 0.7 + s.p) * 0.38;
      ctx.globalAlpha = s.a * tw;
      ctx.fillStyle = i % 13 === 0 ? p.accent : '#dbe8ff';
      ctx.fillRect(x, y, s.r, s.r);
    }
    ctx.globalAlpha = 1;
  }

  function drawGround(time) {
    const world = game.world;
    const def = world.def;
    const grid = world.grid;
    const p = world.palette;
    const themeKey = (def.theme && def.theme.key) || 'neon';
    const trng = mulberry32(def.seed ^ 0x51f15e);
    const rw = def.roadW;

    // Floating slab shadow & rim.
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.78)';
    ctx.shadowBlur = 70;
    ctx.fillStyle = p.ground;
    roundedRect(ctx, 0, 0, grid.width, grid.height, 46);
    ctx.fill();
    ctx.restore();

    ctx.save();
    roundedRect(ctx, 0, 0, grid.width, grid.height, 46);
    ctx.clip();

    if (themeKey === 'harbor') drawHarborWater(grid, def, p, trng);

    // Block pavement.
    for (let i = 0; i < grid.blocks.length; i++) {
      const b = grid.blocks[i];
      const alt = hash2(b.col, b.row, def.seed) % 3 === 0;
      ctx.fillStyle = p.sidewalk;
      roundedRect(ctx, b.x1 - 14, b.y1 - 14, b.w + 28, b.h + 28, 18);
      ctx.fill();
      ctx.fillStyle = alt ? p.blockAlt : p.block;
      roundedRect(ctx, b.x1, b.y1, b.w, b.h, 11);
      ctx.fill();
      // subtle inner curb
      ctx.strokeStyle = 'rgba(255,255,255,0.028)';
      ctx.lineWidth = 1.5;
      roundedRect(ctx, b.x1 + 5, b.y1 + 5, b.w - 10, b.h - 10, 8);
      ctx.stroke();
      if (hash2(b.col + 8, b.row - 3, def.seed) % 4 === 0) {
        ctx.fillStyle = p.grass;
        ctx.globalAlpha = 0.32;
        roundedRect(ctx, b.x1 + b.w * 0.52, b.y1 + b.h * 0.55, b.w * 0.42, b.h * 0.36, 70);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }

    // Road surface.
    ctx.fillStyle = p.road;
    for (let c = 0; c < grid.xs.length; c++) {
      ctx.fillRect(grid.xs[c] - rw / 2, 0, rw, grid.height);
    }
    for (let r = 0; r < grid.ys.length; r++) {
      ctx.fillRect(0, grid.ys[r] - rw / 2, grid.width, rw);
    }

    // Road edge lines.
    ctx.strokeStyle = 'rgba(142, 174, 221, 0.08)';
    ctx.lineWidth = 2;
    for (let c = 0; c < grid.xs.length; c++) {
      ctx.beginPath();
      ctx.moveTo(grid.xs[c] - rw / 2, 0);
      ctx.lineTo(grid.xs[c] - rw / 2, grid.height);
      ctx.moveTo(grid.xs[c] + rw / 2, 0);
      ctx.lineTo(grid.xs[c] + rw / 2, grid.height);
      ctx.stroke();
    }
    for (let r = 0; r < grid.ys.length; r++) {
      ctx.beginPath();
      ctx.moveTo(0, grid.ys[r] - rw / 2);
      ctx.lineTo(grid.width, grid.ys[r] - rw / 2);
      ctx.moveTo(0, grid.ys[r] + rw / 2);
      ctx.lineTo(grid.width, grid.ys[r] + rw / 2);
      ctx.stroke();
    }

    // Lane dashes between intersections.
    ctx.strokeStyle = p.line;
    ctx.lineWidth = 2.2;
    ctx.setLineDash([34, 30]);
    for (let c = 0; c < grid.xs.length; c++) {
      for (let r = 0; r < def.rows; r++) {
        const y1 = grid.ys[r] + rw * 0.72;
        const y2 = grid.ys[r + 1] - rw * 0.72;
        ctx.beginPath();
        ctx.moveTo(grid.xs[c], y1);
        ctx.lineTo(grid.xs[c], y2);
        ctx.stroke();
      }
    }
    for (let r = 0; r < grid.ys.length; r++) {
      for (let c = 0; c < def.cols; c++) {
        const x1 = grid.xs[c] + rw * 0.72;
        const x2 = grid.xs[c + 1] - rw * 0.72;
        ctx.beginPath();
        ctx.moveTo(x1, grid.ys[r]);
        ctx.lineTo(x2, grid.ys[r]);
        ctx.stroke();
      }
    }
    ctx.setLineDash([]);

    // Crosswalks around intersections.
    ctx.fillStyle = themeKey === 'harbor'
      ? 'rgba(255, 214, 164, 0.10)'
      : themeKey === 'sky'
        ? 'rgba(196, 236, 255, 0.10)'
        : 'rgba(210, 228, 255, 0.10)';
    for (let c = 0; c < grid.xs.length; c++) {
      for (let r = 0; r < grid.ys.length; r++) {
        if (c > 0 && c < grid.xs.length - 1 && r > 0 && r < grid.ys.length - 1) {
          const x = grid.xs[c];
          const y = grid.ys[r];
          const off = rw * 0.5 + 15;
          for (let k = -4; k <= 4; k++) {
            const ox = k * 9;
            ctx.fillRect(x + ox - 3.5, y - off - 16, 7, 13);
            ctx.fillRect(x + ox - 3.5, y + off + 3, 7, 13);
            ctx.fillRect(x - off - 16, y + ox - 3.5, 13, 7);
            ctx.fillRect(x + off + 3, y + ox - 3.5, 13, 7);
          }
        }
      }
    }

    // District-specific street markings.
    if (themeKey === 'harbor') {
      drawHarborTracks(grid, def);
    } else if (themeKey === 'sky') {
      drawSkyGroundDecor(grid, def, p, trng);
    } else {
      drawNeonRoadLines(grid, def, p);
    }

    // Ground grime and puddles.
    const rng = mulberry32(def.seed ^ 0x51f15e);
    for (let i = 0; i < 46; i++) {
      const x = rng() * grid.width;
      const y = rng() * grid.height;
      const rr = 16 + rng() * 92;
      ctx.globalAlpha = 0.035 + rng() * 0.05;
      ctx.fillStyle = i % 4 === 0 ? p.accent : '#000';
      ctx.beginPath();
      ctx.ellipse(x, y, rr, rr * (0.22 + rng() * 0.18), rng() * 3, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Spawn plaza.
    const spawn = world.spawn;
    const spGlow = ctx.createRadialGradient(spawn.x, spawn.y, 16, spawn.x, spawn.y, 188);
    spGlow.addColorStop(0, hexToRgba(p.accent, 0.1));
    spGlow.addColorStop(0.72, hexToRgba(p.accent, 0.025));
    spGlow.addColorStop(1, hexToRgba(p.accent, 0));
    ctx.fillStyle = spGlow;
    ctx.beginPath();
    ctx.arc(spawn.x, spawn.y, 188, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = hexToRgba(p.accent, 0.16);
    ctx.lineWidth = 2;
    ctx.setLineDash([14, 14]);
    ctx.beginPath();
    ctx.arc(spawn.x, spawn.y, 154, 0, TAU);
    ctx.stroke();
    ctx.setLineDash([]);

    // Tower landing pad.
    const tower = world.tower;
    const tGlow = ctx.createRadialGradient(tower.x, tower.y, 20, tower.x, tower.y, 310);
    tGlow.addColorStop(0, 'rgba(255, 194, 82, 0.12)');
    tGlow.addColorStop(0.68, 'rgba(255, 160, 65, 0.03)');
    tGlow.addColorStop(1, 'rgba(255, 160, 65, 0)');
    ctx.fillStyle = tGlow;
    ctx.beginPath();
    ctx.arc(tower.x, tower.y, 310, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 199, 104, 0.19)';
    ctx.lineWidth = 2.5;
    ctx.setLineDash([24, 20]);
    ctx.beginPath();
    ctx.arc(tower.x, tower.y, 258, 0, TAU);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.restore();

    // Rim.
    ctx.save();
    ctx.strokeStyle = p.mapEdge;
    ctx.lineWidth = 3;
    roundedRect(ctx, 0, 0, grid.width, grid.height, 46);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.055)';
    ctx.lineWidth = 1;
    roundedRect(ctx, 7, 7, grid.width - 14, grid.height - 14, 40);
    ctx.stroke();
    ctx.restore();
  }

  // ------------------------------------------------------------
  // Per-district ground decoration
  // ------------------------------------------------------------
  function drawHarborWater(grid, def, p, rng) {
    const band = Math.min(def.margin - 16, 132);
    if (band < 24) return;
    const grad = ctx.createLinearGradient(0, 0, 0, grid.height);
    grad.addColorStop(0, '#0b2f34');
    grad.addColorStop(0.5, '#071e24');
    grad.addColorStop(1, '#0a2b31');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, grid.width, band);
    ctx.fillRect(0, grid.height - band, grid.width, band);
    ctx.fillRect(0, band, band, grid.height - band * 2);
    ctx.fillRect(grid.width - band, band, band, grid.height - band * 2);

    // Ripples.
    ctx.strokeStyle = hexToRgba(p.accent2, 0.13);
    ctx.lineWidth = 1.4;
    for (let i = 0; i < 44; i++) {
      const side = i % 4;
      let x;
      let y;
      if (side === 0 || side === 1) {
        x = rng() * grid.width;
        y = side === 0 ? rng() * band : grid.height - rng() * band;
      } else {
        x = side === 2 ? rng() * band : grid.width - rng() * band;
        y = band + rng() * (grid.height - band * 2);
      }
      const w = 10 + rng() * 44;
      ctx.globalAlpha = 0.3 + rng() * 0.5;
      ctx.beginPath();
      ctx.ellipse(x, y, w, w * 0.13, 0, 0, TAU);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // Quay edges.
    ctx.strokeStyle = 'rgba(255, 202, 138, 0.3)';
    ctx.lineWidth = 3;
    ctx.strokeRect(band, band, grid.width - band * 2, grid.height - band * 2);
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.lineWidth = 1;
    ctx.strokeRect(band + 4, band + 4, grid.width - band * 2 - 8, grid.height - band * 2 - 8);

    // Piers reaching into the water.
    ctx.fillStyle = '#1d2328';
    for (let i = 0; i < 4; i++) {
      const px = band + 80 + rng() * (grid.width - band * 2 - 160);
      const pw = 16 + rng() * 10;
      ctx.fillRect(px, band - 54, pw, 56);
      ctx.fillRect(px, grid.height - band - 2, pw, 54);
      ctx.strokeStyle = 'rgba(255, 196, 126, 0.18)';
      ctx.lineWidth = 1;
      for (let k = 1; k < 6; k++) {
        ctx.beginPath();
        ctx.moveTo(px, band - 54 + k * 9);
        ctx.lineTo(px + pw, band - 54 + k * 9);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(px, grid.height - band - 2 + k * 9);
        ctx.lineTo(px + pw, grid.height - band - 2 + k * 9);
        ctx.stroke();
      }
    }
  }

  function drawHarborTracks(grid, def) {
    const rw = def.roadW;
    ctx.save();
    for (let r = 0; r < grid.ys.length; r++) {
      const cy = grid.ys[r];
      ctx.strokeStyle = 'rgba(214, 192, 152, 0.16)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, cy - rw * 0.16);
      ctx.lineTo(grid.width, cy - rw * 0.16);
      ctx.moveTo(0, cy + rw * 0.16);
      ctx.lineTo(grid.width, cy + rw * 0.16);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(214, 192, 152, 0.09)';
      ctx.lineWidth = 2.4;
      ctx.setLineDash([5, 21]);
      ctx.beginPath();
      ctx.moveTo(0, cy - rw * 0.22);
      ctx.lineTo(grid.width, cy - rw * 0.22);
      ctx.moveTo(0, cy + rw * 0.22);
      ctx.lineTo(grid.width, cy + rw * 0.22);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    // Hazard chevrons at intersections.
    ctx.fillStyle = 'rgba(255, 178, 84, 0.09)';
    for (let c = 1; c < grid.xs.length - 1; c++) {
      for (let r = 1; r < grid.ys.length - 1; r++) {
        const x = grid.xs[c];
        const y = grid.ys[r];
        for (let k = -2; k <= 2; k++) {
          ctx.save();
          ctx.translate(x + k * 16, y);
          ctx.rotate(Math.PI / 4);
          ctx.fillRect(-3.5, -3.5, 7, 7);
          ctx.restore();
        }
      }
    }
    ctx.restore();
  }

  function drawNeonRoadLines(grid, def, p) {
    const rw = def.roadW;
    ctx.save();
    ctx.lineWidth = 2;
    for (let c = 0; c < grid.xs.length; c++) {
      ctx.strokeStyle = hexToRgba(c % 2 === 0 ? p.accent : p.accent2, 0.2);
      ctx.beginPath();
      ctx.moveTo(grid.xs[c] - rw / 2, 0);
      ctx.lineTo(grid.xs[c] - rw / 2, grid.height);
      ctx.moveTo(grid.xs[c] + rw / 2, 0);
      ctx.lineTo(grid.xs[c] + rw / 2, grid.height);
      ctx.stroke();
    }
    for (let r = 0; r < grid.ys.length; r++) {
      ctx.strokeStyle = hexToRgba(r % 2 === 0 ? p.accent2 : p.accent, 0.18);
      ctx.beginPath();
      ctx.moveTo(0, grid.ys[r] - rw / 2);
      ctx.lineTo(grid.width, grid.ys[r] - rw / 2);
      ctx.moveTo(0, grid.ys[r] + rw / 2);
      ctx.lineTo(grid.width, grid.ys[r] + rw / 2);
      ctx.stroke();
    }
    // Corner beacons.
    ctx.fillStyle = hexToRgba(p.accent, 0.24);
    for (let c = 1; c < grid.xs.length - 1; c++) {
      for (let r = 1; r < grid.ys.length - 1; r++) {
        ctx.save();
        ctx.translate(grid.xs[c], grid.ys[r]);
        ctx.rotate(Math.PI / 4);
        ctx.fillRect(-4, -4, 8, 8);
        ctx.restore();
      }
    }
    ctx.restore();
  }

  function drawSkyGroundDecor(grid, def, p, rng) {
    // Glowing light bridges.
    ctx.save();
    for (let c = 0; c < grid.xs.length; c++) {
      const x = grid.xs[c];
      const g = ctx.createLinearGradient(x - 6, 0, x + 6, 0);
      g.addColorStop(0, hexToRgba(p.accent2, 0));
      g.addColorStop(0.5, hexToRgba(p.accent2, 0.22));
      g.addColorStop(1, hexToRgba(p.accent2, 0));
      ctx.fillStyle = g;
      ctx.fillRect(x - 6, 0, 12, grid.height);
    }
    for (let r = 0; r < grid.ys.length; r++) {
      const y = grid.ys[r];
      const g = ctx.createLinearGradient(0, y - 6, 0, y + 6);
      g.addColorStop(0, hexToRgba(p.accent, 0));
      g.addColorStop(0.5, hexToRgba(p.accent, 0.2));
      g.addColorStop(1, hexToRgba(p.accent, 0));
      ctx.fillStyle = g;
      ctx.fillRect(0, y - 6, grid.width, 12);
    }
    // Hover pads at intersections.
    for (let c = 1; c < grid.xs.length - 1; c++) {
      for (let r = 1; r < grid.ys.length - 1; r++) {
        ctx.strokeStyle = hexToRgba(p.accent2, 0.18);
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(grid.xs[c], grid.ys[r], 13, 0, TAU);
        ctx.stroke();
      }
    }
    // Low cloud banks drifting over the blocks.
    for (let i = 0; i < 14; i++) {
      const x = rng() * grid.width;
      const y = rng() * grid.height;
      const rx = 70 + rng() * 150;
      const ry = rx * (0.22 + rng() * 0.2);
      const cl = ctx.createRadialGradient(x, y, 0, x, y, rx);
      cl.addColorStop(0, 'rgba(190, 170, 255, 0.075)');
      cl.addColorStop(0.6, 'rgba(150, 130, 230, 0.04)');
      cl.addColorStop(1, 'rgba(120, 100, 200, 0)');
      ctx.fillStyle = cl;
      ctx.beginPath();
      ctx.ellipse(x, y, rx, ry, 0, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }


  const groundCache = { canvas: null, scale: 1, margin: 110, width: 0, height: 0, world: null };

  function buildGroundCache() {
    const world = game.world;
    if (!world) {
      groundCache.canvas = null;
      groundCache.world = null;
      return;
    }
    const grid = world.grid;
    const margin = groundCache.margin;
    const maxDim = Math.max(grid.width, grid.height) + margin * 2;
    const scale = clamp(2600 / maxDim, 0.6, 0.85);
    const cw = Math.max(1, Math.ceil((grid.width + margin * 2) * scale));
    const ch = Math.max(1, Math.ceil((grid.height + margin * 2) * scale));
    const off = document.createElement('canvas');
    off.width = cw;
    off.height = ch;
    const octx = off.getContext('2d');
    const prev = ctx;
    ctx = octx;
    octx.setTransform(scale, 0, 0, scale, margin * scale, margin * scale);
    drawGround(0);
    ctx = prev;
    groundCache.canvas = off;
    groundCache.scale = scale;
    groundCache.width = cw;
    groundCache.height = ch;
    groundCache.world = world;
  }

  function drawGroundCached() {
    if (!groundCache.canvas || groundCache.world !== game.world) buildGroundCache();
    const g = groundCache;
    if (!g.canvas) return;
    ctx.drawImage(g.canvas, -g.margin, -g.margin, g.width / g.scale, g.height / g.scale);
  }

  function drawGroundShadow(x, y, r, alpha) {
    const grad = ctx.createRadialGradient(x, y, r * 0.1, x, y, r * 1.25);
    grad.addColorStop(0, `rgba(0,0,0,${alpha == null ? 0.48 : alpha})`);
    grad.addColorStop(0.65, `rgba(0,0,0,${(alpha == null ? 0.48 : alpha) * 0.55})`);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(x, y + r * 0.08, r * 1.22, r * 0.46, 0, 0, TAU);
    ctx.fill();
  }

  function drawBlackHole(x, y, r, options, time) {
    if (r < 0.8) return;
    const opts = options || {};
    const playerHole = !!opts.isPlayer;
    const enemyHole = !!opts.isEnemy;
    const palette = game.world ? game.world.palette : MAPS[game.selectedMap].palette;
    const primary = enemyHole ? (opts.tint || '#ff465f') : palette.glow;
    const secondary = enemyHole ? (opts.tint2 || '#ff8fa6') : palette.accent;
    const rot = opts.angle || 0;
    const pulse = opts.pulse || 0;
    const rr = r * (1 + pulse * 0.045);
    const glowSize = rr * (enemyHole ? 2.05 : 1.85);
    const glow = ctx.createRadialGradient(x, y, rr * 0.72, x, y, glowSize);
    glow.addColorStop(0, hexToRgba(primary, 0.36));
    glow.addColorStop(0.44, hexToRgba(primary, 0.2));
    glow.addColorStop(0.72, hexToRgba(secondary, 0.07));
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x, y, glowSize, 0, TAU);
    ctx.fill();

    // Rotating accretion arcs.
    ctx.lineCap = 'round';
    for (let i = 0; i < 4; i++) {
      const rr2 = rr * (1.02 + i * 0.075);
      const a0 = rot * (1 + i * 0.2) + i * 1.45;
      const span = 0.55 + i * 0.23;
      ctx.strokeStyle = hexToRgba(i % 2 === 0 ? secondary : primary, 0.22 - i * 0.035);
      ctx.lineWidth = Math.max(1.2, rr * (0.06 - i * 0.008));
      ctx.beginPath();
      ctx.arc(x, y, rr2, a0, a0 + span);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x, y, rr2 * 1.015, a0 + Math.PI, a0 + Math.PI + span * 0.8);
      ctx.stroke();
    }

    // Orbiting sparks.
    const sparkCount = enemyHole ? 14 : 18;
    for (let i = 0; i < sparkCount; i++) {
      const a = rot * (i % 3 === 0 ? 1.5 : 0.7) + (i / sparkCount) * TAU;
      const sr = rr * (1.02 + ((i * 7) % 9) * 0.026);
      const sx = x + Math.cos(a) * sr;
      const sy = y + Math.sin(a) * sr * 0.98;
      ctx.globalAlpha = 0.28 + (Math.sin(time * 4 + i) + 1) * 0.16;
      ctx.fillStyle = i % 4 === 0 ? secondary : primary;
      ctx.beginPath();
      ctx.arc(sx, sy, 0.8 + (i % 3) * 0.45, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.restore();

    // Event horizon.
    ctx.save();
    const core = ctx.createRadialGradient(x - rr * 0.16, y - rr * 0.16, rr * 0.06, x, y, rr);
    core.addColorStop(0, '#010103');
    core.addColorStop(0.7, '#000000');
    core.addColorStop(0.94, '#010104');
    core.addColorStop(1, '#08050a');
    ctx.fillStyle = core;
    ctx.beginPath();
    ctx.arc(x, y, rr, 0, TAU);
    ctx.fill();

    // Bright photon ring.
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = hexToRgba(secondary, enemyHole ? 0.78 : 0.9);
    ctx.lineWidth = Math.max(1.4, rr * 0.035);
    ctx.shadowColor = secondary;
    ctx.shadowBlur = Math.max(8, rr * 0.24);
    ctx.beginPath();
    ctx.arc(x, y, rr * 0.985, 0, TAU);
    ctx.stroke();

    ctx.strokeStyle = hexToRgba(primary, 0.56);
    ctx.lineWidth = Math.max(0.8, rr * 0.018);
    ctx.beginPath();
    ctx.arc(x, y, rr * 1.075, rot * 1.4, rot * 1.4 + TAU * 0.76);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.restore();

    if (opts.flash) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = opts.flash * 0.45;
      ctx.strokeStyle = '#fff3d8';
      ctx.lineWidth = 2 + rr * 0.04;
      ctx.beginPath();
      ctx.arc(x, y, rr * (1.1 + (1 - opts.flash) * 0.35), 0, TAU);
      ctx.stroke();
      ctx.restore();
    }

    if (enemyHole) {
      // Jagged hunter corona.
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = hexToRgba(primary, 0.3);
      ctx.lineWidth = 1.4;
      for (let i = 0; i < 12; i++) {
        const a = rot * 0.4 + (i / 12) * TAU;
        const r1 = rr * (1.12 + (i % 3) * 0.04);
        const r2 = rr * (1.28 + (i % 2) * 0.1);
        ctx.beginPath();
        ctx.moveTo(x + Math.cos(a) * r1, y + Math.sin(a) * r1);
        ctx.lineTo(x + Math.cos(a + 0.025) * r2, y + Math.sin(a + 0.025) * r2);
        ctx.stroke();
      }
      ctx.restore();
    }

    if (playerHole) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.2 + (Math.sin(time * 2.4) + 1) * 0.07;
      ctx.strokeStyle = palette.accent;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(x, y, rr * 1.42, 0, TAU);
      ctx.stroke();
      ctx.restore();
    }
  }

  function hexToRgba(hex, alpha) {
    if (!hex) return `rgba(255,255,255,${alpha})`;
    if (hex.startsWith('rgba') || hex.startsWith('rgb')) return hex;
    const clean = hex.replace('#', '');
    const full = clean.length === 3
      ? clean.split('').map((c) => c + c).join('')
      : clean;
    const num = parseInt(full, 16);
    const r = (num >> 16) & 255;
    const g = (num >> 8) & 255;
    const b = num & 255;
    return `rgba(${r},${g},${b},${alpha})`;
  }

  // ============================================================
  // Buildings
  // ============================================================
  function hsl(h, s, l, a) {
    return `hsla(${h.toFixed(1)}, ${s.toFixed(1)}%, ${l.toFixed(1)}%, ${a == null ? 1 : a})`;
  }

  function drawPrism(x, y, w, h, d, front, side, roof, edge) {
    const half = w / 2;
    const skew = d * 0.34;
    const frontBottom = y + d * 0.45;
    const frontTop = frontBottom - h;
    const backTop = frontTop - d;

    // right side
    ctx.fillStyle = side;
    ctx.beginPath();
    ctx.moveTo(x + half, frontTop);
    ctx.lineTo(x + half, frontBottom);
    ctx.lineTo(x + half + skew, frontBottom - d);
    ctx.lineTo(x + half + skew, backTop);
    ctx.closePath();
    ctx.fill();

    // front face
    const fg = ctx.createLinearGradient(0, frontTop, 0, frontBottom);
    fg.addColorStop(0, front);
    fg.addColorStop(1, side);
    ctx.fillStyle = fg;
    ctx.fillRect(x - half, frontTop, w, h);

    // roof
    ctx.fillStyle = roof;
    ctx.beginPath();
    ctx.moveTo(x - half, frontTop);
    ctx.lineTo(x + half, frontTop);
    ctx.lineTo(x + half + skew, backTop);
    ctx.lineTo(x - half + skew, backTop);
    ctx.closePath();
    ctx.fill();

    if (edge) {
      ctx.strokeStyle = edge;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x - half, frontTop);
      ctx.lineTo(x - half, frontBottom);
      ctx.lineTo(x + half, frontBottom);
      ctx.stroke();
    }
    return { frontTop, frontBottom, backTop, half, skew };
  }

  function drawWindows(x, y, w, h, seed, cols, rows, color, alpha, warmBias) {
    if (rows < 1 || cols < 1) return;
    const warmPct = warmBias == null ? 57 : warmBias;
    const padX = w * 0.1;
    const padY = h * 0.06;
    const cw = (w - padX * 2) / cols;
    const ch = (h - padY * 2) / rows;
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const v = hash2(c + 17, r + 41, seed);
        const lit = v % 100 < 43;
        if (!lit) {
          ctx.fillStyle = 'rgba(4, 9, 16, 0.32)';
          ctx.fillRect(x + padX + c * cw + cw * 0.18, y + padY + r * ch + ch * 0.2, cw * 0.64, ch * 0.58);
          continue;
        }
        const warm = (v % 100) < warmPct;
        ctx.fillStyle = warm ? `rgba(255, 208, 128, ${alpha})` : hexToRgba(color, alpha);
        ctx.fillRect(x + padX + c * cw + cw * 0.17, y + padY + r * ch + ch * 0.18, cw * 0.66, ch * 0.6);
        if (v % 5 === 0) {
          ctx.fillStyle = 'rgba(255, 255, 255, 0.13)';
          ctx.fillRect(x + padX + c * cw + cw * 0.2, y + padY + r * ch + ch * 0.22, cw * 0.24, ch * 0.18);
        }
      }
    }
    ctx.restore();
  }

  function drawBuilding(o, time) {
    const x = o.x;
    const y = o.y;
    const r = o.r;
    const h = o.h;
    const hue = o.hue;
    const seed = o.seed;
    const style = o.style;
    const w = r * 1.82;
    const d = r * 0.5;
    const front = hsl(hue, 23, 18);
    const side = hsl(hue, 24, 10.5);
    const roof = hsl(hue, 18, 23);
    const edge = 'rgba(255,255,255,0.055)';
    const accent = o.neon;

    drawGroundShadow(x, y, r, 0.42);

    if (style === 'house') {
      const wallH = h * 0.72;
      const half = w / 2;
      const frontBottom = y + d * 0.45;
      const frontTop = frontBottom - wallH;
      const roofTop = frontTop - h * 0.3;
      const skew = d * 0.34;
      // side wall
      ctx.fillStyle = side;
      ctx.beginPath();
      ctx.moveTo(x + half, frontTop);
      ctx.lineTo(x + half, frontBottom);
      ctx.lineTo(x + half + skew, frontBottom - d);
      ctx.lineTo(x + half + skew, frontTop - d);
      ctx.closePath();
      ctx.fill();
      // front wall
      const wallGrad = ctx.createLinearGradient(0, frontTop, 0, frontBottom);
      wallGrad.addColorStop(0, front);
      wallGrad.addColorStop(1, hsl(hue, 20, 12));
      ctx.fillStyle = wallGrad;
      ctx.fillRect(x - half, frontTop, w, wallH);
      // roof
      ctx.fillStyle = hsl(hue + 190, 26, 15);
      ctx.beginPath();
      ctx.moveTo(x - half - 5, frontTop);
      ctx.lineTo(x + half + 5, frontTop);
      ctx.lineTo(x + 4, roofTop);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.055)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x - half - 5, frontTop);
      ctx.lineTo(x + 4, roofTop);
      ctx.stroke();
      // windows
      const cols = w > 80 ? 3 : 2;
      drawWindows(x - w * 0.4, frontTop + wallH * 0.18, w * 0.8, wallH * 0.55, seed, cols, Math.max(1, Math.round(wallH / 32)), accent, 0.5, o.windowWarm);
      // door
      ctx.fillStyle = hsl(hue + 20, 28, 7);
      ctx.fillRect(x - w * 0.09, frontBottom - wallH * 0.28, w * 0.18, wallH * 0.27);
      ctx.fillStyle = 'rgba(255, 214, 140, 0.22)';
      ctx.fillRect(x - w * 0.06, frontBottom - wallH * 0.25, w * 0.12, wallH * 0.07);
      // chimney
      if (seed % 3 === 0) {
        ctx.fillStyle = hsl(hue, 18, 12);
        ctx.fillRect(x + w * 0.16, roofTop - 8, w * 0.09, 22);
      }
      // little rim light
      ctx.strokeStyle = hexToRgba(accent, 0.18);
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(x - half, frontTop + 2);
      ctx.lineTo(x - half, frontBottom);
      ctx.stroke();
      return;
    }

    if (style === 'warehouse') {
      const bodyH = h * 0.86;
      const ww = w * 1.06;
      const info = drawPrism(x, y, ww, bodyH, d, front, side, roof, edge);
      // corrugated front
      ctx.save();
      ctx.beginPath();
      ctx.rect(x - ww / 2, info.frontTop, ww, bodyH);
      ctx.clip();
      ctx.strokeStyle = 'rgba(255,255,255,0.035)';
      ctx.lineWidth = 1;
      for (let i = 0; i < 12; i++) {
        const lx = x - ww / 2 + i * ww / 11;
        ctx.beginPath();
        ctx.moveTo(lx, info.frontTop);
        ctx.lineTo(lx, info.frontBottom);
        ctx.stroke();
      }
      ctx.restore();
      // roof vents
      for (let i = -1; i <= 1; i++) {
        ctx.fillStyle = hsl(hue, 18, 27);
        ctx.fillRect(x + i * ww * 0.24 - 8, info.frontTop - d * 0.55, 16, 7);
      }
      // loading door
      ctx.fillStyle = hsl(hue, 20, 8);
      ctx.fillRect(x - ww * 0.25, info.frontBottom - bodyH * 0.46, ww * 0.5, bodyH * 0.45);
      ctx.strokeStyle = 'rgba(255,255,255,0.08)';
      ctx.strokeRect(x - ww * 0.25, info.frontBottom - bodyH * 0.46, ww * 0.5, bodyH * 0.45);
      ctx.fillStyle = hexToRgba(accent, 0.7);
      ctx.fillRect(x - ww * 0.02, info.frontBottom - bodyH * 0.64, ww * 0.04, 3);
      return;
    }

    if (style === 'shop') {
      const bodyH = h * 0.84;
      const ww = w * 0.96;
      const info = drawPrism(x, y, ww, bodyH, d, front, side, roof, edge);
      // sign band
      ctx.fillStyle = hsl(hue + 12, 25, 9);
      ctx.fillRect(x - ww * 0.46, info.frontTop + 4, ww * 0.92, Math.max(10, bodyH * 0.12));
      ctx.fillStyle = hexToRgba(accent, 0.65);
      ctx.font = `700 ${Math.max(6, r * 0.16)}px "SFMono-Regular", monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('OPEN', x, info.frontTop + 4 + Math.max(5, bodyH * 0.06));
      // large glowing storefront
      ctx.fillStyle = 'rgba(255, 210, 130, 0.14)';
      ctx.fillRect(x - ww * 0.38, info.frontBottom - bodyH * 0.3, ww * 0.76, bodyH * 0.27);
      ctx.fillStyle = hexToRgba(accent, 0.45);
      ctx.fillRect(x - ww * 0.37, info.frontBottom - bodyH * 0.31, ww * 0.74, 2);
      // awning
      ctx.fillStyle = hexToRgba(accent, 0.55);
      ctx.beginPath();
      ctx.moveTo(x - ww * 0.4, info.frontBottom - bodyH * 0.34);
      ctx.lineTo(x + ww * 0.4, info.frontBottom - bodyH * 0.34);
      ctx.lineTo(x + ww * 0.32, info.frontBottom - bodyH * 0.28);
      ctx.lineTo(x - ww * 0.32, info.frontBottom - bodyH * 0.28);
      ctx.closePath();
      ctx.fill();
      drawWindows(x - ww * 0.42, info.frontTop + bodyH * 0.2, ww * 0.84, bodyH * 0.3, seed, 4, Math.max(1, Math.round(bodyH / 38)), accent, 0.4, o.windowWarm);
      return;
    }

    if (style === 'mall') {
      const bodyH = h * 0.8;
      const ww = w * 1.08;
      const info = drawPrism(x, y, ww, bodyH, d * 1.15, front, side, roof, edge);
      ctx.fillStyle = hexToRgba(accent, 0.25);
      ctx.fillRect(x - ww * 0.44, info.frontTop + bodyH * 0.14, ww * 0.88, 5);
      drawWindows(x - ww * 0.46, info.frontTop + bodyH * 0.25, ww * 0.92, bodyH * 0.55, seed, 7, 3, accent, 0.35, o.windowWarm);
      ctx.fillStyle = 'rgba(255, 220, 155, 0.16)';
      ctx.fillRect(x - ww * 0.2, info.frontBottom - bodyH * 0.22, ww * 0.4, bodyH * 0.21);
      ctx.fillStyle = 'rgba(255, 245, 220, 0.7)';
      ctx.fillRect(x - ww * 0.2, info.frontTop + 8, ww * 0.4, 2);
      return;
    }

    if (style === 'artdeco') {
      let baseY = y + d * 0.45;
      const segments = [
        { w: w, h: h * 0.55, d: d * 1.06 },
        { w: w * 0.72, h: h * 0.28, d: d * 0.8 },
        { w: w * 0.46, h: h * 0.17, d: d * 0.55 }
      ];
      let offset = 0;
      for (let i = 0; i < segments.length; i++) {
        const seg = segments[i];
        const sy = baseY - offset;
        drawPrism(x, sy - seg.d * 0.45, seg.w, seg.h, seg.d, front, side, roof, edge);
        if (i === 0) {
          drawWindows(x - seg.w * 0.43, sy - seg.h, seg.w * 0.86, seg.h * 0.9, seed, 5, 9, accent, 0.46, o.windowWarm);
        } else {
          drawWindows(x - seg.w * 0.42, sy - seg.h, seg.w * 0.84, seg.h * 0.82, seed + i, 3, 4, accent, 0.5, o.windowWarm);
        }
        offset += seg.h;
      }
      const topY = baseY - offset;
      ctx.fillStyle = hexToRgba(accent, 0.75);
      ctx.shadowColor = accent;
      ctx.shadowBlur = 10;
      ctx.fillRect(x - 2, topY - 18, 4, 20);
      ctx.shadowBlur = 0;
      ctx.beginPath();
      ctx.arc(x, topY - 19, 3.5, 0, TAU);
      ctx.fill();
      return;
    }

    if (style === 'landmark') {
      let baseY = y + d * 0.45;
      const info = drawPrism(x, y, w * 1.08, h * 0.42, d * 1.1, front, side, roof, edge);
      drawWindows(x - w * 0.49, info.frontTop, w * 0.98, h * 0.38, seed, 7, 8, accent, 0.48, o.windowWarm);
      baseY -= h * 0.42;
      drawPrism(x, baseY - d * 0.42, w * 0.68, h * 0.3, d * 0.78, front, side, roof, edge);
      drawWindows(x - w * 0.31, baseY - h * 0.3, w * 0.62, h * 0.27, seed + 2, 4, 7, accent, 0.55, o.windowWarm);
      baseY -= h * 0.3;
      drawPrism(x, baseY - d * 0.34, w * 0.4, h * 0.22, d * 0.56, front, side, roof, edge);
      drawWindows(x - w * 0.18, baseY - h * 0.22, w * 0.36, h * 0.2, seed + 4, 3, 5, accent, 0.62, o.windowWarm);
      baseY -= h * 0.22;
      // crown
      ctx.fillStyle = hsl(hue, 32, 22);
      ctx.beginPath();
      ctx.moveTo(x - w * 0.23, baseY);
      ctx.lineTo(x + w * 0.23, baseY);
      ctx.lineTo(x + w * 0.09, baseY - 28);
      ctx.lineTo(x - w * 0.09, baseY - 28);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = hexToRgba(accent, 0.8);
      ctx.shadowColor = accent;
      ctx.shadowBlur = 18;
      ctx.beginPath();
      ctx.arc(x, baseY - 33, 5, 0, TAU);
      ctx.fill();
      ctx.fillRect(x - 1.2, baseY - 98, 2.4, 68);
      ctx.shadowBlur = 0;
      return;
    }

    if (style === 'glass' || style === 'modern') {
      const bodyH = h;
      const ww = w * (style === 'glass' ? 0.96 : 1);
      const info = drawPrism(x, y, ww, bodyH, d, front, side, roof, edge);
      if (style === 'glass') {
        const glass = ctx.createLinearGradient(x - ww / 2, info.frontTop, x + ww / 2, info.frontBottom);
        const tint = o.glassTint || '#4aa6dc';
        glass.addColorStop(0, hexToRgba(tint, 0.22));
        glass.addColorStop(0.34, hexToRgba(tint, 0.28));
        glass.addColorStop(0.65, hexToRgba(tint, 0.33));
        glass.addColorStop(1, hexToRgba(tint, 0.2));
        ctx.fillStyle = glass;
        ctx.fillRect(x - ww / 2, info.frontTop, ww, bodyH);
        // vertical mullions
        ctx.globalAlpha = 0.28;
        ctx.strokeStyle = hexToRgba(tint, 0.5);
        ctx.lineWidth = 1;
        for (let i = 1; i < 6; i++) {
          const lx = x - ww / 2 + i * ww / 6;
          ctx.beginPath();
          ctx.moveTo(lx, info.frontTop + 2);
          ctx.lineTo(lx, info.frontBottom);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
        drawWindows(x - ww * 0.47, info.frontTop + 12, ww * 0.94, bodyH - 24, seed, 6, Math.max(5, Math.floor(bodyH / 34)), accent, 0.55, o.windowWarm);
        // roof crown
        ctx.fillStyle = hexToRgba(accent, 0.55);
        ctx.fillRect(x - ww * 0.24, info.frontTop - d * 0.6, ww * 0.48, 3);
      } else {
        drawWindows(x - ww * 0.44, info.frontTop + 10, ww * 0.88, bodyH - 26, seed, 5, Math.max(4, Math.floor(bodyH / 30)), accent, 0.45, o.windowWarm);
        // vertical accent strips
        ctx.fillStyle = hexToRgba(accent, 0.17);
        ctx.fillRect(x - ww * 0.47, info.frontTop, 2, bodyH);
        ctx.fillRect(x + ww * 0.47 - 2, info.frontTop, 2, bodyH);
      }
      // rooftop units
      for (let i = -1; i <= 1; i++) {
        if (hash2(i + 8, o.seed % 97, seed) % 3 === 0) {
          ctx.fillStyle = hsl(hue, 14, 28);
          ctx.fillRect(x + i * ww * 0.24 - 8, info.frontTop - d * 0.75, 16, 7);
        }
      }
      // antenna
      if (hash2(o.seed, 3, seed) % 4 === 0) {
        ctx.strokeStyle = 'rgba(190, 220, 255, 0.45)';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(x + ww * 0.2, info.frontTop - d * 0.55);
        ctx.lineTo(x + ww * 0.2, info.frontTop - d * 0.55 - h * 0.12);
        ctx.stroke();
        ctx.fillStyle = '#ff6060';
        ctx.beginPath();
        ctx.arc(x + ww * 0.2, info.frontTop - d * 0.55 - h * 0.12, 2.6, 0, TAU);
        ctx.fill();
      }
      return;
    }

    // Fallback box.
    const info = drawPrism(x, y, w, h, d, front, side, roof, edge);
    drawWindows(x - w * 0.44, info.frontTop + 8, w * 0.88, h - 20, seed, 5, Math.max(3, Math.floor(h / 30)), accent, 0.42, o.windowWarm);
  }

  // ============================================================
  // Props
  // ============================================================
  function drawPerson(o, time) {
    const x = o.x;
    const y = o.y;
    const bob = Math.sin(time * 3.2 + o.bob) * 1.5;
    const h = o.h;
    const hue = o.hue;
    const walk = Math.sin(time * 4.4 + o.bob) * 3;
    ctx.fillStyle = hsl(hue, 42, 38);
    roundedRect(ctx, x - 3.2, y - h * 0.52 + bob, 6.4, h * 0.27, 2.6);
    ctx.fill();
    // legs
    ctx.strokeStyle = hsl(hue + 20, 15, 10);
    ctx.lineWidth = 2.3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x - 2.2, y - h * 0.27 + bob);
    ctx.lineTo(x - 3.2 + walk, y - 1);
    ctx.moveTo(x + 2.2, y - h * 0.27 + bob);
    ctx.lineTo(x + 3.2 - walk, y - 1);
    ctx.stroke();
    // arms
    ctx.strokeStyle = hsl(hue, 34, 27);
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(x - 3, y - h * 0.46 + bob);
    ctx.lineTo(x - 5.4, y - h * 0.26 + bob - walk * 0.35);
    ctx.moveTo(x + 3, y - h * 0.46 + bob);
    ctx.lineTo(x + 5.4, y - h * 0.26 + bob + walk * 0.35);
    ctx.stroke();
    // head
    ctx.fillStyle = hsl(31, 43, 68);
    ctx.beginPath();
    ctx.arc(x, y - h * 0.64 + bob, h * 0.115, 0, TAU);
    ctx.fill();
    if (hash2(o.seed, 4, 99) % 3 === 0) {
      ctx.strokeStyle = hexToRgba(o.neon || '#7de9ff', 0.5);
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.arc(x, y - h * 0.66 + bob, h * 0.17, Math.PI * 1.05, Math.PI * 1.95);
      ctx.stroke();
    }
  }

  function drawTree(o, time) {
    const x = o.x;
    const y = o.y;
    const sway = Math.sin(time * 1.5 + o.phase) * 2.5;
    const h = o.h;
    ctx.strokeStyle = '#2b2018';
    ctx.lineWidth = Math.max(2.5, o.r * 0.15);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + sway * 0.2, y - h * 0.48);
    ctx.stroke();
    const green = `hsl(${o.hue}, 34%, 22%)`;
    const green2 = `hsl(${o.hue + 12}, 38%, 28%)`;
    const blobs = [
      { x: x - o.r * 0.37 + sway, y: y - h * 0.63, r: o.r * 0.55 },
      { x: x + o.r * 0.38 + sway, y: y - h * 0.67, r: o.r * 0.62 },
      { x: x + sway * 1.2, y: y - h * 0.83, r: o.r * 0.7 },
      { x: x - o.r * 0.05 + sway, y: y - h * 0.55, r: o.r * 0.5 }
    ];
    for (let i = 0; i < blobs.length; i++) {
      const b = blobs[i];
      const g = ctx.createRadialGradient(b.x - b.r * 0.24, b.y - b.r * 0.28, 0, b.x, b.y, b.r);
      g.addColorStop(0, green2);
      g.addColorStop(1, green);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = '#9affcf';
    ctx.beginPath();
    ctx.arc(x + sway * 1.2 - o.r * 0.17, y - h * 0.83 - o.r * 0.2, o.r * 0.19, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  function drawBush(o, time) {
    const x = o.x;
    const y = o.y;
    const hue = o.hue;
    for (let i = 0; i < 3; i++) {
      const bx = x + (i - 1) * o.r * 0.34;
      const by = y - o.h * 0.34 - (i === 1 ? o.h * 0.12 : 0);
      ctx.fillStyle = hsl(hue + i * 7, 32, 19 + i * 2);
      ctx.beginPath();
      ctx.arc(bx, by, o.r * 0.52, 0, TAU);
      ctx.fill();
    }
  }

  function drawTrash(o) {
    const x = o.x;
    const y = o.y;
    const w = o.r * 1.25;
    ctx.fillStyle = 'hsl(198, 12%, 27%)';
    roundedRect(ctx, x - w / 2, y - o.h, w, o.h, 3);
    ctx.fill();
    ctx.fillStyle = 'hsl(198, 11%, 36%)';
    ctx.beginPath();
    ctx.ellipse(x, y - o.h, w / 2, w * 0.18, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    for (let i = 0; i < 3; i++) {
      ctx.fillRect(x - w * 0.3, y - o.h * (0.2 + i * 0.23), w * 0.6, 2);
    }
  }

  function drawDumpster(o) {
    const x = o.x;
    const y = o.y;
    const w = o.r * 1.8;
    ctx.fillStyle = '#1e3b36';
    ctx.beginPath();
    ctx.moveTo(x - w / 2, y);
    ctx.lineTo(x + w / 2, y);
    ctx.lineTo(x + w * 0.43, y - o.h);
    ctx.lineTo(x - w * 0.43, y - o.h);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#2f5a4e';
    ctx.fillRect(x - w * 0.45, y - o.h - 3, w * 0.9, 5);
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x - w * 0.1, y - o.h);
    ctx.lineTo(x - w * 0.16, y);
    ctx.stroke();
  }

  function drawBench(o) {
    const x = o.x;
    const y = o.y;
    const w = o.r * 1.9;
    const h = o.h;
    ctx.fillStyle = '#4c3424';
    ctx.fillRect(x - w * 0.42, y - h, w * 0.84, 4);
    ctx.fillStyle = '#76573a';
    ctx.fillRect(x - w * 0.44, y - h - 4, w * 0.88, 4);
    ctx.fillRect(x - w * 0.36, y - h - 8, w * 0.72, 4);
    ctx.strokeStyle = '#2b2420';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x - w * 0.34, y - h);
    ctx.lineTo(x - w * 0.34, y);
    ctx.moveTo(x + w * 0.34, y - h);
    ctx.lineTo(x + w * 0.34, y);
    ctx.stroke();
  }

  function drawLamp(o, time) {
    const x = o.x;
    const y = o.y;
    const h = o.h;
    const col = o.neon || '#ffc87a';
    const pool = ctx.createRadialGradient(x, y, 2, x, y, o.r * 7.5);
    pool.addColorStop(0, hexToRgba(col, 0.1));
    pool.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = pool;
    ctx.beginPath();
    ctx.ellipse(x, y, o.r * 7.5, o.r * 3.1, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = 'rgba(180, 196, 218, 0.45)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, y - h);
    ctx.stroke();
    ctx.fillStyle = col;
    ctx.shadowColor = col;
    ctx.shadowBlur = 14;
    ctx.beginPath();
    ctx.arc(x, y - h, o.r * 1.35, 0, TAU);
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  function drawPlanter(o) {
    const x = o.x;
    const y = o.y;
    ctx.fillStyle = '#3a2d26';
    roundedRect(ctx, x - o.r * 0.7, y - o.h * 0.55, o.r * 1.4, o.h * 0.55, 3);
    ctx.fill();
    ctx.fillStyle = hsl(o.hue, 30, 22);
    ctx.beginPath();
    ctx.arc(x - o.r * 0.28, y - o.h * 0.78, o.r * 0.45, 0, TAU);
    ctx.arc(x + o.r * 0.26, y - o.h * 0.82, o.r * 0.5, 0, TAU);
    ctx.arc(x, y - o.h, o.r * 0.43, 0, TAU);
    ctx.fill();
  }

  function drawHydrant(o) {
    const x = o.x;
    const y = o.y;
    const w = o.r * 1.2;
    ctx.fillStyle = '#c84342';
    roundedRect(ctx, x - w / 2, y - o.h, w, o.h, 3);
    ctx.fill();
    ctx.fillStyle = '#ed6862';
    ctx.fillRect(x - w * 0.72, y - o.h * 0.5, w * 1.44, 3);
    ctx.beginPath();
    ctx.arc(x, y - o.h, w * 0.46, Math.PI, TAU);
    ctx.fill();
  }

  function drawMailbox(o) {
    const x = o.x;
    const y = o.y;
    ctx.fillStyle = '#2b5f9b';
    roundedRect(ctx, x - o.r, y - o.h, o.r * 2, o.h * 0.72, 5);
    ctx.fill();
    ctx.strokeStyle = '#8fa2b8';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(x, y - o.h);
    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fillRect(x - o.r * 0.6, y - o.h * 0.82, o.r * 0.65, 1.5);
  }

  function drawCone(o) {
    const x = o.x;
    const y = o.y;
    ctx.fillStyle = '#ff743d';
    ctx.beginPath();
    ctx.moveTo(x, y - o.h);
    ctx.lineTo(x + o.r, y);
    ctx.lineTo(x - o.r, y);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.68)';
    ctx.beginPath();
    ctx.moveTo(x - o.r * 0.36, y - o.h * 0.54);
    ctx.lineTo(x + o.r * 0.36, y - o.h * 0.54);
    ctx.lineTo(x + o.r * 0.51, y - o.h * 0.36);
    ctx.lineTo(x - o.r * 0.51, y - o.h * 0.36);
    ctx.closePath();
    ctx.fill();
  }

  function drawVehicle(o, time) {
    const x = o.x;
    const y = o.y;
    const type = o.typeKey;
    const maxLen = o.r * 1.65;
    const width = o.r * (type === 'bus' ? 0.68 : 0.78);
    const length = type === 'bus' ? o.r * 2.2 : o.r * 1.85;
    const hue = o.hue;
    const body = hsl(hue, 38, 33);
    const body2 = hsl(hue, 40, 47);
    const roofCol = hsl(hue, 30, 22);

    ctx.save();
    ctx.translate(x, y + 3);
    ctx.rotate(o.angle);
    ctx.fillStyle = 'rgba(0,0,0,0.32)';
    ctx.beginPath();
    ctx.ellipse(0, 0, length * 0.58, width * 0.72, 0, 0, TAU);
    ctx.fill();

    // wheels
    ctx.fillStyle = '#07090d';
    const wheelY = width * 0.49;
    const wheelX = length * 0.28;
    [-1, 1].forEach((side) => {
      ctx.beginPath();
      ctx.ellipse(-wheelX, side * wheelY, length * 0.11, width * 0.14, 0, 0, TAU);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(wheelX, side * wheelY, length * 0.11, width * 0.14, 0, 0, TAU);
      ctx.fill();
    });
    // body
    const grad = ctx.createLinearGradient(0, -width / 2, 0, width / 2);
    grad.addColorStop(0, body2);
    grad.addColorStop(0.55, body);
    grad.addColorStop(1, hsl(hue, 38, 24));
    ctx.fillStyle = grad;
    roundedRect(ctx, -length / 2, -width / 2, length, width, type === 'bus' ? 4 : 7);
    ctx.fill();
    // cabin
    ctx.fillStyle = roofCol;
    roundedRect(ctx, -length * 0.25, -width * 0.4, length * (type === 'bus' ? 0.55 : 0.48), width * 0.8, 4);
    ctx.fill();
    // windshield
    ctx.fillStyle = 'rgba(122, 218, 255, 0.38)';
    roundedRect(ctx, length * 0.2, -width * 0.33, length * 0.16, width * 0.66, 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(140, 218, 255, 0.23)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 3; i++) {
      const lx = -length * 0.22 + i * length * 0.18;
      ctx.beginPath();
      ctx.moveTo(lx, -width * 0.34);
      ctx.lineTo(lx, width * 0.34);
      ctx.stroke();
    }
    // headlights
    ctx.fillStyle = 'rgba(255, 236, 176, 0.84)';
    ctx.beginPath();
    ctx.ellipse(length * 0.46, -width * 0.24, 2.2, 1.7, 0, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(length * 0.46, width * 0.24, 2.2, 1.7, 0, 0, TAU);
    ctx.fill();
    // race stripe
    if (o.seed % 3 === 0) {
      ctx.fillStyle = hexToRgba(o.neon || '#ffd36b', 0.55);
      ctx.fillRect(-length * 0.34, -1.2, length * 0.68, 2.4);
    }
    ctx.restore();
    void maxLen;
  }

  function drawKiosk(o, time) {
    const x = o.x;
    const y = o.y;
    const w = o.r * 1.9;
    drawPrism(x, y, w, o.h, o.r * 0.45, hsl(o.hue, 27, 22), hsl(o.hue, 27, 13), hsl(o.hue, 24, 28), 'rgba(255,255,255,0.05)');
    // awning
    ctx.fillStyle = hexToRgba(o.neon || '#ffd57f', 0.65);
    ctx.beginPath();
    ctx.moveTo(x - w * 0.62, y - o.h * 0.72);
    ctx.lineTo(x + w * 0.62, y - o.h * 0.72);
    ctx.lineTo(x + w * 0.45, y - o.h * 0.58);
    ctx.lineTo(x - w * 0.45, y - o.h * 0.58);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 218, 145, 0.24)';
    ctx.fillRect(x - w * 0.35, y - o.h * 0.45, w * 0.7, o.h * 0.25);
    // tiny bulb
    ctx.fillStyle = '#ffe3a0';
    ctx.beginPath();
    ctx.arc(x, y - o.h - 4, 1.8 + Math.sin(time * 5 + o.phase) * 0.5, 0, TAU);
    ctx.fill();
  }

  function drawFountain(o, time) {
    const x = o.x;
    const y = o.y;
    const rw = o.r * 1.3;
    ctx.fillStyle = 'rgba(32, 48, 70, 0.9)';
    ctx.beginPath();
    ctx.ellipse(x, y, rw, rw * 0.42, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = 'rgba(112, 220, 255, 0.32)';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.ellipse(x, y, rw, rw * 0.42, 0, 0, TAU);
    ctx.stroke();
    const water = ctx.createRadialGradient(x, y - 4, 2, x, y - 4, rw * 0.8);
    water.addColorStop(0, 'rgba(124, 238, 255, 0.48)');
    water.addColorStop(1, 'rgba(40, 100, 160, 0.06)');
    ctx.fillStyle = water;
    ctx.beginPath();
    ctx.ellipse(x, y - 3, rw * 0.84, rw * 0.31, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = 'rgba(143, 243, 255, 0.5)';
    ctx.lineWidth = 1.2;
    for (let i = 0; i < 7; i++) {
      const a = time * 0.7 + i / 7 * TAU;
      const spread = 7 + i * 3.4;
      ctx.beginPath();
      ctx.moveTo(x, y - o.h * 0.45);
      ctx.quadraticCurveTo(x + Math.cos(a) * spread, y - o.h * 0.3, x + Math.cos(a) * spread * 1.9, y - o.h * 0.06);
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(168, 248, 255, 0.55)';
    ctx.beginPath();
    ctx.arc(x, y - o.h * 0.47, 2.5, 0, TAU);
    ctx.fill();
  }

  function drawStatue(o) {
    const x = o.x;
    const y = o.y;
    const h = o.h;
    ctx.fillStyle = '#3b4657';
    ctx.fillRect(x - o.r * 0.55, y - h * 0.2, o.r * 1.1, h * 0.2);
    ctx.fillStyle = '#707c8d';
    ctx.fillRect(x - o.r * 0.32, y - h * 0.24, o.r * 0.64, 5);
    ctx.strokeStyle = '#a7b0bd';
    ctx.lineWidth = Math.max(2, o.r * 0.1);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x, y - h * 0.22);
    ctx.lineTo(x, y - h * 0.58);
    ctx.moveTo(x, y - h * 0.5);
    ctx.lineTo(x - o.r * 0.3, y - h * 0.8);
    ctx.moveTo(x, y - h * 0.5);
    ctx.lineTo(x + o.r * 0.3, y - h * 0.8);
    ctx.stroke();
    ctx.fillStyle = '#c2c8d0';
    ctx.beginPath();
    ctx.arc(x, y - h * 0.68, o.r * 0.18, 0, TAU);
    ctx.fill();
  }

  function drawBarrel(o) {
    const x = o.x;
    const y = o.y;
    const r = o.r;
    const h = o.h;
    const hue = o.hue;
    ctx.fillStyle = hsl(hue, 38, 20);
    roundedRect(ctx, x - r, y - h, r * 2, h, r * 0.35);
    ctx.fill();
    ctx.fillStyle = hsl(hue, 42, 30);
    ctx.beginPath();
    ctx.ellipse(x, y - h, r, r * 0.4, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = hsl(hue, 20, 12);
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.ellipse(x, y - h * 0.62, r * 0.98, r * 0.3, 0, 0, TAU);
    ctx.moveTo(x - r, y - h * 0.3);
    ctx.ellipse(x, y - h * 0.3, r, r * 0.3, 0, 0, TAU);
    ctx.stroke();
    ctx.fillStyle = hexToRgba(o.neon || '#ffb454', 0.45);
    ctx.fillRect(x - r * 0.7, y - h * 0.53, r * 1.4, 2.2);
  }

  function drawContainer(o, time) {
    const x = o.x;
    const y = o.y;
    const hue = o.hue;
    const w = o.r * 2.05;
    const h = o.h * 0.82;
    const d = o.r * 0.52;
    const front = hsl(hue, 30, 24);
    const side = hsl(hue, 32, 15);
    const roof = hsl(hue, 26, 31);
    const info = drawPrism(x, y, w, h, d, front, side, roof, 'rgba(255,255,255,0.06)');
    ctx.save();
    ctx.beginPath();
    ctx.rect(x - w / 2, info.frontTop, w, h);
    ctx.clip();
    ctx.strokeStyle = 'rgba(0,0,0,0.24)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 14; i++) {
      const lx = x - w / 2 + (i + 0.5) * (w / 14);
      ctx.beginPath();
      ctx.moveTo(lx, info.frontTop);
      ctx.lineTo(lx, info.frontBottom);
      ctx.stroke();
    }
    ctx.restore();
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.fillRect(x - w / 2, info.frontTop + h * 0.42, w, 3);
    const label = ['IRON', 'CARGO', 'PORT'][o.seed % 3];
    ctx.fillStyle = hexToRgba(o.neon || '#ffd08a', 0.5);
    ctx.font = `700 ${Math.max(5, o.r * 0.26)}px "SFMono-Regular", monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x, info.frontTop + h * 0.24);
    void time;
  }

  function drawCrane(o, time) {
    const x = o.x;
    const y = o.y;
    const hue = o.hue;
    const h = o.h;
    const span = o.r * 1.55;
    const topY = y - h * 0.8;
    const legH = y - topY;
    const body = hsl(hue, 26, 21);
    const dark = hsl(hue, 24, 12);
    const lat = hsl(hue, 24, 15);
    const lit = hexToRgba(o.neon || '#ffb454', 0.55);

    // Ground rails the gantry rolls on.
    ctx.fillStyle = 'rgba(0, 0, 0, 0.34)';
    ctx.fillRect(x - span * 1.16, y - 2, span * 2.32, 3);
    ctx.fillStyle = hexToRgba('#ffb454', 0.12);
    ctx.fillRect(x - span * 1.16, y - 2, span * 2.32, 1);

    // A-frame legs.
    ctx.strokeStyle = body;
    ctx.lineWidth = Math.max(4, o.r * 0.13);
    ctx.lineCap = 'square';
    const legX = (s, t, inner) => x + s * span * (inner ? 0.58 - 0.24 * t : 1 - 0.66 * t);
    for (let s = -1; s <= 1; s += 2) {
      ctx.beginPath();
      ctx.moveTo(legX(s, 0, false), y);
      ctx.lineTo(legX(s, 1, false), topY);
      ctx.moveTo(legX(s, 0, true), y);
      ctx.lineTo(legX(s, 1, true), topY);
      ctx.stroke();
    }

    // Lattice bracing between the leg pairs.
    ctx.strokeStyle = lat;
    ctx.lineWidth = Math.max(1.4, o.r * 0.045);
    ctx.beginPath();
    for (let s = -1; s <= 1; s += 2) {
      for (let i = 0; i < 3; i++) {
        const t0 = i / 3;
        const t1 = (i + 1) / 3;
        ctx.moveTo(legX(s, t0, false), y - legH * t0);
        ctx.lineTo(legX(s, t1, true), y - legH * t1);
        ctx.moveTo(legX(s, t0, true), y - legH * t0);
        ctx.lineTo(legX(s, t1, false), y - legH * t1);
      }
    }
    ctx.stroke();

    // Top beam.
    ctx.fillStyle = body;
    ctx.fillRect(x - span * 1.06, topY, span * 2.12, Math.max(5, h * 0.04));
    ctx.fillStyle = dark;
    ctx.fillRect(x - span * 1.06, topY + Math.max(5, h * 0.04) - 2, span * 2.12, 2);

    // Trolley, cable and the container it is lifting.
    const trolleyX = x + Math.sin(time * 0.6 + o.phase) * span * 0.5;
    ctx.fillStyle = hsl(hue, 22, 34);
    ctx.fillRect(trolleyX - 8, topY + 2, 16, 8);
    const drop = legH * (0.56 + Math.sin(time * 1.1 + o.phase) * 0.05);
    const loadY = topY + drop;
    ctx.strokeStyle = 'rgba(224, 232, 244, 0.4)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(trolleyX, topY + 8);
    ctx.lineTo(trolleyX, loadY);
    ctx.stroke();
    const cw = span * 0.5;
    const chh = Math.max(9, h * 0.052);
    ctx.fillStyle = hsl(26, 30, 26);
    ctx.fillRect(trolleyX - cw / 2, loadY, cw, chh);
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.lineWidth = 1;
    for (let i = 1; i < 6; i++) {
      const lx = trolleyX - cw / 2 + (i / 6) * cw;
      ctx.beginPath();
      ctx.moveTo(lx, loadY);
      ctx.lineTo(lx, loadY + chh);
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(255, 214, 150, 0.28)';
    ctx.strokeRect(trolleyX - cw / 2, loadY, cw, chh);

    // Warning light on the beam tip.
    const blink = 0.4 + Math.sin(time * 3 + o.phase) * 0.35;
    ctx.fillStyle = hexToRgba('#ff5b5b', blink);
    ctx.shadowColor = '#ff5b5b';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(x + span * 0.98, topY - 4, 3, 0, TAU);
    ctx.fill();
    ctx.shadowBlur = 0;
    // Painted hazard stripe on the beam.
    ctx.fillStyle = lit;
    ctx.fillRect(x - span * 0.42, topY + 1, span * 0.84, 2);
  }

  function drawHolo(o, time) {
    const x = o.x;
    const y = o.y;
    const r = o.r;
    const h = o.h;
    const hue = o.hue;
    // Base.
    drawPrism(x, y, r * 1.7, 20, r * 0.5, hsl(hue, 22, 20), hsl(hue, 24, 11), hsl(hue, 20, 27), 'rgba(255,255,255,0.06)');
    // Light column.
    const top = y - h;
    const glow = ctx.createLinearGradient(0, top, 0, y - 12);
    glow.addColorStop(0, hexToRgba(o.neon || '#7ef0ff', 0.02));
    glow.addColorStop(0.55, hexToRgba(o.neon || '#7ef0ff', 0.16));
    glow.addColorStop(1, hexToRgba(o.neon || '#7ef0ff', 0.05));
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = glow;
    const w = r * 1.5 * (0.85 + Math.sin(time * 1.6 + o.phase) * 0.06);
    ctx.fillRect(x - w / 2, top, w, h - 16);
    // Scan lines.
    ctx.strokeStyle = hexToRgba(o.neon || '#7ef0ff', 0.24);
    ctx.lineWidth = 1;
    for (let i = 0; i < 8; i++) {
      const yy = top + ((time * 26 + i * (h / 8)) % (h - 18));
      ctx.beginPath();
      ctx.moveTo(x - w / 2 + 3, yy);
      ctx.lineTo(x + w / 2 - 3, yy);
      ctx.stroke();
    }
    // Emblem.
    ctx.strokeStyle = hexToRgba(o.neon || '#7ef0ff', 0.55);
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(x, top + h * 0.3, r * 0.42, time * 0.8, time * 0.8 + TAU * 0.78);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x, top + h * 0.3, r * 0.24, -time * 1.1, -time * 1.1 + TAU * 0.6);
    ctx.stroke();
    ctx.restore();
    // Frame edges.
    ctx.strokeStyle = hexToRgba(o.neon || '#7ef0ff', 0.3);
    ctx.lineWidth = 1.2;
    ctx.strokeRect(x - w / 2, top, w, h - 16);
    ctx.fillStyle = hexToRgba(o.neon || '#7ef0ff', 0.5);
    ctx.fillRect(x - r * 0.5, y - 12, r, 2);
  }

  function drawProp(o, time) {
    const type = o.typeKey;
    drawGroundShadow(o.x, o.y, o.r, 0.34);
    switch (type) {
      case 'person': drawPerson(o, time); break;
      case 'tree': drawTree(o, time); break;
      case 'bush': drawBush(o, time); break;
      case 'trash': drawTrash(o); break;
      case 'dumpster': drawDumpster(o); break;
      case 'bench': drawBench(o); break;
      case 'lamp': drawLamp(o, time); break;
      case 'planter': drawPlanter(o); break;
      case 'hydrant': drawHydrant(o); break;
      case 'mailbox': drawMailbox(o); break;
      case 'cone': drawCone(o); break;
      case 'barrel': drawBarrel(o); break;
      case 'container': drawContainer(o, time); break;
      case 'crane': drawCrane(o, time); break;
      case 'holo': drawHolo(o, time); break;
      case 'car':
      case 'van':
      case 'bus': drawVehicle(o, time); break;
      case 'kiosk': drawKiosk(o, time); break;
      case 'fountain': drawFountain(o, time); break;
      case 'statue': drawStatue(o); break;
      default:
        drawGroundShadow(o.x, o.y, o.r, 0.3);
        ctx.fillStyle = 'rgba(200,220,255,0.4)';
        ctx.fillRect(o.x - o.r, o.y - o.h, o.r * 2, o.h);
    }
  }

  // ============================================================
  // Goal tower
  // ============================================================
  function drawGoalTower(o, time) {
    const p = game.player;
    const unlocked = p && p.level >= MAX_LEVEL;
    const locked = !unlocked;
    const accent = unlocked ? '#ffd36e' : '#ff7b9d';
    let winP = 0;
    if (game.mode === 'winning') winP = clamp(game.winTimer / 2.8, 0, 1);
    const easeWin = winP * winP * (3 - 2 * winP);

    ctx.save();
    if (winP > 0 && p) {
      const tx = lerp(o.x, p.x, easeWin * 0.75);
      const ty = lerp(o.y, p.y, easeWin * 0.35);
      const sc = 1 - easeWin * 0.9;
      ctx.translate(tx, ty);
      ctx.rotate(easeWin * 0.34);
      ctx.scale(sc, sc);
      ctx.translate(-o.x, -o.y);
      ctx.globalAlpha = 1 - easeWin * 0.34;
    }

    drawGroundShadow(o.x, o.y, o.r * 1.3, 0.56);

    // Sky beam.
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const beamTop = o.y - o.h - 220;
    const beam = ctx.createLinearGradient(0, beamTop, 0, o.y);
    beam.addColorStop(0, 'rgba(255, 208, 114, 0)');
    beam.addColorStop(0.32, unlocked ? 'rgba(255, 211, 113, 0.06)' : 'rgba(255, 102, 142, 0.035)');
    beam.addColorStop(0.84, unlocked ? 'rgba(255, 195, 84, 0.13)' : 'rgba(255, 84, 128, 0.07)');
    beam.addColorStop(1, 'rgba(255, 186, 72, 0)');
    ctx.fillStyle = beam;
    const beamW = o.r * (0.22 + Math.sin(time * 1.3) * 0.025);
    ctx.fillRect(o.x - beamW / 2, beamTop, beamW, o.h + 220);
    ctx.restore();

    // Base energy rings.
    ctx.save();
    for (let i = 0; i < 3; i++) {
      const rr = o.r * (1.18 + i * 0.2);
      ctx.strokeStyle = hexToRgba(accent, (locked ? 0.14 : 0.18) - i * 0.035);
      ctx.lineWidth = i === 0 ? 3 : 1.4;
      ctx.setLineDash(i === 0 ? [26, 18] : [8, 16]);
      ctx.beginPath();
      ctx.ellipse(o.x, o.y + 8, rr, rr * 0.4, 0, 0, TAU);
      ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.restore();

    // Podium.
    const podium = drawPrism(
      o.x,
      o.y + 12,
      o.r * 1.88,
      92,
      o.r * 0.62,
      unlocked ? 'hsl(36, 31%, 21%)' : 'hsl(340, 24%, 19%)',
      unlocked ? 'hsl(34, 28%, 12%)' : 'hsl(342, 24%, 11%)',
      unlocked ? 'hsl(39, 27%, 28%)' : 'hsl(338, 23%, 25%)',
      'rgba(255,255,255,0.08)'
    );
    // podium glass strip
    const strip = ctx.createLinearGradient(o.x - o.r, 0, o.x + o.r, 0);
    strip.addColorStop(0, 'rgba(255, 191, 84, 0.08)');
    strip.addColorStop(0.5, unlocked ? 'rgba(255, 216, 130, 0.34)' : 'rgba(255, 98, 138, 0.18)');
    strip.addColorStop(1, 'rgba(255, 191, 84, 0.08)');
    ctx.fillStyle = strip;
    ctx.fillRect(o.x - o.r * 0.82, podium.frontTop + 26, o.r * 1.64, 15);
    for (let i = -1; i <= 1; i++) {
      ctx.fillStyle = i === 0 ? hexToRgba(accent, 0.55) : 'rgba(255,255,255,0.04)';
      ctx.fillRect(o.x + i * o.r * 0.46 - 12, podium.frontTop + 53, 24, 22);
    }

    // Main 30-floor body.
    const bodyBase = o.y - 58;
    const bodyH = o.h - 118;
    const body = drawPrism(
      o.x,
      bodyBase,
      o.r * 1.5,
      bodyH,
      o.r * 0.66,
      unlocked ? 'hsl(216, 25%, 18%)' : 'hsl(220, 22%, 16%)',
      unlocked ? 'hsl(218, 24%, 10%)' : 'hsl(220, 22%, 9%)',
      unlocked ? 'hsl(38, 25%, 26%)' : 'hsl(338, 20%, 22%)',
      'rgba(255,255,255,0.06)'
    );

    // Curtain glass gradient.
    const bodyGlass = ctx.createLinearGradient(o.x - o.r * 0.75, body.frontTop, o.x + o.r * 0.75, body.frontBottom);
    bodyGlass.addColorStop(0, 'rgba(64, 121, 168, 0.17)');
    bodyGlass.addColorStop(0.42, 'rgba(25, 62, 98, 0.22)');
    bodyGlass.addColorStop(0.72, 'rgba(13, 34, 60, 0.24)');
    bodyGlass.addColorStop(1, 'rgba(9, 21, 39, 0.18)');
    ctx.fillStyle = bodyGlass;
    ctx.fillRect(o.x - o.r * 0.75, body.frontTop, o.r * 1.5, bodyH);

    // 30 floors of windows.
    drawWindows(
      o.x - o.r * 0.68,
      body.frontTop + 8,
      o.r * 1.36,
      bodyH - 18,
      o.seed,
      5,
      30,
      '#ffd47c',
      0.6
    );

    // Floor bands + vertical mullions.
    ctx.save();
    ctx.beginPath();
    ctx.rect(o.x - o.r * 0.75, body.frontTop, o.r * 1.5, bodyH);
    ctx.clip();
    ctx.strokeStyle = 'rgba(255, 209, 125, 0.12)';
    ctx.lineWidth = 0.8;
    const fh = (bodyH - 18) / 30;
    for (let i = 0; i <= 30; i++) {
      const yy = body.frontTop + 8 + i * fh;
      ctx.beginPath();
      ctx.moveTo(o.x - o.r * 0.7, yy);
      ctx.lineTo(o.x + o.r * 0.7, yy);
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(140, 222, 255, 0.09)';
    for (let i = 0; i < 6; i++) {
      const xx = o.x - o.r * 0.68 + i * (o.r * 1.36 / 5);
      ctx.beginPath();
      ctx.moveTo(xx, body.frontTop);
      ctx.lineTo(xx, body.frontBottom);
      ctx.stroke();
    }
    ctx.restore();

    // Corner lights.
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 30; i += 3) {
      const yy = body.frontTop + 11 + i * fh;
      ctx.fillStyle = i % 6 === 0 ? 'rgba(255, 220, 145, 0.34)' : 'rgba(120, 225, 255, 0.18)';
      ctx.fillRect(o.x - o.r * 0.77, yy, 3, Math.max(2, fh * 0.5));
      ctx.fillRect(o.x + o.r * 0.74, yy, 3, Math.max(2, fh * 0.5));
    }
    ctx.restore();

    // Roof and crown.
    const topY = body.frontTop - o.r * 0.2;
    ctx.fillStyle = unlocked ? 'hsl(39, 28%, 28%)' : 'hsl(341, 24%, 24%)';
    ctx.beginPath();
    ctx.moveTo(o.x - o.r * 0.8, body.frontTop);
    ctx.lineTo(o.x + o.r * 0.8, body.frontTop);
    ctx.lineTo(o.x + o.r * 0.55, topY - 22);
    ctx.lineTo(o.x - o.r * 0.55, topY - 22);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = hexToRgba(accent, 0.16);
    ctx.fillRect(o.x - o.r * 0.5, topY - 18, o.r, 4);
    // antenna
    ctx.strokeStyle = 'rgba(207, 224, 244, 0.52)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(o.x, topY - 22);
    ctx.lineTo(o.x, topY - 118);
    ctx.stroke();
    ctx.fillStyle = hexToRgba(accent, 0.8);
    ctx.shadowColor = accent;
    ctx.shadowBlur = 26;
    ctx.beginPath();
    ctx.arc(o.x, topY - 126, 7, 0, TAU);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Locked shield.
    if (locked) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = `rgba(255, 84, 131, ${0.24 + Math.sin(time * 2.2) * 0.08})`;
      ctx.lineWidth = 2.4;
      ctx.setLineDash([18, 14]);
      ctx.beginPath();
      ctx.ellipse(o.x, o.y + 10, o.r * 1.35, o.r * 0.54, 0, time * 0.2, time * 0.2 + TAU);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.strokeStyle = 'rgba(255, 108, 146, 0.1)';
      ctx.lineWidth = 1;
      for (let i = 0; i < 8; i++) {
        const a = time * 0.18 + i / 8 * TAU;
        const bx = o.x + Math.cos(a) * o.r * 1.35;
        const by = o.y + 10 + Math.sin(a) * o.r * 0.54;
        ctx.beginPath();
        ctx.moveTo(bx, by);
        ctx.lineTo(bx, by - 70 - Math.sin(time + i) * 16);
        ctx.stroke();
      }
      ctx.restore();
    } else {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = `rgba(255, 213, 118, ${0.18 + Math.sin(time * 2.6) * 0.07})`;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.ellipse(o.x, o.y + 8, o.r * 1.55, o.r * 0.62, 0, 0, TAU);
      ctx.stroke();
      ctx.restore();
    }

    ctx.restore();
  }

  // ============================================================
  // Sorted world rendering / effects
  // ============================================================
  function drawEntry(entry, time) {
    if (entry.kind === 'player') {
      const p = game.player;
      drawBlackHole(p.x, p.y, p.radius, {
        isPlayer: true,
        angle: p.angle,
        pulse: p.pulse,
        flash: p.flash
      }, time);
    } else if (entry.kind === 'enemy') {
      const e = entry.ref;
      if (!e) return;
      drawBlackHole(e.x, e.y, e.radius, {
        isEnemy: true,
        angle: e.angle,
        pulse: e.pulse,
        tint: e.tint,
        tint2: e.tint2
      }, time);
    } else if (entry.kind === 'goal') {
      drawGoalTower(entry.ref, time);
    } else if (entry.kind === 'building') {
      drawBuilding(entry.ref, time);
    } else {
      drawProp(entry.ref, time);
    }
  }

  function drawSuckEffect(fx, time) {
    const o = fx.object;
    const target = game.player;
    if (!o || !target) return;
    const t = clamp(fx.t / fx.dur, 0, 1);
    const pull = t * t * (3 - 2 * t);
    const px = lerp(fx.x0, target.x, pull);
    const py = lerp(fx.y0, target.y, pull);
    const scale = Math.max(0.01, 1 - pull * 0.92);
    ctx.save();
    ctx.globalAlpha = Math.max(0, 1 - t * 1.05);
    ctx.translate(px, py);
    ctx.rotate(fx.spin * t * 0.8);
    ctx.scale(scale, scale);
    ctx.translate(-o.x, -o.y);
    if (o.kind === 'building') drawBuilding(o, time);
    else if (o.kind === 'goal') drawGoalTower(o, time);
    else drawProp(o, time);
    ctx.restore();

    // Pulling streak.
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = `rgba(255, 193, 106, ${(1 - t) * 0.2})`;
    ctx.lineWidth = 1.2;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(fx.x0 + (i - 1) * o.r * 0.35, fx.y0 + (i - 1) * o.r * 0.2);
      ctx.quadraticCurveTo(
        lerp(fx.x0, px, 0.5) + (i - 1) * 12,
        lerp(fx.y0, py, 0.5) - 20,
        px,
        py
      );
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawEffects(time) {
    for (let i = 0; i < game.effects.length; i++) {
      const fx = game.effects[i];
      if (fx.type === 'suck') {
        drawSuckEffect(fx, time);
      } else if (fx.type === 'shockwave') {
        const t = clamp(fx.t / fx.dur, 0, 1);
        const r = lerp(fx.r0, fx.r1, t * t * (3 - 2 * t));
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = (1 - t) * 0.9;
        ctx.strokeStyle = fx.color;
        ctx.lineWidth = Math.max(1, 4 * (1 - t) + 1);
        ctx.beginPath();
        ctx.ellipse(fx.x, fx.y, r, r * 0.52, 0, 0, TAU);
        ctx.stroke();
        ctx.restore();
      }
    }
  }

  function drawParticles() {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < game.particles.length; i++) {
      const p = game.particles[i];
      const a = clamp(p.life / Math.max(0.01, p.maxLife), 0, 1);
      ctx.globalAlpha = a * 0.8;
      ctx.strokeStyle = p.color;
      ctx.fillStyle = p.color;
      const streak = Math.min(10, Math.hypot(p.vx, p.vy) * 0.018);
      if (streak > 1.4) {
        ctx.lineWidth = Math.max(0.6, p.size * 0.55);
        ctx.beginPath();
        ctx.moveTo(p.x - p.vx / Math.max(1, Math.hypot(p.vx, p.vy)) * streak, p.y - p.vy / Math.max(1, Math.hypot(p.vx, p.vy)) * streak);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, TAU);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  function drawFloaters() {
    const zoom = game.camera.zoom;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let i = 0; i < game.floaters.length; i++) {
      const f = game.floaters[i];
      const a = clamp(1 - f.t / f.life, 0, 1);
      const size = f.size / Math.max(0.32, zoom);
      ctx.globalAlpha = a;
      ctx.font = `700 ${size}px "SFMono-Regular", "PingFang SC", monospace`;
      ctx.fillStyle = f.color;
      ctx.shadowColor = f.color;
      ctx.shadowBlur = size * 0.6;
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  function playerIsOccluded(entries, playerIndex, p) {
    for (let i = playerIndex + 1; i < entries.length; i++) {
      const en = entries[i];
      if (en.kind !== 'building' && en.kind !== 'goal') continue;
      const o = en.ref;
      const halfW = o.r * 1.15 + 8;
      const top = o.y - o.h - 10;
      const bottom = o.y + o.r * 0.9;
      if (p.x + p.radius > o.x - halfW &&
          p.x - p.radius < o.x + halfW &&
          p.y + p.radius > top &&
          p.y - p.radius < bottom) return true;
    }
    return false;
  }

  function renderWorld(time) {
    drawSky(time);
    const cam = game.camera;
    ctx.save();
    ctx.translate(W / 2 + cam.shakeX, H / 2 + cam.shakeY);
    ctx.scale(cam.zoom, cam.zoom);
    ctx.translate(-cam.x, -cam.y);

    drawGroundCached();

    const entries = [];
    for (let i = 0; i < game.objects.length; i++) {
      const o = game.objects[i];
      if (o.eaten) continue;
      if (!inView(o.x, o.y, o.r, o.h)) continue;
      entries.push({
        kind: o.kind === 'goal' ? 'goal' : o.kind,
        y: o.y,
        ref: o
      });
    }
    const p = game.player;
    if (p && inView(p.x, p.y, p.radius, p.radius)) {
      entries.push({ kind: 'player', y: p.y, ref: p });
    }
    for (let i = 0; i < game.enemies.length; i++) {
      const e = game.enemies[i];
      if (inView(e.x, e.y, e.radius, e.radius)) {
        entries.push({ kind: 'enemy', y: e.y, ref: e });
      }
    }
    entries.sort((a, b) => a.y - b.y);
    for (let i = 0; i < entries.length; i++) {
      drawEntry(entries[i], time);
    }

    // If a tall building sits between the camera and the player, redraw a
    // translucent silhouette so the player never loses track of the hole.
    const playerIndex = entries.findIndex((en) => en.kind === 'player');
    if (p && playerIndex >= 0 && playerIsOccluded(entries, playerIndex, p)) {
      ctx.save();
      ctx.globalAlpha = 0.42;
      drawBlackHole(p.x, p.y, p.radius, {
        isPlayer: true,
        angle: p.angle,
        pulse: p.pulse * 0.6,
        flash: 0
      }, time);
      ctx.restore();
    }

    drawEffects(time);
    drawParticles();
    drawFloaters();
    ctx.restore();

    drawLabels(time);
    drawCompasses(time);
    drawScreenFX(time);
  }

  // ============================================================
  // Screen-space labels, compass & effects
  // ============================================================
  function measurePill(text, size, padX, dot) {
    ctx.save();
    ctx.font = `600 ${size}px "SFMono-Regular", "PingFang SC", monospace`;
    const w = ctx.measureText(text).width + padX * 2 + (dot === false ? 0 : 11);
    ctx.restore();
    return w;
  }

  function drawScreenPill(text, x, y, color, options) {    const o = options || {};
    const font = `${o.bold === false ? 500 : 600} ${o.size || 10}px "SFMono-Regular", "PingFang SC", monospace`;
    ctx.save();
    ctx.font = font;
    const textW = ctx.measureText(text).width;
    const padX = o.padX || 10;
    const h = o.height || 24;
    const w = textW + padX * 2 + (o.dot === false ? 0 : 11);
    const bx = x - w / 2;
    const by = y - h / 2;
    ctx.fillStyle = o.bg || 'rgba(7, 12, 22, 0.74)';
    roundedRect(ctx, bx, by, w, h, h / 2);
    ctx.fill();
    ctx.strokeStyle = o.border || hexToRgba(color, 0.32);
    ctx.lineWidth = 1;
    ctx.stroke();
    if (o.dot !== false) {
      ctx.fillStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(bx + padX + 1, y, 2.2, 0, TAU);
      ctx.fill();
      ctx.shadowBlur = 0;
    }
    ctx.fillStyle = o.textColor || color;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, bx + padX + (o.dot === false ? 0 : 7), y + 0.5);
    ctx.restore();
    return w;
  }

  function drawLabels(time) {
    const cam = game.camera;
    const p = game.player;
    const margin = 20;
    if (p && game.mode !== 'menu') {
      const sp = worldToScreen(p.x, p.y);
      const off = p.radius * cam.zoom + 20;
      if (sp.x > margin && sp.x < W - margin && sp.y > margin && sp.y < H - margin) {
        drawScreenPill(`LV.${p.level}`, sp.x, sp.y - off, game.world.palette.glow, {
          bg: 'rgba(10, 9, 12, 0.72)',
          border: 'rgba(255, 166, 91, 0.3)',
          size: 10
        });
      }
    }
    const manyHunters = game.enemies.length > 1;
    for (let i = 0; i < game.enemies.length; i++) {
      const e = game.enemies[i];
      if (!e || game.mode === 'menu') continue;
      const sp = worldToScreen(e.x, e.y);
      const off = e.radius * cam.zoom + 20;
      if (sp.x > margin && sp.x < W - margin && sp.y > margin && sp.y < H - margin) {
        const text = manyHunters ? `猎手 ${e.index + 1} · LV.${e.level}` : `猎手 LV.${e.level}`;
        drawScreenPill(text, sp.x, sp.y - off, e.tint || '#ff5f7e', {
          bg: 'rgba(20, 7, 13, 0.78)',
          border: hexToRgba(e.tint || '#ff5f7e', 0.34),
          size: 9
        });
      }
    }
    const tower = game.tower;
    if (tower && !tower.eaten && game.mode !== 'menu') {
      const base = worldToScreen(tower.x, tower.y);
      const top = worldToScreen(tower.x, tower.y - tower.h);
      let labelY = top.y - 18;
      if (labelY < 92 || top.y < 40) labelY = base.y - 18;
      if (base.x > 40 && base.x < W - 40 && labelY > 48 && labelY < H - 40) {
        const unlocked = p && p.level >= MAX_LEVEL;
        drawScreenPill(unlocked ? '30F · 可以吞噬' : '30F · 需要 LV.15', base.x, labelY, unlocked ? '#ffd36e' : '#ff819e', {
          bg: unlocked ? 'rgba(24, 18, 7, 0.8)' : 'rgba(22, 7, 13, 0.78)',
          border: unlocked ? 'rgba(255, 200, 103, 0.36)' : 'rgba(255, 90, 126, 0.28)',
          size: 9
        });
      }
    }
    void time;
  }

  function drawEdgeArrow(worldX, worldY, color, label, offset, plates) {
    const sp = worldToScreen(worldX, worldY);
    const narrow = W < 760;
    const margin = narrow ? 30 : 38;
    const topBoundary = narrow ? 214 : 96;
    if (sp.x > margin && sp.x < W - margin && sp.y > topBoundary && sp.y < H - margin - 20) return;
    const cx = W / 2;
    const cy = H / 2;
    const dx = sp.x - cx;
    const dy = sp.y - cy;
    if (Math.abs(dx) < 0.01 && Math.abs(dy) < 0.01) return;
    const left = narrow ? 52 : 66;
    const right = W - (narrow ? 52 : 66);
    const top = narrow ? 198 : 98;
    const bottom = H - (narrow ? 138 : 104);
    let t = Infinity;
    if (dx > 0) t = Math.min(t, (right - cx) / dx);
    if (dx < 0) t = Math.min(t, (left - cx) / dx);
    if (dy > 0) t = Math.min(t, (bottom - cy) / dy);
    if (dy < 0) t = Math.min(t, (top - cy) / dy);
    if (!Number.isFinite(t) || t <= 0) return;
    const ax = cx + dx * t;
    const ay = cy + dy * t;
    const ang = Math.atan2(dy, dx);
    const pulse = 0.72 + Math.sin(game.timeNow * 3.3 + (offset || 0)) * 0.22;
    ctx.save();
    ctx.translate(ax, ay);
    ctx.rotate(ang);
    ctx.globalAlpha = pulse;
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 16;
    ctx.beginPath();
    ctx.moveTo(13, 0);
    ctx.lineTo(-7, -8);
    ctx.lineTo(-3, 0);
    ctx.lineTo(-7, 8);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Short landscape screens don't have room for both HUD panels and
    // floating compass captions; the arrow alone is enough.
    if (H < 560) return;

    const inwardX = ax + (cx - ax) * 0.06;
    const inwardY = ay + (cy - ay) * 0.06;
    const toastCount = dom.toastLayer ? dom.toastLayer.children.length : 0;
    const toastTop = narrow ? 126 : 108;
    const toastSafe = toastCount > 0 ? toastTop + toastCount * 42 + 14 : 0;
    const labelW = measurePill(label, 8, 8, true);
    let finalX = clamp(inwardX, 80, W - 80);
    let finalY = ay < 140 ? 150 : ay > H - 130 ? H - 150 : inwardY;
    if (ay < 260) finalY = Math.max(finalY, toastSafe, narrow ? 220 : 150);
    finalY = clamp(finalY, 126, H - 120);

    // Keep the two compass pills from stacking on top of each other.
    if (plates && plates.length) {
      const halfW = labelW / 2 + 6;
      const halfH = 10.5 + 5;
      let settled = false;
      for (let step = 0; step < 4 && !settled; step++) {
        const y = clamp(finalY + step * 27, 126, H - 120);
        settled = !plates.some((pl) => Math.abs(pl.x - finalX) < halfW + pl.w / 2 && Math.abs(pl.y - y) < halfH + 10.5);
        if (settled) finalY = y;
      }
      if (!settled) {
        finalX = clamp(finalX + (finalX < cx ? -labelW : labelW), 80, W - 80);
        finalY = clamp(finalY + 27, 126, H - 120);
      }
    }

    drawScreenPill(label, finalX, finalY, color, {
      bg: 'rgba(8, 12, 21, 0.7)',
      border: hexToRgba(color, 0.28),
      size: 8,
      height: 21,
      padX: 8
    });
    if (plates) plates.push({ x: finalX, y: finalY, w: labelW });
  }

  function drawCompasses(time) {
    if (!game.player) return;
    const plates = [];
    if (game.tower && !game.tower.eaten && game.mode !== 'victory' && game.mode !== 'gameover') {
      const goalDist = dist(game.player.x, game.player.y, game.tower.x, game.tower.y);
      drawEdgeArrow(game.tower.x, game.tower.y, '#ffd36e', `高塔 ${fmtDist(goalDist)}`, 0, plates);
    }
    if (game.player && game.mode === 'playing') {
      let nearest = null;
      let nearestDist = Infinity;
      for (let i = 0; i < game.enemies.length; i++) {
        const e = game.enemies[i];
        if (!e || e.beingEaten) continue;
        const d = dist(game.player.x, game.player.y, e.x, e.y);
        if (d < nearestDist) {
          nearest = e;
          nearestDist = d;
        }
      }
      if (nearest && nearestDist < 1800) {
        const tag = game.enemies.length > 1 ? `猎手 ${nearest.index + 1} ${fmtDist(nearestDist)}` : `猎手 ${fmtDist(nearestDist)}`;
        drawEdgeArrow(nearest.x, nearest.y, nearest.tint || '#ff5477', tag, 1.3, plates);
      }
    }
    void time;
  }

  function drawScreenFX(time) {
    if (game.mode === 'menu') return;
    const p = game.player;
    let danger = 0;
    if (p && (game.mode === 'playing' || game.mode === 'dying')) {
      const source = game.mode === 'dying' ? game.killer : null;
      if (source) {
        danger = clamp(1 - dist(p.x, p.y, source.x, source.y) / 560, 0, 1);
      } else {
        for (let i = 0; i < game.enemies.length; i++) {
          const e = game.enemies[i];
          if (!e || e.beingEaten) continue;
          danger = Math.max(danger, clamp(1 - dist(p.x, p.y, e.x, e.y) / 560, 0, 1));
        }
      }
      if (game.mode === 'dying') danger = Math.max(danger, 0.75);
      if (danger > 0.01) {
        const grad = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.22, W / 2, H / 2, Math.max(W, H) * 0.72);
        grad.addColorStop(0, 'rgba(255, 50, 82, 0)');
        grad.addColorStop(0.7, `rgba(255, 38, 72, ${danger * 0.085})`);
        grad.addColorStop(1, `rgba(255, 28, 65, ${danger * 0.32})`);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, W, H);
      }
    }
    if (game.mode === 'winning') {
      const p2 = clamp(game.winTimer / 2.8, 0, 1);
      const flash = Math.sin(p2 * Math.PI) * 0.13;
      const grad = ctx.createRadialGradient(W / 2, H / 2, 20, W / 2, H / 2, Math.max(W, H) * 0.75);
      grad.addColorStop(0, `rgba(255, 232, 170, ${flash})`);
      grad.addColorStop(0.5, `rgba(255, 171, 78, ${flash * 0.35})`);
      grad.addColorStop(1, 'rgba(255, 111, 48, 0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);
    }
    void time;
  }

  function drawJoystick() {
    if (!input.joy.active || game.mode !== 'playing') return;
    const max = Math.max(46, Math.min(W, H) * 0.085);
    const ox = input.joy.ox;
    const oy = input.joy.oy;
    const dx = input.joy.dx * max;
    const dy = input.joy.dy * max;
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.strokeStyle = 'rgba(173, 225, 255, 0.45)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(ox, oy, max, 0, TAU);
    ctx.stroke();
    ctx.globalAlpha = 0.12;
    ctx.fillStyle = 'rgba(160, 225, 255, 0.28)';
    ctx.beginPath();
    ctx.arc(ox, oy, max, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 0.85;
    const glow = ctx.createRadialGradient(ox + dx, oy + dy, 2, ox + dx, oy + dy, max * 0.34);
    glow.addColorStop(0, 'rgba(255, 232, 190, 0.92)');
    glow.addColorStop(0.6, 'rgba(255, 157, 77, 0.66)');
    glow.addColorStop(1, 'rgba(255, 111, 43, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(ox + dx, oy + dy, max * 0.34, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  // ============================================================
  // Minimap
  // ============================================================
  function drawMinimap() {
    if (!game.world || !game.player) return;
    const c = miniCtx;
    const cw = dom.minimap.width;
    const ch = dom.minimap.height;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, cw, ch);

    const bg = c.createLinearGradient(0, 0, cw, ch);
    bg.addColorStop(0, 'rgba(5, 10, 19, 0.95)');
    bg.addColorStop(1, 'rgba(10, 18, 32, 0.95)');
    c.fillStyle = bg;
    c.fillRect(0, 0, cw, ch);

    const world = game.world;
    const def = world.def;
    const p = world.palette;
    const pad = 10;
    const scale = Math.min((cw - pad * 2) / world.width, (ch - pad * 2) / world.height);
    const ox = (cw - world.width * scale) / 2;
    const oy = (ch - world.height * scale) / 2;
    const mx = (x) => ox + x * scale;
    const my = (y) => oy + y * scale;

    c.save();
    c.beginPath();
    c.rect(ox - 2, oy - 2, world.width * scale + 4, world.height * scale + 4);
    c.clip();

    // Blocks.
    c.fillStyle = 'rgba(86, 118, 160, 0.12)';
    for (let i = 0; i < world.grid.blocks.length; i++) {
      const b = world.grid.blocks[i];
      c.fillRect(mx(b.x1), my(b.y1), b.w * scale, b.h * scale);
    }

    // Roads.
    c.strokeStyle = 'rgba(176, 214, 255, 0.17)';
    c.lineWidth = Math.max(1, def.roadW * scale);
    for (let i = 0; i < world.grid.xs.length; i++) {
      c.beginPath();
      c.moveTo(mx(world.grid.xs[i]), my(0));
      c.lineTo(mx(world.grid.xs[i]), my(world.height));
      c.stroke();
    }
    for (let i = 0; i < world.grid.ys.length; i++) {
      c.beginPath();
      c.moveTo(mx(0), my(world.grid.ys[i]));
      c.lineTo(mx(world.width), my(world.grid.ys[i]));
      c.stroke();
    }

    // Viewport.
    const cam = game.camera;
    const vw = W / cam.zoom * scale;
    const vh = H / cam.zoom * scale;
    c.strokeStyle = 'rgba(219, 237, 255, 0.16)';
    c.lineWidth = 1;
    c.strokeRect(mx(cam.x) - vw / 2, my(cam.y) - vh / 2, vw, vh);

    // Tower.
    const tower = game.tower;
    if (tower && !tower.eaten) {
      const tx = mx(tower.x);
      const ty = my(tower.y);
      const pulse = 1 + Math.sin(game.timeNow * 2.7) * 0.25;
      c.fillStyle = '#ffd36e';
      c.shadowColor = '#ffd36e';
      c.shadowBlur = 12;
      c.beginPath();
      c.arc(tx, ty, 4.2 * pulse, 0, TAU);
      c.fill();
      c.strokeStyle = 'rgba(255, 211, 110, 0.28)';
      c.lineWidth = 1;
      c.beginPath();
      c.arc(tx, ty, 9 * pulse, 0, TAU);
      c.stroke();
      c.shadowBlur = 0;
    }

    // Enemies.
    for (let i = 0; i < game.enemies.length; i++) {
      const e = game.enemies[i];
      if (!e || e.beingEaten) continue;
      const ex = mx(e.x);
      const ey = my(e.y);
      const tint = e.tint || '#ff4f70';
      c.fillStyle = tint;
      c.shadowColor = tint;
      c.shadowBlur = 10;
      c.beginPath();
      c.arc(ex, ey, 3.6, 0, TAU);
      c.fill();
      c.strokeStyle = hexToRgba(tint, 0.24 + Math.sin(game.timeNow * 3) * 0.08);
      c.lineWidth = 1;
      c.beginPath();
      c.arc(ex, ey, 7.5 + Math.sin(game.timeNow * 3 + i) * 1.5, 0, TAU);
      c.stroke();
      c.shadowBlur = 0;
    }

    // Player.
    const pl = game.player;
    const px = mx(pl.x);
    const py = my(pl.y);
    c.fillStyle = '#67eaff';
    c.shadowColor = '#67eaff';
    c.shadowBlur = 12;
    c.beginPath();
    c.arc(px, py, 3.8, 0, TAU);
    c.fill();
    c.strokeStyle = 'rgba(103, 234, 255, 0.3)';
    c.lineWidth = 1;
    c.beginPath();
    c.arc(px, py, 8, 0, TAU);
    c.stroke();
    c.shadowBlur = 0;
    c.restore();

    // Radar rings.
    c.save();
    c.globalAlpha = 0.09;
    c.strokeStyle = '#afdfff';
    c.lineWidth = 1;
    for (let i = 1; i <= 2; i++) {
      c.beginPath();
      c.arc(px, py, i * 36, 0, TAU);
      c.stroke();
    }
    c.restore();

    // Top gloss.
    const gloss = c.createLinearGradient(0, 0, 0, ch);
    gloss.addColorStop(0, 'rgba(255,255,255,0.045)');
    gloss.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = gloss;
    c.fillRect(0, 0, cw, ch * 0.4);
  }

  // ============================================================
  // Menu background
  // ============================================================
  const silhouetteCache = {};
  function getSilhouette(mapId) {
    if (silhouetteCache[mapId]) return silhouetteCache[mapId];
    const rng = mulberry32(MAPS[mapId].seed ^ 0x88ba11);
    const arr = [];
    for (let i = 0; i < 38; i++) {
      arr.push({
        x: rng(),
        w: 0.024 + rng() * 0.06,
        h: 0.06 + rng() * 0.24,
        hue: rng() * 20 - 10,
        windows: 3 + ((rng() * 6) | 0),
        a: 0.25 + rng() * 0.5
      });
    }
    arr.sort((a, b) => a.h - b.h);
    silhouetteCache[mapId] = arr;
    return arr;
  }

  function renderMenuBackground(time) {
    const p = MAPS[game.selectedMap].palette;
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#04060c');
    grad.addColorStop(0.52, '#070b14');
    grad.addColorStop(1, '#020409');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    const neb = ctx.createRadialGradient(W * 0.7, H * 0.45, 0, W * 0.7, H * 0.45, Math.max(W, H) * 0.55);
    neb.addColorStop(0, p.glow + '10');
    neb.addColorStop(0.35, p.accent2 + '07');
    neb.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = neb;
    ctx.fillRect(0, 0, W, H);

    for (let i = 0; i < menuStars.length; i++) {
      const s = menuStars[i];
      const x = ((s.x * W + time * (2 + s.r * 2)) % W + W) % W;
      const y = s.y * H;
      ctx.globalAlpha = s.a * (0.55 + Math.sin(time * 0.8 + s.p) * 0.4);
      ctx.fillStyle = i % 17 === 0 ? p.accent : '#d7e7ff';
      ctx.fillRect(x, y, s.r, s.r);
    }
    ctx.globalAlpha = 1;

    // A distant ringed singularity.
    ctx.save();
    ctx.globalAlpha = 0.47;
    const hx = W * 0.72;
    const hy = H * 0.47;
    const hr = Math.min(W, H) * 0.16;
    drawBlackHole(hx, hy, hr, { isPlayer: true, angle: time * 0.18, pulse: 0.12 }, time);
    ctx.globalAlpha = 0.22;
    ctx.strokeStyle = p.accent;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(hx, hy, hr * 2.1, hr * 0.52, -0.34, 0, TAU);
    ctx.stroke();
    ctx.restore();

    // Distant skyline.
    const silhouette = getSilhouette(game.selectedMap);
    const baseY = H * 0.94;
    const horizonY = H * 0.64;
    const skyGlow = ctx.createLinearGradient(0, horizonY, 0, baseY);
    skyGlow.addColorStop(0, 'rgba(0,0,0,0)');
    skyGlow.addColorStop(1, p.accent + '08');
    ctx.fillStyle = skyGlow;
    ctx.fillRect(0, horizonY, W, baseY - horizonY);

    for (let i = 0; i < silhouette.length; i++) {
      const b = silhouette[i];
      const bw = b.w * W;
      const bh = b.h * H;
      const bx = b.x * W;
      const by = baseY - bh;
      ctx.fillStyle = `hsla(${215 + b.hue}, 25%, 7%, ${0.5 + b.a * 0.25})`;
      ctx.fillRect(bx, by, bw, bh);
      if (bw > 34) {
        ctx.globalAlpha = b.a * 0.33;
        ctx.fillStyle = p.accent;
        const cols = Math.max(2, Math.floor(bw / 14));
        for (let wy = by + 12; wy < baseY - 8; wy += 14) {
          for (let wx = bx + 6; wx < bx + bw - 4; wx += 12) {
            if (hash2(Math.round(wx), Math.round(wy), i + 8) % 7 < 2) {
              ctx.fillRect(wx, wy, 2.5, 3.5);
            }
          }
        }
        ctx.globalAlpha = 1;
      }
    }

    const horizon = ctx.createLinearGradient(0, baseY - 1, 0, baseY + 2);
    horizon.addColorStop(0, 'rgba(255,255,255,0)');
    horizon.addColorStop(0.5, p.mapEdge);
    horizon.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = horizon;
    ctx.fillRect(0, baseY - 1, W, 3);

    // Floating dust.
    ctx.save();
    for (let i = 0; i < 16; i++) {
      const a = time * 0.12 + i * 1.7;
      const x = W * 0.72 + Math.cos(a) * (90 + i * 13);
      const y = H * 0.47 + Math.sin(a * 1.2) * (50 + i * 8);
      ctx.globalAlpha = 0.1 + (i % 4) * 0.04;
      ctx.fillStyle = i % 3 === 0 ? p.accent : p.glow;
      ctx.beginPath();
      ctx.arc(x, y, 1.2 + (i % 3) * 0.5, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  // ============================================================
  // Main render loop & bootstrap
  // ============================================================
  function render() {
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    if (game.mode === 'menu' || !game.world) {
      renderMenuBackground(game.timeNow);
    } else {
      renderWorld(game.timeNow);
      drawJoystick();
    }
  }

  let lastFrame = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, Math.max(0, (now - lastFrame) / 1000));
    lastFrame = now;
    game.timeNow = now / 1000;
    if (!document.hidden) update(dt);
    // Paused / result screens are static: stop re-rasterising the canvas under
    // the modal until something actually changes (resume, restart, resize).
    const continuous = game.mode !== 'paused' && game.mode !== 'victory' && game.mode !== 'gameover';
    if (needsRender || continuous) {
      render();
      needsRender = false;
    }
    requestAnimationFrame(frame);
  }

  window.addEventListener('resize', () => {
    resize();
    if (game.mode === 'menu') renderMenuBackground(game.timeNow);
  });

  window.addEventListener('contextmenu', (e) => {
    if (e.target === dom.canvas) e.preventDefault();
  });

  // Small development API. Handy for previewing a specific level/map.
  window.__BH__ = {
    game,
    startGame,
    maps: MAPS,
    render,
    update,
    setLevel(level) {
      const p = game.player;
      if (!p) return;
      const lv = clamp(Number(level) || 1, 1, MAX_LEVEL);
      p.score = Math.max(p.score, LEVEL_THRESHOLDS[lv - 1]);
      p.level = levelForScore(p.score);
      p.targetRadius = targetRadiusForScore(p.score, p.level);
      p.radius = p.targetRadius;
      p.pulse = 1;
      if (p.level >= MAX_LEVEL && game.tower) game.tower.unlocked = true;
      syncEnemyLevel();
      game.camera.zoom = getTargetZoom(p);
      updateHUD();
    },
    teleport(x, y) {
      if (!game.player) return;
      game.player.x = clamp(Number(x) || 0, 20, game.world.width - 20);
      game.player.y = clamp(Number(y) || 0, 20, game.world.height - 20);
      game.camera.x = game.player.x;
      game.camera.y = game.player.y;
    },
    win: startTowerWin,
    lose: startPlayerDeath,
    pause: pauseGame,
    resume: resumeGame
  };

  // Boot.
  resize();
  selectMap(game.selectedMap);
  updateMenuRecords();
  initMenuThumbs();
  updateSoundButton();
  setHUDVisible(false);
  requestAnimationFrame(frame);

  // Convenience launch links: ?play=1&map=0&dev=1&level=10&near=tower
  const params = new URLSearchParams(window.location.search);
  if (params.get('play')) {
    const mapId = clamp(Number(params.get('map')) || 0, 0, MAPS.length - 1);
    window.setTimeout(() => {
      startGame(mapId);
      if (params.get('dev')) {
        if (params.get('level')) window.__BH__.setLevel(Number(params.get('level')));
        if (params.get('near') === 'tower' && game.world) {
          window.__BH__.teleport(game.tower.x, game.tower.y + 360);
        }
        if (params.get('win')) window.setTimeout(() => window.__BH__.win(), 300);
        if (params.get('lose')) window.setTimeout(() => window.__BH__.lose(), 300);
      }
    }, 120);
  }
})();
