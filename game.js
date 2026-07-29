/**
 * ============================================================
 *  SKATE RUNNER  –  HTML5 Canvas game
 *  Modes: Endless Runner · Platformer
 *  Pure JavaScript, no external dependencies.
 * ============================================================
 */

'use strict';

// ─── Canvas setup ───────────────────────────────────────────
const canvas = document.getElementById('gameCanvas');
const ctx    = canvas.getContext('2d');
const W      = canvas.width;   // 800
const H      = canvas.height;  // 400

// ─── Shared constants ────────────────────────────────────────
const GROUND_Y             = H - 60;   // y-coordinate of ground line (340)

// Endless-runner constants
const GRAVITY              = 1800;
const JUMP_VELOCITY        = -700;
const BASE_SPEED           = 300;
const MAX_SPEED            = 700;
const SPEED_RAMP           = 15;
const FLIP_SPEED           = 540;
const FLIP_BONUS_SCORE     = 50;
const DIST_SCORE_RATE      = 10;
const OBSTACLE_INTERVAL_MIN = 1.4;
const OBSTACLE_INTERVAL_MAX = 2.8;

// Platformer constants
const PLAT_GRAVITY     = 1600;   // px/s²
const PLAT_JUMP_VEL   = -680;   // initial vertical velocity when jumping
const PLAT_MOVE_SPEED  = 260;   // horizontal speed px/s
const PLAT_LEVEL_WIDTH = 2800;  // total level width
const PLAT_GOAL_X      = 2650;  // x of goal flag

// ─── Color palette ───────────────────────────────────────────
const COLOR = {
  sky:          '#1a1a2e',
  ground:       '#e0e0e0',
  groundFill:   '#2a2a2a',
  player:       '#00ff96',
  skate:        '#ffffff',
  wheel:        '#aaaaaa',
  obstacle:     '#ff6b6b',
  platform:     '#8888ff',
  platformFill: '#1a1a3a',
  goal:         '#ffd700',
  star:         'rgba(255,255,255,0.6)',
  hudAccent:    '#00ff96',
  hudShadow:    'rgba(0,0,0,0.7)',
  overlay:      'rgba(0,0,0,0.55)',
};

// ─── Input state ─────────────────────────────────────────────
const keys = {};
document.addEventListener('keydown', e => {
  keys[e.code] = true;
  handleKeyDown(e.code);
});
document.addEventListener('keyup', e => { keys[e.code] = false; });

// ─── Utility helpers ─────────────────────────────────────────
function randBetween(a, b) { return a + Math.random() * (b - a); }
function degreesToRadians(deg) { return (deg * Math.PI) / 180; }

/** Draw a rounded rectangle path on ctx (no fill/stroke). */
function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y,     x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h,     x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y,         x + r, y);
  ctx.closePath();
}

// ─── Stars (shared parallax background) ──────────────────────
const STARS = Array.from({ length: 60 }, () => ({
  x:     Math.random() * W,
  y:     Math.random() * (GROUND_Y - 40),
  r:     Math.random() * 1.5 + 0.3,
  speed: Math.random() * 0.3 + 0.05,
}));

