/**
 * ============================================================
 *  SKATE RUNNER  –  HTML5 Canvas endless runner
 *  Pure JavaScript, no external dependencies.
 * ============================================================
 */

'use strict';

// ─── Canvas setup ───────────────────────────────────────────
const canvas = document.getElementById('gameCanvas');
const ctx    = canvas.getContext('2d');
const W      = canvas.width;   // 800
const H      = canvas.height;  // 400

// ─── Game constants ──────────────────────────────────────────
const GROUND_Y         = H - 60;   // y-coordinate of the ground line
const GRAVITY          = 1800;     // px / s²
const JUMP_VELOCITY    = -700;     // initial jump vy (px/s)
const BASE_SPEED       = 300;      // initial scroll speed (px/s)
const MAX_SPEED        = 700;      // speed cap
const SPEED_RAMP       = 15;       // px/s added per second
const FLIP_SPEED       = 540;      // deg/s during flip trick
const FLIP_BONUS_SCORE = 50;       // points for a completed flip
const DIST_SCORE_RATE  = 10;       // score points per second of running
const OBSTACLE_INTERVAL_MIN = 1.4; // seconds between obstacles (min)
const OBSTACLE_INTERVAL_MAX = 2.8; // seconds between obstacles (max)

// ─── Color palette ───────────────────────────────────────────
const COLOR = {
  sky:        '#1a1a2e',
  ground:     '#e0e0e0',
  groundFill: '#2a2a2a',
  player:     '#00ff96',
  skate:      '#ffffff',
  wheel:      '#aaaaaa',
  obstacle:   '#ff6b6b',
  star:       'rgba(255,255,255,0.6)',
  hud:        '#ffffff',
  hudAccent:  '#00ff96',
  hudShadow:  'rgba(0,0,0,0.7)',
  overlay:    'rgba(0,0,0,0.55)',
};

// ─── Input state ─────────────────────────────────────────────
const keys = {};
document.addEventListener('keydown', e => {
  keys[e.code] = true;
  handleKeyDown(e.code);
});
document.addEventListener('keyup',  e => { keys[e.code] = false; });

// ─── Utility helpers ─────────────────────────────────────────
function randBetween(a, b) {
  return a + Math.random() * (b - a);
}

function degreesToRadians(deg) {
  return (deg * Math.PI) / 180;
}

