import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js';
import { createSun } from './sun';
import { createSolarSystem } from './planets';
import type { PositionMode, ScaleMode } from './planets';
import { createBelt, createKuiperBelt } from './belt';
import { createComet } from './comet';
import { createControls } from './controls';
import { createUI } from './ui';
import type { ControlsRef, QualityMode } from './ui';
import { prefersReducedMotion, resolveInitialQuality } from './a11y';
import { FpsMeter, PERF_BUDGET, shouldSuggestLowQuality } from './perf';
import { registerSW } from 'virtual:pwa-register';
import './style.css';

// Offline-first (Fase 1.4): precached app shell + textures via vite-plugin-pwa.
registerSW({ immediate: true });

function init(): void {
  const canvas = document.getElementById('solar-canvas') as HTMLCanvasElement | null;
  if (!canvas) throw new Error('Missing #solar-canvas');

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x000000, 0.00045);

  const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 3000);
  camera.position.set(0, 140, 420);

  const renderer = new THREE.WebGLRenderer({
    canvas,
    // Fase 4.2: canvas MSAA is bypassed by EffectComposer (all frames go
    // through RenderPass → bloom → OutputPass), so antialias only costs
    // memory without improving the image. Off saves a full-res MSAA buffer.
    antialias: false,
    alpha: false,
  });
  renderer.setSize(window.innerWidth, window.innerHeight);
  // Fase 4.2: cap DPR at 1.5 — retina fill-rate + bloom cost drops ~44% vs 2x,
  // 1080p (DPR 1) displays are unaffected.
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;

  // postprocessing: subtle bloom so the sun + highlights glow
  const composer = new EffectComposer(renderer);
  composer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    0.85, // strength
    0.55, // radius
    0.78 // threshold
  );
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  // HTML labels overlay (planet names)
  const labelRenderer = new CSS2DRenderer();
  labelRenderer.setSize(window.innerWidth, window.innerHeight);
  labelRenderer.domElement.id = 'labels';
  document.body.appendChild(labelRenderer.domElement);

  const sunLight = createLighting(scene);
  createStarfield(scene);

  const sun = createSun(scene);
  const solarSystem = createSolarSystem(scene);
  const belt = createBelt(scene);
  const kuiper = createKuiperBelt(scene);
  const comet = createComet(scene);

  const controlsRef: ControlsRef = {};
  const ui = createUI(controlsRef);

  const controls = createControls(camera, renderer, solarSystem, {
    onSelect: (data) => {
      // Quiz mode consumes planet picks as answers (canvas, nav, 1-9).
      // Moons / Sun / deselect are ignored so the quiz keeps waiting.
      const picked =
        data &&
        !(data as { _isMoon?: boolean })._isMoon &&
        !(data as { _isSun?: boolean })._isSun &&
        (data as { name?: string }).name
          ? (data as { name: string }).name
          : null;
      if (picked) ui.handleQuizPick(picked);
      ui.showInfo(data);
      if (data && (data as { _isSun?: boolean })._isSun) {
        ui.setActive(ui.sunBtn);
      } else if (data && !(data as { _isMoon?: boolean })._isMoon && (data as { name?: string }).name) {
        ui.setActive(ui.buttonsMap[(data as { name: string }).name] ?? null);
      } else {
        ui.setActive(null);
      }
    },
    onFollow: (name) => {
      ui.setFollowing(name);
    },
  });
  controls.setSceneRefs({ sun: sun.group });

  let simulationSpeed = 1;
  let currentQuality: QualityMode = 'high';

  // Fase 4.2: perf HUD (toggle with F) — rolling fps + draw stats so the
  // 60fps High / 30fps Low budget is verifiable on any machine.
  const fpsMeter = new FpsMeter();
  const perfBadge = document.getElementById('perf-badge');
  let perfVisible = false;
  let perfTimer = 0;
  let poorFpsSec = 0;
  window.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
    const t = e.target as HTMLElement | null;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA')) return;
    if ((e.key === 'f' || e.key === 'F') && perfBadge) {
      perfVisible = !perfVisible;
      perfBadge.classList.toggle('hidden', !perfVisible);
    }
  });

  function updatePerfBadge(dt: number): void {
    if (!perfBadge || !perfVisible) return;
    perfTimer += dt;
    if (perfTimer < 0.5) return;
    perfTimer = 0;
    const fps = fpsMeter.avgFps();
    const floor = currentQuality === 'high' ? PERF_BUDGET.fpsHigh : PERF_BUDGET.fpsLow;
    const ok = fpsMeter.samples >= 60 && fps >= floor;
    if (currentQuality === 'high' && fpsMeter.samples >= 60 && fps < PERF_BUDGET.fpsLow) {
      poorFpsSec += 0.5;
    } else {
      poorFpsSec = 0;
    }
    const info = renderer.info.render;
    const hint = shouldSuggestLowQuality(fps, poorFpsSec) ? ' · try Low quality' : '';
    perfBadge.textContent = `${Math.round(fps)} fps · ${info.calls} calls · ${(info.triangles / 1e6).toFixed(2)}M tris${hint}`;
    perfBadge.classList.toggle('bad', !ok);
  }

  function applyQuality(mode: QualityMode): void {
    currentQuality = mode;
    const low = mode === 'low';
    bloom.enabled = !low;
    comet.setQuality(low);
    sun.setQuality(low);
    renderer.shadowMap.enabled = !low;
    sunLight.castShadow = !low;
    renderer.setPixelRatio(low ? 1 : Math.min(window.devicePixelRatio, 1.5));
    composer.setPixelRatio(low ? 1 : Math.min(window.devicePixelRatio, 1.5));
    // recompile materials so shadow on/off actually takes effect
    scene.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      const mat = mesh.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat))
        mat.forEach((m) => {
          m.needsUpdate = true;
        });
      else if (mat) mat.needsUpdate = true;
    });
  }

  // Dim mode (glare relief): tames bloom + exposure + sun glow + comet tail.
  function applyDim(dim: boolean): void {
    bloom.strength = dim ? 0.25 : 0.85;
    renderer.toneMappingExposure = dim ? 0.8 : 1.1;
    sun.setDim(dim);
    comet.setDim(dim);
  }

  Object.assign(controlsRef, {
    flyToPlanet: (name: string) => controls.flyToPlanet(name),
    focusSun: () => controls.focusSun(),
    stopFollowing: () => controls.stopFollowing(true),
    resetView: () => controls.resetView(),
    onSpeedChange: (scale: number) => {
      simulationSpeed = scale;
    },
    onScaleChange: (mode: ScaleMode) => {
      solarSystem.setScaleMode(mode);
      comet.setScaleMode(mode);
      controls.setScaleMode(mode);
    },
    onPositionsChange: (mode: PositionMode) => {
      solarSystem.setPositionMode(mode);
    },
    onLabelsChange: (visible: boolean) => {
      solarSystem.setLabelsVisible(visible);
      comet.setLabelsVisible(visible);
    },
    onOrbitsChange: (visible: boolean) => {
      solarSystem.setOrbitsVisible(visible);
      comet.setOrbitsVisible(visible);
    },
    onBeltChange: (visible: boolean) => {
      belt.setVisible(visible);
      kuiper.setVisible(visible);
    },
    onQualityChange: (mode: QualityMode) => {
      applyQuality(mode);
    },
    onDimChange: (dim: boolean) => {
      applyDim(dim);
    },
  });

  // Apply persisted settings (ui already reflects them; push to the 3D scene)
  // Fase 4.1: prefers-reduced-motion forces low quality (no bloom) at startup.
  const initial = ui.getInitialState();
  const effectiveQuality: QualityMode = resolveInitialQuality(initial.quality, prefersReducedMotion()) as QualityMode;
  simulationSpeed = initial.speed;
  solarSystem.setScaleMode(initial.scaleMode);
  solarSystem.setPositionMode(initial.positionsMode);
  controls.setScaleMode(initial.scaleMode);
  solarSystem.setLabelsVisible(initial.labelsOn);
  solarSystem.setOrbitsVisible(initial.orbitsOn);
  comet.setLabelsVisible(initial.labelsOn);
  comet.setOrbitsVisible(initial.orbitsOn);
  belt.setVisible(initial.beltOn);
  kuiper.setVisible(initial.beltOn);
  applyQuality(effectiveQuality);
  applyDim(initial.dim);

  // If the OS toggles reduced-motion mid-session, drop bloom immediately.
  try {
    window.matchMedia?.('(prefers-reduced-motion: reduce)').addEventListener?.('change', (e) => {
      if (e.matches) applyQuality('low');
    });
  } catch {
    // older browsers without addEventListener on MediaQueryList — ignore
  }

  // Deep link: #mars, #earth, #sun, ...
  const hashTarget = ui.getHashTarget();
  if (hashTarget === 'Sun') {
    controls.focusSun();
  } else if (hashTarget) {
    controls.flyToPlanet(hashTarget);
  }

  const clock = new THREE.Clock();
  let elapsed = 0;
  let orbitTime = 0;
  let dateTimer = 0;
  // Earth does a full orbit when orbitTime * speed * 2 = 2π with speed 0.25
  // → orbitTime per year = π / 0.25 → ~29.07 days per orbitTime unit
  const DAYS_PER_UNIT = 365.25 / (Math.PI / 0.25);
  const MS_PER_DAY = 86400e3;
  // Fase 3.1: simulasi berjalan dari hari ini; mode real memetakan tanggal
  // sim ke posisi JPL, mode artistic memakai penghitung hari lama.
  const simEpochMs = Date.now();

  function simDateMs(): number {
    return simEpochMs + orbitTime * DAYS_PER_UNIT * MS_PER_DAY;
  }

  function animate(): void {
    requestAnimationFrame(animate);

    const delta = Math.min(clock.getDelta(), 0.05);
    elapsed += delta;
    orbitTime += delta * simulationSpeed;
    fpsMeter.push(delta);

    sun.update(elapsed, simulationSpeed, delta);
    solarSystem.update(orbitTime, simulationSpeed, delta, simDateMs());
    comet.update(orbitTime);
    belt.update(orbitTime);
    kuiper.update(orbitTime);
    controls.update();

    dateTimer += delta;
    if (dateTimer > 0.25) {
      dateTimer = 0;
      if (ui.getPositionsMode() === 'real') ui.setDateReal(simDateMs());
      else ui.setDate(orbitTime * DAYS_PER_UNIT);
    }

    composer.render();
    labelRenderer.render(scene, camera);
    updatePerfBadge(delta);
  }

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);
    labelRenderer.setSize(window.innerWidth, window.innerHeight);
  });

  ui.hideLoading();
  animate();
}

