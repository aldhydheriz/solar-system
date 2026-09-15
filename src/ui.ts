import { PLANETS, SUN_DATA } from './planets';
import type { MoonPayload, PlanetData, ScaleMode, SelectPayload } from './planets';

export type QualityMode = 'high' | 'low';

export interface AppSettings {
  speed: number;
  scaleMode: ScaleMode;
  labelsOn: boolean;
  orbitsOn: boolean;
  beltOn: boolean;
  quality: QualityMode;
}

export interface ControlsRef {
  flyToPlanet?: (name: string) => void;
  focusSun?: () => void;
  stopFollowing?: () => void;
  resetView?: () => void;
  onSpeedChange?: (scale: number) => void;
  onScaleChange?: (mode: ScaleMode) => void;
  onLabelsChange?: (visible: boolean) => void;
  onOrbitsChange?: (visible: boolean) => void;
  onBeltChange?: (visible: boolean) => void;
  onQualityChange?: (mode: QualityMode) => void;
}

export interface UI {
  showInfo(data: SelectPayload | null): void;
  hideLoading(): void;
  setActive(btn: HTMLButtonElement | null): void;
  setFollowing(name: string | null): void;
  setDate(days: number): void;
  getInitialState(): AppSettings;
  getHashTarget(): string | null;
  buttonsMap: Record<string, HTMLButtonElement>;
  sunBtn: HTMLButtonElement;
}

function getEl<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing element #${id}`);
  return el as T;
}

const STORE_KEY = 'solar-system-settings-v1';

const DEFAULTS: AppSettings = {
  speed: 1,
  scaleMode: 'stylized',
  labelsOn: true,
  orbitsOn: true,
  beltOn: true,
  quality: 'high'
};

function loadStore(): AppSettings {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw) as Partial<AppSettings>;
    return {
      speed: typeof parsed.speed === 'number' ? Math.min(4, Math.max(0, parsed.speed)) : DEFAULTS.speed,
      scaleMode: parsed.scaleMode === 'real' ? 'real' : 'stylized',
      labelsOn: parsed.labelsOn !== false,
      orbitsOn: parsed.orbitsOn !== false,
      beltOn: parsed.beltOn !== false,
      quality: parsed.quality === 'low' ? 'low' : 'high'
    };
  } catch {
    return { ...DEFAULTS };
  }
}

function saveStore(s: AppSettings): void {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(s));
  } catch {
    // private mode etc — settings just won't persist
  }
}

