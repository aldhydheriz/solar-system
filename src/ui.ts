import { PLANETS, SUN_DATA } from './planets';
import type { MoonPayload, PlanetData, PositionMode, ScaleMode, SelectPayload } from './planets';
import { compareCircleSizes, comparePair, listCompareNames } from './compare';
import {
  answerQuiz,
  loadBestQuizScore,
  pickQuizQuestions,
  quizProgress,
  quizTarget,
  saveBestQuizScore,
  startQuiz as createQuiz,
} from './quiz';
import type { QuizState } from './quiz';
import { TOUR_STEP_MS, tourStartIndex, tourStopAt } from './tour';

export type QualityMode = 'high' | 'low';

export interface AppSettings {
  speed: number;
  scaleMode: ScaleMode;
  positionsMode: PositionMode;
  labelsOn: boolean;
  orbitsOn: boolean;
  beltOn: boolean;
  quality: QualityMode;
  dim: boolean;
  tourSpeech: boolean;
}

export interface ControlsRef {
  flyToPlanet?: (name: string) => void;
  focusSun?: () => void;
  stopFollowing?: () => void;
  resetView?: () => void;
  onSpeedChange?: (scale: number) => void;
  onScaleChange?: (mode: ScaleMode) => void;
  onPositionsChange?: (mode: PositionMode) => void;
  onLabelsChange?: (visible: boolean) => void;
  onOrbitsChange?: (visible: boolean) => void;
  onBeltChange?: (visible: boolean) => void;
  onQualityChange?: (mode: QualityMode) => void;
  onDimChange?: (dim: boolean) => void;
}

export interface UI {
  showInfo(data: SelectPayload | null): void;
  hideLoading(): void;
  setActive(btn: HTMLButtonElement | null): void;
  setFollowing(name: string | null): void;
  setDate(days: number): void;
  setDateReal(dateMs: number): void;
  getPositionsMode(): PositionMode;
  getInitialState(): AppSettings;
  getHashTarget(): string | null;
  buttonsMap: Record<string, HTMLButtonElement>;
  sunBtn: HTMLButtonElement;
  /** Feed a 3D/nav planet pick into quiz mode. Returns true when consumed as an answer. */
  handleQuizPick(name: string | null): boolean;
  isQuizActive(): boolean;
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
  positionsMode: 'artistic',
  labelsOn: true,
  orbitsOn: true,
  beltOn: true,
  quality: 'high',
  dim: false,
  tourSpeech: false,
};