function createLighting(scene: THREE.Scene): THREE.PointLight {
  const ambient = new THREE.AmbientLight(0x404055, 0.35);
  scene.add(ambient);

  const sunLight = new THREE.PointLight(0xfff3e0, 2200, 0, 1.6);
  sunLight.position.set(0, 0, 0);
  sunLight.castShadow = true;
  // Fase 4.2: 1024 cube = 24MiB vs 2048 = 96MiB. Biggest single GPU saving
  // toward the <150MB budget; shadows get slightly softer, still crisp.
  sunLight.shadow.mapSize.width = 1024;
  sunLight.shadow.mapSize.height = 1024;
  scene.add(sunLight);

  const subtleFill = new THREE.DirectionalLight(0x4466cc, 0.15);
  subtleFill.position.set(-50, 80, -100);
  scene.add(subtleFill);

  return sunLight;
}

function createStarfield(scene: THREE.Scene): THREE.Points {
  const starsGeometry = new THREE.BufferGeometry();
  // Fase 4.2: 9000 pts (was 12000) — still dense, 25% less vertex + fill cost.
  const count = 9000;
  const positions = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const colors = new Float32Array(count * 3);

  const colorPalette = [
    new THREE.Color(0xffffff),
    new THREE.Color(0xffeedd),
    new THREE.Color(0xbbddff),
    new THREE.Color(0xffd4b0),
  ];

  for (let i = 0; i < count; i++) {
    const r = 600 + Math.random() * 1200;
    const theta = Math.acos(2 * Math.random() - 1);
    const phi = Math.random() * Math.PI * 2;

    positions[i * 3] = r * Math.sin(theta) * Math.cos(phi);
    positions[i * 3 + 1] = r * Math.sin(theta) * Math.sin(phi) * 0.6;
    positions[i * 3 + 2] = r * Math.cos(theta);

    sizes[i] = 0.3 + Math.random() * 2.5;

    const color = colorPalette[Math.floor(Math.random() * colorPalette.length)];
    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
  }

  starsGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  starsGeometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
  starsGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const starsMaterial = new THREE.PointsMaterial({
    size: 1.2,
    vertexColors: true,
    transparent: true,
    opacity: 0.95,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true,
  });

  const stars = new THREE.Points(starsGeometry, starsMaterial);
  scene.add(stars);

  return stars;
}

init();
