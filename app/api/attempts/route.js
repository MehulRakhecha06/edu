/**
 * Attempt history.
 *   GET — students see their own attempts; teachers/admins see all
 *         attempts (with student names) for the results dashboard.
 */

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

export const runtime = 'nodejs';

function isTeacherOrAdmin(role) {
  return role === 'TEACHER' || role === 'TEACHERS' || role === 'ADMIN';
}

export async function GET(request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  try {
    const role = session.user.role;
    const tests = await db.listTests();
    const testById = new Map(tests.map((t) => [t.id, t]));

    const decorate = (a) => {
      const test = testById.get(a.testId);
      const passing = test?.passingPercentage ?? 40;
      const percentage = a.total > 0 ? Math.round((a.score / a.total) * 100) : 0;
      return {
        id: a.id,
        testTitle: test?.title || 'Deleted test',
        isPractice: Boolean(test?.isPractice),
        passingPercentage: passing,
        score: a.score,
        total: a.total,
        percentage,
        passed: percentage >= passing,
        finishedAt: a.finishedAt,
      };
    };

    if (isTeacherOrAdmin(role)) {
      const [attempts, users] = await Promise.all([db.listAttempts(), db.listUsers()]);
      const userById = new Map(users.map((u) => [u.id, u]));
      return NextResponse.json({
        attempts: attempts.map((a) => ({
          ...decorate(a),
          studentName: userById.get(a.studentId)?.name || 'Unknown student',
          studentEmail: userById.get(a.studentId)?.email || '',
        })),
      });
    }

    const attempts = await db.listAttemptsByStudent(session.user.id);
    return NextResponse.json({
      attempts: attempts.map(decorate),
    });
  } catch (err) {
    console.error('[attempts GET]', err?.message);
    return NextResponse.json({ error: 'Failed to load attempts' }, { status: 500 });
  }
}