// ─── Stars (parallax background decoration) ──────────────────
const STARS = Array.from({ length: 60 }, () => ({
  x:     Math.random() * W,
  y:     Math.random() * (GROUND_Y - 40),
  r:     Math.random() * 1.5 + 0.3,
  speed: Math.random() * 0.3 + 0.05, // parallax multiplier
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

// ─── Ground background blocks (parallax mid-layer) ───────────
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

// ─── Ground line strips ───────────────────────────────────────
const GROUND_STRIP_W = 60;
let groundOffset = 0;

function drawGround() {
  // Main ground fill
  ctx.fillStyle = COLOR.groundFill;
  ctx.fillRect(0, GROUND_Y, W, H - GROUND_Y);

  // Ground top line
  ctx.strokeStyle = COLOR.ground;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, GROUND_Y);
  ctx.lineTo(W, GROUND_Y);
  ctx.stroke();

  // Dashed speed stripes
  ctx.strokeStyle = 'rgba(255,255,255,0.2)';
  ctx.lineWidth = 1;
  for (let i = 0; i < W + GROUND_STRIP_W; i += GROUND_STRIP_W) {
    const x = ((i - groundOffset % GROUND_STRIP_W) + GROUND_STRIP_W) % (W + GROUND_STRIP_W);
    ctx.beginPath();
    ctx.moveTo(x, GROUND_Y + 10);
    ctx.lineTo(x + 20, GROUND_Y + 10);
    ctx.stroke();
  }
}

// ─── Player class ─────────────────────────────────────────────
class Player {
  constructor() {
    this.reset();
  }

  reset() {
    this.x    = 160;             // fixed horizontal position
    this.y    = GROUND_Y;        // feet on ground
    this.vy   = 0;               // vertical velocity
    this.onGround = true;

    // Flip trick state
    this.flipAngle    = 0;       // current rotation of skate (degrees)
    this.isFlipping   = false;
    this.flipDir      = 1;       // +1 clockwise
    this.flipComplete = false;   // has the flip crossed 360°?

    // Body wobble animation
    this.runFrame = 0;           // time accumulator for run cycle
  }

  // Height of the bounding box for collision (feet to head)
  get height() { return 60; }
  get width()  { return 34; }

  // Bounding box (used for collision detection)
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
    this.vy        = JUMP_VELOCITY;
    this.onGround  = false;
    this.flipAngle  = 0;
    this.isFlipping = false;
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
    // Gravity
    if (!this.onGround) {
      this.vy += GRAVITY * dt;
      this.y  += this.vy * dt;
    }

    // Land on ground
    if (this.y >= GROUND_Y) {
      this.y        = GROUND_Y;
      this.vy       = 0;
      this.onGround = true;
      this.isFlipping = false;
      // reset flip angle smoothly to 0 after landing
      this.flipAngle = 0;
    }

    // Flip rotation
    if (this.isFlipping) {
      const prev = this.flipAngle;
      this.flipAngle += FLIP_SPEED * this.flipDir * dt;
      if (!this.flipComplete && this.flipAngle >= 360) {
        this.flipComplete = true;
      }
      // Keep flipping until we land
    }

    // Running body animation
    if (this.onGround) {
      this.runFrame += dt;
    }
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);

    // ── Skate ──
    this.drawSkate(ctx);

    // ── Stick figure body ──
    this.drawBody(ctx);

    ctx.restore();
  }

  drawSkate(ctx) {
    ctx.save();
    // Rotate the skate during flip trick
    if (this.isFlipping) {
      ctx.rotate(degreesToRadians(this.flipAngle));
    }

    // Deck (plank)
    ctx.strokeStyle = COLOR.skate;
    ctx.lineWidth   = 4;
    ctx.lineCap     = 'round';
    ctx.beginPath();
    ctx.moveTo(-18, 0);
    ctx.lineTo( 18, 0);
    ctx.stroke();

    // Trucks (axles) – small vertical lines
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
      // Wheel shine
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(wx, 4, 2, 0, Math.PI);
      ctx.stroke();
      ctx.strokeStyle = COLOR.wheel;
      ctx.lineWidth = 1.5;
    });

    ctx.restore();
  }

  drawBody(ctx) {
    ctx.strokeStyle = COLOR.player;
    ctx.lineWidth   = 2.5;
    ctx.lineCap     = 'round';
    ctx.lineJoin    = 'round';

    // Running lean: slight forward tilt when on ground
    const lean = this.onGround ? 0.15 : -0.05;

    // Feet y offset (touching the deck)
    const feetY = -2;

    // Leg swing (only on ground)
    const swing = this.onGround
      ? Math.sin(this.runFrame * 8) * 8
      : 0;

    // ── Legs ──
    // Left leg
    ctx.beginPath();
    ctx.moveTo(-3 + lean * 10, feetY);
    ctx.lineTo(-8 + swing * 0.5, feetY - 18);
    ctx.stroke();

    // Right leg
    ctx.beginPath();
    ctx.moveTo( 3 + lean * 10, feetY);
    ctx.lineTo( 8 - swing * 0.5, feetY - 18);
    ctx.stroke();

    // ── Torso ──
    const hipX  = lean * 10;
    const hipY  = feetY - 17;
    const neckX = lean * 20;
    const neckY = feetY - 40;

    ctx.beginPath();
    ctx.moveTo(hipX, hipY);
    ctx.lineTo(neckX, neckY);
    ctx.stroke();

    // ── Arms ──
    const armSwing = this.onGround ? -swing * 0.7 : 12;
    // Left arm (forward)
    ctx.beginPath();
    ctx.moveTo(neckX - 2, neckY + 4);
    ctx.lineTo(neckX - 12 + armSwing, neckY + 18);
    ctx.stroke();
    // Right arm (back)
    ctx.beginPath();
    ctx.moveTo(neckX + 2, neckY + 4);
    ctx.lineTo(neckX + 14 - armSwing, neckY + 16);
    ctx.stroke();

    // ── Head ──
    const headX = neckX + lean * 5;
    const headY = neckY - 10;
    ctx.beginPath();
    ctx.arc(headX, headY, 8, 0, Math.PI * 2);
    ctx.stroke();

    // ── Helmet / cap ──
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
}

