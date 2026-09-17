import { PLANETS } from './planetData';

/** Questions per game — matches the roadmap acceptance (5 soal selesai). */
export const QUIZ_LENGTH = 5;

/** sessionStorage key for the best score (session-persisted). */
export const QUIZ_BEST_KEY = 'solar-system-quiz-best-v1';

export interface QuizState {
  questions: string[];
  /** index of the current question (0-based); == questions.length when done */
  current: number;
  score: number;
  done: boolean;
  lastCorrect: boolean | null;
  lastPicked: string | null;
}

export interface QuizAnswer {
  state: QuizState;
  correct: boolean;
  finished: boolean;
}

/** Planet names eligible for quiz questions: Mercury … Pluto. */
export function listQuizNames(): string[] {
  return PLANETS.map((p) => p.name);
}

/** Pick `count` unique random planet names (Fisher–Yates, injectable rand). */
export function pickQuizQuestions(count: number = QUIZ_LENGTH, rand: () => number = Math.random): string[] {
  const names = listQuizNames();
  for (let i = names.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [names[i], names[j]] = [names[j], names[i]];
  }
  return names.slice(0, Math.max(0, Math.min(count, names.length)));
}

/** Fresh quiz state from a question list (defaults to 5 random). */
export function startQuiz(questions?: string[]): QuizState {
  const list = questions && questions.length > 0 ? [...questions] : pickQuizQuestions();
  return { questions: list, current: 0, score: 0, done: false, lastCorrect: null, lastPicked: null };
}

/** Current target name, or null when the quiz is finished. */
export function quizTarget(state: QuizState): string | null {
  if (state.done || state.current >= state.questions.length) return null;
  return state.questions[state.current];
}

/** "2 / 5" style progress label. */
export function quizProgress(state: QuizState): string {
  const total = state.questions.length;
  const pos = Math.min(state.current + 1, total);
  return `${pos} / ${total}`;
}

/**
 * Answer the current question. Comparison is case-insensitive.
 * Returns the next state; answering a finished quiz is a no-op (correct=false).
 */
export function answerQuiz(state: QuizState, pickedName: string): QuizAnswer {
  if (state.done || state.current >= state.questions.length) {
    return { state, correct: false, finished: true };
  }
  const target = state.questions[state.current];
  const correct = pickedName.trim().toLowerCase() === target.toLowerCase();
  const current = state.current + 1;
  const finished = current >= state.questions.length;
  const next: QuizState = {
    questions: state.questions,
    current,
    score: state.score + (correct ? 1 : 0),
    done: finished,
    lastCorrect: correct,
    lastPicked: pickedName,
  };
  return { state: next, correct, finished };
}

// ---- best score (session-persisted, memory fallback for non-DOM envs) ----
let memBest = 0;

function readSession(): number | null {
  try {
    if (typeof sessionStorage === 'undefined') return null;
    const raw = sessionStorage.getItem(QUIZ_BEST_KEY);
    if (raw === null) return null;
    const n = parseInt(raw, 10);
    return Number.isFinite(n) && n >= 0 ? n : null;
  } catch {
    return null;
  }
}

export function loadBestQuizScore(): number {
  const s = readSession();
  if (s !== null) {
    if (s > memBest) memBest = s;
    return s;
  }
  return memBest;
}

/** Persist the max score; returns the (possibly updated) best. */
export function saveBestQuizScore(score: number): number {
  const best = Math.max(loadBestQuizScore(), score);
  memBest = best;
  try {
    if (typeof sessionStorage !== 'undefined') sessionStorage.setItem(QUIZ_BEST_KEY, String(best));
  } catch {
    // private mode etc — memory fallback still works for the session
  }
  return best;
}
