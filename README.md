# 🛹 Skate Runner

An **endless runner** web game built with pure HTML5 Canvas + JavaScript — no frameworks, no external dependencies.

You control a stick-figure skater who must jump over and dodge procedurally generated obstacles while pulling off sweet **kickflips** for bonus points. The game gets faster and harder the longer you survive!

---

## 🎮 How to Play

| Key | Action |
|-----|--------|
| `Space` / `↑` | **Jump** |
| `↓` / `F` | **Kickflip** *(only while airborne)* |
| `Enter` / `Space` | **Restart** after Game Over |

- Avoid **cones**, **rails**, **gaps**, and **other skaters**.
- Complete a full 360° kickflip in the air to earn **+50 bonus points**.
- Your **high score** is saved in your browser (localStorage) between sessions.

---

## 🚀 Running Locally

Just open `index.html` in any modern browser — no build step required:

```bash
# Option A – open directly
open index.html          # macOS
start index.html         # Windows

# Option B – serve with a simple HTTP server (avoids some browser security warnings)
npx serve .
# or
python3 -m http.server 8080
```

Then visit `http://localhost:8080` (if using a server).

---

## 📁 File Structure

```
skate-runner-videogame/
├── index.html   – HTML shell with <canvas>
├── style.css    – Minimal dark-theme styles
├── game.js      – All game logic (Player, Obstacle, Game classes)
└── README.md    – This file
```

---

## 🏗️ Technical Details

- **Rendering**: Canvas 2D API – everything drawn with `ctx.strokeStyle`, `lineTo`, `arc`, etc. (no sprites or images).
- **Game loop**: `requestAnimationFrame` with delta-time for frame-rate independent movement.
- **Parallax**: Stars and background blocks scroll at different speeds for a sense of depth.
- **Difficulty scaling**: Game speed increases from 300 px/s up to 700 px/s; obstacle interval shrinks with speed.
- **Persistence**: High score stored in `localStorage` under the key `skateRunnerHighScore`.
