import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { MoonData, MoonPayload, PlanetData, SelectPayload } from './planets';
import type { SolarSystem } from './planets';

export interface ControlsCallbacks {
  onSelect?: (data: SelectPayload | null) => void;
  onHover?: (name: string) => void;
  onHoverEnd?: () => void;
  onFollow?: (name: string | null) => void;
}

export interface SceneRefs {
  sun: THREE.Object3D | null;
}

export interface PlanetControls {
  controls: OrbitControls;
  update(): void;
  flyToPlanet(name: string): void;
  focusSun(): void;
  resetView(): void;
  selectPlanet(mesh: THREE.Object3D): void;
  stopFollowing(deselect?: boolean): void;
  getFollowedName(): string | null;
  setSceneRefs(refs: SceneRefs): void;
  getSelected(): THREE.Object3D | null;
}

interface FlyState {
  startPos: THREE.Vector3;
  targetPos: THREE.Vector3;
  startTarget: THREE.Vector3;
  endTarget: THREE.Vector3;
  offset: THREE.Vector3;
  followTarget: THREE.Object3D | null;
  startTime: number;
  duration: number;
}

export function createControls(
  camera: THREE.PerspectiveCamera,
  renderer: THREE.WebGLRenderer,
  solarSystem: SolarSystem,
  callbacks: ControlsCallbacks
): PlanetControls {
  const { planets, systemGroup } = solarSystem;

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 15;
  controls.maxDistance = 1600;
  controls.zoomSpeed = 1.2;
  controls.rotateSpeed = 0.8;

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  // planets + moons are all clickable / followable
  const meshes: THREE.Object3D[] = [
    ...planets.map((p) => p.mesh),
    ...planets.flatMap((p) => p.moons.map((m) => m.mesh))
  ];
  const hoverRings = planets.map((p) => createHoverRing(p.data));
  hoverRings.forEach((ring) => {
    ring.visible = false;
    systemGroup.add(ring);
  });

  let hoveredPlanet: THREE.Mesh | null = null;
  let selectedPlanet: THREE.Object3D | null = null;
  let flyState: FlyState | null = null;
  let followed: THREE.Object3D | null = null;
  const followTmp = new THREE.Vector3();
  const followDelta = new THREE.Vector3();

  renderer.domElement.addEventListener('pointermove', onPointerMove);
  renderer.domElement.addEventListener('pointerleave', onPointerLeave);
  renderer.domElement.addEventListener('click', onPointerClick);
  renderer.domElement.addEventListener('dblclick', () => resetView());
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') stopFollowing(true);
  });

  function onPointerMove(event: PointerEvent): void {
    pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
    pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;
  }

  function onPointerLeave(): void {
    clearHover();
  }

  function onPointerClick(event: MouseEvent): void {
    if (flyState) return;
    if (Math.abs(event.movementX) > 6 || Math.abs(event.movementY) > 6) return;

    const hit = raycast();
    if (hit) {
      selectPlanet(hit);
    } else {
      // click empty space: unfollow + deselect
      stopFollowing(true);
    }
  }

  function raycast(): THREE.Mesh | null {
    raycaster.setFromCamera(pointer, camera);
    const intersects = raycaster.intersectObjects(meshes, false);
    for (const inter of intersects) {
      const obj = inter.object as THREE.Mesh;
      if (obj.userData.planetData) return obj;
    }
    return null;
  }

  function updateHover(): void {
    if (flyState) return;
    const hit = raycast();

    if (hit) {
      if (hoveredPlanet !== hit) {
        clearHover();
        hoveredPlanet = hit;
        const mat = hoveredPlanet.material as THREE.MeshStandardMaterial;
        if (!hoveredPlanet.userData._baseEmissive) {
          hoveredPlanet.userData._baseEmissive = mat.emissive.clone();
        }
        mat.emissive.copy(hoveredPlanet.userData._baseEmissive as THREE.Color).multiplyScalar(3.2);
        // moons get emissive highlight only (no hover ring)
        if (!hit.userData.moonData) {
          const ring = hoverRings.find((r) => r.userData.planetId === (hit.userData.planetData as PlanetData).name);
          if (ring) {
            // follow planet position (rings live in systemGroup space)
            const wp = new THREE.Vector3();
            hit.getWorldPosition(wp);
            ring.position.copy(wp);
            ring.visible = true;
          }
        }
        renderer.domElement.style.cursor = 'pointer';
        callbacks.onHover?.((hit.userData.planetData as PlanetData).name);
      } else {
        // keep hover ring glued to moving planet
        const ring = hoverRings.find((r) => r.userData.planetId === (hit.userData.planetData as PlanetData).name);
        if (ring) {
          const wp = new THREE.Vector3();
          hit.getWorldPosition(wp);
          ring.position.copy(wp);
        }
      }
    } else if (hoveredPlanet) {
      clearHover();
    }
  }

  function clearHover(): void {
    if (hoveredPlanet) {
      const mat = hoveredPlanet.material as THREE.MeshStandardMaterial;
      const base = hoveredPlanet.userData._baseEmissive as THREE.Color | undefined;
      if (mat.emissive && base) {
        mat.emissive.copy(base);
      }
      const ring = hoverRings.find((r) => r.userData.planetId === (hoveredPlanet!.userData.planetData as PlanetData).name);
      if (ring) ring.visible = false;
      hoveredPlanet = null;
      renderer.domElement.style.cursor = 'default';
      callbacks.onHoverEnd?.();
    }
  }

  function selectPlanet(mesh: THREE.Object3D): void {
    clearHover();
    selectedPlanet = mesh;

    const moonData = mesh.userData.moonData as MoonData | undefined;
    if (moonData) {
      const parent = mesh.userData.planetData as PlanetData;
      const payload: MoonPayload = {
        _isMoon: true,
        name: moonData.name,
        color: moonData.color,
        parentName: parent.name,
        diameter: moonData.infoDiameter,
        distance: moonData.infoDistance,
        desc: `${moonData.name} is a moon of ${parent.name}. ${moonData.blurb}`
      };
      callbacks.onSelect?.(payload);
      callbacks.onFollow?.(moonData.name);

      const worldPos = new THREE.Vector3();
      mesh.getWorldPosition(worldPos);
      const r = ((mesh as THREE.Mesh).geometry as THREE.SphereGeometry).parameters.radius;
      const offset = new THREE.Vector3().copy(worldPos).normalize().multiplyScalar(Math.max(3, r * 8));
      offset.y += Math.max(1.5, r * 3);
      startFly(worldPos.clone(), offset, mesh);
      return;
    }

    const data = (mesh.userData.planetData as PlanetData);
    callbacks.onSelect?.(data);
    callbacks.onFollow?.(data.name);

    const worldPos = new THREE.Vector3();
    mesh.getWorldPosition(worldPos);

    const radius = data.radius;
    const offset = new THREE.Vector3().copy(worldPos).normalize().multiplyScalar(radius * 6);
    offset.y += radius * 2.5;

    startFly(worldPos.clone(), offset, mesh);
  }

  function startFly(target: THREE.Vector3, offset: THREE.Vector3, followTarget: THREE.Object3D | null = null): void {
    const startPos = camera.position.clone();
    const targetPos = target.clone().add(offset);

    const dist = startPos.distanceTo(targetPos);
    const duration = Math.max(0.6, Math.min(2.5, dist / 320));

    flyState = {
      startPos,
      targetPos,
      startTarget: controls.target.clone(),
      endTarget: target.clone(),
      offset: offset.clone(),
      followTarget,
      startTime: performance.now(),
      duration: duration * 1000
    };
    controls.enabled = false;
  }

  const chaseTmp = new THREE.Vector3();

  function updateFly(): void {
    if (!flyState) return;

    // chase the moving planet during flight so we land on it, not where it was
    if (flyState.followTarget) {
      flyState.followTarget.getWorldPosition(chaseTmp);
      flyState.endTarget.copy(chaseTmp);
      flyState.targetPos.copy(chaseTmp).add(flyState.offset);
    }

    const { startPos, targetPos, startTarget, endTarget, startTime, duration } = flyState;
    const elapsed = performance.now() - startTime;
    const t = Math.min(elapsed / duration, 1);
    const eased = easeInOutCubic(t);

    camera.position.lerpVectors(startPos, targetPos, eased);
    controls.target.lerpVectors(startTarget, endTarget, eased);
    controls.update();

    if (t >= 1) {
      followed = flyState.followTarget;
      flyState = null;
      controls.enabled = true;
    }
  }

  /** Glue camera target to the followed planet every frame. */
  function updateFollow(): void {
    if (!followed || flyState) return;
    followed.getWorldPosition(followTmp);
    followDelta.copy(followTmp).sub(controls.target);
    if (followDelta.lengthSq() === 0) return;
    controls.target.copy(followTmp);
    camera.position.add(followDelta);
  }

  function stopFollowing(deselect = false): void {
    const wasFollowing = followed !== null || flyState?.followTarget != null;
    followed = null;
    if (flyState) flyState.followTarget = null;
    if (wasFollowing) callbacks.onFollow?.(null);
    if (deselect) {
      selectedPlanet = null;
      callbacks.onSelect?.(null);
    }
  }

  function getFollowedName(): string | null {
    const target = followed ?? flyState?.followTarget ?? null;
    if (!target) return null;
    const moon = target.userData.moonData as MoonData | undefined;
    if (moon) return moon.name;
    return (target.userData.planetData as PlanetData | undefined)?.name ?? null;
  }

  function flyToPlanet(name: string): void {
    const planet = planets.find((p) => p.data.name.toLowerCase() === name.toLowerCase());
    if (!planet) return;
    selectPlanet(planet.mesh);
  }

  function focusSun(): void {
    clearHover();
    selectedPlanet = null;
    followed = null;
    if (flyState) flyState.followTarget = null;
    callbacks.onFollow?.(null);
    const sunEvent = { name: 'Sun', _isSun: true } as unknown as PlanetData;
    callbacks.onSelect?.(sunEvent);

    const sunPos = new THREE.Vector3();
    sceneRefs.sun?.getWorldPosition(sunPos);

    startFly(sunPos.clone(), new THREE.Vector3(0, 18, 40));
  }

  let sceneRefs: SceneRefs = { sun: null };
  function setSceneRefs(refs: SceneRefs): void {
    sceneRefs = refs;
  }

  function resetView(): void {
    clearHover();
    selectedPlanet = null;
    followed = null;
    if (flyState) flyState.followTarget = null;
    callbacks.onFollow?.(null);
    callbacks.onSelect?.(null);
    startFly(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 70, 220));
  }

  return {
    controls,
    update() {
      updateHover();
      updateFly();
      updateFollow();
      if (!flyState && controls.enabled) {
        controls.update();
      }
    },
    flyToPlanet,
    focusSun,
    resetView,
    selectPlanet,
    stopFollowing,
    getFollowedName,
    setSceneRefs,
    getSelected() { return selectedPlanet; }
  };
}

function createHoverRing(data: PlanetData): THREE.Mesh {
  const geo = new THREE.RingGeometry(data.radius * 1.2, data.radius * 1.35, 64);
  const mat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.9,
    side: THREE.DoubleSide,
    depthTest: false,
    blending: THREE.AdditiveBlending
  });
  const ring = new THREE.Mesh(geo, mat);
  ring.rotation.x = Math.PI / 2;
  ring.userData.planetId = data.name;
  return ring;
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}
