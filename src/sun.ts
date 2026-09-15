import * as THREE from 'three';
import { SUN_DATA } from './planets';
import sunMapUrl from './assets/textures/sunmap.jpg';

export interface Sun {
  group: THREE.Group;
  sun: THREE.Mesh;
  update(time: number, speed: number, delta?: number): void;
}

export function createSun(scene: THREE.Scene): Sun {
  const group = new THREE.Group();

  const sunGeo = new THREE.SphereGeometry(SUN_DATA.radius, 64, 64);
  const sunTex = new THREE.TextureLoader().load(sunMapUrl);
  sunTex.colorSpace = THREE.SRGBColorSpace;
  const sunMat = new THREE.MeshBasicMaterial({
    map: sunTex,
    color: 0xffffff,
    fog: false
  });

  const sun = new THREE.Mesh(sunGeo, sunMat);
  group.add(sun);

  const glowLayer = createGlowSprite();
  group.add(glowLayer);

  const atmosphere = createAtmosphere();
  group.add(atmosphere);

  scene.add(group);
  scene.userData.sun = sun;

  return {
    group,
    sun,
    update(time: number, speed: number, delta = 1 / 60) {
      sun.rotation.y += SUN_DATA.rotationSpeed * speed * delta * 60;
      (glowLayer.material as THREE.SpriteMaterial).opacity = 0.9 + Math.sin(time * 1.2) * 0.1;
      (atmosphere.material as THREE.SpriteMaterial).opacity = 0.55 + Math.sin(time * 1.8) * 0.08;
    }
  };
}

function createGlowSprite(): THREE.Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  const gradient = ctx.createRadialGradient(256, 256, 0, 256, 256, 256);
  gradient.addColorStop(0, 'rgba(255, 220, 120, 1)');
  gradient.addColorStop(0.08, 'rgba(255, 170, 60, 0.95)');
  gradient.addColorStop(0.12, 'rgba(255, 130, 30, 0.8)');
  gradient.addColorStop(0.2, 'rgba(255, 100, 20, 0.45)');
  gradient.addColorStop(0.35, 'rgba(255, 80, 10, 0.2)');
  gradient.addColorStop(0.6, 'rgba(255, 60, 5, 0.06)');
  gradient.addColorStop(1, 'rgba(255, 50, 0, 0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 512, 512);

  const texture = new THREE.CanvasTexture(canvas);
  const spriteMat = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    depthTest: false
  });
  const sprite = new THREE.Sprite(spriteMat);
  sprite.scale.set(SUN_DATA.radius * 7, SUN_DATA.radius * 7, 1);
  return sprite;
}

function createAtmosphere(): THREE.Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  const gradient = ctx.createRadialGradient(256, 256, 0, 256, 256, 256);
  gradient.addColorStop(0, 'rgba(255, 200, 100, 0.6)');
  gradient.addColorStop(0.5, 'rgba(255, 140, 40, 0.25)');
  gradient.addColorStop(0.7, 'rgba(255, 120, 20, 0.12)');
  gradient.addColorStop(1, 'rgba(255, 100, 0, 0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 512, 512);

  const texture = new THREE.CanvasTexture(canvas);
  const mat = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    depthTest: true
  });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(SUN_DATA.radius * 2.4, SUN_DATA.radius * 2.4, 1);
  return sprite;
}
