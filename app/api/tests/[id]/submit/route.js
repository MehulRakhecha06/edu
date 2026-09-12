/**
 * Submit a test attempt (student).
 * Grades the answers server-side (the correct answers never leave the
 * server until after submission), stores the attempt, and returns the
 * score plus the full review data.
 */

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { isUuid } from '@/lib/validators';
import { db } from '@/lib/db';
import { submitTestSchema } from '@/lib/validators';
import { rateLimit, requestIp } from '@/lib/rate-limit';

export const runtime = 'nodejs';

export async function POST(request, { params }) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const rl = rateLimit(`submit:${requestIp(request)}`, { limit: 20, windowMs: 10 * 60_000 });
  if (!rl.ok) {
    return NextResponse.json({ error: 'Too many submissions. Please wait.' }, { status: 429 });
  }

  const { id: testId } = await params;

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const parsed = submitTestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || 'Invalid input' },
      { status: 400 }
    );
  }

  try {
    const test = await db.getTest(testId);
    if (!test) {
      return NextResponse.json({ error: 'Test not found' }, { status: 404 });
    }

    // Scheduling: reject submissions outside the availability window
    const now = Date.now();
    if (test.availableFrom && now < new Date(test.availableFrom).getTime()) {
      return NextResponse.json({ error: 'This test is not open yet.' }, { status: 403 });
    }
    if (test.availableTo && now > new Date(test.availableTo).getTime()) {
      return NextResponse.json({ error: 'This test has closed.' }, { status: 403 });
    }

    // Retake policy: practice tests are always unlimited; otherwise the
    // teacher's maxAttempts limit applies (0 = unlimited).
    if (!test.isPractice) {
      const maxAttempts = test.maxAttempts ?? 1;
      if (maxAttempts > 0) {
        const used = (await db.listAttemptsByStudent(session.user.id)).filter(
          (a) => a.testId === testId
        ).length;
        if (used >= maxAttempts) {
          return NextResponse.json(
            {
              error: `You have already used all ${maxAttempts} attempt${maxAttempts === 1 ? '' : 's'} for this test.`,
            },
            { status: 409 }
          );
        }
      }
    }

    const questions = await db.getQuestionsByIds(test.questionIds);
    const byId = new Map(questions.map((q) => [q.id, q]));

    // Only grade answers that belong to THIS test — ignore anything else
    let score = 0;
    const review = [];

    for (const qid of test.questionIds) {
      const q = byId.get(qid);
      if (!q) continue;

      const submitted = parsed.data.answers.find((a) => a.questionId === qid);
      const selected = submitted?.selected || null;
      const isCorrect = selected !== null && selected === q.correctAnswer;
      if (isCorrect) score += 1;

      review.push({
        questionId: q.id,
        questionText: q.questionText,
        options: q.options,
        selected,
        correctAnswer: q.correctAnswer,
        isCorrect,
      });
    }

    const attempt = await db.saveAttempt({
      testId,
      studentId: session.user.id,
      score,
      total: review.length,
      answers: review.map((r) => ({
        questionId: r.questionId,
        selectedOption: r.selected,
        isCorrect: r.isCorrect,
      })),
    });

    const passing = test.passingPercentage ?? 40;
    const percentage = review.length > 0 ? Math.round((score / review.length) * 100) : 0;

    return NextResponse.json({
      ok: true,
      attemptId: attempt.id,
      score, // each question carries 1 mark
      total: review.length,
      percentage,
      passingPercentage: passing,
      passed: percentage >= passing,
      review,
    });
  } catch (err) {
    console.error('[submit]', err?.message);
    return NextResponse.json({ error: 'Submission failed' }, { status: 500 });
  }
}