// ─── Obstacle types ───────────────────────────────────────────
const OBSTACLE_TYPES = ['cone', 'rail', 'gap', 'skater'];

class Obstacle {
  /**
   * @param {number} x - initial x position (right edge of canvas)
   * @param {string} [type] - obstacle type (random if not provided)
   */
  constructor(x, type) {
    this.x    = x;
    this.type = type || OBSTACLE_TYPES[Math.floor(Math.random() * OBSTACLE_TYPES.length)];
    this._init();
  }

  _init() {
    switch (this.type) {
      case 'cone':
        this.w = 20; this.h = 30;
        break;
      case 'rail':
        this.w = 80; this.h = 14;
        break;
      case 'gap':
        // gap is drawn as a hole in the ground; no solid hit-box above ground
        this.w = 60; this.h = 1; // very thin top; player must jump over
        break;
      case 'skater':
        this.w = 34; this.h = 60;
        break;
      default:
        this.w = 20; this.h = 30;
    }
  }

  // Bounding box (world coordinates, feet at GROUND_Y)
  get bounds() {
    return {
      left:   this.x,
      right:  this.x + this.w,
      top:    GROUND_Y - this.h,
      bottom: GROUND_Y,
    };
  }

  update(dt, speed) {
    this.x -= speed * dt;
  }

  isOffScreen() {
    return this.x + this.w + 10 < 0;
  }

  draw(ctx) {
    switch (this.type) {
      case 'cone':   this.drawCone(ctx);   break;
      case 'rail':   this.drawRail(ctx);   break;
      case 'gap':    this.drawGap(ctx);    break;
      case 'skater': this.drawSkater(ctx); break;
    }
  }

  drawCone(ctx) {
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

    // Stripe
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(bx - 5, by - 12);
    ctx.lineTo(bx + 5, by - 12);
    ctx.stroke();
  }

  drawRail(ctx) {
    ctx.strokeStyle = '#c0c0ff';
    ctx.lineWidth   = 3;
    ctx.lineCap     = 'round';

    const y = GROUND_Y - this.h;

    // Rail beam
    ctx.beginPath();
    ctx.moveTo(this.x, y);
    ctx.lineTo(this.x + this.w, y);
    ctx.stroke();

    // Support legs
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(192,192,255,0.6)';
    [this.x + 10, this.x + this.w - 10].forEach(lx => {
      ctx.beginPath();
      ctx.moveTo(lx, y);
      ctx.lineTo(lx, GROUND_Y);
      ctx.stroke();
    });
  }

  drawGap(ctx) {
    // A gap is a missing section of the ground
    ctx.fillStyle = '#0a0a1a'; // hole color = dark
    ctx.fillRect(this.x, GROUND_Y, this.w, H - GROUND_Y);

    // Broken ground edges
    ctx.strokeStyle = COLOR.obstacle;
    ctx.lineWidth   = 2;
    // Left edge
    ctx.beginPath();
    ctx.moveTo(this.x, GROUND_Y - 4);
    ctx.lineTo(this.x, GROUND_Y + 20);
    ctx.stroke();
    // Right edge
    ctx.beginPath();
    ctx.moveTo(this.x + this.w, GROUND_Y - 4);
    ctx.lineTo(this.x + this.w, GROUND_Y + 20);
    ctx.stroke();
    // Depth lines inside gap
    ctx.strokeStyle = 'rgba(255,107,107,0.3)';
    ctx.lineWidth = 1;
    for (let d = 10; d < H - GROUND_Y; d += 14) {
      ctx.beginPath();
      ctx.moveTo(this.x + 4, GROUND_Y + d);
      ctx.lineTo(this.x + this.w - 4, GROUND_Y + d);
      ctx.stroke();
    }
  }

