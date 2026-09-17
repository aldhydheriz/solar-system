import { describe, expect, it } from 'vitest';
import {
  QUIZ_LENGTH,
  answerQuiz,
  loadBestQuizScore,
  pickQuizQuestions,
  quizProgress,
  quizTarget,
  saveBestQuizScore,
  startQuiz,
} from './quiz';

describe('quiz mode', () => {
  it('picks 5 unique valid planet names', () => {
    const q = pickQuizQuestions();
    expect(q).toHaveLength(QUIZ_LENGTH);
    expect(new Set(q).size).toBe(QUIZ_LENGTH);
  });

  it('finishes 5 questions and counts the score', () => {
    let s = startQuiz(['Mercury', 'Venus', 'Earth', 'Mars', 'Jupiter']);
    expect(quizTarget(s)).toBe('Mercury');
    expect(quizProgress(s)).toBe('1 / 5');
    // 3 right, 2 wrong
    const picks = ['Mercury', 'Saturn', 'Earth', 'Pluto', 'Jupiter'];
    let correct = 0;
    for (const p of picks) {
      const r = answerQuiz(s, p);
      if (r.correct) correct++;
      s = r.state;
    }
    expect(s.done).toBe(true);
    expect(s.score).toBe(3);
    expect(correct).toBe(3);
    expect(quizTarget(s)).toBeNull();
  });

  it('a wrong answer advances without scoring', () => {
    const s = startQuiz(['Mars', 'Earth']);
    const r = answerQuiz(s, 'Venus');
    expect(r.correct).toBe(false);
    expect(r.state.score).toBe(0);
    expect(quizTarget(r.state)).toBe('Earth');
    expect(r.finished).toBe(false);
  });

  it('matching is case-insensitive', () => {
    const s = startQuiz(['Mars']);
    const r = answerQuiz(s, 'mArS');
    expect(r.correct).toBe(true);
    expect(r.finished).toBe(true);
  });

  it('answering a finished quiz is a no-op', () => {
    const s = startQuiz(['Mars']);
    const done = answerQuiz(s, 'Mars').state;
    expect(done.done).toBe(true);
    const again = answerQuiz(done, 'Mars');
    expect(again.state.score).toBe(1);
    expect(again.finished).toBe(true);
  });

  it('best score persists the max for the session', () => {
    saveBestQuizScore(3);
    expect(loadBestQuizScore()).toBeGreaterThanOrEqual(3);
    saveBestQuizScore(1);
    expect(loadBestQuizScore()).toBeGreaterThanOrEqual(3);
    const best = saveBestQuizScore(5);
    expect(best).toBeGreaterThanOrEqual(5);
    expect(loadBestQuizScore()).toBe(best);
  });
});