/** Normalize location.hash to a planet name or 'sun', or null. */
function parseHash(): string | null {
  const h = window.location.hash.replace(/^#/, '').trim().toLowerCase();
  if (!h) return null;
  if (h === 'sun' || h === 'sol') return 'Sun';
  const hit = PLANETS.find((p) => p.name.toLowerCase() === h);
  return hit ? hit.name : null;
}

function updateHash(name: string | null): void {
  try {
    if (name) {
      window.location.hash = name.toLowerCase();
    } else if (window.location.hash) {
      history.replaceState(null, '', window.location.pathname + window.location.search);
    }
  } catch {
    // ignore (e.g. sandboxed iframe)
  }
}

export function createUI(controlsRef: ControlsRef): UI {
  const settings: AppSettings = loadStore();

  const nav = getEl<HTMLElement>('planet-nav');
  const infoPanel = getEl<HTMLElement>('info-panel');
  const closeBtn = getEl<HTMLButtonElement>('close-panel');
  const speedSlider = getEl<HTMLInputElement>('speed-slider');
  const speedLabel = getEl<HTMLElement>('speed-label');
  const loadingScreen = getEl<HTMLElement>('loading-screen');
  const scaleToggle = document.getElementById('scale-toggle') as HTMLButtonElement | null;
  const labelsToggle = document.getElementById('labels-toggle') as HTMLButtonElement | null;
  const orbitsToggle = document.getElementById('orbits-toggle') as HTMLButtonElement | null;
  const beltToggle = document.getElementById('belt-toggle') as HTMLButtonElement | null;
  const qualityToggle = document.getElementById('quality-toggle') as HTMLButtonElement | null;
  const resetBtn = document.getElementById('reset-btn') as HTMLButtonElement | null;
  const pauseBtn = document.getElementById('pause-btn') as HTMLButtonElement | null;
  const tourBtn = document.getElementById('tour-btn') as HTMLButtonElement | null;
  const simDate = document.getElementById('sim-date') as HTMLElement | null;
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
    stopTour();
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
      stopTour();
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

  // ---- speed + pause ----
  let lastSpeed = settings.speed > 0 ? settings.speed : 1;
  speedSlider.value = String(settings.speed * 50);
  speedLabel.textContent = settings.speed.toFixed(1) + 'x';

  function refreshPauseBtn(): void {
    if (!pauseBtn) return;
    const paused = parseFloat(speedSlider.value) / 50 === 0;
    pauseBtn.textContent = paused ? 'Play' : 'Pause';
    pauseBtn.classList.toggle('active', paused);
  }
  refreshPauseBtn();

  function applySpeed(scale: number): void {
    settings.speed = scale;
    if (scale > 0) lastSpeed = scale;
    saveStore(settings);
    speedSlider.value = String(scale * 50);
    speedLabel.textContent = scale.toFixed(1) + 'x';
    refreshPauseBtn();
    controlsRef.onSpeedChange?.(scale);
  }

  speedSlider.addEventListener('input', () => {
    const val = parseFloat(speedSlider.value);
    applySpeed(val / 50);
  });

  pauseBtn?.addEventListener('click', () => {
    const current = parseFloat(speedSlider.value) / 50;
    applySpeed(current === 0 ? lastSpeed : 0);
  });

  // ---- scale / labels / orbits / belt / quality ----
  let scaleMode: ScaleMode = settings.scaleMode;
  function refreshScaleBtn(): void {
    if (!scaleToggle) return;
    scaleToggle.textContent = scaleMode === 'stylized' ? 'Stylized scale' : 'Real scale';
    scaleToggle.classList.toggle('active', scaleMode === 'real');
  }
  refreshScaleBtn();
  scaleToggle?.addEventListener('click', () => {
    scaleMode = scaleMode === 'stylized' ? 'real' : 'stylized';
    settings.scaleMode = scaleMode;
    saveStore(settings);
    refreshScaleBtn();
    controlsRef.onScaleChange?.(scaleMode);
  });

  let labelsOn = settings.labelsOn;
  function refreshLabelsBtn(): void {
    if (!labelsToggle) return;
    labelsToggle.textContent = labelsOn ? 'Labels on' : 'Labels off';
    labelsToggle.classList.toggle('active', !labelsOn);
  }
  refreshLabelsBtn();
  labelsToggle?.addEventListener('click', () => {
    labelsOn = !labelsOn;
    settings.labelsOn = labelsOn;
    saveStore(settings);
    refreshLabelsBtn();
    controlsRef.onLabelsChange?.(labelsOn);
  });

  let orbitsOn = settings.orbitsOn;
  function refreshOrbitsBtn(): void {
    if (!orbitsToggle) return;
    orbitsToggle.textContent = orbitsOn ? 'Orbits on' : 'Orbits off';
    orbitsToggle.classList.toggle('active', !orbitsOn);
  }
  refreshOrbitsBtn();
  orbitsToggle?.addEventListener('click', () => {
    orbitsOn = !orbitsOn;
    settings.orbitsOn = orbitsOn;
    saveStore(settings);
    refreshOrbitsBtn();
    controlsRef.onOrbitsChange?.(orbitsOn);
  });

  let beltOn = settings.beltOn;
  function refreshBeltBtn(): void {
    if (!beltToggle) return;
    beltToggle.textContent = beltOn ? 'Belt on' : 'Belt off';
    beltToggle.classList.toggle('active', !beltOn);
  }
  refreshBeltBtn();
  beltToggle?.addEventListener('click', () => {
    beltOn = !beltOn;
    settings.beltOn = beltOn;
    saveStore(settings);
    refreshBeltBtn();
    controlsRef.onBeltChange?.(beltOn);
  });

  let quality: QualityMode = settings.quality;
  function refreshQualityBtn(): void {
    if (!qualityToggle) return;
    qualityToggle.textContent = quality === 'high' ? 'High' : 'Low';
    qualityToggle.classList.toggle('active', quality === 'low');
  }
  refreshQualityBtn();
  qualityToggle?.addEventListener('click', () => {
    quality = quality === 'high' ? 'low' : 'high';
    settings.quality = quality;
    saveStore(settings);
    refreshQualityBtn();
    controlsRef.onQualityChange?.(quality);
  });

  // ---- reset + tour ----
  resetBtn?.addEventListener('click', () => {
    stopTour();
    setActive(null);
    controlsRef.resetView?.();
  });

  let tourActive = false;
  let tourTimer: ReturnType<typeof setInterval> | null = null;
  let tourIndex = 0;

  function refreshTourBtn(): void {
    if (!tourBtn) return;
    tourBtn.textContent = tourActive ? 'Stop' : 'Tour';
    tourBtn.classList.toggle('active', tourActive);
  }

  function stopTour(): void {
    if (!tourActive) return;
    tourActive = false;
    if (tourTimer) {
      clearInterval(tourTimer);
      tourTimer = null;
    }
    refreshTourBtn();
  }

  function startTour(): void {
    stopTour();
    tourActive = true;
    refreshTourBtn();
    // start from the planet nearest to current selection, else Mercury
    const activeName = buttonsMap && Object.keys(buttonsMap).find((n) => buttonsMap[n].classList.contains('active'));
    tourIndex = activeName ? Math.max(0, PLANETS.findIndex((p) => p.name === activeName)) : 0;
    const step = (): void => {
      const p = PLANETS[tourIndex % PLANETS.length];
      tourIndex++;
      setActive(buttonsMap[p.name] ?? null);
      controlsRef.flyToPlanet?.(p.name);
    };
    step();
    tourTimer = setInterval(step, 5000);
  }

  tourBtn?.addEventListener('click', () => {
    if (tourActive) stopTour();
    else startTour();
  });

  // ---- keyboard shortcuts ----
  window.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.repeat) return;
    const key = e.key;
    if (key === ' ' || e.code === 'Space') {
      e.preventDefault();
      pauseBtn?.click();
    } else if (key >= '1' && key <= '8') {
      const p = PLANETS[parseInt(key, 10) - 1];
      if (p) (buttonsMap[p.name] ?? null)?.click();
    } else if (key === '0') {
      sunBtn.click();
    } else if (key === 'r' || key === 'R') {
      resetBtn?.click();
    } else if (key === 't' || key === 'T') {
      tourBtn?.click();
    } else if (key === 'Escape') {
      stopTour();
    }
  });

  function setActive(btn: HTMLButtonElement | null): void {
    buttons.forEach((b) => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
  }

  let lastDateText = '';
  function setDate(days: number): void {
    if (!simDate) return;
    const text = days < 730 ? `Day ${Math.floor(days)}` : `${(days / 365.25).toFixed(1)} yrs`;
    if (text !== lastDateText) {
      lastDateText = text;
      simDate.textContent = text;
    }
  }

  function showInfo(data: SelectPayload | null): void {
    if (!data) {
      infoPanel.classList.add('hidden');
      stopTour();
      updateHash(null);
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
      updateHash(m.parentName);
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
    updateHash(d.name);
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
    setDate,
    getInitialState: () => ({ ...settings }),
    getHashTarget: () => parseHash(),
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