  drawSkater(ctx) {
    // Another stick-figure skater as obstacle
    ctx.save();
    ctx.translate(this.x + this.w / 2, GROUND_Y);
    ctx.strokeStyle = '#ff9966';
    ctx.lineWidth   = 2;
    ctx.lineCap     = 'round';

    // Skate deck
    ctx.strokeStyle = '#ffaa44';
    ctx.lineWidth   = 3;
    ctx.beginPath();
    ctx.moveTo(-16, 0);
    ctx.lineTo( 16, 0);
    ctx.stroke();
    // Wheels
    ctx.strokeStyle = '#ffaa44';
    ctx.lineWidth   = 1.5;
    [-10, 10].forEach(wx => {
      ctx.beginPath();
      ctx.arc(wx, 4, 4, 0, Math.PI * 2);
      ctx.stroke();
    });

    // Body
    ctx.strokeStyle = '#ff9966';
    ctx.lineWidth   = 2;
    // Legs
    ctx.beginPath(); ctx.moveTo(-4, -2); ctx.lineTo(-8, -18); ctx.stroke();
    ctx.beginPath(); ctx.moveTo( 4, -2); ctx.lineTo( 8, -18); ctx.stroke();
    // Torso
    ctx.beginPath(); ctx.moveTo(0, -18); ctx.lineTo(0, -40); ctx.stroke();
    // Arms
    ctx.beginPath(); ctx.moveTo(0, -30); ctx.lineTo(-14, -24); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, -30); ctx.lineTo( 14, -24); ctx.stroke();
    // Head
    ctx.beginPath();
    ctx.arc(0, -48, 8, 0, Math.PI * 2);
    ctx.stroke();

    ctx.restore();
  }
}

// ─── HUD (Heads-Up Display) ────────────────────────────────────
function drawHUD(score, highScore, speed) {
  const pad = 16;

  // Score
  ctx.font = 'bold 22px "Courier New", monospace';
  ctx.textAlign = 'left';
  // Shadow
  ctx.fillStyle = COLOR.hudShadow;
  ctx.fillText(`SCORE  ${Math.floor(score)}`, pad + 1, pad + 21);
  // Text
  ctx.fillStyle = COLOR.hudAccent;
  ctx.fillText(`SCORE  ${Math.floor(score)}`, pad, pad + 20);

  // High score
  ctx.font = '14px "Courier New", monospace';
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.fillText(`BEST  ${Math.floor(highScore)}`, pad, pad + 42);

  // Speed indicator (top right)
  ctx.textAlign = 'right';
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.font = '12px "Courier New", monospace';
  ctx.fillText(`${Math.floor(speed)} px/s`, W - pad, pad + 14);
}

// ─── Overlay screens ──────────────────────────────────────────
function drawStartScreen() {
  // Semi-transparent overlay
  ctx.fillStyle = COLOR.overlay;
  ctx.fillRect(0, 0, W, H);

  ctx.textAlign = 'center';

  // Title
  ctx.font = 'bold 52px "Courier New", monospace';
  ctx.fillStyle = COLOR.hudAccent;
  ctx.fillText('SKATE RUNNER', W / 2, H / 2 - 70);

  // Sub-title
  ctx.font = '20px "Courier New", monospace';
  ctx.fillStyle = '#ffffff';
  ctx.fillText('Endless Skate Adventure', W / 2, H / 2 - 36);

  // Controls
  ctx.font = '15px "Courier New", monospace';
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  const controls = [
    '[ Space / ↑ ]  Jump',
    '[ ↓ / F ]      Kickflip (in the air)',
    '[ Enter ]      Restart after Game Over',
  ];
  controls.forEach((line, i) => {
    ctx.fillText(line, W / 2, H / 2 + 10 + i * 24);
  });

  // Call to action
  ctx.font = 'bold 18px "Courier New", monospace';
  ctx.fillStyle = COLOR.hudAccent;
  ctx.fillText('Press SPACE to start', W / 2, H / 2 + 105);
}

