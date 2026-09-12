'use client';

/**
 * Take a test: timer, one question at a time, progress dots, then submit.
 * After submitting, students see their score and can pull an AI explanation
 * for each question. Correct answers are NEVER sent to the browser before
 * submission (the API strips them for students).
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Timer, Sparkles, CheckCheck, Bot, PartyPopper, Dumbbell, BookOpen, CheckCircle2, XCircle, HelpCircle, Ban } from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

function fmtTime(totalSeconds) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function TakeTestPage() {
  const { id } = useParams();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [test, setTest] = useState(null);
  const [answers, setAnswers] = useState({});
  const [current, setCurrent] = useState(0);
  const [timeLeft, setTimeLeft] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [explanations, setExplanations] = useState({});
  const [pendingIds, setPendingIds] = useState([]);
  const [explainingAll, setExplainingAll] = useState(false);
  const submittedRef = useRef(false);

  // ---- load the test ----
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/tests/${id}`);
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setLoadError(data.error || 'Could not load this test.');
        } else {
          setTest(data.test);
          setTimeLeft(data.test.timeLimitMinutes * 60);
        }
      } catch {
        if (!cancelled) setLoadError('Network error — please try again.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const submit = useCallback(async () => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    setSubmitting(true);

    const payload = {
      answers: (test?.questions || []).map((q) => ({
        questionId: q.id,
        selected: answers[q.id] || null,
      })),
    };

    try {
      const res = await fetch(`/api/tests/${id}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Submission failed.');
        submittedRef.current = false;
        setSubmitting(false);
        return;
      }
      setResult(data);
      window.scrollTo({ top: 0 });
    } catch {
      alert('Network error — please try again.');
      submittedRef.current = false;
      setSubmitting(false);
    }
  }, [answers, id, test]);

  // ---- countdown ----
  useEffect(() => {
    if (!test || result || timeLeft === null) return;
    if (timeLeft <= 0) {
      submit();
      return;
    }
    const t = setTimeout(() => setTimeLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [timeLeft, test, result, submit]);

  // ---- AI explanations (after submission) ----
  const explainOne = useCallback(
    async (questionId) => {
      if (explanations[questionId] || pendingIds.includes(questionId)) return;
      setPendingIds((ids) => [...ids, questionId]);
      try {
        const res = await fetch('/api/ai/explain', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ questionId, testId: id }),
        });
        const data = await res.json();
        setExplanations((e) => ({
          ...e,
          [questionId]:
            data.explanation || data.error || 'No explanation available right now.',
        }));
      } catch {
        setExplanations((e) => ({
          ...e,
          [questionId]: 'Could not reach the AI — please try again.',
        }));
      } finally {
        setPendingIds((ids) => ids.filter((x) => x !== questionId));
      }
    },
    [explanations, pendingIds, id]
  );

  const explainAll = useCallback(async () => {
    if (explainingAll || !result) return;
    setExplainingAll(true);
    for (const r of result.review) {
      // sequential so a slow/local model isn't overwhelmed
      // eslint-disable-next-line no-await-in-loop
      await explainOne(r.questionId);
    }
    setExplainingAll(false);
  }, [explainingAll, result, explainOne]);

  // ------------------------------------------------------------- states

  if (loading) {
    return (
      <Shell>
        <div className="space-y-4" aria-label="Loading test">
          <div className="bg-white border border-slate-200 rounded-2xl p-4 flex items-center justify-between">
            <div className="space-y-2">
              <div className="skeleton h-4 w-48" />
              <div className="skeleton h-3 w-32" />
            </div>
            <div className="skeleton h-9 w-24" />
          </div>
          <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
            <div className="skeleton h-4 w-full max-w-md" />
            <div className="skeleton h-4 w-3/4" />
            <div className="pt-3 space-y-2.5">
              <div className="skeleton h-11 w-full" />
              <div className="skeleton h-11 w-full" />
              <div className="skeleton h-11 w-full" />
              <div className="skeleton h-11 w-full" />
            </div>
          </div>
        </div>
      </Shell>
    );
  }

  if (loadError || !test) {
    return (
      <Shell>
        <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center">
          <HelpCircle className="w-10 h-10 mx-auto text-slate-400" aria-hidden />
          <p className="mt-3 text-slate-700">{loadError || 'Test not found.'}</p>
          <button
            onClick={() => router.push('/student')}
            className="mt-5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-5 py-2.5 rounded-lg text-sm"
          >
            Back to dashboard
          </button>
        </div>
      </Shell>
    );
  }

  // ---- attempt limit reached ----
  if (!result && test.attemptsLeft === 0) {
    return (
      <Shell>
        <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center">
          <Ban className="w-10 h-10 mx-auto text-red-500" aria-hidden />
          <h2 className="mt-3 text-xl font-bold text-slate-900">You&apos;ve used all your attempts</h2>
          <p className="mt-2 text-slate-600 text-sm">
            {test.isPractice
              ? 'Practice tests have unlimited retakes — refresh and try again.'
              : `This test allows ${test.maxAttempts} attempt${test.maxAttempts === 1 ? '' : 's'} and you&apos;ve taken them all. Your teacher decides if more are allowed.`}
          </p>
          <button
            onClick={() => router.push('/student')}
            className="mt-5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-5 py-2.5 rounded-lg text-sm"
          >
            Back to dashboard
          </button>
        </div>
      </Shell>
    );
  }

  // ---- result view ----
  if (result) {
    const pct = result.total > 0 ? Math.round((result.score / result.total) * 100) : 0;
    const passing = result.passingPercentage ?? 40;
    const passed = result.passed ?? pct >= passing;

    // celebrate a pass (client-side only, fails silently)
    if (passed && typeof window !== 'undefined') {
      import('canvas-confetti')
        .then((mod) =>
          mod.default({
            particleCount: 130,
            spread: 80,
            origin: { y: 0.7 },
            colors: ['#4f46e5', '#10b981', '#f59e0b', '#6366f1'],
          })
        )
        .catch(() => {});
    }
    return (
      <Shell>
        <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 text-center">
          <p className="text-5xl" aria-hidden>
            {passed ? (
              <PartyPopper className="w-10 h-10 text-emerald-500" aria-hidden />
            ) : pct >= passing / 2 ? (
              <Dumbbell className="w-10 h-10 text-amber-500" aria-hidden />
            ) : (
              <BookOpen className="w-10 h-10 text-indigo-500" aria-hidden />
            )}
          </p>
          <p
            className={`mt-3 inline-flex px-4 py-1.5 rounded-full text-sm font-bold ${
              passed ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
            }`}
          >
            {passed ? (
              <>
                <CheckCircle2 className="w-4 h-4 inline" aria-hidden /> PASSED
              </>
            ) : (
              <>
                <XCircle className="w-4 h-4 inline" aria-hidden /> FAILED
              </>
            )}
          </p>
          <h1 className="mt-3 text-2xl font-bold text-slate-900">
            You scored {result.score} out of {result.total}
          </h1>
          <p className="text-slate-600 mt-1">
            {pct}% — each question carries 1 mark · passing at {passing}%
          </p>
          <p className="text-xs text-slate-400 mt-1">“{test.title}”</p>
          <button
            onClick={() => router.push('/student')}
            className="mt-5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-5 py-2.5 rounded-lg text-sm"
          >
            Back to dashboard
          </button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 mt-8 mb-3">
          <h2 className="font-bold text-slate-900">Review &amp; AI explanations</h2>
          <button
            onClick={explainAll}
            disabled={explainingAll || result.review.every((r) => explanations[r.questionId])}
            className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-lg"
          >
            {explainingAll
              ? `Explaining… (${Object.keys(explanations).length}/${result.review.length})`
              : result.review.every((r) => explanations[r.questionId])
                ? (
                    <>
                      <CheckCheck className="w-4 h-4 inline" aria-hidden /> All explained
                    </>
                  )
                : (
                    <>
                      <Sparkles className="w-4 h-4 inline" aria-hidden /> Explain all answers
                    </>
                  )}
          </button>
        </div>
        <div className="space-y-4">
          {result.review.map((r, i) => (
            <ReviewCard
              key={r.questionId}
              index={i}
              r={r}
              explanation={explanations[r.questionId]}
              busy={pendingIds.includes(r.questionId)}
              onExplain={() => explainOne(r.questionId)}
            />
          ))}
        </div>
      </Shell>
    );
  }

  // ---- test view ----
  const q = test.questions[current];
  const answeredCount = Object.keys(answers).length;
  const lowTime = timeLeft !== null && timeLeft <= 60;

  return (
    <Shell>
      {/* Header bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 sticky top-16 z-10 shadow-sm">
        <div>
          <p className="font-bold text-slate-900">
            {test.isPractice && (
              <span className="mr-1 text-[10px] font-bold bg-sky-100 text-sky-700 rounded-full px-2 py-0.5 align-middle">
                PRACTICE
              </span>
            )}
            {test.title}
          </p>
          <p className="text-xs text-slate-500">
            Question {current + 1} of {test.questions.length} · {answeredCount} answered
            {test.attemptsLeft === null
              ? ' · unlimited retakes'
              : test.attemptsLeft > 0
                ? ` · ${test.attemptsLeft} attempt${test.attemptsLeft === 1 ? '' : 's'} left`
                : ''}
          </p>
        </div>
        <div
          className={`font-mono text-xl font-bold px-4 py-1.5 rounded-lg ${
            lowTime ? 'bg-red-100 text-red-700 animate-pulse' : 'bg-slate-100 text-slate-800'
          }`}
          aria-live="polite"
        >
          <Timer className="w-4 h-4 inline" aria-hidden /> {fmtTime(timeLeft ?? 0)}
        </div>
      </div>

      {/* Progress dots */}
      <div className="flex flex-wrap gap-1.5 mt-4">
        {test.questions.map((qq, i) => (
          <button
            key={qq.id}
            onClick={() => setCurrent(i)}
            aria-label={`Go to question ${i + 1}`}
            className={`w-8 h-8 rounded-lg text-xs font-bold transition-colors ${
              i === current
                ? 'bg-indigo-600 text-white'
                : answers[qq.id]
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
            }`}
          >
            {i + 1}
          </button>
        ))}
      </div>

      {/* Question */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 mt-4 shadow-sm">
        <p className="text-lg font-medium text-slate-900 leading-relaxed">
          {current + 1}. {q.questionText}
        </p>
        <div className="mt-5 space-y-2.5">
          {q.options.map((opt, j) => {
            const selected = answers[q.id] === LETTERS[j];
            return (
              <label
                key={j}
                className={`flex items-center gap-3 border rounded-xl px-4 py-3 cursor-pointer transition-colors ${
                  selected
                    ? 'border-indigo-500 bg-indigo-50'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <input
                  type="radio"
                  name={`q-${q.id}`}
                  checked={selected}
                  onChange={() => setAnswers((a) => ({ ...a, [q.id]: LETTERS[j] }))}
                  className="accent-indigo-600"
                />
                <span className="text-sm text-slate-800">
                  <strong className="mr-1.5">{LETTERS[j]})</strong>
                  {opt}
                </span>
              </label>
            );
          })}
        </div>
      </div>

      {/* Nav */}
      <div className="flex items-center justify-between gap-3 mt-5">
        <button
          onClick={() => setCurrent((c) => Math.max(0, c - 1))}
          disabled={current === 0}
          className="bg-white border border-slate-300 disabled:opacity-40 text-slate-700 font-semibold text-sm px-5 py-2.5 rounded-lg"
        >
          ← Previous
        </button>

        {current < test.questions.length - 1 ? (
          <button
            onClick={() => setCurrent((c) => Math.min(test.questions.length - 1, c + 1))}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm px-5 py-2.5 rounded-lg"
          >
            Next →
          </button>
        ) : (
          <button
            onClick={() => {
              if (
                confirm(
                  `Submit the test? You answered ${answeredCount} of ${test.questions.length} questions.`
                )
              ) {
                submit();
              }
            }}
            disabled={submitting}
            className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold text-sm px-5 py-2.5 rounded-lg"
          >
            {submitting ? 'Submitting…' : '✓ Submit test'}
          </button>
        )}
      </div>

      <p className="text-center text-xs text-slate-400 mt-4">
        The test submits automatically when the timer reaches zero.
      </p>
    </Shell>
  );
}

function Shell({ children }) {
  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
      <Link href="/student" className="text-sm font-medium text-slate-500 hover:text-slate-800">
        ← Dashboard
      </Link>
      <div className="mt-4">{children}</div>
    </main>
  );
}

function ReviewCard({ index, r, explanation, busy, onExplain }) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5">
      <div className="flex items-start gap-3">
        <span
          className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold ${
            r.isCorrect ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
          }`}
        >
          {r.isCorrect ? '✓' : '✕'}
        </span>
        <div className="flex-1">
          <p className="font-medium text-slate-900">
            {index + 1}. {r.questionText}
          </p>

          <div className="mt-3 grid gap-1.5">
            {r.options.map((opt, j) => {
              const letter = LETTERS[j];
              const isCorrect = letter === r.correctAnswer;
              const isSelected = letter === r.selected;
              return (
                <p
                  key={j}
                  className={`text-sm px-3 py-2 rounded-lg border ${
                    isCorrect
                      ? 'border-emerald-300 bg-emerald-50 text-emerald-800 font-medium'
                      : isSelected
                        ? 'border-red-300 bg-red-50 text-red-800'
                        : 'border-slate-200 text-slate-600'
                  }`}
                >
                  {letter}) {opt}
                  {isCorrect && ' ✓'}
                  {isSelected && !isCorrect && ' ← your answer'}
                </p>
              );
            })}
            {r.selected === null && (
              <p className="text-xs text-slate-400">You did not answer this question.</p>
            )}
          </div>

          {explanation ? (
            <div className="mt-3 bg-indigo-50 border border-indigo-200 rounded-xl p-4">
              <p className="flex items-center gap-1.5 text-xs font-bold text-indigo-800 uppercase tracking-wide mb-1">
                <Bot className="w-3.5 h-3.5" aria-hidden /> AI explanation
              </p>
              <p className="text-sm text-slate-800 leading-relaxed">{explanation}</p>
            </div>
          ) : (
            <button
              onClick={onExplain}
              disabled={busy}
              className="mt-3 text-sm font-semibold text-indigo-700 hover:bg-indigo-50 border border-indigo-200 rounded-lg px-3 py-1.5 disabled:opacity-50"
            >
              {busy ? 'Thinking…' : (
                <>
                  <Sparkles className="w-4 h-4 inline" aria-hidden /> Explain with AI
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
