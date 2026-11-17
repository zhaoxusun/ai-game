(() => {
  'use strict';

  /* ============================================================
     坦克大战 · TANK BATTLE
     单文件逻辑：地图生成 / 坦克 AI / 弹道 / 补给 / 渲染 / 音效
     ============================================================ */

  const TILE = 16;
  const COLS = 26;
  const ROWS = 26;
  const W = COLS * TILE;
  const H = ROWS * TILE;
  const DPR = 2;
  const TAU = Math.PI * 2;

  const EMPTY = 0;
  const BRICK = 1;
  const STEEL = 2;
  const WATER = 3;
  const FOREST = 4;

  const DIRS = {
    up:    { x: 0, y: -1, angle: 0 },
    right: { x: 1, y: 0, angle: Math.PI / 2 },
    down:  { x: 0, y: 1, angle: Math.PI },
    left:  { x: -1, y: 0, angle: -Math.PI / 2 },
  };
  const DIR_LIST = ['up', 'right', 'down', 'left'];
  const OPPOSITE = { up: 'down', down: 'up', left: 'right', right: 'left' };

  const ENEMY_TYPES = {
    basic: { name: '突击兵', color: '#ff7a5c', glow: 'rgba(255,122,92,.55)', speed: 58,  hp: 1, score: 100, bulletSpeed: 280, fire: 1.7,  maxBullets: 1 },
    fast:  { name: '疾行者', color: '#ffd166', glow: 'rgba(255,209,102,.55)', speed: 100, hp: 1, score: 200, bulletSpeed: 330, fire: 1.5,  maxBullets: 1 },
    armor: { name: '重装甲', color: '#9fb2d9', glow: 'rgba(159,178,217,.55)', speed: 50,  hp: 3, score: 300, bulletSpeed: 300, fire: 1.9,  maxBullets: 1 },
    power: { name: '重炮手', color: '#c792ff', glow: 'rgba(199,146,255,.55)', speed: 62,  hp: 2, score: 400, bulletSpeed: 430, fire: 1.15, maxBullets: 2 },
  };

  const WEAPONS = [
    { max: 1, speed: 330, cooldown: 0.36 },
    { max: 2, speed: 410, cooldown: 0.28 },
    { max: 3, speed: 490, cooldown: 0.20 },
  ];

  const POWER_TYPES = {
    star:   { name: '火力强化', color: '#ffd166', glow: 'rgba(255,209,102,.75)' },
    shield: { name: '能量护盾', color: '#5fd8ff', glow: 'rgba(95,216,255,.75)' },
    bomb:   { name: '全屏轰炸', color: '#ff8264', glow: 'rgba(255,130,100,.75)' },
    clock:  { name: '时间冻结', color: '#a6d8ff', glow: 'rgba(166,216,255,.75)' },
    life:   { name: '备用坦克', color: '#6cf0a8', glow: 'rgba(108,240,168,.75)' },
    shovel: { name: '基地强化', color: '#ffb347', glow: 'rgba(255,179,71,.75)' },
  };
  const POWER_LIST = ['star', 'shield', 'bomb', 'clock', 'life', 'shovel'];

  const BASE_WALLS = [
    [10, 22], [11, 22], [12, 22], [13, 22], [14, 22], [15, 22],
    [11, 23], [14, 23], [11, 24], [14, 24],
  ];
  const BASE_RECT = { x: 192, y: 368, w: 32, h: 32 };
  const PLAYER_SPAWN = { x: 128, y: 368 };

  const SPAWN_POINTS = [
    { x: 18, y: 18 },
    { x: 194, y: 18 },
    { x: 370, y: 18 },
  ];

  /* ---------------- DOM ---------------- */
  const $ = (id) => document.getElementById(id);
  const canvas = $('game');
  const ctx = canvas.getContext('2d');
  const overlays = {
    start: $('screen-start'),
    pause: $('screen-pause'),
    clear: $('screen-clear'),
    over: $('screen-over'),
  };
  const dom = {
    score: $('stat-score'),
    hi: $('stat-hi'),
    level: $('stat-level'),
    enemies: $('stat-enemies'),
    lives: $('stat-lives'),
    pauseBtn: $('btn-pause'),
    startHi: $('start-hi'),
    clearTitle: $('clear-title'),
    clearBonus: $('clear-bonus'),
    clearNext: $('clear-next'),
    overTitle: $('over-title'),
    overDesc: $('over-desc'),
    overScore: $('over-score'),
    overLevel: $('over-level'),
    overHi: $('over-hi'),
    soundBtn: $('btn-sound'),
    soundLabel: $('sound-label'),
    fireBtn: $('btn-fire'),
  };

  /* ---------------- 存档 ---------------- */
  function readNumber(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      const n = raw === null ? NaN : Number(raw);
      return Number.isFinite(n) ? n : fallback;
    } catch (err) {
      return fallback;
    }
  }
  function writeStorage(key, value) {
    try { localStorage.setItem(key, String(value)); } catch (err) { /* ignore */ }
  }

  let hiScore = Math.max(0, readNumber('tank-hi', 0));
  let soundOn = readNumber('tank-sound', 1) !== 0;

  /* ---------------- 状态 ---------------- */
  const state = {
    mode: 'menu',
    level: 1,
    score: 0,
    lives: 3,
    weapon: 0,
    grid: null,
    base: null,
    player: null,
    enemies: [],
    bullets: [],
    particles: [],
    powerups: [],
    texts: [],
    queue: [],
    spawnTimer: 0,
    spawnInterval: 2.4,
    maxOnField: 3,
    freeze: 0,
    shovel: 0,
    shovelTick: 0,
    shovelToggle: false,
    shake: 0,
    flash: 0,
    time: 0,
    clearDelay: 0,
    clearTimer: 0,
    enemyId: 0,
  };

  /* ---------------- 工具 ---------------- */
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const rand = (a, b) => a + Math.random() * (b - a);
  const randInt = (a, b) => Math.floor(rand(a, b + 1));
  const overlap = (ax, ay, aw, ah, bx, by, bw, bh) =>
    ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
  const dist2 = (ax, ay, bx, by) => {
    const dx = ax - bx;
    const dy = ay - by;
    return dx * dx + dy * dy;
  };

  function roundRect(x, y, w, h, r) {
    const radius = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + w, y, x + w, y + h, radius);
    ctx.arcTo(x + w, y + h, x, y + h, radius);
    ctx.arcTo(x, y + h, x, y, radius);
    ctx.arcTo(x, y, x + w, y, radius);
    ctx.closePath();
  }

  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* ---------------- 音效 ---------------- */
  let audioCtx = null;

  function ensureAudio() {
    if (!soundOn) return null;
    try {
      if (!audioCtx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        audioCtx = new AC();
      }
      if (audioCtx.state === 'suspended') audioCtx.resume();
      return audioCtx;
    } catch (err) {
      return null;
    }
  }

  function tone(opt) {
    const ac = ensureAudio();
    if (!ac) return;
    const {
      freq = 440, to = freq, dur = 0.09, type = 'square',
      vol = 0.04, delay = 0,
    } = opt || {};
    const t0 = ac.currentTime + delay;
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(20, freq), t0);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), t0 + dur);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, vol), t0 + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain).connect(ac.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  function noise(opt) {
    const ac = ensureAudio();
    if (!ac) return;
    const {
      dur = 0.2, vol = 0.09, from = 1600, to = 220, delay = 0,
    } = opt || {};
    const t0 = ac.currentTime + delay;
    const frames = Math.max(1, Math.floor(ac.sampleRate * dur));
    const buffer = ac.createBuffer(1, frames, ac.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < frames; i += 1) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / frames);
    }
    const src = ac.createBufferSource();
    src.buffer = buffer;
    const filter = ac.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(from, t0);
    filter.frequency.exponentialRampToValueAtTime(Math.max(60, to), t0 + dur);
    const gain = ac.createGain();
    gain.gain.setValueAtTime(Math.max(0.0001, vol), t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filter).connect(gain).connect(ac.destination);
    src.start(t0);
    src.stop(t0 + dur + 0.02);
  }

  const sfx = {
    shoot() {
      tone({ freq: 640, to: 190, dur: 0.07, type: 'square', vol: 0.035 });
    },
    enemyShoot() {
      tone({ freq: 380, to: 150, dur: 0.08, type: 'sawtooth', vol: 0.022 });
    },
    brick() {
      noise({ dur: 0.12, vol: 0.05, from: 2200, to: 400 });
    },
    clink() {
      tone({ freq: 1680, to: 900, dur: 0.05, type: 'triangle', vol: 0.028 });
      noise({ dur: 0.05, vol: 0.02, from: 4200, to: 1600 });
    },
    explosion(scale = 1) {
      noise({ dur: 0.28 + scale * 0.12, vol: 0.1 * scale, from: 1100, to: 70 });
      tone({ freq: 120 * scale, to: 38, dur: 0.24, type: 'sine', vol: 0.07 * scale });
    },
    power() {
      tone({ freq: 660, dur: 0.08, type: 'triangle', vol: 0.05 });
      tone({ freq: 880, dur: 0.08, type: 'triangle', vol: 0.05, delay: 0.08 });
      tone({ freq: 1320, dur: 0.14, type: 'triangle', vol: 0.05, delay: 0.16 });
    },
    life() {
      tone({ freq: 520, to: 780, dur: 0.18, type: 'triangle', vol: 0.05 });
      tone({ freq: 780, to: 1180, dur: 0.22, type: 'triangle', vol: 0.05, delay: 0.12 });
    },
    freeze() {
      tone({ freq: 1200, to: 280, dur: 0.34, type: 'sine', vol: 0.05 });
      noise({ dur: 0.3, vol: 0.03, from: 5200, to: 1400 });
    },
    start() {
      tone({ freq: 330, dur: 0.1, type: 'square', vol: 0.04 });
      tone({ freq: 494, dur: 0.1, type: 'square', vol: 0.04, delay: 0.11 });
      tone({ freq: 660, dur: 0.18, type: 'square', vol: 0.045, delay: 0.22 });
    },
    clear() {
      [523, 659, 784, 1047].forEach((f, i) => {
        tone({ freq: f, dur: 0.16, type: 'triangle', vol: 0.05, delay: i * 0.11 });
      });
    },
    over() {
      tone({ freq: 300, to: 120, dur: 0.7, type: 'sawtooth', vol: 0.05 });
      noise({ dur: 0.8, vol: 0.08, from: 700, to: 60, delay: 0.1 });
    },
  };

  /* ---------------- 地图生成 ---------------- */
  function inReserved(c, r) {
    if (r >= 1 && r <= 3) return true;
    if (r >= 20 && r <= 24 && c >= 8 && c <= 16) return true;
    return false;
  }

  function canPlace(grid, c0, r0, w, h) {
    for (let r = r0; r < r0 + h; r += 1) {
      for (let c = c0; c < c0 + w; c += 1) {
        if (c < 1 || c > COLS - 2 || r < 1 || r > ROWS - 2) return false;
        if (inReserved(c, r)) return false;
        if (grid[r][c] !== EMPTY) return false;
        const mc = COLS - 1 - c;
        if (grid[r][mc] !== EMPTY) return false;
      }
    }
    return true;
  }

  function fillMirror(grid, c0, r0, w, h, type) {
    for (let r = r0; r < r0 + h; r += 1) {
      for (let c = c0; c < c0 + w; c += 1) {
        grid[r][c] = type;
        grid[r][COLS - 1 - c] = type;
      }
    }
  }

  function buildLevel(level) {
    const rng = mulberry32(0x9e3779b9 ^ (level * 7919));
    const grid = Array.from({ length: ROWS }, () => new Uint8Array(COLS));

    for (let c = 0; c < COLS; c += 1) {
      grid[0][c] = STEEL;
      grid[ROWS - 1][c] = STEEL;
    }
    for (let r = 0; r < ROWS; r += 1) {
      grid[r][0] = STEEL;
      grid[r][COLS - 1] = STEEL;
    }
    for (const [c, r] of BASE_WALLS) grid[r][c] = BRICK;

    const target = 30 + Math.min(16, level * 2);
    let placed = 0;

    for (let attempt = 0; attempt < 900 && placed < target; attempt += 1) {
      const pick = rng();
      let type = BRICK;
      let w = 1;
      let h = 1;

      if (pick < 0.56) {
        type = BRICK;
        const shape = rng();
        if (shape < 0.42) {
          w = 1 + Math.floor(rng() * 3);
          h = 1 + Math.floor(rng() * 3);
        } else if (shape < 0.74) {
          w = 3 + Math.floor(rng() * 3);
          h = 1;
        } else {
          w = 1;
          h = 3 + Math.floor(rng() * 3);
        }
      } else if (pick < 0.70) {
        type = STEEL;
        w = 1 + Math.floor(rng() * 2);
        h = 1 + Math.floor(rng() * 2);
      } else if (pick < 0.84) {
        type = WATER;
        w = 2 + Math.floor(rng() * 2);
        h = 1 + Math.floor(rng() * 2);
      } else {
        type = FOREST;
        w = 2 + Math.floor(rng() * 2);
        h = 2 + Math.floor(rng() * 2);
      }

      const c0 = 1 + Math.floor(rng() * 12);
      const r0 = 4 + Math.floor(rng() * 17);

      if (!canPlace(grid, c0, r0, w, h)) continue;
      fillMirror(grid, c0, r0, w, h, type);
      placed += 1;
    }

    // 中轴线两侧补几段砖墙，让地图更有“战场街区”的秩序感
    const extra = 3 + Math.min(5, Math.floor(level / 2));
    for (let i = 0; i < extra; i += 1) {
      const c = randInt(2, 10);
      const r = randInt(5, 19);
      const len = randInt(2, 4);
      if (canPlace(grid, c, r, len, 1)) fillMirror(grid, c, r, len, 1, BRICK);
    }

    return grid;
  }

  function buildEnemyQueue(level) {
    const total = Math.min(26, 14 + level * 2);
    const list = [];
    for (let i = 0; i < total; i += 1) {
      let kind = 'basic';
      if (level >= 2) {
        const fastW = Math.min(0.30, 0.12 + level * 0.015);
        const armorW = level >= 3 ? Math.min(0.30, 0.08 + level * 0.022) : 0;
        const powerW = level >= 3 ? Math.min(0.28, 0.07 + level * 0.02) : 0;
        const basicW = Math.max(0.16, 1 - fastW - armorW - powerW);
        const sum = basicW + fastW + armorW + powerW;
        let x = Math.random() * sum;
        x -= basicW;
        if (x < 0) kind = 'basic';
        else if ((x -= fastW) < 0) kind = 'fast';
        else if ((x -= armorW) < 0) kind = 'armor';
        else kind = 'power';
      }
      list.push({ kind, bonus: i >= 3 && (i + 1) % 5 === 0 });
    }
    if (level >= 4 && !list.some((e) => e.kind === 'armor')) list[list.length - 1].kind = 'armor';
    return list;
  }

  /* ---------------- 关卡初始化 ---------------- */
  function makePlayer(invuln) {
    return {
      x: PLAYER_SPAWN.x,
      y: PLAYER_SPAWN.y,
      w: 28,
      h: 28,
      dir: 'up',
      speed: 122,
      cooldown: 0,
      invuln: invuln === undefined ? 2.2 : invuln,
      tread: 0,
      moving: false,
      alive: true,
      respawn: 0,
    };
  }

  function startLevel(level) {
    state.level = level;
    state.grid = buildLevel(level);
    state.base = { ...BASE_RECT, alive: true };
    state.player = makePlayer();
    state.enemies = [];
    state.bullets = [];
    state.particles = [];
    state.powerups = [];
    state.texts = [];
    state.queue = buildEnemyQueue(level);
    state.spawnTimer = 1.1;
    state.spawnInterval = Math.max(1.15, 2.45 - level * 0.11);
    state.maxOnField = Math.min(6, 3 + Math.floor((level - 1) / 2));
    state.freeze = 0;
    state.shovel = 0;
    state.shovelTick = 0;
    state.shovelToggle = false;
    state.shake = 0;
    state.flash = 0;
    state.clearDelay = 0;
    state.clearTimer = 0;
    updateHUD();
  }

  /* ---------------- HUD / 覆盖层 ---------------- */
  function fmtScore(n) {
    return String(Math.max(0, Math.floor(n))).padStart(6, '0');
  }

  function enemiesLeft() {
    return state.queue.length + state.enemies.filter((e) => e.alive).length;
  }

  function updateHUD() {
    dom.score.textContent = fmtScore(state.score);
    dom.hi.textContent = fmtScore(hiScore);
    dom.level.textContent = String(state.level).padStart(2, '0');
    dom.enemies.textContent = String(enemiesLeft()).padStart(2, '0');
    const hearts = state.lives > 5 ? `${'♥'.repeat(5)}+` : '♥'.repeat(Math.max(0, state.lives));
    dom.lives.textContent = hearts || '—';
    dom.startHi.textContent = fmtScore(hiScore);
  }

  function saveHi() {
    if (state.score > hiScore) {
      hiScore = state.score;
      writeStorage('tank-hi', hiScore);
    }
    updateHUD();
  }

  function showScreen(name) {
    Object.values(overlays).forEach((el) => el.classList.add('is-hidden'));
    if (overlays[name]) overlays[name].classList.remove('is-hidden');
  }

  function hideScreens() {
    Object.values(overlays).forEach((el) => el.classList.add('is-hidden'));
  }

  /* ---------------- 开始 / 暂停 / 结束 ---------------- */
  function newGame() {
    ensureAudio();
    clearInput();
    state.score = 0;
    state.lives = 3;
    state.weapon = 0;
    state.enemyId = 0;
    startLevel(1);
    state.mode = 'playing';
    hideScreens();
    dom.pauseBtn.disabled = false;
    dom.pauseBtn.textContent = '暂停';
    sfx.start();
    updateHUD();
  }

  function togglePause() {
    if (state.mode === 'playing') {
      state.mode = 'paused';
      dom.pauseBtn.textContent = '继续';
      showScreen('pause');
    } else if (state.mode === 'paused') {
      state.mode = 'playing';
      dom.pauseBtn.textContent = '暂停';
      hideScreens();
    }
  }

  function gameOver(reason) {
    if (state.mode === 'gameover') return;
    state.mode = 'gameover';
    saveHi();
    dom.pauseBtn.disabled = true;
    dom.pauseBtn.textContent = '暂停';
    dom.overTitle.textContent = reason;
    dom.overDesc.textContent = reason === '基地失守'
      ? '基地被击毁，防线崩溃。'
      : '所有坦克损失殆尽，任务终止。';
    dom.overScore.textContent = String(state.score);
    dom.overLevel.textContent = String(state.level);
    dom.overHi.textContent = fmtScore(hiScore);
    sfx.over();
    window.setTimeout(() => {
      if (state.mode === 'gameover') showScreen('over');
    }, 700);
  }

  function levelClear() {
    if (state.mode !== 'playing') return;
    state.mode = 'levelclear';
    const bonus = 400 + state.level * 150 + state.lives * 100;
    state.score += bonus;
    saveHi();
    dom.clearTitle.textContent = `第 ${state.level} 关 完成`;
    dom.clearBonus.textContent = `关卡奖励 +${bonus}`;
    dom.clearNext.textContent = `下一关：第 ${state.level + 1} 关`;
    state.clearTimer = 2.6;
    dom.pauseBtn.disabled = true;
    showScreen('clear');
    sfx.clear();
  }

  /* ---------------- 输入 ---------------- */
  const activeDirs = new Set();
  let dirHistory = [];
  let fireHeld = false;
  const touchFire = { held: false };
  const joystickEl = $('joystick');
  const joystickKnob = $('joystick-knob');
  let joyDir = null;
  let joyPointerId = null;

  function pressDir(dir) {
    activeDirs.add(dir);
    dirHistory = dirHistory.filter((d) => d !== dir);
    dirHistory.push(dir);
  }

  function releaseDir(dir) {
    activeDirs.delete(dir);
    dirHistory = dirHistory.filter((d) => d !== dir);
  }

  function setJoyDir(dir) {
    if (dir === joyDir) return;
    joyDir = dir;
    if (!joystickEl) return;
    joystickEl.dataset.dir = dir || '';
    joystickEl.querySelectorAll('.joy-arrow').forEach((el) => {
      el.classList.toggle('is-on', el.dataset.dir === dir);
    });
  }

  function resetJoystick() {
    joyPointerId = null;
    if (joystickEl) joystickEl.classList.remove('is-active');
    if (joystickKnob) joystickKnob.style.transform = '';
    setJoyDir(null);
  }

  function currentDir() {
    if (joyDir) return joyDir;
    for (let i = dirHistory.length - 1; i >= 0; i -= 1) {
      if (activeDirs.has(dirHistory[i])) return dirHistory[i];
    }
    return null;
  }

  function clearInput() {
    activeDirs.clear();
    dirHistory = [];
    fireHeld = false;
    touchFire.held = false;
    resetJoystick();
    document.querySelectorAll('.fire-btn.is-active').forEach((el) => {
      el.classList.remove('is-active');
    });
  }

  const KEY_DIR = {
    ArrowUp: 'up', KeyW: 'up',
    ArrowDown: 'down', KeyS: 'down',
    ArrowLeft: 'left', KeyA: 'left',
    ArrowRight: 'right', KeyD: 'right',
  };

  window.addEventListener('keydown', (e) => {
    if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
    const dir = KEY_DIR[e.code];
    if (dir) {
      e.preventDefault();
      if (!e.repeat) pressDir(dir);
      return;
    }
    if (e.code === 'Space' || e.code === 'KeyJ' || e.code === 'KeyK') {
      e.preventDefault();
      fireHeld = true;
      return;
    }
    if (e.code === 'KeyP' || e.code === 'Escape') {
      e.preventDefault();
      if (state.mode === 'playing' || state.mode === 'paused') togglePause();
      return;
    }
    if (e.code === 'KeyM') {
      toggleSound();
      return;
    }
    if (e.code === 'Enter') {
      if (state.mode === 'menu' || state.mode === 'gameover') {
        e.preventDefault();
        newGame();
      } else if (state.mode === 'paused') {
        e.preventDefault();
        togglePause();
      }
      return;
    }
    if (e.code === 'KeyR' && (state.mode === 'playing' || state.mode === 'paused')) {
      e.preventDefault();
      newGame();
    }
  });

  window.addEventListener('keyup', (e) => {
    const dir = KEY_DIR[e.code];
    if (dir) releaseDir(dir);
    if (e.code === 'Space' || e.code === 'KeyJ' || e.code === 'KeyK') fireHeld = false;
  });

  window.addEventListener('blur', () => {
    releaseDir('up'); releaseDir('down'); releaseDir('left'); releaseDir('right');
    fireHeld = false;
    touchFire.held = false;
    resetJoystick();
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && state.mode === 'playing') togglePause();
  });

  // 触屏虚拟摇杆
  if (joystickEl) {
    const updateJoystick = (e) => {
      const rect = joystickEl.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      let dx = e.clientX - cx;
      let dy = e.clientY - cy;
      const dist = Math.hypot(dx, dy) || 0;
      const maxR = rect.width * 0.29;
      if (dist > maxR) {
        dx = (dx / dist) * maxR;
        dy = (dy / dist) * maxR;
      }
      if (joystickKnob) {
        joystickKnob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
      }
      if (dist < maxR * 0.2) {
        setJoyDir(null);
        return;
      }
      if (Math.abs(dx) > Math.abs(dy)) setJoyDir(dx > 0 ? 'right' : 'left');
      else setJoyDir(dy > 0 ? 'down' : 'up');
    };

    const joyDown = (e) => {
      e.preventDefault();
      ensureAudio();
      joyPointerId = e.pointerId;
      joystickEl.classList.add('is-active');
      if (joystickEl.setPointerCapture && e.pointerId !== undefined) {
        try { joystickEl.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      }
      updateJoystick(e);
    };

    const joyMove = (e) => {
      if (joyPointerId !== e.pointerId) return;
      e.preventDefault();
      updateJoystick(e);
    };

    const joyUp = (e) => {
      if (joyPointerId !== null && e.pointerId !== joyPointerId) return;
      if (e) e.preventDefault();
      resetJoystick();
    };

    joystickEl.addEventListener('pointerdown', joyDown);
    joystickEl.addEventListener('pointermove', joyMove);
    joystickEl.addEventListener('pointerup', joyUp);
    joystickEl.addEventListener('pointercancel', joyUp);
    joystickEl.addEventListener('lostpointercapture', joyUp);
    joystickEl.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  const fireBtn = dom.fireBtn;
  if (fireBtn) {
    const fireDown = (e) => {
      e.preventDefault();
      ensureAudio();
      touchFire.held = true;
      fireBtn.classList.add('is-active');
      if (fireBtn.setPointerCapture && e.pointerId !== undefined) {
        try { fireBtn.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      }
    };
    const fireUp = (e) => {
      if (e) e.preventDefault();
      touchFire.held = false;
      fireBtn.classList.remove('is-active');
    };
    fireBtn.addEventListener('pointerdown', fireDown);
    fireBtn.addEventListener('pointerup', fireUp);
    fireBtn.addEventListener('pointercancel', fireUp);
    fireBtn.addEventListener('pointerleave', (e) => { if (e.buttons === 0) fireUp(e); });
    fireBtn.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  /* ---------------- 分数 / 粒子 ---------------- */
  function addScore(n) {
    state.score += n;
    if (state.score > hiScore) {
      hiScore = state.score;
      writeStorage('tank-hi', hiScore);
    }
    updateHUD();
  }

  function addText(x, y, text, color) {
    state.texts.push({
      x, y, text,
      color: color || '#ffe9be',
      life: 0.95,
      max: 0.95,
    });
  }

  function addParticle(p) {
    if (state.particles.length > 420) state.particles.shift();
    state.particles.push(p);
  }

  function spark(x, y, color, count, speed) {
    const n = count || 6;
    for (let i = 0; i < n; i += 1) {
      const angle = Math.random() * TAU;
      const sp = rand(20, speed || 120);
      addParticle({
        type: 'spark',
        x, y,
        vx: Math.cos(angle) * sp,
        vy: Math.sin(angle) * sp,
        life: rand(0.16, 0.42),
        max: 0.42,
        size: rand(1.2, 2.4),
        color,
        drag: 4,
      });
    }
  }

  function explosion(x, y, scale, color) {
    const s = scale || 1;
    const base = color || '#ffb347';
    const palette = [base, '#ffd166', '#fff1d0'];
    for (let i = 0; i < Math.round(16 * s); i += 1) {
      const angle = Math.random() * TAU;
      const sp = rand(30, 190) * Math.sqrt(s);
      addParticle({
        type: 'spark',
        x, y,
        vx: Math.cos(angle) * sp,
        vy: Math.sin(angle) * sp,
        life: rand(0.25, 0.72),
        max: 0.72,
        size: rand(1.4, 3.1) * Math.min(2, s),
        color: palette[randInt(0, palette.length - 1)],
        drag: 3.2,
      });
    }
    for (let i = 0; i < Math.round(7 * s); i += 1) {
      addParticle({
        type: 'smoke',
        x: x + rand(-9, 9),
        y: y + rand(-9, 9),
        vx: rand(-22, 22),
        vy: rand(-26, 14),
        life: rand(0.5, 1.15),
        max: 1.15,
        size: rand(5, 10) * Math.min(1.7, s),
        color: '#59606f',
        drag: 1.6,
      });
    }
    for (let i = 0; i < Math.round(5 * s); i += 1) {
      addParticle({
        type: 'debris',
        x, y,
        vx: rand(-120, 120),
        vy: rand(-120, 120),
        life: rand(0.35, 0.8),
        max: 0.8,
        size: rand(2, 4.5),
        color: '#7a4a31',
        drag: 2.2,
        rot: Math.random() * TAU,
        vr: rand(-12, 12),
      });
    }
    addParticle({
      type: 'ring',
      x, y,
      vx: 0, vy: 0,
      life: 0.34,
      max: 0.34,
      size: 6 * s,
      grow: 78 * s,
      color: base,
      drag: 0,
    });
    state.shake = Math.max(state.shake, 3.4 * s);
  }

  function updateParticles(dt) {
    for (const p of state.particles) {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.drag) {
        const damp = Math.max(0, 1 - p.drag * dt);
        p.vx *= damp;
        p.vy *= damp;
      }
      if (p.vr) p.rot = (p.rot || 0) + p.vr * dt;
      if (p.type === 'ring') p.size += p.grow * dt;
    }
    state.particles = state.particles.filter((p) => p.life > 0);
  }

  function updateTexts(dt) {
    for (const t of state.texts) {
      t.life -= dt;
      t.y -= 26 * dt;
    }
    state.texts = state.texts.filter((t) => t.life > 0);
  }

  /* ---------------- 基地墙 ---------------- */
  function setBaseWalls(type) {
    if (!state.base || !state.base.alive || !state.grid) return;
    for (const [c, r] of BASE_WALLS) state.grid[r][c] = type;
  }

  /* ---------------- 坦克移动 / 碰撞 ---------------- */
  function tankBlocked(tank, nx, ny) {
    if (nx < 8 || ny < 8 || nx + tank.w > W - 8 || ny + tank.h > H - 8) return true;

    const c0 = Math.max(0, Math.floor(nx / TILE));
    const c1 = Math.min(COLS - 1, Math.floor((nx + tank.w - 0.01) / TILE));
    const r0 = Math.max(0, Math.floor(ny / TILE));
    const r1 = Math.min(ROWS - 1, Math.floor((ny + tank.h - 0.01) / TILE));
    for (let r = r0; r <= r1; r += 1) {
      for (let c = c0; c <= c1; c += 1) {
        const v = state.grid[r][c];
        if (v === BRICK || v === STEEL || v === WATER) return true;
      }
    }

    if (state.base && overlap(nx, ny, tank.w, tank.h, state.base.x, state.base.y, state.base.w, state.base.h)) {
      return true;
    }

    if (state.player && state.player !== tank && state.player.alive
      && overlap(nx, ny, tank.w, tank.h, state.player.x, state.player.y, state.player.w, state.player.h)) {
      return true;
    }
    for (const e of state.enemies) {
      if (e === tank || !e.alive) continue;
      if (overlap(nx, ny, tank.w, tank.h, e.x, e.y, e.w, e.h)) return true;
    }
    return false;
  }

  function moveTank(tank, dir, dist) {
    const v = DIRS[dir];
    const nx = tank.x + v.x * dist;
    const ny = tank.y + v.y * dist;
    if (tankBlocked(tank, nx, ny)) return false;
    tank.x = nx;
    tank.y = ny;
    return true;
  }

  // 转向时把垂直于行进方向的坐标吸附到 8px 网格，方便钻巷道
  function snapTank(tank, dir) {
    if (dir === 'left' || dir === 'right') {
      const ny = Math.round(tank.y / 8) * 8;
      if (Math.abs(ny - tank.y) <= 7 && !tankBlocked(tank, tank.x, ny)) tank.y = ny;
    } else {
      const nx = Math.round(tank.x / 8) * 8;
      if (Math.abs(nx - tank.x) <= 7 && !tankBlocked(tank, nx, tank.y)) tank.x = nx;
    }
  }

  /* ---------------- 子弹 ---------------- */
  function countBullets(owner, shooterId) {
    let n = 0;
    for (const b of state.bullets) {
      if (b.dead || b.owner !== owner) continue;
      if (shooterId !== undefined && b.shooterId !== shooterId) continue;
      n += 1;
    }
    return n;
  }

  function spawnBullet(tank, owner, speed, shooterId) {
    const v = DIRS[tank.dir];
    const x = tank.x + tank.w / 2 + v.x * 15;
    const y = tank.y + tank.h / 2 + v.y * 15;
    state.bullets.push({
      x, y, w: 7, h: 7,
      dir: tank.dir,
      speed,
      owner,
      shooterId,
      dead: false,
      life: 0,
    });
    for (let i = 0; i < 4; i += 1) {
      addParticle({
        type: 'spark',
        x, y,
        vx: v.x * rand(40, 120) + rand(-30, 30),
        vy: v.y * rand(40, 120) + rand(-30, 30),
        life: rand(0.08, 0.2),
        max: 0.2,
        size: rand(1, 2.2),
        color: owner === 'player' ? '#9dfff0' : '#ffc9a3',
        drag: 3,
      });
    }
  }

  function firePlayer() {
    const p = state.player;
    if (!p || !p.alive) return;
    const weapon = WEAPONS[state.weapon];
    if (p.cooldown > 0) return;
    if (countBullets('player') >= weapon.max) return;
    p.cooldown = weapon.cooldown;
    spawnBullet(p, 'player', weapon.speed);
    sfx.shoot();
  }

  function shootEnemy(e) {
    if (!e.alive || e.spawn > 0) return;
    const type = ENEMY_TYPES[e.kind];
    if (countBullets('enemy', e.id) >= type.maxBullets) return;
    spawnBullet(e, 'enemy', type.bulletSpeed, e.id);
    sfx.enemyShoot();
  }

  function breakBrick(c, r) {
    if (!state.grid || state.grid[r][c] !== BRICK) return;
    state.grid[r][c] = EMPTY;
    const cx = c * TILE + TILE / 2;
    const cy = r * TILE + TILE / 2;
    for (let i = 0; i < 7; i += 1) {
      addParticle({
        type: 'debris',
        x: cx + rand(-4, 4),
        y: cy + rand(-4, 4),
        vx: rand(-70, 70),
        vy: rand(-80, 30),
        life: rand(0.25, 0.55),
        max: 0.55,
        size: rand(1.5, 3.6),
        color: Math.random() < 0.5 ? '#8a4a2f' : '#5c3020',
        drag: 2.6,
        rot: Math.random() * TAU,
        vr: rand(-15, 15),
      });
    }
    spark(cx, cy, '#ffb37a', 5, 110);
    sfx.brick();
  }

  function damageEnemy(e) {
    e.hp -= 1;
    e.hitFlash = 0.2;
    const cx = e.x + e.w / 2;
    const cy = e.y + e.h / 2;
    if (e.hp <= 0) {
      destroyEnemy(e);
    } else {
      spark(cx, cy, '#ffe4b8', 7, 160);
      sfx.clink();
      state.shake = Math.max(state.shake, 1.5);
    }
  }

  function destroyEnemy(e) {
    if (!e.alive) return;
    e.alive = false;
    const type = ENEMY_TYPES[e.kind];
    const cx = e.x + e.w / 2;
    const cy = e.y + e.h / 2;
    explosion(cx, cy, 1, type.color);
    addScore(type.score);
    addText(cx, cy - 12, `+${type.score}`, type.color);
    if (e.bonus) dropPowerup(cx, cy);
    sfx.explosion(0.85);
    updateHUD();
  }

  function resolveBullet(b) {
    if (b.dead) return;
    const bx = b.x - b.w / 2;
    const by = b.y - b.h / 2;

    if (b.x < 0 || b.x > W || b.y < 0 || b.y > H) {
      b.dead = true;
      return;
    }

    // 命中地形
    const c0 = Math.max(0, Math.floor(bx / TILE));
    const c1 = Math.min(COLS - 1, Math.floor((bx + b.w) / TILE));
    const r0 = Math.max(0, Math.floor(by / TILE));
    const r1 = Math.min(ROWS - 1, Math.floor((by + b.h) / TILE));
    for (let r = r0; r <= r1; r += 1) {
      for (let c = c0; c <= c1; c += 1) {
        const v = state.grid[r][c];
        if (v === BRICK) {
          b.dead = true;
          breakBrick(c, r);
          return;
        }
        if (v === STEEL) {
          b.dead = true;
          spark(b.x, b.y, '#cfe0ff', 6, 150);
          sfx.clink();
          return;
        }
      }
    }

    // 命中基地
    if (state.base && state.base.alive
      && overlap(bx, by, b.w, b.h, state.base.x, state.base.y, state.base.w, state.base.h)) {
      b.dead = true;
      destroyBase();
      return;
    }

    // 命中坦克
    if (b.owner === 'player') {
      for (const e of state.enemies) {
        if (!e.alive || e.spawn > 0) continue;
        if (!overlap(bx, by, b.w, b.h, e.x, e.y, e.w, e.h)) continue;
        b.dead = true;
        if (e.invuln > 0) {
          spark(b.x, b.y, '#cfe0ff', 5, 120);
          sfx.clink();
        } else {
          damageEnemy(e);
        }
        return;
      }
    } else {
      const p = state.player;
      if (p && p.alive && overlap(bx, by, b.w, b.h, p.x, p.y, p.w, p.h)) {
        b.dead = true;
        if (p.invuln > 0) {
          spark(b.x, b.y, '#5fd8ff', 6, 140);
          sfx.clink();
        } else {
          killPlayer();
        }
      }
    }
  }

  function updateBullets(dt) {
    for (const b of state.bullets) {
      if (b.dead) continue;
      b.life += dt;
      let remaining = b.speed * dt;
      const v = DIRS[b.dir];
      let guard = 0;
      while (remaining > 0 && !b.dead && guard < 32) {
        const step = Math.min(7, remaining);
        b.x += v.x * step;
        b.y += v.y * step;
        remaining -= step;
        guard += 1;
        resolveBullet(b);
      }
    }

    // 玩家子弹可以打掉敌方子弹
    for (const pb of state.bullets) {
      if (pb.dead || pb.owner !== 'player') continue;
      for (const eb of state.bullets) {
        if (eb.dead || eb.owner !== 'enemy') continue;
        if (Math.abs(pb.x - eb.x) < 7 && Math.abs(pb.y - eb.y) < 7) {
          pb.dead = true;
          eb.dead = true;
          spark(pb.x, pb.y, '#fff3cf', 6, 120);
          sfx.clink();
          break;
        }
      }
    }

    state.bullets = state.bullets.filter((b) => !b.dead && b.life < 7);
  }

  /* ---------------- 玩家 ---------------- */
  function updatePlayer(dt) {
    const p = state.player;
    if (!p) return;

    if (!p.alive) {
      p.respawn -= dt;
      if (p.respawn <= 0 && state.lives > 0) respawnPlayer();
      return;
    }

    p.invuln = Math.max(0, p.invuln - dt);
    p.cooldown = Math.max(0, p.cooldown - dt);

    const dir = currentDir();
    if (dir) {
      if (p.dir !== dir) {
        p.dir = dir;
        snapTank(p, dir);
      }
      const moved = moveTank(p, dir, p.speed * dt);
      p.moving = moved;
      if (moved) {
        p.tread += dt * 7;
        if (Math.random() < dt * 14) {
          const v = DIRS[dir];
          addParticle({
            type: 'smoke',
            x: p.x + p.w / 2 - v.x * 12 + rand(-5, 5),
            y: p.y + p.h / 2 - v.y * 12 + rand(-5, 5),
            vx: -v.x * 20 + rand(-8, 8),
            vy: -v.y * 20 + rand(-8, 8),
            life: rand(0.22, 0.45),
            max: 0.45,
            size: rand(2.5, 5),
            color: '#3a4557',
            drag: 2.4,
          });
        }
      }
    } else {
      p.moving = false;
    }

    if (fireHeld || touchFire.held) firePlayer();
  }

  function killPlayer() {
    const p = state.player;
    if (!p || !p.alive) return;
    p.alive = false;
    explosion(p.x + p.w / 2, p.y + p.h / 2, 1.15, '#5ff0d0');
    sfx.explosion(0.9);
    state.shake = Math.max(state.shake, 6);
    state.lives -= 1;
    if (state.weapon > 0) state.weapon = Math.max(0, state.weapon - 1);
    updateHUD();

    if (state.lives <= 0) {
      gameOver('全军覆没');
    } else {
      p.respawn = 1.35;
      addText(p.x + p.w / 2, p.y, '坦克损失', '#ff9aa9');
    }
  }

  function respawnPlayer() {
    if (!state.base || !state.base.alive || state.lives <= 0) return;
    state.player = makePlayer(3);
    addText(state.player.x + 14, state.player.y - 6, '重新部署', '#7fffe0');
  }

  /* ---------------- 基地 ---------------- */
  function destroyBase() {
    if (!state.base || !state.base.alive) return;
    state.base.alive = false;
    explosion(state.base.x + 16, state.base.y + 16, 2.3, '#ffb347');
    explosion(state.base.x + 8, state.base.y + 20, 1.2, '#ff7a5c');
    state.shake = 14;
    state.flash = 0.75;
    sfx.explosion(1.4);
    gameOver('基地失守');
  }

  /* ---------------- 补给 ---------------- */
  function dropPowerup(x, y) {
    const type = POWER_LIST[randInt(0, POWER_LIST.length - 1)];
    state.powerups.push({
      type,
      x: clamp(x, 26, W - 26),
      y: clamp(y, 26, H - 26),
      life: 12,
      bob: Math.random() * TAU,
      dead: false,
    });
    addText(x, y - 18, '补给出现', POWER_TYPES[type].color);
  }

  function applyPowerup(pw) {
    const p = state.player;
    const cx = p ? p.x + p.w / 2 : pw.x;
    const cy = p ? p.y + p.h / 2 : pw.y;

    switch (pw.type) {
      case 'star':
        if (state.weapon < 2) {
          state.weapon += 1;
          addText(cx, cy - 16, `火力 LV.${state.weapon + 1}`, '#ffd166');
        } else {
          addScore(500);
          addText(cx, cy - 16, '火力已满 +500', '#ffd166');
        }
        sfx.power();
        break;
      case 'shield':
        if (p) p.invuln = Math.max(p.invuln, 8);
        addText(cx, cy - 16, '护盾 8 秒', '#5fd8ff');
        sfx.power();
        break;
      case 'bomb': {
        state.flash = 0.55;
        state.shake = 10;
        for (const e of state.enemies.slice()) {
          if (e.alive) destroyEnemy(e);
        }
        state.enemies = state.enemies.filter((e) => e.alive);
        addText(W / 2, H / 2 - 20, '全屏轰炸！', '#ff8264');
        sfx.explosion(1.3);
        break;
      }
      case 'clock':
        state.freeze = Math.max(state.freeze, 7);
        addText(cx, cy - 16, '时间冻结 7 秒', '#a6d8ff');
        sfx.freeze();
        break;
      case 'life':
        state.lives = Math.min(9, state.lives + 1);
        addText(cx, cy - 16, '生命 +1', '#6cf0a8');
        sfx.life();
        updateHUD();
        break;
      case 'shovel':
        state.shovel = 14;
        state.shovelTick = 0;
        state.shovelToggle = false;
        setBaseWalls(STEEL);
        addText(cx, cy - 16, '基地钢墙 14 秒', '#ffb347');
        sfx.power();
        break;
      default:
        break;
    }
  }

  function updatePowerups(dt) {
    for (const pw of state.powerups) {
      pw.life -= dt;
      pw.bob += dt * 3;
      const p = state.player;
      if (p && p.alive) {
        const dx = (p.x + p.w / 2) - pw.x;
        const dy = (p.y + p.h / 2) - pw.y;
        if (dx * dx + dy * dy < 24 * 24) {
          pw.dead = true;
          applyPowerup(pw);
        }
      }
    }
    state.powerups = state.powerups.filter((pw) => !pw.dead && pw.life > 0);
  }

  /* ---------------- 敌方 AI ---------------- */
  function canStep(tank, dir, dist) {
    const v = DIRS[dir];
    return !tankBlocked(tank, tank.x + v.x * dist, tank.y + v.y * dist);
  }

  function chooseEnemyDir(e) {
    const options = DIR_LIST.filter((d) => canStep(e, d, 7));
    if (!options.length) return OPPOSITE[e.dir];

    const p = state.player;
    const target = p && p.alive && Math.random() < 0.55 ? p : state.base;
    if (!target) return options[randInt(0, options.length - 1)];

    const ecx = e.x + e.w / 2;
    const ecy = e.y + e.h / 2;
    const dx = (target.x + target.w / 2) - ecx;
    const dy = (target.y + target.h / 2) - ecy;
    const pref = Math.abs(dx) > Math.abs(dy)
      ? (dx > 0 ? 'right' : 'left')
      : (dy > 0 ? 'down' : 'up');

    if (options.includes(pref) && Math.random() < 0.7) return pref;

    const alt = Math.abs(dx) > Math.abs(dy)
      ? (dy > 0 ? 'down' : 'up')
      : (dx > 0 ? 'right' : 'left');
    if (options.includes(alt) && Math.random() < 0.45) return alt;

    return options[randInt(0, options.length - 1)];
  }

  function hasLOS(ax, ay, bx, by) {
    const dx = bx - ax;
    const dy = by - ay;
    const dist = Math.hypot(dx, dy);
    const steps = Math.floor(dist / 9);
    for (let i = 1; i < steps; i += 1) {
      const t = i / steps;
      const c = Math.floor((ax + dx * t) / TILE);
      const r = Math.floor((ay + dy * t) / TILE);
      if (r < 0 || r >= ROWS || c < 0 || c >= COLS) return false;
      const v = state.grid[r][c];
      if (v === BRICK || v === STEEL) return false;
    }
    return true;
  }

  function updateEnemies(dt) {
    for (const e of state.enemies) {
      if (!e.alive) continue;
      if (e.hitFlash > 0) e.hitFlash = Math.max(0, e.hitFlash - dt);

      if (e.spawn > 0) {
        e.spawn -= dt;
        if (e.spawn <= 0 && e.invuln === 0) e.invuln = 0.35;
        continue;
      }
      if (e.invuln > 0) e.invuln = Math.max(0, e.invuln - dt);
      if (state.freeze > 0) continue;

      const type = ENEMY_TYPES[e.kind];
      e.cooldown -= dt;
      e.moveTimer -= dt;

      const p = state.player;
      const target = (p && p.alive) ? p : state.base;
      if (target && e.cooldown <= 0) {
        const ecx = e.x + e.w / 2;
        const ecy = e.y + e.h / 2;
        const tcx = target.x + target.w / 2;
        const tcy = target.y + target.h / 2;
        const dx = tcx - ecx;
        const dy = tcy - ecy;
        let aim = null;
        if (Math.abs(dx) <= 11) aim = dy > 0 ? 'down' : (dy < 0 ? 'up' : null);
        else if (Math.abs(dy) <= 11) aim = dx > 0 ? 'right' : 'left';
        if (aim && hasLOS(ecx, ecy, tcx, tcy)) {
          e.dir = aim;
          if (countBullets('enemy', e.id) < type.maxBullets) {
            shootEnemy(e);
            e.cooldown = type.fire * rand(0.85, 1.25);
          }
        }
      }

      if (e.cooldown <= 0 && Math.random() < dt * 0.32) {
        shootEnemy(e);
        e.cooldown = type.fire + rand(0.2, 0.8);
      }

      if (e.moveTimer <= 0) {
        e.dir = chooseEnemyDir(e);
        e.moveTimer = rand(0.45, 1.65);
      }

      const moved = moveTank(e, e.dir, e.speed * dt);
      if (moved) {
        e.tread += dt * 6;
        e.blockedTime = 0;
      } else {
        e.blockedTime += dt;
        if (e.blockedTime > 0.15) {
          if (e.cooldown <= 0 && Math.random() < 0.55) {
            shootEnemy(e);
            e.cooldown = type.fire;
          }
          e.dir = chooseEnemyDir(e);
          e.moveTimer = rand(0.3, 0.9);
          e.blockedTime = 0;
        }
      }
    }
  }

  /* ---------------- 敌人生成 ---------------- */
  function pickSpawnPoint() {
    const order = [0, 1, 2].sort(() => Math.random() - 0.5);
    for (const idx of order) {
      const pt = SPAWN_POINTS[idx];
      let blocked = false;
      const p = state.player;
      if (p && p.alive && overlap(pt.x, pt.y, 28, 28, p.x, p.y, p.w, p.h)) blocked = true;
      if (!blocked) {
        for (const e of state.enemies) {
          if (!e.alive) continue;
          if (overlap(pt.x, pt.y, 28, 28, e.x, e.y, e.w, e.h)) { blocked = true; break; }
        }
      }
      if (!blocked && state.base
        && overlap(pt.x, pt.y, 28, 28, state.base.x, state.base.y, state.base.w, state.base.h)) {
        blocked = true;
      }
      if (!blocked) return pt;
    }
    return null;
  }

  function spawnLogic(dt) {
    if (!state.queue.length) return;
    if (state.enemies.length >= state.maxOnField) return;

    state.spawnTimer -= dt;
    if (state.spawnTimer > 0) return;

    const point = pickSpawnPoint();
    if (!point) {
      state.spawnTimer = 0.45;
      return;
    }

    const entry = state.queue.shift();
    const type = ENEMY_TYPES[entry.kind];
    state.enemyId += 1;
    state.enemies.push({
      id: state.enemyId,
      kind: entry.kind,
      x: point.x,
      y: point.y,
      w: 28,
      h: 28,
      dir: 'down',
      speed: type.speed,
      hp: type.hp,
      maxHp: type.hp,
      cooldown: rand(0.5, 1.1),
      moveTimer: 0,
      blockedTime: 0,
      spawn: 0.9,
      invuln: 0,
      tread: 0,
      alive: true,
      bonus: entry.bonus,
      hitFlash: 0,
    });
    state.spawnTimer = state.spawnInterval * rand(0.82, 1.25);
    updateHUD();
  }

  /* ---------------- 计时效果 ---------------- */
  function updateTimers(dt) {
    if (state.freeze > 0) state.freeze = Math.max(0, state.freeze - dt);

    if (state.shovel > 0) {
      state.shovel -= dt;
      if (state.shovel <= 0) {
        state.shovel = 0;
        setBaseWalls(BRICK);
      } else if (state.shovel < 2.4) {
        state.shovelTick -= dt;
        if (state.shovelTick <= 0) {
          state.shovelTick = 0.18;
          state.shovelToggle = !state.shovelToggle;
          setBaseWalls(state.shovelToggle ? BRICK : STEEL);
        }
      }
    }
  }

  /* ---------------- 主更新 ---------------- */
  function update(dt) {
    if (state.flash > 0) state.flash = Math.max(0, state.flash - dt * 1.8);
    if (state.shake > 0) state.shake = Math.max(0, state.shake - dt * 22);

    updateTimers(dt);
    updatePlayer(dt);
    updateEnemies(dt);
    updateBullets(dt);
    state.enemies = state.enemies.filter((e) => e.alive);
    if (state.mode !== 'playing') {
      updateParticles(dt);
      updateTexts(dt);
      return;
    }

    updatePowerups(dt);
    state.enemies = state.enemies.filter((e) => e.alive);
    updateParticles(dt);
    updateTexts(dt);
    spawnLogic(dt);

    if (!state.queue.length && !state.enemies.length) {
      state.clearDelay += dt;
      if (state.clearDelay > 0.9) levelClear();
    } else {
      state.clearDelay = 0;
    }
  }

  /* ---------------- 绘制：基础 ---------------- */
  const ACCENTS = {
    player: '#d7fff7',
    basic: '#ffd9cc',
    fast: '#fff3c4',
    armor: '#eef5ff',
    power: '#f4e8ff',
  };

  function starPath(cx, cy, R, r, points) {
    const n = points || 5;
    ctx.beginPath();
    for (let i = 0; i < n * 2; i += 1) {
      const rad = i % 2 === 0 ? R : r;
      const a = -Math.PI / 2 + (i * Math.PI) / n;
      const x = cx + Math.cos(a) * rad;
      const y = cy + Math.sin(a) * rad;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
  }

  function drawGround() {
    ctx.fillStyle = '#070c15';
    ctx.fillRect(-24, -24, W + 48, H + 48);

    const wash = ctx.createRadialGradient(W / 2, H * 0.42, 30, W / 2, H * 0.42, W * 0.78);
    wash.addColorStop(0, 'rgba(38, 66, 102, .22)');
    wash.addColorStop(1, 'rgba(7, 12, 21, 0)');
    ctx.fillStyle = wash;
    ctx.fillRect(0, 0, W, H);

    ctx.strokeStyle = 'rgba(120, 160, 220, .055)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x <= W; x += 32) {
      ctx.moveTo(x + 0.5, 0);
      ctx.lineTo(x + 0.5, H);
    }
    for (let y = 0; y <= H; y += 32) {
      ctx.moveTo(0, y + 0.5);
      ctx.lineTo(W, y + 0.5);
    }
    ctx.stroke();

    ctx.fillStyle = 'rgba(140, 180, 240, .06)';
    for (let i = 0; i < 64; i += 1) {
      const x = (i * 97 + 23) % W;
      const y = (i * 61 + 47) % H;
      ctx.fillRect(x, y, 1.4, 1.4);
    }
  }

  function drawWater(t) {
    for (let r = 0; r < ROWS; r += 1) {
      for (let c = 0; c < COLS; c += 1) {
        if (state.grid[r][c] !== WATER) continue;
        const x = c * TILE;
        const y = r * TILE;
        const ph = Math.sin(t * 2.2 + c * 0.55 + r * 0.4);
        ctx.fillStyle = '#0b2438';
        ctx.fillRect(x, y, TILE, TILE);
        ctx.fillStyle = 'rgba(50, 140, 215, .24)';
        ctx.fillRect(x + 1, y + 1, TILE - 2, TILE - 2);
        ctx.fillStyle = 'rgba(140, 226, 255, .32)';
        ctx.fillRect(x + 2, y + 4 + ph * 2.2, 9, 1.4);
        ctx.fillRect(x + 6, y + 10 - ph * 2.2, 8, 1.4);
        ctx.fillStyle = 'rgba(190, 245, 255, .18)';
        ctx.fillRect(x + 3, y + 12 + ph, 5, 1);
      }
    }
  }

  function drawBrickCell(x, y, c, r) {
    const shade = (c * 13 + r * 7) % 3;
    ctx.fillStyle = '#241310';
    ctx.fillRect(x, y, TILE, TILE);
    ctx.fillStyle = shade === 0 ? '#7c412a' : (shade === 1 ? '#87492e' : '#743d26');
    ctx.fillRect(x + 1, y + 1, 6, 6);
    ctx.fillRect(x + 9, y + 1, 6, 6);
    ctx.fillRect(x + 1, y + 9, 6, 6);
    ctx.fillRect(x + 9, y + 9, 6, 6);
    ctx.fillStyle = 'rgba(255, 176, 126, .22)';
    ctx.fillRect(x + 1, y + 1, 6, 1);
    ctx.fillRect(x + 9, y + 1, 6, 1);
    ctx.fillRect(x + 1, y + 9, 6, 1);
    ctx.fillRect(x + 9, y + 9, 6, 1);
    ctx.fillStyle = 'rgba(30, 14, 9, .45)';
    ctx.fillRect(x + 4, y + 2, 1, 5);
    ctx.fillRect(x + 12, y + 10, 1, 5);
  }

  function drawSteelCell(x, y, c, r) {
    ctx.fillStyle = '#141c2a';
    ctx.fillRect(x, y, TILE, TILE);
    ctx.fillStyle = '#4a5a7b';
    ctx.fillRect(x + 1, y + 1, 14, 14);
    ctx.fillStyle = '#6f83a8';
    ctx.fillRect(x + 2, y + 2, 6, 6);
    ctx.fillRect(x + 8, y + 8, 6, 6);
    ctx.fillStyle = '#93a8cc';
    ctx.fillRect(x + 3, y + 3, 4, 4);
    ctx.fillRect(x + 9, y + 9, 4, 4);
    ctx.fillStyle = '#2c3a52';
    ctx.fillRect(x + 9, y + 2, 5, 5);
    ctx.fillRect(x + 2, y + 9, 5, 5);
    ctx.fillStyle = 'rgba(230, 240, 255, .55)';
    const rivet = (c + r) % 2 === 0 ? 2 : 12;
    ctx.fillRect(x + rivet, y + 2, 1.5, 1.5);
    ctx.fillRect(x + 14 - rivet, y + 13, 1.5, 1.5);
  }

  function drawBlocks() {
    for (let r = 0; r < ROWS; r += 1) {
      for (let c = 0; c < COLS; c += 1) {
        const v = state.grid[r][c];
        if (v === BRICK) drawBrickCell(c * TILE, r * TILE, c, r);
        else if (v === STEEL) drawSteelCell(c * TILE, r * TILE, c, r);
      }
    }
  }

  function drawBase(t) {
    const b = state.base;
    if (!b) return;
    const cx = b.x + b.w / 2;
    const cy = b.y + b.h / 2;

    ctx.fillStyle = '#0b1424';
    roundRect(b.x + 1, b.y + 1, b.w - 2, b.h - 2, 5);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 209, 102, .35)';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.save();
    ctx.translate(cx, cy);

    if (!b.alive) {
      ctx.fillStyle = '#2a303c';
      ctx.beginPath();
      ctx.moveTo(-9, -10);
      ctx.lineTo(9, -10);
      ctx.lineTo(9, 1);
      ctx.quadraticCurveTo(9, 8, 0, 12);
      ctx.quadraticCurveTo(-9, 8, -9, 1);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#4c5568';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255, 95, 122, .75)';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(-5, -7);
      ctx.lineTo(2, 0);
      ctx.lineTo(-2, 4);
      ctx.lineTo(4, 9);
      ctx.stroke();
      ctx.restore();
      return;
    }

    const pulse = 0.6 + 0.4 * Math.sin(t * 3.2);
    ctx.shadowColor = `rgba(255, 194, 92, ${0.45 + pulse * 0.45})`;
    ctx.shadowBlur = 9 + pulse * 5;

    ctx.beginPath();
    ctx.moveTo(-9, -10);
    ctx.lineTo(9, -10);
    ctx.lineTo(9, 1);
    ctx.quadraticCurveTo(9, 8, 0, 12);
    ctx.quadraticCurveTo(-9, 8, -9, 1);
    ctx.closePath();
    const g = ctx.createLinearGradient(0, -10, 0, 12);
    g.addColorStop(0, '#ffeab4');
    g.addColorStop(0.55, '#ffca5e');
    g.addColorStop(1, '#e89a24');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 248, 220, .9)';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.shadowBlur = 0;
    ctx.fillStyle = '#3a2a0c';
    starPath(0, -1, 6.2, 2.6, 5);
    ctx.fill();
    ctx.restore();

    // 基地外的钢墙闪烁提示
    if (state.shovel > 0) {
      ctx.strokeStyle = `rgba(255, 211, 120, ${0.35 + 0.35 * Math.sin(t * 10)})`;
      ctx.lineWidth = 1;
      ctx.strokeRect(b.x - 15, b.y - 15, 62, 62);
    }
  }

  function drawPowerups(t) {
    for (const pw of state.powerups) {
      const def = POWER_TYPES[pw.type];
      const bob = Math.sin(pw.bob) * 2;
      const blink = pw.life < 3 ? (0.35 + 0.65 * (Math.sin(t * 12) > 0 ? 1 : 0)) : 1;
      ctx.save();
      ctx.globalAlpha = blink;
      ctx.translate(pw.x, pw.y + bob);

      ctx.fillStyle = def.glow;
      ctx.globalAlpha = blink * 0.18;
      ctx.beginPath();
      ctx.arc(0, 0, 15, 0, TAU);
      ctx.fill();

      ctx.globalAlpha = blink;
      ctx.shadowColor = def.glow;
      ctx.shadowBlur = 14;
      ctx.fillStyle = 'rgba(6, 11, 19, .94)';
      roundRect(-11, -11, 22, 22, 6);
      ctx.fill();
      ctx.strokeStyle = def.color;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.shadowBlur = 0;

      drawPowerIcon(pw.type, def.color);
      ctx.restore();
    }
  }

  function drawPowerIcon(type, color) {
    ctx.fillStyle = color;
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.7;
    ctx.lineCap = 'round';

    if (type === 'star') {
      starPath(0, 0, 7.4, 3.2, 5);
      ctx.fill();
    } else if (type === 'shield') {
      ctx.beginPath();
      ctx.moveTo(0, -7.5);
      ctx.lineTo(6, -5);
      ctx.lineTo(6, 1.5);
      ctx.quadraticCurveTo(6, 5.5, 0, 7.5);
      ctx.quadraticCurveTo(-6, 5.5, -6, 1.5);
      ctx.lineTo(-6, -5);
      ctx.closePath();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, -4.5);
      ctx.lineTo(0, 4.5);
      ctx.stroke();
    } else if (type === 'bomb') {
      ctx.beginPath();
      ctx.arc(0, 1.5, 5.2, 0, TAU);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(2.5, -2.5);
      ctx.quadraticCurveTo(5, -7, 2.5, -8);
      ctx.stroke();
      ctx.fillRect(1.2, -8.8, 2.6, 2.6);
    } else if (type === 'clock') {
      ctx.beginPath();
      ctx.arc(0, 0, 6.4, 0, TAU);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(0, -4);
      ctx.moveTo(0, 0);
      ctx.lineTo(3.2, 1.6);
      ctx.stroke();
    } else if (type === 'life') {
      ctx.beginPath();
      ctx.moveTo(0, 6.4);
      ctx.bezierCurveTo(-8, 0.4, -6.4, -6.6, -2.4, -6.6);
      ctx.bezierCurveTo(-0.8, -6.6, 0, -5.2, 0, -4.2);
      ctx.bezierCurveTo(0, -5.2, 0.8, -6.6, 2.4, -6.6);
      ctx.bezierCurveTo(6.4, -6.6, 8, 0.4, 0, 6.4);
      ctx.fill();
    } else if (type === 'shovel') {
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(2.4, -7);
      ctx.lineTo(-1.6, 2.2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-4.4, 1.6);
      ctx.lineTo(1.2, 0.4);
      ctx.lineTo(3.6, 7);
      ctx.lineTo(-1.6, 8);
      ctx.closePath();
      ctx.fill();
    }
  }

  function drawTank(tank, bodyColor, accentColor) {
    const cx = tank.x + tank.w / 2;
    const cy = tank.y + tank.h / 2;
    const angle = DIRS[tank.dir].angle;
    const isPlayer = tank === state.player;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);

    ctx.fillStyle = 'rgba(0, 0, 0, .38)';
    ctx.beginPath();
    ctx.ellipse(0, 3, 14, 13, 0, 0, TAU);
    ctx.fill();

    // 履带
    ctx.fillStyle = '#080d15';
    roundRect(-14, -14, 7, 28, 2.5);
    ctx.fill();
    roundRect(7, -14, 7, 28, 2.5);
    ctx.fill();
    ctx.fillStyle = 'rgba(150, 185, 225, .26)';
    const off = ((tank.tread * 3) % 5 + 5) % 5;
    for (let i = -14 + off; i < 13; i += 5) {
      ctx.fillRect(-13.2, i, 5.4, 1.8);
      ctx.fillRect(7.8, i, 5.4, 1.8);
    }

    // 车体
    const grad = ctx.createLinearGradient(-9, -12, 9, 12);
    grad.addColorStop(0, accentColor);
    grad.addColorStop(0.42, bodyColor);
    grad.addColorStop(1, bodyColor);
    ctx.fillStyle = grad;
    roundRect(-9.5, -12, 19, 24, 4);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, .22)';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = 'rgba(255, 255, 255, .16)';
    roundRect(-6, -11.2, 12, 4.6, 2);
    ctx.fill();

    ctx.fillStyle = 'rgba(0, 0, 0, .3)';
    ctx.fillRect(-5, 7.5, 10, 2);

    // 炮塔
    const tg = ctx.createRadialGradient(-2, -2, 1, 0, 0, 8);
    tg.addColorStop(0, accentColor);
    tg.addColorStop(1, bodyColor);
    ctx.fillStyle = tg;
    ctx.beginPath();
    ctx.arc(0, 0, 6.6, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0, 0, 0, .35)';
    ctx.stroke();

    // 炮管
    ctx.fillStyle = 'rgba(9, 15, 24, .92)';
    roundRect(-2, -18, 4, 12, 1.5);
    ctx.fill();
    ctx.fillStyle = accentColor;
    ctx.fillRect(-1.4, -18, 2.8, 5);

    ctx.fillStyle = 'rgba(255, 255, 255, .8)';
    ctx.beginPath();
    ctx.arc(0, -1, 1.6, 0, TAU);
    ctx.fill();

    if (isPlayer) {
      ctx.fillStyle = 'rgba(130, 255, 232, .9)';
      ctx.beginPath();
      ctx.arc(0, -18.4, 1.7, 0, TAU);
      ctx.fill();
    }

    ctx.restore();
  }

  function drawShield(p, t) {
    const cx = p.x + p.w / 2;
    const cy = p.y + p.h / 2;
    const rad = 21 + Math.sin(t * 4) * 1.2;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.fillStyle = 'rgba(95, 216, 255, .08)';
    ctx.beginPath();
    ctx.arc(0, 0, rad, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = 'rgba(95, 216, 255, .85)';
    ctx.lineWidth = 1.6;
    ctx.setLineDash([5, 4]);
    ctx.lineDashOffset = -t * 24;
    ctx.beginPath();
    ctx.arc(0, 0, rad, 0, TAU);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  function drawTanks(t) {
    for (const e of state.enemies) {
      if (!e.alive || e.spawn > 0) continue;
      const type = ENEMY_TYPES[e.kind];
      const body = e.hitFlash > 0 ? '#ffffff' : type.color;
      drawTank(e, body, e.hitFlash > 0 ? '#ffffff' : ACCENTS[e.kind]);
      if (state.freeze > 0) {
        const cx = e.x + e.w / 2;
        const cy = e.y + e.h / 2;
        ctx.strokeStyle = 'rgba(140, 210, 255, .55)';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(cx, cy, 18, 0, TAU);
        ctx.stroke();
        ctx.fillStyle = 'rgba(150, 220, 255, .12)';
        ctx.beginPath();
        ctx.arc(cx, cy, 18, 0, TAU);
        ctx.fill();
      }
      if (e.invuln > 0) {
        ctx.strokeStyle = 'rgba(255, 230, 170, .5)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(e.x + e.w / 2, e.y + e.h / 2, 18, 0, TAU);
        ctx.stroke();
      }
    }

    const p = state.player;
    if (p && p.alive) {
      drawTank(p, '#2fd8bd', ACCENTS.player);
      if (p.invuln > 0) drawShield(p, t);
    }
  }

  function drawSpawnStars(t) {
    for (const e of state.enemies) {
      if (e.spawn <= 0 || !e.alive) continue;
      const p = 1 - e.spawn / 0.9;
      const cx = e.x + e.w / 2;
      const cy = e.y + e.h / 2;
      const rad = 5 + p * 12;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(t * 8 + p * 3);
      ctx.strokeStyle = '#ffd166';
      ctx.lineWidth = 2;
      ctx.shadowColor = 'rgba(255, 209, 102, .9)';
      ctx.shadowBlur = 12;
      ctx.beginPath();
      for (let i = 0; i < 8; i += 1) {
        const r = i % 2 === 0 ? rad : rad * 0.34;
        const a = (i * Math.PI) / 4;
        const x = Math.cos(a) * r;
        const y = Math.sin(a) * r;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.stroke();
      ctx.fillStyle = 'rgba(255, 240, 200, .25)';
      ctx.beginPath();
      ctx.arc(0, 0, rad * 0.35, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
  }

  function drawBullets() {
    for (const b of state.bullets) {
      if (b.dead) continue;
      const color = b.owner === 'player' ? '#6ffbe4' : '#ffab6e';
      const v = DIRS[b.dir];
      ctx.save();
      ctx.strokeStyle = color;
      ctx.globalAlpha = 0.45;
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(b.x - v.x * 7, b.y - v.y * 7);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.shadowColor = color;
      ctx.shadowBlur = 10;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(b.x, b.y, 3.2, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(b.x, b.y, 1.4, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
  }

  function drawForest() {
    ctx.save();
    ctx.globalAlpha = 0.9;
    for (let r = 0; r < ROWS; r += 1) {
      for (let c = 0; c < COLS; c += 1) {
        if (state.grid[r][c] !== FOREST) continue;
        const x = c * TILE;
        const y = r * TILE;
        const jx = ((c * 7 + r * 3) % 5) - 2;
        const jy = ((c * 3 + r * 5) % 5) - 2;
        ctx.fillStyle = '#0c2a20';
        ctx.beginPath();
        ctx.arc(x + 4 + jx, y + 6 + jy, 6.5, 0, TAU);
        ctx.arc(x + 12 - jx, y + 5 - jy, 6, 0, TAU);
        ctx.arc(x + 8, y + 12, 6.5, 0, TAU);
        ctx.fill();
        ctx.fillStyle = '#165a3c';
        ctx.beginPath();
        ctx.arc(x + 5 + jx, y + 5 + jy, 4.4, 0, TAU);
        ctx.arc(x + 11 - jx, y + 9 - jy, 4, 0, TAU);
        ctx.fill();
        ctx.fillStyle = '#2a8a58';
        ctx.beginPath();
        ctx.arc(x + 5 + jx, y + 4 + jy, 1.8, 0, TAU);
        ctx.arc(x + 10, y + 11, 1.5, 0, TAU);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  function drawParticles() {
    for (const p of state.particles) {
      const a = clamp(p.life / p.max, 0, 1);
      if (p.type === 'spark') {
        ctx.globalAlpha = a;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, Math.max(0.4, p.size * a), 0, TAU);
        ctx.fill();
      } else if (p.type === 'smoke') {
        ctx.globalAlpha = a * 0.28;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (1.5 - a * 0.5), 0, TAU);
        ctx.fill();
      } else if (p.type === 'debris') {
        ctx.globalAlpha = a;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot || 0);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.7);
        ctx.restore();
      } else if (p.type === 'ring') {
        ctx.globalAlpha = a * 0.8;
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, TAU);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
  }

  function drawTexts() {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '700 11px ui-monospace, Menlo, monospace';
    for (const t of state.texts) {
      const a = clamp(t.life / t.max, 0, 1);
      ctx.globalAlpha = a;
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(4, 8, 14, .8)';
      ctx.strokeText(t.text, t.x, t.y);
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, t.x, t.y);
    }
    ctx.restore();
  }

  /* ---------------- 渲染主函数 ---------------- */
  function render() {
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.clearRect(0, 0, W, H);

    const shake = state.shake;
    const sx = shake > 0 ? rand(-shake, shake) : 0;
    const sy = shake > 0 ? rand(-shake, shake) : 0;

    ctx.save();
    ctx.translate(sx, sy);

    drawGround();
    drawWater(state.time);
    drawBlocks();
    drawBase(state.time);
    drawPowerups(state.time);
    drawTanks(state.time);
    drawSpawnStars(state.time);
    drawBullets();
    drawParticles();
    drawForest();
    drawTexts();

    ctx.restore();

    if (state.flash > 0) {
      ctx.fillStyle = `rgba(255, 236, 200, ${Math.min(0.5, state.flash * 0.45)})`;
      ctx.fillRect(0, 0, W, H);
    }
    if (state.freeze > 0) {
      ctx.fillStyle = 'rgba(80, 180, 255, .045)';
      ctx.fillRect(0, 0, W, H);
    }
    if (state.shovel > 2.4) {
      ctx.strokeStyle = 'rgba(255, 203, 110, .18)';
      ctx.lineWidth = 4;
      ctx.strokeRect(2, 2, W - 4, H - 4);
    }
  }

  /* ---------------- 音效按钮 / 全屏 ---------------- */
  function updateSoundButton() {
    dom.soundBtn.setAttribute('aria-pressed', String(soundOn));
    dom.soundLabel.textContent = soundOn ? '音效开' : '音效关';
  }

  function toggleSound() {
    soundOn = !soundOn;
    writeStorage('tank-sound', soundOn ? 1 : 0);
    updateSoundButton();
    if (soundOn) {
      ensureAudio();
      sfx.power();
    }
  }

  function toggleFullscreen() {
    const stage = $('stage');
    if (!stage) return;
    if (document.fullscreenElement) {
      if (document.exitFullscreen) document.exitFullscreen();
      return;
    }
    if (stage.requestFullscreen) {
      stage.requestFullscreen().catch(() => {});
    } else if (stage.webkitRequestFullscreen) {
      stage.webkitRequestFullscreen();
    }
  }

  /* ---------------- 事件绑定 ---------------- */
  $('btn-start').addEventListener('click', newGame);
  $('btn-retry').addEventListener('click', newGame);
  $('btn-resume').addEventListener('click', togglePause);
  $('btn-pause-restart').addEventListener('click', newGame);
  $('btn-side-pause').addEventListener('click', togglePause);
  $('btn-side-restart').addEventListener('click', newGame);
  dom.pauseBtn.addEventListener('click', togglePause);
  dom.soundBtn.addEventListener('click', toggleSound);
  $('btn-fullscreen').addEventListener('click', toggleFullscreen);

  window.addEventListener('pointerdown', ensureAudio, { passive: true });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  /* ---------------- 主循环 ---------------- */
  let lastFrame = performance.now();

  function frame(now) {
    const dt = clamp((now - lastFrame) / 1000, 0, 0.033);
    lastFrame = now;
    state.time += dt;

    if (state.mode === 'playing') {
      update(dt);
    } else if (state.mode === 'levelclear') {
      if (state.flash > 0) state.flash = Math.max(0, state.flash - dt * 1.8);
      if (state.shake > 0) state.shake = Math.max(0, state.shake - dt * 22);
      updateParticles(dt);
      updateTexts(dt);
      state.clearTimer -= dt;
      if (state.clearTimer <= 0) {
        state.level += 1;
        startLevel(state.level);
        state.mode = 'playing';
        hideScreens();
        dom.pauseBtn.disabled = false;
        dom.pauseBtn.textContent = '暂停';
        updateHUD();
      }
    } else if (state.mode === 'gameover') {
      if (state.flash > 0) state.flash = Math.max(0, state.flash - dt * 1.8);
      if (state.shake > 0) state.shake = Math.max(0, state.shake - dt * 22);
      updateParticles(dt);
      updateTexts(dt);
    }

    render();
    requestAnimationFrame(frame);
  }

  /* ---------------- 启动 ---------------- */
  function init() {
    state.mode = 'menu';
    state.score = 0;
    state.lives = 3;
    state.weapon = 0;
    startLevel(1);
    showScreen('start');
    dom.pauseBtn.disabled = true;
    updateSoundButton();
    updateHUD();
    render();
    requestAnimationFrame(frame);
  }

  init();
})();
