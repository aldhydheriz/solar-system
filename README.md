# Solar System 3D

An interactive 3D solar system built with **Three.js**, **Vite**, and **TypeScript**.
Click any planet — or any of its 11 moons — and the camera chases it down and follows it along its orbit.

> Live demo: `https://<your-username>.github.io/<repo>/` (enable GitHub Pages, see below)

## Features

- **Real planet textures** — Mercury through Neptune, Earth's swirling cloud layer, cratered Moon, textured Sun
- **11 clickable moons** — Earth's Moon, Phobos & Deimos, 4 Galilean moons, Titan & Rhea, Titania, Triton (retrograde), each with real diameter/orbit data and its own info panel
- **Follow camera** — click a planet/moon to chase + track it; badge shows what's followed; stop via badge, empty click, `Esc`, or double-click
- **Real orbital mechanics flavor** — true inclination, eccentricity (Sun sits at the focus), axial tilts (Uranus rolls on its side), Kepler-ish asteroid belt with 2,500 instanced rocks
- **Stylized ↔ Real scale toggle** — compare exaggerated sizes vs true proportions
- **Floating name labels** (toggleable), Saturn's procedural rings with Cassini division, subtle sun bloom (UnrealBloomPass)
- Speed slider (0–4x, 0 = pause), fly-to navigation bar, responsive + mobile layout

## Quickstart

Requires **Node 20+**.

```bash
npm install
npm run dev      # dev server, default http://localhost:8000
npm run build    # typecheck + production build into dist/
npm run preview  # serve the production build
```

> Don't open `index.html` directly via `file://` — ES modules are blocked by the
> browser CORS policy. Always use the dev server or preview.

## Project structure

```
index.html            # Vite entry (mounts /src/main.ts)
src/
  main.ts             # renderer, bloom composer, label renderer, game loop
  planets.ts          # planet/moon data, textures, orbits, rings, labels
  sun.ts              # sun + procedural glow sprites
  controls.ts         # OrbitControls, raycast pick, chase + follow camera
  ui.ts               # nav bar, info panel, speed/scale/label controls
  belt.ts             # instanced asteroid belt
  style.css
  assets/textures/    # planet/moon/sun maps (bundled at build time)
.github/workflows/   # auto-deploy to GitHub Pages on push to main
```

## Deploy to GitHub Pages

1. Create an empty **public** repo on GitHub (no README).
2. Push this project to it (`main` branch).
3. In repo **Settings → Pages**, set **Source** to **GitHub Actions**.
4. Push to `main` — the included workflow builds and publishes `dist/` automatically.

## Credits

- Planet/moon/sun textures from [threex.planets](https://github.com/jeromeetienne/threex.planets) by Jérôme Etienne.
- Built with [Three.js](https://threejs.org/), [Vite](https://vitejs.dev/), [TypeScript](https://www.typescriptlang.org/).

## License

MIT — see [LICENSE](LICENSE).