function loadStore(): AppSettings {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw) as Partial<AppSettings>;
    return {
      speed: typeof parsed.speed === 'number' ? Math.min(4, Math.max(0, parsed.speed)) : DEFAULTS.speed,
      scaleMode: parsed.scaleMode === 'real' ? 'real' : 'stylized',
      positionsMode: parsed.positionsMode === 'real' ? 'real' : 'artistic',
      labelsOn: parsed.labelsOn !== false,
      orbitsOn: parsed.orbitsOn !== false,
      beltOn: parsed.beltOn !== false,
      quality: parsed.quality === 'low' ? 'low' : 'high',
      dim: parsed.dim === true,
      tourSpeech: parsed.tourSpeech === true,
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
  const positionsToggle = document.getElementById('positions-toggle') as HTMLButtonElement | null;
  const labelsToggle = document.getElementById('labels-toggle') as HTMLButtonElement | null;
  const orbitsToggle = document.getElementById('orbits-toggle') as HTMLButtonElement | null;
  const beltToggle = document.getElementById('belt-toggle') as HTMLButtonElement | null;
  const qualityToggle = document.getElementById('quality-toggle') as HTMLButtonElement | null;
  const dimToggle = document.getElementById('dim-toggle') as HTMLButtonElement | null;
  const viewToggle = document.getElementById('view-toggle') as HTMLButtonElement | null;
  const viewMenu = document.getElementById('view-menu') as HTMLElement | null;
  const resetBtn = document.getElementById('reset-btn') as HTMLButtonElement | null;
  const pauseBtn = document.getElementById('pause-btn') as HTMLButtonElement | null;
  const tourBtn = document.getElementById('tour-btn') as HTMLButtonElement | null;
  const helpBtn = document.getElementById('help-btn') as HTMLButtonElement | null;
  const helpModal = document.getElementById('help-modal') as HTMLElement | null;
  const helpClose = document.getElementById('help-close') as HTMLButtonElement | null;
  const compareBtn = document.getElementById('compare-btn') as HTMLButtonElement | null;
  const compareModal = document.getElementById('compare-modal') as HTMLElement | null;
  const compareClose = document.getElementById('compare-close') as HTMLButtonElement | null;
  const compareSelectA = document.getElementById('compare-a') as HTMLSelectElement | null;
  const compareSelectB = document.getElementById('compare-b') as HTMLSelectElement | null;
  const compareSwap = document.getElementById('compare-swap') as HTMLButtonElement | null;
  const compareCircleA = document.getElementById('compare-circle-a') as HTMLElement | null;
  const compareCircleB = document.getElementById('compare-circle-b') as HTMLElement | null;
  const compareLabelA = document.getElementById('compare-label-a') as HTMLElement | null;
  const compareLabelB = document.getElementById('compare-label-b') as HTMLElement | null;
  const compareRatio = document.getElementById('compare-ratio') as HTMLElement | null;
  const compareScaleNote = document.getElementById('compare-scale-note') as HTMLElement | null;
  const simDate = document.getElementById('sim-date') as HTMLElement | null;
  const followBadge = document.getElementById('follow-badge') as HTMLButtonElement | null;
  const quizBtn = document.getElementById('quiz-btn') as HTMLButtonElement | null;
  const quizPanel = document.getElementById('quiz-panel') as HTMLElement | null;
  const quizProgressEl = document.getElementById('quiz-progress') as HTMLElement | null;
  const quizPrompt = document.getElementById('quiz-prompt') as HTMLElement | null;
  const quizScoreEl = document.getElementById('quiz-score') as HTMLElement | null;
  const quizFeedback = document.getElementById('quiz-feedback') as HTMLElement | null;
  const quizStopBtn = document.getElementById('quiz-stop') as HTMLButtonElement | null;

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
    colorBar: getEl<HTMLElement>('planet-color-bar'),
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

  // ---- dropdown rows: label + state pill ----
  function setRowState(btn: HTMLButtonElement | null, state: string, on: boolean): void {
    if (!btn) return;
    const pill = btn.querySelector('.state');
    if (pill) pill.textContent = state;
    pill?.classList.toggle('on', on);
  }

  // ---- scale / labels / orbits / belt / quality / dim (live in View menu) ----
  let scaleMode: ScaleMode = settings.scaleMode;
  function refreshScaleBtn(): void {
    setRowState(scaleToggle, scaleMode === 'real' ? 'Real' : 'Stylized', scaleMode === 'real');
  }
  refreshScaleBtn();
  scaleToggle?.addEventListener('click', () => {
    scaleMode = scaleMode === 'stylized' ? 'real' : 'stylized';
    settings.scaleMode = scaleMode;
    saveStore(settings);
    refreshScaleBtn();
    controlsRef.onScaleChange?.(scaleMode);
    refreshCompare();
  });

  // ---- positions (Fase 3.1): artistic vs JPL-real per tanggal ----
  let positionsMode: PositionMode = settings.positionsMode;
  function refreshPositionsBtn(): void {
    setRowState(positionsToggle, positionsMode === 'real' ? 'Real' : 'Artistic', positionsMode === 'real');
  }
  refreshPositionsBtn();
  positionsToggle?.addEventListener('click', () => {
    positionsMode = positionsMode === 'artistic' ? 'real' : 'artistic';
    settings.positionsMode = positionsMode;
    saveStore(settings);
    refreshPositionsBtn();
    controlsRef.onPositionsChange?.(positionsMode);
  });

  let labelsOn = settings.labelsOn;
  function refreshLabelsBtn(): void {
    setRowState(labelsToggle, labelsOn ? 'On' : 'Off', labelsOn);
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
    setRowState(orbitsToggle, orbitsOn ? 'On' : 'Off', orbitsOn);
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
    setRowState(beltToggle, beltOn ? 'On' : 'Off', beltOn);
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
    setRowState(qualityToggle, quality === 'low' ? 'Low' : 'High', quality === 'low');
  }
  refreshQualityBtn();
  qualityToggle?.addEventListener('click', () => {
    quality = quality === 'high' ? 'low' : 'high';
    settings.quality = quality;
    saveStore(settings);
    refreshQualityBtn();
    controlsRef.onQualityChange?.(quality);
  });

  // ---- dim (glare relief): tames bloom, exposure, sun glow, comet tail ----
  let dim = settings.dim;
  function refreshDimBtn(): void {
    setRowState(dimToggle, dim ? 'On' : 'Off', dim);
  }
  refreshDimBtn();
  dimToggle?.addEventListener('click', () => {
    dim = !dim;
    settings.dim = dim;
    saveStore(settings);
    refreshDimBtn();
    controlsRef.onDimChange?.(dim);
  });

  // ---- View dropdown: open/close, outside click, Esc ----
  function isViewOpen(): boolean {
    return !!viewMenu && !viewMenu.classList.contains('hidden');
  }
  function setViewOpen(open: boolean): void {
    viewMenu?.classList.toggle('hidden', !open);
    viewToggle?.classList.toggle('open', open);
    viewToggle?.setAttribute('aria-expanded', String(open));
  }
  viewToggle?.addEventListener('click', () => {
    stopTour();
    setViewOpen(!isViewOpen());
  });
  document.addEventListener('click', (e) => {
    if (!isViewOpen()) return;
    // row clicks live inside .dropdown so the menu stays open for multi-toggle
    if ((e.target as HTMLElement).closest?.('.dropdown')) return;
    setViewOpen(false);
  });

  // ---- reset + tour ----
  resetBtn?.addEventListener('click', () => {
    stopTour();
    stopQuizGame();
    setActive(null);
    controlsRef.resetView?.();
  });

  const tourCaption = document.getElementById('tour-caption') as HTMLElement | null;
  const tourProgress = document.getElementById('tour-progress') as HTMLElement | null;
  const tourText = document.getElementById('tour-text') as HTMLElement | null;
  const tourPrev = document.getElementById('tour-prev') as HTMLButtonElement | null;
  const tourNext = document.getElementById('tour-next') as HTMLButtonElement | null;
  const tourSpeechBtn = document.getElementById('tour-speech') as HTMLButtonElement | null;
  const tourStopBtn = document.getElementById('tour-stop') as HTMLButtonElement | null;

  let tourActive = false;
  let tourTimer: ReturnType<typeof setInterval> | null = null;
  let tourIndex = 0;
  let tourSpeech = settings.tourSpeech;

  function supportsSpeech(): boolean {
    return typeof window !== 'undefined' && 'speechSynthesis' in window;
  }

  function cancelSpeech(): void {
    try {
      if (supportsSpeech()) window.speechSynthesis.cancel();
    } catch {
      // speech not available — caption still works
    }
  }

  function speakTour(text: string): void {
    if (!tourSpeech || !supportsSpeech()) return;
    try {
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = typeof navigator !== 'undefined' && navigator.language ? navigator.language : 'en-US';
      utter.rate = 1;
      window.speechSynthesis.speak(utter);
    } catch {
      // ignore (e.g. blocked before user gesture)
    }
  }

  function refreshTourBtn(): void {
    if (!tourBtn) return;
    tourBtn.textContent = tourActive ? 'Stop' : 'Tour';
    tourBtn.classList.toggle('active', tourActive);
  }

  function refreshSpeechBtn(): void {
    if (!tourSpeechBtn) return;
    tourSpeechBtn.textContent = tourSpeech ? '🔊 On' : '🔊 Off';
    tourSpeechBtn.classList.toggle('active', tourSpeech);
  }
  refreshSpeechBtn();

  function renderTourStop(): void {
    const stop = tourStopAt(tourIndex);
    if (!stop) {
      stopTour();
      return;
    }
    tourIndex = stop.index;
    if (tourProgress) tourProgress.textContent = stop.progress;
    if (tourText) tourText.textContent = stop.text;
    tourCaption?.classList.remove('hidden');
    // flyToPlanet fires onSelect → showInfo, so the info panel opens
    // automatically at every stop (auto info panel).
    setActive(buttonsMap[stop.name] ?? null);
    controlsRef.flyToPlanet?.(stop.name);
    speakTour(stop.text);
  }

  function restartTourTimer(): void {
    if (tourTimer) clearInterval(tourTimer);
    tourTimer = setInterval(() => {
      tourIndex++;
      renderTourStop();
    }, TOUR_STEP_MS);
  }

  function stopTour(): void {
    if (!tourActive) return;
    tourActive = false;
    if (tourTimer) {
      clearInterval(tourTimer);
      tourTimer = null;
    }
    cancelSpeech();
    tourCaption?.classList.add('hidden');
    refreshTourBtn();
  }

  function startTour(): void {
    stopTour();
    stopQuizGame();
    tourActive = true;
    refreshTourBtn();
    // start from the planet nearest to current selection, else Mercury
    const activeName = buttonsMap && Object.keys(buttonsMap).find((n) => buttonsMap[n].classList.contains('active'));
    tourIndex = tourStartIndex(activeName ?? null);
    renderTourStop();
    restartTourTimer();
  }

  function goTourStep(dir: 1 | -1): void {
    if (!tourActive) return;
    tourIndex += dir;
    renderTourStop();
    restartTourTimer();
  }

  tourPrev?.addEventListener('click', (e) => {
    e.stopPropagation();
    goTourStep(-1);
  });
  tourNext?.addEventListener('click', (e) => {
    e.stopPropagation();
    goTourStep(1);
  });
  tourStopBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    stopTour();
  });
  tourSpeechBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    tourSpeech = !tourSpeech;
    settings.tourSpeech = tourSpeech;
    saveStore(settings);
    refreshSpeechBtn();
    if (!tourSpeech) {
      cancelSpeech();
    } else if (tourActive) {
      const stop = tourStopAt(tourIndex);
      if (stop) speakTour(stop.text);
    }
  });

  tourBtn?.addEventListener('click', () => {
    if (tourActive) stopTour();
    else startTour();
  });

  // ---- help modal ----
  function isHelpOpen(): boolean {
    return !!helpModal && !helpModal.classList.contains('hidden');
  }
  function openHelp(): void {
    helpModal?.classList.remove('hidden');
    helpBtn?.classList.add('active');
    helpClose?.focus();
  }
  function closeHelp(): void {
    helpModal?.classList.add('hidden');
    helpBtn?.classList.remove('active');
    helpBtn?.focus();
  }
  helpBtn?.addEventListener('click', () => {
    if (isHelpOpen()) closeHelp();
    else {
      stopTour();
      stopQuizGame();
      openHelp();
    }
  });
  helpClose?.addEventListener('click', () => closeHelp());
  helpModal?.addEventListener('click', (e) => {
    if (e.target === helpModal) closeHelp();
  });

  // ---- compare mode (Fase 3.2): two bodies side by side, true scale ----
  function bodyColor(name: string): number {
    if (name === SUN_DATA.name) return SUN_DATA.color;
    return PLANETS.find((p) => p.name === name)?.color ?? 0xffffff;
  }
  function bodyDiameter(name: string): string {
    if (name === SUN_DATA.name) return SUN_DATA.stats.diameter;
    return PLANETS.find((p) => p.name === name)?.stats.diameter ?? '—';
  }
  function isCompareOpen(): boolean {
    return !!compareModal && !compareModal.classList.contains('hidden');
  }
  function refreshCompare(): void {
    if (!compareSelectA || !compareSelectB) return;
    const aName = compareSelectA.value;
    const bName = compareSelectB.value;
    const r = comparePair(aName, bName, scaleMode);
    if (!r || !compareCircleA || !compareCircleB || !compareLabelA || !compareLabelB || !compareRatio) return;
    const px = compareCircleSizes(r.aRadius, r.bRadius);
    const paint = (el: HTMLElement, name: string, size: number): void => {
      const c = bodyColor(name);
      el.style.width = `${size}px`;
      el.style.height = `${size}px`;
      el.style.background = `radial-gradient(circle at 35% 35%, ${hexToRgba(c, 1)}, ${hexToRgba(shade(c), 1)})`;
    };
    paint(compareCircleA, r.aName, px.aPx);
    paint(compareCircleB, r.bName, px.bPx);
    compareLabelA.textContent = `${r.aName} · ${bodyDiameter(r.aName)}`;
    compareLabelB.textContent = `${r.bName} · ${bodyDiameter(r.bName)}`;
    compareRatio.textContent =
      r.ratio < 1.005 ? `${r.aName} ≈ ${r.bName} — same size` : `${r.biggerName} ≈ ${r.ratio.toFixed(2)}× the other`;
    if (compareScaleNote) {
      compareScaleNote.textContent =
        scaleMode === 'real' ? 'Scale: Real — follows View ▸ Scale' : 'Scale: Stylized — follows View ▸ Scale';
    }
  }
  function openCompare(): void {
    compareModal?.classList.remove('hidden');
    compareBtn?.classList.add('active');
    refreshCompare();
    compareSelectA?.focus();
  }
  function closeCompare(): void {
    compareModal?.classList.add('hidden');
    compareBtn?.classList.remove('active');
    compareBtn?.focus();
  }
  if (compareSelectA && compareSelectB) {
    listCompareNames().forEach((n) => {
      const oa = document.createElement('option');
      oa.value = n;
      oa.textContent = n;
      compareSelectA.appendChild(oa);
      const ob = document.createElement('option');
      ob.value = n;
      ob.textContent = n;
      compareSelectB.appendChild(ob);
    });
    compareSelectA.value = 'Earth';
    compareSelectB.value = 'Jupiter';
    compareSelectA.addEventListener('change', refreshCompare);
    compareSelectB.addEventListener('change', refreshCompare);
  }
  compareBtn?.addEventListener('click', () => {
    if (isCompareOpen()) closeCompare();
    else {
      stopTour();
      stopQuizGame();
      openCompare();
    }
  });
  compareClose?.addEventListener('click', () => closeCompare());
  compareModal?.addEventListener('click', (e) => {
    if (e.target === compareModal) closeCompare();
  });
  compareSwap?.addEventListener('click', () => {
    if (!compareSelectA || !compareSelectB) return;
    const tmp = compareSelectA.value;
    compareSelectA.value = compareSelectB.value;
    compareSelectB.value = tmp;
    refreshCompare();
  });

  // ---- quiz mode (Fase 3.4): "Click Mars!", score, highlight right/wrong ----
  // Answers arrive via handleQuizPick(), fed from main.ts onSelect — so canvas
  // raycast clicks, nav buttons, and 1-9 shortcuts all count exactly once.
  let quizActive = false;
  let quizState: QuizState = createQuiz();
  let quizBest = loadBestQuizScore();

  function refreshQuizBtn(): void {
    quizBtn?.classList.toggle('active', quizActive);
  }

  function renderQuizQuestion(): void {
    const target = quizTarget(quizState);
    if (quizProgressEl) quizProgressEl.textContent = quizProgress(quizState);
    if (quizPrompt) quizPrompt.textContent = target ? `Click ${target}!` : 'Done!';
    if (quizScoreEl) quizScoreEl.textContent = `Score: ${quizState.score} · Best: ${quizBest}`;
  }

  function setQuizFeedback(text: string, kind: 'good' | 'bad' | ''): void {
    if (!quizFeedback) return;
    quizFeedback.textContent = text;
    quizFeedback.classList.remove('good', 'bad');
    if (kind) quizFeedback.classList.add(kind);
  }

  function flashNav(name: string, correct: boolean): void {
    const btn = buttonsMap[name];
    if (!btn) return;
    const cls = correct ? 'correct' : 'wrong';
    btn.classList.add(cls);
    window.setTimeout(() => btn.classList.remove(cls), 900);
  }

  function clearQuizFlash(): void {
    Object.values(buttonsMap).forEach((b) => b.classList.remove('correct', 'wrong'));
  }

  function beginQuiz(): void {
    stopTour();
    closeCompare();
    if (isHelpOpen()) closeHelp();
    setViewOpen(false);
    quizState = createQuiz(pickQuizQuestions());
    quizBest = loadBestQuizScore();
    quizActive = true;
    refreshQuizBtn();
    quizPanel?.classList.remove('hidden');
    setQuizFeedback('', '');
    renderQuizQuestion();
    quizStopBtn?.focus();
  }

  function stopQuizGame(): void {
    if (!quizActive) return;
    quizActive = false;
    clearQuizFlash();
    quizPanel?.classList.add('hidden');
    refreshQuizBtn();
  }

  /**
   * Consume a planet pick as a quiz answer. Only planet names count —
   * moons / Sun / deselect return false so the quiz keeps waiting.
   */
  function handleQuizPick(name: string | null): boolean {
    if (!quizActive || !name) return false;
    if (!buttonsMap[name]) return false;
    const target = quizTarget(quizState);
    if (!target) return false;
    const r = answerQuiz(quizState, name);
    quizState = r.state;
    flashNav(name, r.correct);
    // flash the right answer green too so a miss still teaches
    if (!r.correct) flashNav(target, true);
    if (r.finished) {
      quizBest = saveBestQuizScore(quizState.score);
      if (quizProgressEl) quizProgressEl.textContent = quizProgress(quizState);
      if (quizPrompt) quizPrompt.textContent = 'Done!';
      if (quizScoreEl)
        quizScoreEl.textContent = `Score: ${quizState.score} / ${quizState.questions.length} · Best: ${quizBest}`;
      setQuizFeedback(
        quizState.score === quizState.questions.length
          ? `🏆 Perfect! ${quizState.score}/${quizState.questions.length} — you're a navigator!`
          : `You scored ${quizState.score}/${quizState.questions.length}. Hit Quiz to play again!`,
        quizState.score === quizState.questions.length ? 'good' : ''
      );
    } else {
      renderQuizQuestion();
      setQuizFeedback(
        r.correct ? `✅ Correct! That was ${name}.` : `❌ That was ${name} — looking for ${target}.`,
        r.correct ? 'good' : 'bad'
      );
      // re-render prompt for the next question (renderQuizQuestion already did)
      if (quizPrompt) {
        const next = quizTarget(quizState);
        if (next) quizPrompt.textContent = `Click ${next}!`;
      }
    }
    return true;
  }

  function isQuizActive(): boolean {
    return quizActive;
  }

  quizBtn?.addEventListener('click', () => {
    if (quizActive) stopQuizGame();
    else beginQuiz();
  });
  quizStopBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    stopQuizGame();
  });

  // ---- keyboard shortcuts ----
  window.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.repeat) return;
    const key = e.key;
    if (key === 'Escape') {
      // Help takes priority: close it without touching follow/tour state.
      // stopImmediatePropagation blocks the controls.ts Esc handler
      // (registered later) so Esc never unfollows while help is open.
      if (isHelpOpen()) {
        e.stopImmediatePropagation();
        closeHelp();
        return;
      }
      if (isCompareOpen()) {
        e.stopImmediatePropagation();
        closeCompare();
        return;
      }
      // View menu next: close it without stopping tours or unfollowing.
      if (isViewOpen()) {
        e.stopImmediatePropagation();
        setViewOpen(false);
        return;
      }
      stopQuizGame();
      stopTour();
      return;
    }
    if (isHelpOpen()) {
      if (key === '?' || key === 'h' || key === 'H') closeHelp();
      return;
    }
    if (isCompareOpen()) {
      if (key === 'c' || key === 'C' || key === 'Escape') closeCompare();
      return;
    }
    if (key === '?' || key === 'h' || key === 'H') {
      openHelp();
    } else if (key === 'c' || key === 'C') {
      stopTour();
      stopQuizGame();
      openCompare();
    } else if (key === 'q' || key === 'Q') {
      if (quizActive) stopQuizGame();
      else beginQuiz();
    } else if (key === ' ' || e.code === 'Space') {
      e.preventDefault();
      pauseBtn?.click();
    } else if (key >= '1' && key <= '9') {
      const p = PLANETS[parseInt(key, 10) - 1];
      if (p) (buttonsMap[p.name] ?? null)?.click();
    } else if (key === '0') {
      sunBtn.click();
    } else if (key === 'r' || key === 'R') {
      resetBtn?.click();
    } else if (key === 't' || key === 'T') {
      tourBtn?.click();
    } else if (key === 'v' || key === 'V') {
      viewToggle?.click();
    } else if (key === 'p' || key === 'P') {
      positionsToggle?.click();
    } else if (key === 'd' || key === 'D') {
      dimToggle?.click();
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

  function setDateReal(dateMs: number): void {
    if (!simDate) return;
    const d = new Date(dateMs);
    const text = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
    if (text !== lastDateText) {
      lastDateText = text;
      simDate.textContent = text;
      simDate.title = `Simulated date (${d.toUTCString().slice(0, 16)})`;
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
    setDateReal,
    getPositionsMode: () => positionsMode,
    getInitialState: () => ({ ...settings }),
    getHashTarget: () => parseHash(),
    buttonsMap,
    sunBtn,
    handleQuizPick,
    isQuizActive,
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
