import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js';
import { createSun } from './sun';
import { createSolarSystem } from './planets';
import type { ScaleMode } from './planets';
import { createBelt } from './belt';
import { createControls } from './controls';
import { createUI } from './ui';
import type { ControlsRef, QualityMode } from './ui';
import './style.css';

function init(): void {
  const canvas = document.getElementById('solar-canvas') as HTMLCanvasElement | null;
  if (!canvas) throw new Error('Missing #solar-canvas');

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x000000, 0.00045);

  const camera = new THREE.PerspectiveCamera(
    55,
    window.innerWidth / window.innerHeight,
    0.1,
    3000
  );
  camera.position.set(0, 140, 420);

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false
  });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;

  // postprocessing: subtle bloom so the sun + highlights glow
  const composer = new EffectComposer(renderer);
  composer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
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

  const controlsRef: ControlsRef = {};
  const ui = createUI(controlsRef);

  const controls = createControls(camera, renderer, solarSystem, {
    onSelect: (data) => {
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
    }
  });
  controls.setSceneRefs({ sun: sun.group });

  let simulationSpeed = 1;

  function applyQuality(mode: QualityMode): void {
    const low = mode === 'low';
    bloom.enabled = !low;
    renderer.shadowMap.enabled = !low;
    sunLight.castShadow = !low;
    renderer.setPixelRatio(low ? 1 : Math.min(window.devicePixelRatio, 2));
    composer.setPixelRatio(low ? 1 : Math.min(window.devicePixelRatio, 2));
    // recompile materials so shadow on/off actually takes effect
    scene.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      const mat = mesh.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach((m) => { m.needsUpdate = true; });
      else if (mat) mat.needsUpdate = true;
    });
  }

  Object.assign(controlsRef, {
    flyToPlanet: (name: string) => controls.flyToPlanet(name),
    focusSun: () => controls.focusSun(),
    stopFollowing: () => controls.stopFollowing(true),
    resetView: () => controls.resetView(),
    onSpeedChange: (scale: number) => { simulationSpeed = scale; },
    onScaleChange: (mode: ScaleMode) => { solarSystem.setScaleMode(mode); },
    onLabelsChange: (visible: boolean) => { solarSystem.setLabelsVisible(visible); },
    onOrbitsChange: (visible: boolean) => { solarSystem.setOrbitsVisible(visible); },
    onBeltChange: (visible: boolean) => { belt.setVisible(visible); },
    onQualityChange: (mode: QualityMode) => { applyQuality(mode); }
  });

  // Apply persisted settings (ui already reflects them; push to the 3D scene)
  const initial = ui.getInitialState();
  simulationSpeed = initial.speed;
  solarSystem.setScaleMode(initial.scaleMode);
  solarSystem.setLabelsVisible(initial.labelsOn);
  solarSystem.setOrbitsVisible(initial.orbitsOn);
  belt.setVisible(initial.beltOn);
  applyQuality(initial.quality);

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

  function animate(): void {
    requestAnimationFrame(animate);

    const delta = Math.min(clock.getDelta(), 0.05);
    elapsed += delta;
    orbitTime += delta * simulationSpeed;

    sun.update(elapsed, simulationSpeed, delta);
    solarSystem.update(orbitTime, simulationSpeed, delta);
    belt.update(orbitTime);
    controls.update();

    dateTimer += delta;
    if (dateTimer > 0.25) {
      dateTimer = 0;
      ui.setDate(orbitTime * DAYS_PER_UNIT);
    }

    composer.render();
    labelRenderer.render(scene, camera);
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
  sunLight.shadow.mapSize.width = 2048;
  sunLight.shadow.mapSize.height = 2048;
  scene.add(sunLight);

  const subtleFill = new THREE.DirectionalLight(0x4466cc, 0.15);
  subtleFill.position.set(-50, 80, -100);
  scene.add(subtleFill);

  return sunLight;
}

function createStarfield(scene: THREE.Scene): THREE.Points {
  const starsGeometry = new THREE.BufferGeometry();
  const count = 12000;
  const positions = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const colors = new Float32Array(count * 3);

  const colorPalette = [
    new THREE.Color(0xffffff),
    new THREE.Color(0xffeedd),
    new THREE.Color(0xbbddff),
    new THREE.Color(0xffd4b0)
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
    sizeAttenuation: true
  });

  const stars = new THREE.Points(starsGeometry, starsMaterial);
  scene.add(stars);

  return stars;
}

init();