function drawGameOverScreen(score, highScore, isNewRecord) {
  ctx.fillStyle = COLOR.overlay;
  ctx.fillRect(0, 0, W, H);

  ctx.textAlign = 'center';

  ctx.font = 'bold 48px "Courier New", monospace';
  ctx.fillStyle = '#ff6b6b';
  ctx.fillText('GAME OVER', W / 2, H / 2 - 60);

  ctx.font = '26px "Courier New", monospace';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(`Score: ${Math.floor(score)}`, W / 2, H / 2 - 10);

  if (isNewRecord) {
    ctx.font = 'bold 18px "Courier New", monospace';
    ctx.fillStyle = COLOR.hudAccent;
    ctx.fillText('🏆  NEW HIGH SCORE!', W / 2, H / 2 + 22);
  } else {
    ctx.font = '16px "Courier New", monospace';
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.fillText(`Best: ${Math.floor(highScore)}`, W / 2, H / 2 + 22);
  }

  ctx.font = 'bold 18px "Courier New", monospace';
  ctx.fillStyle = COLOR.hudAccent;
  ctx.fillText('Press ENTER or SPACE to play again', W / 2, H / 2 + 70);
}

// ─── Flip bonus toast ─────────────────────────────────────────
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
    this.y       -= 40 * dt; // float upward
    if (this.elapsed >= this.duration) this.dead = true;
  }

  draw(ctx) {
    const alpha = Math.max(0, 1 - this.elapsed / this.duration);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.font = 'bold 18px "Courier New", monospace';
    ctx.fillStyle   = this.color;
    ctx.textAlign   = 'center';
    ctx.fillText(this.text, this.x, this.y);
    ctx.restore();
  }
}

// ─── Game state machine ───────────────────────────────────────
const STATE = {
  START:    'start',
  RUNNING:  'running',
  GAMEOVER: 'gameover',
};

// ─── Main Game class ──────────────────────────────────────────
class Game {
  constructor() {
    this.state    = STATE.START;
    this.player   = new Player();
    this.obstacles = [];
    this.toasts    = [];

    this.score     = 0;
    this.highScore = this._loadHighScore();

    this.speed          = BASE_SPEED;
    this.scrollOffset   = 0;
    this.lastTimestamp  = null;

    this.nextObstacleIn = randBetween(OBSTACLE_INTERVAL_MIN, OBSTACLE_INTERVAL_MAX);
    this.timeSinceObstacle = 0;

    this.isNewRecord = false;

    // Kick off the loop
    requestAnimationFrame(ts => this._loop(ts));
  }

  _loadHighScore() {
    try {
      return parseFloat(localStorage.getItem('skateRunnerHighScore') || '0');
    } catch {
      return 0;
    }
  }

  _saveHighScore() {
    try {
      localStorage.setItem('skateRunnerHighScore', String(Math.floor(this.score)));
    } catch { /* localStorage not available */ }
  }

  reset() {
    this.player.reset();
    this.obstacles = [];
    this.toasts    = [];
    this.score     = 0;
    this.speed     = BASE_SPEED;
    this.scrollOffset = 0;
    this.nextObstacleIn = randBetween(OBSTACLE_INTERVAL_MIN, OBSTACLE_INTERVAL_MAX);
    this.timeSinceObstacle = 0;
    this.isNewRecord = false;
    this.state = STATE.RUNNING;
  }

  // ── Input handler (called from global keydown) ─────────────
  handleInput(code) {
    if (this.state === STATE.START) {
      if (code === 'Space' || code === 'ArrowUp') this.reset();
      return;
    }
    if (this.state === STATE.GAMEOVER) {
      if (code === 'Enter' || code === 'Space') this.reset();
      return;
    }
    // Running
    if (code === 'Space' || code === 'ArrowUp') {
      this.player.jump();
    }
    if (code === 'ArrowDown' || code === 'KeyF') {
      if (!this.player.onGround) {
        this.player.startFlip();
      }
    }
  }

