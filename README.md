# 🛹 Skate Runner

A web game built with pure **HTML5 Canvas + JavaScript** — no frameworks, no external dependencies, no images.

When you open the game you land on a **main menu** where you choose between two game modes. Everything is drawn with canvas primitives (lines, arcs) in a minimal stick-figure style.

---

## 🗂️ Game Modes

### 🏃 Endless Runner
Control a stick-figure skater dodging procedurally-generated obstacles on an infinite road. The game speeds up over time, and you can pull off **kickflip tricks** in the air for bonus points.

| Key | Action |
|-----|--------|
| `Space` / `↑` | **Jump** |
| `↓` / `F` | **Kickflip** *(airborne only — earns +50 pts on completion)* |
| `Enter` / `Space` | **Restart** after Game Over |
| `Escape` | **Back to Main Menu** |

**Obstacles:** traffic cones, grind rails, ground gaps, and rival skaters.  
**Scoring:** distance-based (10 pts/s) + kickflip bonuses. High score is saved in `localStorage`.

---

### 🎮 Platformer *(new!)*
A scrolling platformer in the style of classic side-scrollers. Navigate a designed level by jumping between floating platforms to reach the **FINISH flag** at the far right.

| Key | Action |
|-----|--------|
| `←` / `A` | Move left |
| `→` / `D` | Move right |
| `↑` / `Space` | **Jump** |
| `Escape` | **Back to Main Menu** |

**Objective:** reach the gold `FINISH` flag at the end of the level.  
**Hazards:** gaps in the ground — fall into one and you must retry.  
**Camera:** the canvas scrolls horizontally to follow the player.  
**Level:** four ground gaps bridged by floating platforms at varying heights, with a clear visual progress bar at the top.

---

## 🖥️ Main Menu

| Key | Action |
|-----|--------|
| `↑` / `↓` (or `←` / `→`) | Navigate between modes |
| `Enter` / `Space` | **Select** |
| `Escape` | Return to menu from either mode |

---

## 🚀 Running Locally

Open `index.html` in any modern browser — no build step needed:

```bash
# Option A – open directly
open index.html          # macOS
start index.html         # Windows

# Option B – simple HTTP server
npx serve .
# or
python3 -m http.server 8080
```

Then visit `http://localhost:8080`.

---

## 📁 File Structure

```
skate-runner-videogame/
├── index.html   – HTML shell with <canvas id="gameCanvas">
├── style.css    – Minimal dark-theme styles
├── game.js      – All game logic (~1 200 lines, no dependencies)
└── README.md    – This file
```

---

## 🏗️ Technical Details

| Topic | Detail |
|-------|--------|
| **Rendering** | Canvas 2D API — `lineTo`, `arc`, `strokeRect`, etc. No sprites or images. |
| **Game loop** | `requestAnimationFrame` with delta-time for frame-rate-independent movement. |
| **Architecture** | State machine: `MenuState` → `EndlessRunnerState` / `PlatformerState`, managed by a top-level `Game` controller. |
| **Platformer physics** | Gravity (1600 px/s²), vertical velocity integration, surface-crossing detection for both ground segments and floating platforms. One-way platforms (jump-through from below). |
| **Camera** | Horizontal-only translate (`ctx.translate(-cameraX, 0)`) applied each frame; HUD and overlays rendered after `ctx.restore()` to stay in screen space. |
| **Parallax** | Stars scroll at individual per-star multipliers; background blocks at 0.3× speed. |
| **Persistence** | Endless Runner high score stored in `localStorage` under key `skateRunnerHighScore`. |