function drawStars(scrollOffset) {
  ctx.fillStyle = COLOR.star;
  for (const s of STARS) {
    const sx = ((s.x - scrollOffset * s.speed) % W + W) % W;
    ctx.beginPath();
    ctx.arc(sx, s.y, s.r, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ─── Background blocks (endless-runner parallax mid-layer) ───
const BG_BLOCKS = Array.from({ length: 8 }, (_, i) => ({
  x: i * 120,
  w: randBetween(40, 90),
  h: randBetween(20, 80),
}));

function drawBackgroundBlocks(scrollOffset) {
  ctx.strokeStyle = 'rgba(255,255,255,0.04)';
  ctx.lineWidth = 1;
  for (const b of BG_BLOCKS) {
    const bx = ((b.x - scrollOffset * 0.3) % (W + 200) + (W + 200)) % (W + 200) - 100;
    ctx.strokeRect(bx, GROUND_Y - b.h, b.w, b.h);
  }
}

// ─── Endless-runner scrolling ground ─────────────────────────
const GROUND_STRIP_W = 60;
let   groundOffset   = 0;

function drawGround() {
  ctx.fillStyle = COLOR.groundFill;
  ctx.fillRect(0, GROUND_Y, W, H - GROUND_Y);

  ctx.strokeStyle = COLOR.ground;
  ctx.lineWidth   = 2;
  ctx.beginPath();
  ctx.moveTo(0, GROUND_Y);
  ctx.lineTo(W, GROUND_Y);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(255,255,255,0.2)';
  ctx.lineWidth   = 1;
  for (let i = 0; i < W + GROUND_STRIP_W; i += GROUND_STRIP_W) {
    const x = ((i - groundOffset % GROUND_STRIP_W) + GROUND_STRIP_W) % (W + GROUND_STRIP_W);
    ctx.beginPath();
    ctx.moveTo(x, GROUND_Y + 10);
    ctx.lineTo(x + 20, GROUND_Y + 10);
    ctx.stroke();
  }
}

// ─── Shared sprite drawing ───────────────────────────────────
/**
 * Draw the skateboard. ctx origin must already be at player-feet position.
 */
function drawSkateSprite(ctx, isFlipping, flipAngle) {
  ctx.save();
  if (isFlipping) ctx.rotate(degreesToRadians(flipAngle));

  // Deck
  ctx.strokeStyle = COLOR.skate;
  ctx.lineWidth   = 4;
  ctx.lineCap     = 'round';
  ctx.beginPath();
  ctx.moveTo(-18, 0);
  ctx.lineTo( 18, 0);
  ctx.stroke();

  // Trucks
  ctx.lineWidth = 2;
  [-11, 11].forEach(tx => {
    ctx.beginPath();
    ctx.moveTo(tx, 0);
    ctx.lineTo(tx, 4);
    ctx.stroke();
  });

  // Wheels
  ctx.strokeStyle = COLOR.wheel;
  ctx.fillStyle   = '#333';
  ctx.lineWidth   = 1.5;
  [-11, 11].forEach(wx => {
    ctx.beginPath();
    ctx.arc(wx, 5, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(wx, 4, 2, 0, Math.PI);
    ctx.stroke();
    ctx.strokeStyle = COLOR.wheel;
    ctx.lineWidth   = 1.5;
  });

  ctx.restore();
}

/**
 * Draw the stick-figure body. ctx origin must already be at player-feet position.
 */
function drawBodySprite(ctx, onGround, runFrame) {
  ctx.strokeStyle = COLOR.player;
  ctx.lineWidth   = 2.5;
  ctx.lineCap     = 'round';
  ctx.lineJoin    = 'round';

  const lean  = onGround ? 0.15 : -0.05;
  const feetY = -2;
  const swing = onGround ? Math.sin(runFrame * 8) * 8 : 0;

  // Legs
  ctx.beginPath();
  ctx.moveTo(-3 + lean * 10, feetY);
  ctx.lineTo(-8 + swing * 0.5, feetY - 18);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo( 3 + lean * 10, feetY);
  ctx.lineTo( 8 - swing * 0.5, feetY - 18);
  ctx.stroke();

  // Torso
  const hipX  = lean * 10;
  const hipY  = feetY - 17;
  const neckX = lean * 20;
  const neckY = feetY - 40;
  ctx.beginPath();
  ctx.moveTo(hipX, hipY);
  ctx.lineTo(neckX, neckY);
  ctx.stroke();

  // Arms
  const armSwing = onGround ? -swing * 0.7 : 12;
  ctx.beginPath();
  ctx.moveTo(neckX - 2, neckY + 4);
  ctx.lineTo(neckX - 12 + armSwing, neckY + 18);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(neckX + 2, neckY + 4);
  ctx.lineTo(neckX + 14 - armSwing, neckY + 16);
  ctx.stroke();

  // Head
  const headX = neckX + lean * 5;
  const headY = neckY - 10;
  ctx.beginPath();
  ctx.arc(headX, headY, 8, 0, Math.PI * 2);
  ctx.stroke();

  // Helmet / cap
  ctx.fillStyle = 'rgba(0,255,150,0.3)';
  ctx.beginPath();
  ctx.arc(headX, headY - 2, 9, Math.PI, 0);
  ctx.fill();
  ctx.strokeStyle = COLOR.player;
  ctx.lineWidth   = 2;
  ctx.beginPath();
  ctx.moveTo(headX - 10, headY - 2);
  ctx.lineTo(headX + 10, headY - 2);
  ctx.stroke();
}

/**
 * Draw the complete player sprite at world position (x, y) where y = feet.
 * state must expose: { onGround, runFrame, isFlipping, flipAngle, facingRight }
 */
function drawPlayerSprite(ctx, x, y, state) {
  ctx.save();
  ctx.translate(x, y);
  if (state.facingRight === false) ctx.scale(-1, 1);
  drawSkateSprite(ctx, state.isFlipping, state.flipAngle);
  drawBodySprite(ctx, state.onGround, state.runFrame);
  ctx.restore();
}

// ─── Player class (Endless Runner) ───────────────────────────
class Player {
  constructor() { this.reset(); }

  reset() {
    this.x            = 160;
    this.y            = GROUND_Y;
    this.vy           = 0;
    this.onGround     = true;
    this.flipAngle    = 0;
    this.isFlipping   = false;
    this.flipDir      = 1;
    this.flipComplete = false;
    this.runFrame     = 0;
    this.facingRight  = true;
  }

  get height() { return 60; }
  get width()  { return 34; }

  get bounds() {
    return {
      left:   this.x - this.width  / 2,
      right:  this.x + this.width  / 2,
      top:    this.y - this.height,
      bottom: this.y,
    };
  }

  jump() {
    if (!this.onGround) return;
    this.vy           = JUMP_VELOCITY;
    this.onGround     = false;
    this.flipAngle    = 0;
    this.isFlipping   = false;
    this.flipComplete = false;
  }

  startFlip() {
    if (this.onGround || this.isFlipping) return;
    this.isFlipping   = true;
    this.flipAngle    = 0;
    this.flipDir      = 1;
    this.flipComplete = false;
  }

  update(dt) {
    if (!this.onGround) {
      this.vy += GRAVITY * dt;
      this.y  += this.vy  * dt;
    }
    if (this.y >= GROUND_Y) {
      this.y          = GROUND_Y;
      this.vy         = 0;
      this.onGround   = true;
      this.isFlipping = false;
      this.flipAngle  = 0;
    }
    if (this.isFlipping) {
      this.flipAngle += FLIP_SPEED * this.flipDir * dt;
      if (!this.flipComplete && this.flipAngle >= 360) this.flipComplete = true;
    }
    if (this.onGround) this.runFrame += dt;
  }

  draw(ctx) { drawPlayerSprite(ctx, this.x, this.y, this); }
}

// ─── Obstacle class (Endless Runner) ─────────────────────────
const OBSTACLE_TYPES = ['cone', 'rail', 'gap', 'skater'];

class Obstacle {
  constructor(x, type) {
    this.x    = x;
    this.type = type || OBSTACLE_TYPES[Math.floor(Math.random() * OBSTACLE_TYPES.length)];
    this._init();
  }

  _init() {
    switch (this.type) {
      case 'cone':   this.w = 20;  this.h = 30; break;
      case 'rail':   this.w = 80;  this.h = 14; break;
      case 'gap':    this.w = 60;  this.h = 1;  break;
      case 'skater': this.w = 34;  this.h = 60; break;
      default:       this.w = 20;  this.h = 30;
    }
  }

  get bounds() {
    return {
      left:   this.x,
      right:  this.x + this.w,
      top:    GROUND_Y - this.h,
      bottom: GROUND_Y,
    };
  }

  update(dt, speed) { this.x -= speed * dt; }
  isOffScreen()      { return this.x + this.w + 10 < 0; }

  draw(ctx) {
    switch (this.type) {
      case 'cone':   this._drawCone(ctx);   break;
      case 'rail':   this._drawRail(ctx);   break;
      case 'gap':    this._drawGap(ctx);    break;
      case 'skater': this._drawSkater(ctx); break;
    }
  }

  _drawCone(ctx) {
    ctx.strokeStyle = COLOR.obstacle;
    ctx.fillStyle   = 'rgba(255,107,107,0.3)';
    ctx.lineWidth   = 2;
    ctx.lineCap     = 'round';
    const bx = this.x + this.w / 2;
    const by = GROUND_Y;
    ctx.beginPath();
    ctx.moveTo(bx, by - this.h);
    ctx.lineTo(bx - this.w / 2, by);
    ctx.lineTo(bx + this.w / 2, by);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth   = 1;
    ctx.beginPath();
    ctx.moveTo(bx - 5, by - 12);
    ctx.lineTo(bx + 5, by - 12);
    ctx.stroke();
  }

  _drawRail(ctx) {
    ctx.strokeStyle = '#c0c0ff';
    ctx.lineWidth   = 3;
    ctx.lineCap     = 'round';
    const y = GROUND_Y - this.h;
    ctx.beginPath();
    ctx.moveTo(this.x, y);
    ctx.lineTo(this.x + this.w, y);
    ctx.stroke();
    ctx.lineWidth   = 2;
    ctx.strokeStyle = 'rgba(192,192,255,0.6)';
    [this.x + 10, this.x + this.w - 10].forEach(lx => {
      ctx.beginPath();
      ctx.moveTo(lx, y);
      ctx.lineTo(lx, GROUND_Y);
      ctx.stroke();
    });
  }

  _drawGap(ctx) {
    ctx.fillStyle = '#0a0a1a';
    ctx.fillRect(this.x, GROUND_Y, this.w, H - GROUND_Y);
    ctx.strokeStyle = COLOR.obstacle;
    ctx.lineWidth   = 2;
    ctx.beginPath(); ctx.moveTo(this.x,          GROUND_Y - 4); ctx.lineTo(this.x,          GROUND_Y + 20); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(this.x + this.w, GROUND_Y - 4); ctx.lineTo(this.x + this.w, GROUND_Y + 20); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,107,107,0.3)';
    ctx.lineWidth   = 1;
    for (let d = 10; d < H - GROUND_Y; d += 14) {
      ctx.beginPath();
      ctx.moveTo(this.x + 4, GROUND_Y + d);
      ctx.lineTo(this.x + this.w - 4, GROUND_Y + d);
      ctx.stroke();
    }
  }

  _drawSkater(ctx) {
    ctx.save();
    ctx.translate(this.x + this.w / 2, GROUND_Y);
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#ffaa44'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(-16, 0);  ctx.lineTo(16,  0);   ctx.stroke();
    ctx.lineWidth = 1.5;
    [-10, 10].forEach(wx => {
      ctx.beginPath(); ctx.arc(wx, 4, 4, 0, Math.PI * 2); ctx.stroke();
    });
    ctx.strokeStyle = '#ff9966'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-4,  -2);  ctx.lineTo(-8,  -18); ctx.stroke();
    ctx.beginPath(); ctx.moveTo( 4,  -2);  ctx.lineTo( 8,  -18); ctx.stroke();
    ctx.beginPath(); ctx.moveTo( 0, -18);  ctx.lineTo( 0,  -40); ctx.stroke();
    ctx.beginPath(); ctx.moveTo( 0, -30);  ctx.lineTo(-14, -24); ctx.stroke();
    ctx.beginPath(); ctx.moveTo( 0, -30);  ctx.lineTo( 14, -24); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, -48, 8, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  }
}

// ─── Toast class (shared) ────────────────────────────────────
class Toast {
  constructor(text, x, y, color = '#00ff96', duration = 1.2) {
    this.text     = text;
    this.x        = x;
    this.y        = y;
    this.color    = color;
    this.duration = duration;
    this.elapsed  = 0;
    this.dead     = false;
  }

  update(dt) {
    this.elapsed += dt;
    this.y       -= 40 * dt;
    if (this.elapsed >= this.duration) this.dead = true;
  }

  draw(ctx) {
    const alpha = Math.max(0, 1 - this.elapsed / this.duration);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.font        = 'bold 18px "Courier New", monospace';
    ctx.fillStyle   = this.color;
    ctx.textAlign   = 'center';
    ctx.fillText(this.text, this.x, this.y);
    ctx.restore();
  }
}

// ─── Platformer level data ────────────────────────────────────
// Ground segments {x, w}: strips where ground exists at GROUND_Y
const PLAT_GROUND_SEGS = [
  { x: 0,    w: 500 },   // starting area
  { x: 680,  w: 320 },   // after gap 1  (gap 500–680)
  { x: 1180, w: 300 },   // after gap 2  (gap 1000–1180)
  { x: 1660, w: 300 },   // after gap 3  (gap 1480–1660)
  { x: 2140, w: 660 },   // final stretch (gap 4: 1960–2140)
];

// Floating platforms {x, y, w}: y = top surface; player feet land on y
const PLAT_PLATFORMS = [
  // Starting area – gentle introduction
  { x: 130,  y: 285, w: 120 },
  { x: 330,  y: 235, w: 100 },
  // Gap-1 bridges (gap 500–680)
  { x: 490,  y: 275, w: 130 },
  { x: 640,  y: 235, w: 120 },
  // Ground section 2
  { x: 790,  y: 270, w: 100 },
  { x: 880,  y: 215, w: 110 },
  // Gap-2 bridge (gap 1000–1180)
  { x: 1010, y: 270, w: 130 },
  // Ground section 3
  { x: 1200, y: 200, w: 100 },
  { x: 1340, y: 255, w: 100 },
  // Gap-3 bridge (gap 1480–1660)
  { x: 1490, y: 270, w: 130 },
  // Ground section 4
  { x: 1700, y: 240, w: 100 },
  { x: 1840, y: 200, w: 110 },
  // Gap-4 bridge (gap 1960–2140)
  { x: 1970, y: 265, w: 130 },
  // Final stretch
  { x: 2200, y: 230, w: 100 },
  { x: 2360, y: 270, w: 100 },
  { x: 2520, y: 230, w: 100 },
];

// ─── PlatformerPlayer class ───────────────────────────────────
class PlatformerPlayer {
  constructor(x, y) {
    this.x           = x;
    this.y           = y;
    this.vx          = 0;
    this.vy          = 0;
    this.onGround    = false;
    this.facingRight = true;
    this.isFlipping  = false;   // unused in platformer but required by drawPlayerSprite
    this.flipAngle   = 0;
    this.runFrame    = 0;
  }

  get width()  { return 34; }
  get height() { return 60; }

  jump() {
    if (!this.onGround) return;
    this.vy       = PLAT_JUMP_VEL;
    this.onGround = false;
  }

  draw(ctx) { drawPlayerSprite(ctx, this.x, this.y, this); }
}

// ═══════════════════════════════════════════════════════════════
//  MENU STATE
// ═══════════════════════════════════════════════════════════════
class MenuState {
  constructor(game) {
    this.game    = game;
    this.selIdx  = 0;
    this.options = [
      { label: 'Endless Runner', desc: 'Dodge obstacles · Kickflips · High score' },
      { label: 'Platformer',     desc: 'Jump platforms · Reach the finish flag'   },
    ];
    this.animTime = 0;
  }

  handleInput(code) {
    if (code === 'ArrowUp' || code === 'ArrowLeft') {
      this.selIdx = (this.selIdx - 1 + this.options.length) % this.options.length;
    } else if (code === 'ArrowDown' || code === 'ArrowRight') {
      this.selIdx = (this.selIdx + 1) % this.options.length;
    } else if (code === 'Enter' || code === 'Space') {
      this._confirm();
    }
  }

  _confirm() {
    if (this.selIdx === 0) this.game.startEndlessRunner();
    else                   this.game.startPlatformer();
  }

  update(dt) { this.animTime += dt; }

  draw() {
    // Background
    ctx.fillStyle = COLOR.sky;
    ctx.fillRect(0, 0, W, H);
    drawStars(this.animTime * 30);

    // Faint ground line
    ctx.save();
    ctx.globalAlpha = 0.25;
    ctx.strokeStyle = COLOR.ground;
    ctx.lineWidth   = 2;
    ctx.beginPath();
    ctx.moveTo(0, GROUND_Y);
    ctx.lineTo(W, GROUND_Y);
    ctx.stroke();
    ctx.restore();

    // Animated demo player (bounces gently)
    const bounce   = Math.sin(this.animTime * 2.8) * 6;
    const demoState = {
      onGround:    true,
      runFrame:    this.animTime * 1.4,
      isFlipping:  false,
      flipAngle:   0,
      facingRight: true,
    };
    drawPlayerSprite(ctx, 110, GROUND_Y + bounce, demoState);

    // Title
    ctx.textAlign   = 'center';
    ctx.font        = 'bold 52px "Courier New", monospace';
    ctx.fillStyle   = COLOR.hudAccent;
    ctx.shadowColor = COLOR.hudAccent;
    ctx.shadowBlur  = 18;
    ctx.fillText('SKATE RUNNER', W / 2, 98);
    ctx.shadowBlur  = 0;

    // Subtitle
    ctx.font      = '17px "Courier New", monospace';
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.fillText('Select a game mode', W / 2, 132);

    // Mode options
    this.options.forEach((opt, i) => {
      const selected = i === this.selIdx;
      const cy       = 218 + i * 84;
      const bx       = W / 2 - 210;
      const bw       = 420;
      const bh       = 62;

      if (selected) {
        ctx.fillStyle = 'rgba(0,255,150,0.10)';
        roundRectPath(ctx, bx, cy - 36, bw, bh, 6);
        ctx.fill();
        ctx.strokeStyle = COLOR.hudAccent;
        ctx.lineWidth   = 2;
        roundRectPath(ctx, bx, cy - 36, bw, bh, 6);
        ctx.stroke();
      } else {
        ctx.strokeStyle = 'rgba(255,255,255,0.12)';
        ctx.lineWidth   = 1;
        roundRectPath(ctx, bx, cy - 36, bw, bh, 6);
        ctx.stroke();
      }

      // Arrow indicator
      if (selected) {
        ctx.fillStyle = COLOR.hudAccent;
        ctx.font      = 'bold 20px "Courier New", monospace';
        ctx.textAlign = 'left';
        ctx.fillText('▶', bx + 18, cy + 6);
      }

      // Label
      ctx.textAlign = 'center';
      ctx.font      = selected
        ? 'bold 26px "Courier New", monospace'
        : '22px "Courier New", monospace';
      ctx.fillStyle = selected ? COLOR.hudAccent : 'rgba(255,255,255,0.6)';
      ctx.fillText(opt.label, W / 2, cy + 2);

      // Description
      ctx.font      = '13px "Courier New", monospace';
      ctx.fillStyle = selected ? 'rgba(0,255,150,0.65)' : 'rgba(255,255,255,0.28)';
      ctx.fillText(opt.desc, W / 2, cy + 20);
    });

    // Footer hint
    ctx.textAlign = 'center';
    ctx.font      = '12px "Courier New", monospace';
    ctx.fillStyle = 'rgba(255,255,255,0.28)';
    ctx.fillText('[ ↑ / ↓ ]  Navigate     [ Enter / Space ]  Select', W / 2, H - 22);
  }
}

// ═══════════════════════════════════════════════════════════════
//  ENDLESS RUNNER STATE
// ═══════════════════════════════════════════════════════════════
const ER = { START: 'start', RUNNING: 'running', GAMEOVER: 'gameover' };

class EndlessRunnerState {
  constructor(game) {
    this.game      = game;
    this.player    = new Player();
    this.obstacles = [];
    this.toasts    = [];

    this.score     = 0;
    this.highScore = this._loadHighScore();
    this.speed     = BASE_SPEED;

    this.scrollOffset      = 0;
    this.nextObstacleIn    = randBetween(OBSTACLE_INTERVAL_MIN, OBSTACLE_INTERVAL_MAX);
    this.timeSinceObstacle = 0;
    this.isNewRecord       = false;
    this._flipBonusAwarded = false;

    this.subState = ER.START;
  }

  _loadHighScore() {
    try   { return parseFloat(localStorage.getItem('skateRunnerHighScore') || '0'); }
    catch { return 0; }
  }

  _saveHighScore() {
    try   { localStorage.setItem('skateRunnerHighScore', String(Math.floor(this.score))); }
    catch { /* ignore */ }
  }

  _reset() {
    this.player.reset();
    this.obstacles  = [];
    this.toasts     = [];
    this.score      = 0;
    this.speed      = BASE_SPEED;
    this.scrollOffset      = 0;
    this.nextObstacleIn    = randBetween(OBSTACLE_INTERVAL_MIN, OBSTACLE_INTERVAL_MAX);
    this.timeSinceObstacle = 0;
    this.isNewRecord       = false;
    this._flipBonusAwarded = false;
    this.subState  = ER.RUNNING;
  }

  handleInput(code) {
    if (code === 'Escape') { this.game.goToMenu(); return; }

    if (this.subState === ER.START) {
      if (code === 'Space' || code === 'ArrowUp') this._reset();
      return;
    }
    if (this.subState === ER.GAMEOVER) {
      if (code === 'Enter' || code === 'Space') this._reset();
      return;
    }
    // Running
    if (code === 'Space' || code === 'ArrowUp') this.player.jump();
    if ((code === 'ArrowDown' || code === 'KeyF') && !this.player.onGround) {
      this.player.startFlip();
    }
  }

  update(dt) {
    if (this.subState !== ER.RUNNING) return;
    dt = Math.min(dt, 0.05);

    this.speed         = Math.min(MAX_SPEED, this.speed + SPEED_RAMP * dt);
    this.scrollOffset += this.speed * dt;
    groundOffset       = this.scrollOffset;
    this.score        += DIST_SCORE_RATE * dt;

    const wasFlipping = this.player.isFlipping;
    this.player.update(dt);

    // Kickflip bonus toast
    if (wasFlipping && this.player.flipComplete && !this._flipBonusAwarded) {
      this.score += FLIP_BONUS_SCORE;
      this._flipBonusAwarded = true;
      this.toasts.push(new Toast(
        `+${FLIP_BONUS_SCORE}  KICKFLIP!`,
        this.player.x, this.player.y - 80,
        COLOR.hudAccent,
      ));
    }
    if (!this.player.isFlipping) this._flipBonusAwarded = false;

    // Spawn obstacles
    this.timeSinceObstacle += dt;
    if (this.timeSinceObstacle >= this.nextObstacleIn) {
      this.timeSinceObstacle = 0;
      const factor = BASE_SPEED / this.speed;
      this.nextObstacleIn = randBetween(
        OBSTACLE_INTERVAL_MIN * factor,
        OBSTACLE_INTERVAL_MAX * factor,
      );
      this.obstacles.push(new Obstacle(W + 10));
    }

    // Update obstacles & collision check
    for (const obs of this.obstacles) {
      obs.update(dt, this.speed);
      if (this._collides(this.player, obs)) { this._gameOver(); return; }
    }
    this.obstacles = this.obstacles.filter(o => !o.isOffScreen());

    for (const t of this.toasts) t.update(dt);
    this.toasts = this.toasts.filter(t => !t.dead);
  }

  _collides(player, obs) {
    if (obs.type === 'gap') {
      if (player.onGround) {
        const pb = player.bounds, ob = obs.bounds;
        if (pb.right > ob.left + 4 && pb.left < ob.right - 4) return true;
      }
      return false;
    }
    const pb = player.bounds, ob = obs.bounds;
    return (
      pb.right  > ob.left  + 2 &&
      pb.left   < ob.right - 2 &&
      pb.bottom > ob.top   + 2 &&
      pb.top    < ob.bottom
    );
  }

  _gameOver() {
    this.subState = ER.GAMEOVER;
    if (this.score > this.highScore) {
      this.highScore   = this.score;
      this.isNewRecord = true;
      this._saveHighScore();
    }
  }

  draw() {
    // Background
    ctx.fillStyle = COLOR.sky;
    ctx.fillRect(0, 0, W, H);
    drawStars(this.scrollOffset);
    drawBackgroundBlocks(this.scrollOffset);
    drawGround();

    for (const obs of this.obstacles) obs.draw(ctx);
    if (this.subState !== ER.START) this.player.draw(ctx);
    for (const t of this.toasts)    t.draw(ctx);

    if (this.subState === ER.RUNNING)   this._drawHUD();
    if (this.subState === ER.START)     { this.player.draw(ctx); this._drawStartScreen(); }
    if (this.subState === ER.GAMEOVER)  this._drawGameOverScreen();
  }

  _drawHUD() {
    const pad = 16;
    ctx.font      = 'bold 22px "Courier New", monospace';
    ctx.textAlign = 'left';
    ctx.fillStyle = COLOR.hudShadow;
    ctx.fillText(`SCORE  ${Math.floor(this.score)}`, pad + 1, pad + 21);
    ctx.fillStyle = COLOR.hudAccent;
    ctx.fillText(`SCORE  ${Math.floor(this.score)}`, pad, pad + 20);
    ctx.font      = '14px "Courier New", monospace';
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.fillText(`BEST  ${Math.floor(this.highScore)}`, pad, pad + 42);
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.font      = '12px "Courier New", monospace';
    ctx.fillText(`${Math.floor(this.speed)} px/s`, W - pad, pad + 14);
    ctx.fillStyle = 'rgba(255,255,255,0.28)';
    ctx.fillText('ESC – Menú', W - pad, H - 16);
  }

  _drawStartScreen() {
    ctx.fillStyle = COLOR.overlay;
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center';
    ctx.font      = 'bold 52px "Courier New", monospace';
    ctx.fillStyle = COLOR.hudAccent;
    ctx.fillText('SKATE RUNNER', W / 2, H / 2 - 70);
    ctx.font      = '20px "Courier New", monospace';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('Endless Skate Adventure', W / 2, H / 2 - 36);
    ctx.font      = '15px "Courier New", monospace';
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    [
      '[ Space / ↑ ]   Jump',
      '[ ↓ / F ]       Kickflip (only while airborne)',
      '[ Escape ]      Back to Menu',
    ].forEach((line, i) => ctx.fillText(line, W / 2, H / 2 + 10 + i * 24));
    ctx.font      = 'bold 18px "Courier New", monospace';
    ctx.fillStyle = COLOR.hudAccent;
    ctx.fillText('Press SPACE to start', W / 2, H / 2 + 100);
  }

  _drawGameOverScreen() {
    ctx.fillStyle = COLOR.overlay;
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center';
    ctx.font      = 'bold 48px "Courier New", monospace';
    ctx.fillStyle = '#ff6b6b';
    ctx.fillText('GAME OVER', W / 2, H / 2 - 60);
    ctx.font      = '26px "Courier New", monospace';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(`Score: ${Math.floor(this.score)}`, W / 2, H / 2 - 10);
    if (this.isNewRecord) {
      ctx.font      = 'bold 18px "Courier New", monospace';
      ctx.fillStyle = COLOR.hudAccent;
      ctx.fillText('🏆  NEW HIGH SCORE!', W / 2, H / 2 + 22);
    } else {
      ctx.font      = '16px "Courier New", monospace';
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.fillText(`Best: ${Math.floor(this.highScore)}`, W / 2, H / 2 + 22);
    }
    ctx.font      = 'bold 16px "Courier New", monospace';
    ctx.fillStyle = COLOR.hudAccent;
    ctx.fillText('[ Enter / Space ]  Play again     [ Escape ]  Menú', W / 2, H / 2 + 68);
  }
}

// ═══════════════════════════════════════════════════════════════
//  PLATFORMER STATE
// ═══════════════════════════════════════════════════════════════
class PlatformerState {
  constructor(game) {
    this.game = game;
    this.reset();
  }

  reset() {
    this.player   = new PlatformerPlayer(80, GROUND_Y);
    this.cameraX  = 0;
    this.subState = 'playing'; // 'playing' | 'dead' | 'complete'
  }

  handleInput(code) {
    if (code === 'Escape') { this.game.goToMenu(); return; }

    if (this.subState === 'playing') {
      if (code === 'ArrowUp' || code === 'Space') this.player.jump();
    } else {
      // dead or complete: any confirm key restarts
      if (code === 'Enter' || code === 'Space') this.reset();
    }
  }

  update(dt) {
    if (this.subState !== 'playing') return;
    dt = Math.min(dt, 0.05);

    const p = this.player;

    // ── Horizontal movement from held keys ───────────────────
    if (keys['ArrowLeft'] || keys['KeyA']) {
      p.vx = -PLAT_MOVE_SPEED;
      p.facingRight = false;
    } else if (keys['ArrowRight'] || keys['KeyD']) {
      p.vx = PLAT_MOVE_SPEED;
      p.facingRight = true;
    } else {
      p.vx = 0;
    }

    // ── Physics ──────────────────────────────────────────────
    p.vy += PLAT_GRAVITY * dt;       // gravity always acts

    const prevY = p.y;
    p.x += p.vx * dt;
    p.y += p.vy * dt;

    // Clamp x within level bounds
    p.x = Math.max(20, Math.min(PLAT_LEVEL_WIDTH - 20, p.x));

    // ── Collision detection ───────────────────────────────────
    p.onGround = false;

    // Ground segments – only resolve when falling (vy ≥ 0)
    if (p.vy >= 0) {
      for (const seg of PLAT_GROUND_SEGS) {
        const overX = (p.x + p.width / 2) > seg.x &&
                      (p.x - p.width / 2) < seg.x + seg.w;
        if (overX && prevY <= GROUND_Y && p.y >= GROUND_Y) {
          p.y = GROUND_Y; p.vy = 0; p.onGround = true;
          break;
        }
      }
    }

    // Platform surfaces – only when falling and not already on ground
    if (!p.onGround && p.vy >= 0) {
      for (const plat of PLAT_PLATFORMS) {
        const overX = (p.x + p.width / 2) > plat.x &&
                      (p.x - p.width / 2) < plat.x + plat.w;
        if (overX && prevY <= plat.y && p.y >= plat.y) {
          p.y = plat.y; p.vy = 0; p.onGround = true;
          break;
        }
      }
    }

    // ── Run animation ─────────────────────────────────────────
    if (p.onGround && p.vx !== 0) p.runFrame += Math.abs(p.vx) * dt / 30;

    // ── Camera: follow player horizontally ────────────────────
    this.cameraX = Math.max(0, Math.min(p.x - 200, PLAT_LEVEL_WIDTH - W));

    // ── Death: fell off screen ────────────────────────────────
    if (p.y > H + 80) this.subState = 'dead';

    // ── Goal reached ──────────────────────────────────────────
    if (p.x >= PLAT_GOAL_X) this.subState = 'complete';
  }

  draw() {
    // ── Sky background ────────────────────────────────────────
    ctx.fillStyle = COLOR.sky;
    ctx.fillRect(0, 0, W, H);
    drawStars(this.cameraX * 0.05);

    // ── World (scrolled by cameraX) ───────────────────────────
    ctx.save();
    ctx.translate(-this.cameraX, 0);

    for (const seg  of PLAT_GROUND_SEGS) this._drawGroundSeg(seg.x, seg.w);
    for (const plat of PLAT_PLATFORMS)   this._drawPlatform(plat.x, plat.y, plat.w);
    this._drawGoal(PLAT_GOAL_X, GROUND_Y);
    this.player.draw(ctx);

    ctx.restore();
    // ─────────────────────────────────────────────────────────

    this._drawHUD();
    if (this.subState === 'dead')     this._drawDeadScreen();
    if (this.subState === 'complete') this._drawCompleteScreen();
  }

  _drawGroundSeg(x, w) {
    // Fill
    ctx.fillStyle = COLOR.groundFill;
    ctx.fillRect(x, GROUND_Y, w, H - GROUND_Y);
    // Top edge
    ctx.strokeStyle = COLOR.ground;
    ctx.lineWidth   = 2;
    ctx.beginPath();
    ctx.moveTo(x, GROUND_Y);
    ctx.lineTo(x + w, GROUND_Y);
    ctx.stroke();
    // Dashes
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.lineWidth   = 1;
    for (let i = x + 10; i < x + w - 10; i += 40) {
      ctx.beginPath();
      ctx.moveTo(i, GROUND_Y + 10);
      ctx.lineTo(i + 20, GROUND_Y + 10);
      ctx.stroke();
    }
  }

  _drawPlatform(x, y, w) {
    // Body slab
    ctx.fillStyle = COLOR.platformFill;
    ctx.fillRect(x, y, w, 12);
    // Top surface
    ctx.strokeStyle = COLOR.platform;
    ctx.lineWidth   = 3;
    ctx.lineCap     = 'round';
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + w, y);
    ctx.stroke();
    // Underside
    ctx.strokeStyle = 'rgba(136,136,255,0.22)';
    ctx.lineWidth   = 1;
    ctx.beginPath();
    ctx.moveTo(x + 4, y + 12);
    ctx.lineTo(x + w - 4, y + 12);
    ctx.stroke();
    // Centre support leg
    const legLen = Math.min(GROUND_Y - y - 12, 28);
    if (legLen > 4) {
      ctx.strokeStyle = 'rgba(136,136,255,0.35)';
      ctx.beginPath();
      ctx.moveTo(x + w / 2, y + 12);
      ctx.lineTo(x + w / 2, y + 12 + legLen);
      ctx.stroke();
    }
  }

  _drawGoal(x, groundY) {
    // Pole
    ctx.strokeStyle = COLOR.goal;
    ctx.lineWidth   = 3;
    ctx.lineCap     = 'round';
    ctx.beginPath();
    ctx.moveTo(x, groundY);
    ctx.lineTo(x, groundY - 90);
    ctx.stroke();
    // Flag
    ctx.fillStyle   = 'rgba(255,215,0,0.85)';
    ctx.strokeStyle = COLOR.goal;
    ctx.lineWidth   = 2;
    ctx.beginPath();
    ctx.moveTo(x,      groundY - 90);
    ctx.lineTo(x + 44, groundY - 74);
    ctx.lineTo(x,      groundY - 58);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // "FINISH" label
    ctx.fillStyle = COLOR.goal;
    ctx.font      = 'bold 13px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('FINISH', x, groundY - 98);
  }

  _drawHUD() {
    const pad      = 16;
    const progress = Math.min(1, this.player.x / PLAT_GOAL_X);

    // Progress bar track
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(pad, pad, W - pad * 2, 10);
    // Progress bar fill
    ctx.fillStyle = COLOR.hudAccent;
    ctx.fillRect(pad, pad, (W - pad * 2) * progress, 10);
    // Progress bar border
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth   = 1;
    ctx.strokeRect(pad, pad, W - pad * 2, 10);

    // Percentage text
    ctx.font      = '12px "Courier New", monospace';
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.fillText(`${Math.floor(progress * 100)}%  to finish`, W - pad, pad + 26);

    // ESC hint
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(255,255,255,0.28)';
    ctx.fillText('ESC – Menú', pad, H - 16);

    // Controls reminder (fades away once player moves past the start)
    if (this.player.x < 240) {
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(255,255,255,0.38)';
      ctx.fillText('[ ← / → ] Mover    [ ↑ / Space ] Saltar', W / 2, H - 16);
    }
  }

  _drawDeadScreen() {
    ctx.fillStyle = COLOR.overlay;
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center';
    ctx.font      = 'bold 44px "Courier New", monospace';
    ctx.fillStyle = '#ff6b6b';
    ctx.fillText('¡TE CAÍSTE!', W / 2, H / 2 - 44);
    ctx.font      = '20px "Courier New", monospace';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('Caíste al vacío – vuelve a intentarlo', W / 2, H / 2 + 2);
    ctx.font      = 'bold 15px "Courier New", monospace';
    ctx.fillStyle = COLOR.hudAccent;
    ctx.fillText('[ Enter / Space ]  Reintentar     [ Escape ]  Menú', W / 2, H / 2 + 48);
  }

  _drawCompleteScreen() {
    ctx.fillStyle = 'rgba(0,0,0,0.62)';
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign   = 'center';
    ctx.font        = 'bold 40px "Courier New", monospace';
    ctx.fillStyle   = COLOR.goal;
    ctx.shadowColor = COLOR.goal;
    ctx.shadowBlur  = 22;
    ctx.fillText('¡NIVEL COMPLETADO!', W / 2, H / 2 - 44);
    ctx.shadowBlur  = 0;
    ctx.font        = '20px "Courier New", monospace';
    ctx.fillStyle   = '#ffffff';
    ctx.fillText('¡Llegaste a la meta! 🏁', W / 2, H / 2 + 2);
    ctx.font        = 'bold 15px "Courier New", monospace';
    ctx.fillStyle   = COLOR.hudAccent;
    ctx.fillText('[ Enter / Space ]  Jugar de nuevo     [ Escape ]  Menú', W / 2, H / 2 + 48);
  }
}

// ═══════════════════════════════════════════════════════════════
//  MAIN GAME CONTROLLER
// ═══════════════════════════════════════════════════════════════
class Game {
  constructor() {
    this.currentState  = null;
    this.lastTimestamp = null;
    this.goToMenu();
    requestAnimationFrame(ts => this._loop(ts));
  }

  goToMenu()           { this.currentState = new MenuState(this); }
  startEndlessRunner() { this.currentState = new EndlessRunnerState(this); }
  startPlatformer()    { this.currentState = new PlatformerState(this); }

  _loop(timestamp) {
    const dt = this.lastTimestamp !== null
      ? (timestamp - this.lastTimestamp) / 1000
      : 0;
    this.lastTimestamp = timestamp;

    this.currentState.update(dt);
    this.currentState.draw();

    requestAnimationFrame(ts => this._loop(ts));
  }
}

// ─── Global input router ──────────────────────────────────────
let game;

function handleKeyDown(code) {
  if (game) game.currentState.handleInput(code);
}

// ─── Boot ─────────────────────────────────────────────────────
window.addEventListener('load', () => {
  game = new Game();
});
