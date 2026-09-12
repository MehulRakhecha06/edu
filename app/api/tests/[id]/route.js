/**
 * GET one test.
 *   - Teacher/Admin: full details including correct answers.
 *   - Student: test WITHOUT correct answers (so they can't peek),
 *     plus whether they already attempted it.
 */

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { isUuid } from '@/lib/validators';

export const runtime = 'nodejs';

function isTeacherOrAdmin(role) {
  return role === 'TEACHER' || role === 'TEACHERS' || role === 'ADMIN';
}

export async function GET(request, { params }) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { id } = await params;
  if (!isUuid(id)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  try {
    const test = await db.getTest(id);
    if (!test) {
      return NextResponse.json({ error: 'Test not found' }, { status: 404 });
    }

    const questions = await db.getQuestionsByIds(test.questionIds);

    // Preserve the teacher's stored order
    const byId = new Map(questions.map((q) => [q.id, q]));
    const ordered = test.questionIds.map((qid) => byId.get(qid)).filter(Boolean);

    const now = Date.now();
    const opensAt = test.availableFrom ? new Date(test.availableFrom).getTime() : null;
    const closesAt = test.availableTo ? new Date(test.availableTo).getTime() : null;
    const schedule = {
      availableFrom: test.availableFrom || null,
      availableTo: test.availableTo || null,
      notOpenYet: opensAt !== null && now < opensAt,
      closed: closesAt !== null && now > closesAt,
    };

    const base = {
      id: test.id,
      title: test.title,
      timeLimitMinutes: test.timeLimitMinutes,
      passingPercentage: test.passingPercentage ?? 40,
      maxAttempts: test.maxAttempts ?? 1,
      isPractice: Boolean(test.isPractice),
      schedule,
      createdAt: test.createdAt,
      questionCount: ordered.length,
    };

    if (isTeacherOrAdmin(session.user.role)) {
      return NextResponse.json({
        test: {
          ...base,
          questions: ordered.map((q) => ({
            id: q.id,
            questionText: q.questionText,
            options: q.options,
            correctAnswer: q.correctAnswer,
          })),
        },
      });
    }

    // scheduling: students cannot start outside the availability window
    if (schedule.notOpenYet) {
      return NextResponse.json(
        { error: `This test is not open yet. It opens on ${new Date(test.availableFrom).toLocaleString()}.` },
        { status: 403 }
      );
    }
    if (schedule.closed) {
      return NextResponse.json(
        { error: `This test is closed — it ended on ${new Date(test.availableTo).toLocaleString()}.` },
        { status: 403 }
      );
    }

    // Student view — strip the answers, include their attempt usage
    const myAttempts = (await db.listAttemptsByStudent(session.user.id)).filter(
      (a) => a.testId === test.id
    );
    const maxAttempts = test.isPractice ? 0 : (test.maxAttempts ?? 1);
    return NextResponse.json({
      test: {
        ...base,
        attemptsUsed: myAttempts.length,
        attemptsLeft:
          maxAttempts === 0
            ? null // unlimited
            : Math.max(0, maxAttempts - myAttempts.length),
        questions: ordered.map((q) => ({
          id: q.id,
          questionText: q.questionText,
          options: q.options,
        })),
      },
    });
  } catch (err) {
    console.error('[test GET]', err?.message);
    return NextResponse.json({ error: 'Failed to load test' }, { status: 500 });
  }
}
