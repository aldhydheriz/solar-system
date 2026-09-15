import { PLANETS, SUN_DATA } from './planets';
import type { MoonPayload, PlanetData, ScaleMode, SelectPayload } from './planets';

export interface ControlsRef {
  flyToPlanet?: (name: string) => void;
  focusSun?: () => void;
  stopFollowing?: () => void;
  onSpeedChange?: (scale: number) => void;
  onScaleChange?: (mode: ScaleMode) => void;
  onLabelsChange?: (visible: boolean) => void;
}

export interface UI {
  showInfo(data: SelectPayload | null): void;
  hideLoading(): void;
  setActive(btn: HTMLButtonElement | null): void;
  setFollowing(name: string | null): void;
  buttonsMap: Record<string, HTMLButtonElement>;
  sunBtn: HTMLButtonElement;
}

function getEl<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing element #${id}`);
  return el as T;
}

export function createUI(controlsRef: ControlsRef): UI {
  const nav = getEl<HTMLElement>('planet-nav');
  const infoPanel = getEl<HTMLElement>('info-panel');
  const closeBtn = getEl<HTMLButtonElement>('close-panel');
  const speedSlider = getEl<HTMLInputElement>('speed-slider');
  const speedLabel = getEl<HTMLElement>('speed-label');
  const loadingScreen = getEl<HTMLElement>('loading-screen');
  const scaleToggle = document.getElementById('scale-toggle') as HTMLButtonElement | null;
  const labelsToggle = document.getElementById('labels-toggle') as HTMLButtonElement | null;
  const followBadge = document.getElementById('follow-badge') as HTMLButtonElement | null;

  followBadge?.addEventListener('click', () => {
    controlsRef.stopFollowing?.();
  });

  const refs = {
    name: getEl<HTMLElement>('panel-name'),
    diameter: getEl<HTMLElement>('panel-diameter'),
    distance: getEl<HTMLElement>('panel-distance'),
    period: getEl<HTMLElement>('panel-period'),
    day: getEl<HTMLElement>('panel-day'),
    moons: getEl<HTMLElement>('panel-moons'),
    desc: getEl<HTMLElement>('panel-desc'),
    colorBar: getEl<HTMLElement>('planet-color-bar')
  };

  const buttons: HTMLButtonElement[] = [];
  const buttonsMap: Record<string, HTMLButtonElement> = {};

  const sunBtn = document.createElement('button');
  sunBtn.className = 'nav-btn sun-btn';
  sunBtn.title = 'Sun';
  sunBtn.style.background = 'radial-gradient(circle at 35% 35%, #ffdf8a, #ff9d2f 60%, #e56300)';
  sunBtn.innerHTML = '<span class="tooltip">Sun</span>';
  sunBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    setActive(sunBtn);
    controlsRef.focusSun?.();
  });
  nav.appendChild(sunBtn);
  buttons.push(sunBtn);

  PLANETS.forEach((p) => {
    const btn = document.createElement('button');
    btn.className = 'nav-btn';
    btn.title = p.name;
    btn.style.background = `radial-gradient(circle at 35% 35%, ${hexToRgba(p.color, 1)}, ${hexToRgba(shade(p.color), 1)})`;
    btn.innerHTML = `<span class="tooltip">${p.name}</span>`;
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      setActive(btn);
      controlsRef.flyToPlanet?.(p.name);
    });
    nav.appendChild(btn);
    buttons.push(btn);
    buttonsMap[p.name] = btn;
  });

  closeBtn.addEventListener('click', () => {
    infoPanel.classList.add('hidden');
  });

  speedSlider.addEventListener('input', () => {
    const val = parseFloat(speedSlider.value);
    const scale = val / 50;
    speedLabel.textContent = scale.toFixed(1) + 'x';
    controlsRef.onSpeedChange?.(scale);
  });

  let scaleMode: ScaleMode = 'stylized';
  scaleToggle?.addEventListener('click', () => {
    scaleMode = scaleMode === 'stylized' ? 'real' : 'stylized';
    scaleToggle.textContent = scaleMode === 'stylized' ? 'Stylized scale' : 'Real scale';
    scaleToggle.classList.toggle('active', scaleMode === 'real');
    controlsRef.onScaleChange?.(scaleMode);
  });

  let labelsOn = true;
  labelsToggle?.addEventListener('click', () => {
    labelsOn = !labelsOn;
    labelsToggle.textContent = labelsOn ? 'Labels on' : 'Labels off';
    labelsToggle.classList.toggle('active', !labelsOn);
    controlsRef.onLabelsChange?.(labelsOn);
  });

  function setActive(btn: HTMLButtonElement | null): void {
    buttons.forEach((b) => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
  }

  function showInfo(data: SelectPayload | null): void {
    if (!data) {
      infoPanel.classList.add('hidden');
      return;
    }

    if ((data as MoonPayload)._isMoon === true) {
      const m = data as MoonPayload;
      const color = hexToRgba(m.color, 1);
      refs.name.textContent = m.name;
      refs.diameter.textContent = m.diameter;
      refs.distance.textContent = m.distance;
      refs.period.textContent = `Orbits ${m.parentName}`;
      refs.day.textContent = '—';
      refs.moons.textContent = '0';
      refs.desc.textContent = `${m.desc} Click the planet nav below to fly back out.`;
      refs.colorBar.style.background = `linear-gradient(90deg, ${color}, ${hexToRgba(shade(m.color), 1)})`;
      infoPanel.classList.remove('hidden');
      return;
    }

    const d = data as PlanetData;
    const isSun = d._isSun === true || d.name === 'Sun';
    const color = isSun ? '#ff9d2f' : hexToRgba(d.color ?? 0xffffff, 1);

    refs.name.textContent = d.name;
    refs.diameter.textContent = isSun ? SUN_DATA.stats.diameter : (d.stats?.diameter ?? '—');
    refs.distance.textContent = isSun ? SUN_DATA.stats.distance : (d.stats?.distance ?? '—');
    refs.period.textContent = isSun ? SUN_DATA.stats.period : (d.stats?.period ?? '—');
    refs.day.textContent = isSun ? SUN_DATA.stats.day : (d.stats?.day ?? '—');
    refs.moons.textContent = isSun ? SUN_DATA.stats.moons : (d.stats?.moons ?? '—');
    let desc = isSun ? SUN_DATA.desc : (d.desc ?? '');
    if (!isSun && d.moons && d.moons.length > 0) {
      desc += ` Moons shown: ${d.moons.map((m) => m.name).join(', ')}.`;
    }
    if (!isSun) {
      desc += ` Inclination ${d.inclination}°, eccentricity ${d.eccentricity}.`;
    }
    refs.desc.textContent = desc;
    refs.colorBar.style.background = `linear-gradient(90deg, ${color}, ${hexToRgba(shade(isSun ? 0xff9d2f : (d.color ?? 0xffffff)), 1)})`;

    infoPanel.classList.remove('hidden');
  }

  function hideLoading(): void {
    loadingScreen.classList.add('fade-out');
    setTimeout(() => loadingScreen.remove(), 800);
  }

  function setFollowing(name: string | null): void {
    if (!followBadge) return;
    if (name) {
      followBadge.innerHTML = `Following <strong>${name}</strong> &times;`;
      followBadge.classList.remove('hidden');
    } else {
      followBadge.classList.add('hidden');
    }
  }

  return {
    showInfo,
    hideLoading,
    setActive,
    setFollowing,
    buttonsMap,
    sunBtn
  };
}

function shade(color: number): number {
  const r = (color >> 16) & 255;
  const g = (color >> 8) & 255;
  const b = color & 255;
  return (Math.round(r * 0.5) << 16) | (Math.round(g * 0.5) << 8) | Math.round(b * 0.5);
}

function hexToRgba(color: number, alpha: number): string {
  const r = (color >> 16) & 255;
  const g = (color >> 8) & 255;
  const b = color & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
