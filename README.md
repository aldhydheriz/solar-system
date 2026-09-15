# Solar System 3D

An interactive 3D solar system built with **Three.js**, **Vite**, and **TypeScript**.
Click any planet — or any of its 11 moons — and the camera chases it down and follows it along its orbit.

> Live demo: https://aldhydheriz.github.io/solar-system/

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

No Actions needed — serve the prebuilt `dist/` folder straight from a branch
(this also works when GitHub Actions is unavailable on your account):

```bash
npm run build
git checkout --orphan gh-pages
git rm -rf .
cp dist/index.html .
cp -r dist/assets .
touch .nojekyll
git add index.html assets .nojekyll
git commit -m "Publish site"
git push origin gh-pages
git checkout main
```

Then in repo **Settings → Pages**, set **Source** to **Deploy from a branch**,
branch `gh-pages`, folder `/ (root)`.

Republish after changes by rebuilding and repeating the copy step on the
`gh-pages` branch. (An Actions-based workflow is included as
`.github/workflows/deploy.yml.disabled` — rename it to `deploy.yml` and switch
Pages source to **GitHub Actions** once Actions works on your account.)

## Credits

- Planet/moon/sun textures from [threex.planets](https://github.com/jeromeetienne/threex.planets) by Jérôme Etienne.
- Built with [Three.js](https://threejs.org/), [Vite](https://vitejs.dev/), [TypeScript](https://www.typescriptlang.org/).

## License

MIT — see [LICENSE](LICENSE).