  // ── Update ─────────────────────────────────────────────────
  update(dt) {
    if (this.state !== STATE.RUNNING) return;

    // Clamp dt to avoid huge jumps if tab was hidden
    dt = Math.min(dt, 0.05);

    // Increase speed over time
    this.speed = Math.min(MAX_SPEED, this.speed + SPEED_RAMP * dt);

    // Scroll offset (for parallax)
    this.scrollOffset += this.speed * dt;
    groundOffset       = this.scrollOffset;

    // Score: distance-based
    this.score += DIST_SCORE_RATE * dt;

    // Player update
    const wasFlipping = this.player.isFlipping;
    this.player.update(dt);

    // Award flip bonus on first completed flip
    if (wasFlipping && this.player.flipComplete && !this._flipBonusAwarded) {
      this.score += FLIP_BONUS_SCORE;
      this._flipBonusAwarded = true;
      this.toasts.push(new Toast(
        `+${FLIP_BONUS_SCORE}  KICKFLIP!`,
        this.player.x,
        this.player.y - 80,
        COLOR.hudAccent,
      ));
    }
    if (!this.player.isFlipping) {
      this._flipBonusAwarded = false;
    }

    // Spawn obstacles
    this.timeSinceObstacle += dt;
    if (this.timeSinceObstacle >= this.nextObstacleIn) {
      this.timeSinceObstacle = 0;
      // Adjust interval based on current speed
      const factor = BASE_SPEED / this.speed;
      this.nextObstacleIn = randBetween(
        OBSTACLE_INTERVAL_MIN * factor,
        OBSTACLE_INTERVAL_MAX * factor,
      );
      this.obstacles.push(new Obstacle(W + 10));
    }

    // Update obstacles & check collisions
    for (const obs of this.obstacles) {
      obs.update(dt, this.speed);
      if (this._collides(this.player, obs)) {
        this._gameOver();
        return;
      }
    }

    // Remove off-screen obstacles
    this.obstacles = this.obstacles.filter(o => !o.isOffScreen());

    // Update toasts
    for (const t of this.toasts) t.update(dt);
    this.toasts = this.toasts.filter(t => !t.dead);
  }

  _collides(player, obs) {
    // Gap: player must be airborne to cross; if on ground over gap = death
    if (obs.type === 'gap') {
      if (player.onGround) {
        const pb = player.bounds;
        const ob = obs.bounds;
        // Overlapping horizontally while on ground
        if (pb.right > ob.left + 4 && pb.left < ob.right - 4) return true;
      }
      return false;
    }

    const pb = player.bounds;
    const ob = obs.bounds;
    return (
      pb.right  > ob.left + 2 &&
      pb.left   < ob.right - 2 &&
      pb.bottom > ob.top  + 2 &&
      pb.top    < ob.bottom
    );
  }

  _gameOver() {
    this.state = STATE.GAMEOVER;
    if (this.score > this.highScore) {
      this.highScore   = this.score;
      this.isNewRecord = true;
      this._saveHighScore();
    }
  }

  // ── Draw ───────────────────────────────────────────────────
  draw() {
    // Clear
    ctx.fillStyle = COLOR.sky;
    ctx.fillRect(0, 0, W, H);

    drawStars(this.scrollOffset);
    drawBackgroundBlocks(this.scrollOffset);
    drawGround();

    // Obstacles
    for (const obs of this.obstacles) obs.draw(ctx);

    // Player
    if (this.state !== STATE.START) {
      this.player.draw(ctx);
    }

    // Toasts
    for (const t of this.toasts) t.draw(ctx);

    // HUD
    if (this.state === STATE.RUNNING) {
      drawHUD(this.score, this.highScore, this.speed);
    }

    // Overlays
    if (this.state === STATE.START) {
      this.player.draw(ctx); // show player on start screen
      drawStartScreen();
    } else if (this.state === STATE.GAMEOVER) {
      drawGameOverScreen(this.score, this.highScore, this.isNewRecord);
    }
  }

  // ── Main loop ─────────────────────────────────────────────
  _loop(timestamp) {
    const dt = this.lastTimestamp !== null
      ? (timestamp - this.lastTimestamp) / 1000
      : 0;
    this.lastTimestamp = timestamp;

    this.update(dt);
    this.draw();

    requestAnimationFrame(ts => this._loop(ts));
  }
}

// ─── Global input router ──────────────────────────────────────
let game;

function handleKeyDown(code) {
  if (game) game.handleInput(code);
}

// ─── Boot ────────────────────────────────────────────────────
window.addEventListener('load', () => {
  game = new Game();
});
