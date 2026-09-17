# Solar System 3D

An interactive 3D solar system built with **Three.js**, **Vite**, and **TypeScript**.
Click any planet — or any of its 12 moons — and the camera chases it down and follows it along its orbit.

> Live demo: https://aldhydheriz.github.io/solar-system/

## Features

- **Sun + 9 planets, Mercury through Pluto** — real textures, true inclination/eccentricity (Sun sits at the focus), axial tilts (Uranus rolls on its side)
- **12 clickable moons** — Earth's Moon, Phobos & Deimos, 4 Galilean moons, Titan & Rhea, Titania, Triton (retrograde), Charon, each with real diameter/orbit data and its own info panel
- **Halley's comet** — highly eccentric orbit with an anti-Sun particle tail that grows near perihelion
- **Asteroid belt (2,500 rocks) + Kuiper belt (3,500 icy rocks)** beyond Neptune
- **Rings everywhere they belong** — Saturn's textured rings with Cassini division, plus faint Jupiter/Uranus/Neptune rings (Uranus stands vertical with its 97.8° tilt)
- **Earth night lights** — city lights fade in on the night side; animated Sun shader (granulation + sunspots + limb darkening) with a **Dim mode (`D`)** for glare control
- **Follow camera** — click a planet/moon to chase + track it; badge shows what's followed; stop via badge, empty click, `Esc`, or double-click empty space
- **Artistic ↔ Real positions (`P`)** — JPL Kepler elements per date vs the stylized default; date readout in real mode
- **Compare mode (`C`)** — two bodies side by side at true relative size, follows the View scale
- **Narrated tour (`T`)** — 9 stops with captions, auto info panel, Prev/Next, optional speech synthesis (off by default; auto-advance disabled under reduced motion)
- **Quiz mode (`Q`)** — "Click Mars!", 5 questions, score + session best, green ✓ / red ✕ nav highlight
- **View menu (`V`)** — Scale (stylized/real), Labels, Orbits, Belts, Quality (High/Low), Dim, Positions — all persisted to `localStorage`
- **Perf meter (`F`)** — fps + draw calls + triangles, suggests Low quality below 28 fps; High ≈ 130 MiB GPU / Low ≈ 51 MiB at 1080p
- **Help modal (`?`)**, speed slider (0–4x, 0 = pause), fly-to nav bar (`1–9`, `0` Sun), deep links (`#mars`, `#pluto`, …), `R` reset
- **PWA offline** — app shell + 12 textures precached (~3.5 MB), works offline after first visit
- **Accessibility** — skip link, `←/→/Home/End` nav roving, `:focus-visible` ring, `prefers-reduced-motion` (forces Low, manual tour, no idle animation), colorblind-safe quiz badges

## Quickstart

Requires **Node 20+**.

```bash
npm install
npm run dev      # dev server, default http://localhost:8000
npm run build    # typecheck + production build into dist/
npm run preview  # serve the production build
npm test         # 81 unit tests (vitest)
npm run e2e      # 9 Playwright screenshot tests (desktop/tablet/mobile)
npm run lint     # eslint, must be clean
```

> Don't open `index.html` directly via `file://` — ES modules are blocked by the
> browser CORS policy. Always use the dev server or preview.

### Keyboard shortcuts

| Key     | Action                            |
| ------- | --------------------------------- |
| `1–9`   | Fly to Mercury … Pluto            |
| `0`     | Fly to Sun                        |
| `R`     | Reset view                        |
| `T`     | Start / stop tour                 |
| `C`     | Compare two bodies                |
| `Q`     | Quiz mode                         |
| `V`     | View options menu                 |
| `P`     | Artistic / real positions         |
| `D`     | Dim glare on / off                |
| `F`     | FPS + draw-call meter             |
| `Space` | Pause / resume                    |
| `?`     | Help modal                        |
| `Esc`   | Close dialog, else stop following |

## Project structure

```
index.html            # Vite entry (mounts /src/main.ts)
src/
  main.ts             # renderer, bloom composer, label renderer, game loop
  data/planets.json   # planet/moon data (radii, orbits, textures)
  planetTypes.ts      # shared types (PlanetData, RingConfig, PositionMode…)
  planetData.ts       # data access + texture map
  factory.ts          # planet/moon mesh + orbit factory (orbitPosition)
  planets.ts          # barrel re-export
  sun.ts              # animated sun shader + glow sprites
  comet.ts            # Halley + anti-Sun particle tail
  belt.ts             # asteroid + Kuiper belts (instanced)
  ephemeris.ts        # JPL Kepler solver + real orbit lines
  compare.ts          # compare-mode math (pure)
  tour.ts             # narrated-tour state machine (pure)
  quiz.ts             # quiz logic + session best (pure)
  earthNight.ts       # night-lights shader hook
  perf.ts             # GPU estimates + fps meter (pure)
  a11y.ts             # reduced-motion / keyboard helpers (pure)
  controls.ts         # OrbitControls, raycast pick, chase + follow camera
  ui.ts               # nav bar, info panel, tour/quiz/compare/help wiring
  style.css
  assets/textures/    # planet/moon/sun maps (bundled at build time)
e2e/                  # Playwright screenshot tests (9 baselines)
.github/workflows/   # lint → test → build → e2e → deploy to GitHub Pages
```

## Deploy to GitHub Pages

Push to `main` — the included workflow (`.github/workflows/deploy.yml`)
runs lint, unit tests, build, and Playwright E2E, then publishes `dist/`
automatically. First time only, in repo **Settings → Pages** set **Source**
to **GitHub Actions**.

Alternative without Actions: build locally (`npm run build`) and publish the
`dist/` folder from a `gh-pages` branch with **Source** set to
**Deploy from a branch**.

## Credits

- Planet/moon/sun textures from [threex.planets](https://github.com/jeromeetienne/threex.planets) by Jérôme Etienne.
- Built with [Three.js](https://threejs.org/), [Vite](https://vitejs.dev/), [TypeScript](https://www.typescriptlang.org/).

## License

MIT — see [LICENSE](LICENSE).
