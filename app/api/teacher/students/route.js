/**
 * Student progress overview for teachers/admins.
 *   GET /api/teacher/students — every student with their aggregate stats
 *   GET /api/teacher/students?id=<id> — one student's full attempt history
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
  if (!isTeacherOrAdmin(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const studentId = new URL(request.url).searchParams.get('id');

  try {
    const [users, attempts, tests] = await Promise.all([
      db.listUsers(),
      db.listAttempts(),
      db.listTests(),
    ]);
    const testById = new Map(tests.map((t) => [t.id, t]));
    const students = users.filter((u) => (u.role || 'STUDENT') === 'STUDENT');

    const byStudent = new Map();
    for (const a of attempts) {
      if (!byStudent.has(a.studentId)) byStudent.set(a.studentId, []);
      byStudent.get(a.studentId).push(a);
    }

    // Single student detail: full attempt history
    if (studentId) {
      const student = students.find((u) => u.id === studentId);
      if (!student) {
        return NextResponse.json({ error: 'Student not found' }, { status: 404 });
      }
      const history = (byStudent.get(studentId) || [])
        .slice()
        .sort((x, y) => new Date(y.finishedAt) - new Date(x.finishedAt))
        .map((a) => {
          const test = testById.get(a.testId);
          const passing = test?.passingPercentage ?? 40;
          const percentage = a.total > 0 ? Math.round((a.score / a.total) * 100) : 0;
          return {
            testId: a.testId,
            testTitle: test?.title || 'Deleted test',
            isPractice: Boolean(test?.isPractice),
            score: a.score,
            total: a.total,
            percentage,
            passed: percentage >= passing,
            finishedAt: a.finishedAt,
          };
        });
      return NextResponse.json({ student: { id: student.id, name: student.name, email: student.email }, history });
    }

    // Overview: aggregate per student
    const overview = students.map((u) => {
      const mine = (byStudent.get(u.id) || []).filter((a) => !testById.get(a.testId)?.isPractice);
      const percentages = mine
        .filter((a) => a.total > 0)
        .map((a) => (a.score / a.total) * 100);
      const avg = percentages.length
        ? Math.round(percentages.reduce((s2, v) => s2 + v, 0) / percentages.length)
        : null;
      const last = mine
        .slice()
        .sort((x, y) => new Date(y.finishedAt) - new Date(x.finishedAt))[0];
      return {
        id: u.id,
        name: u.name,
        email: u.email,
        testsTaken: mine.length,
        averageScore: avg,
        passedCount: mine.filter((a) => {
          const passing = testById.get(a.testId)?.passingPercentage ?? 40;
          return a.total > 0 && (a.score / a.total) * 100 >= passing;
        }).length,
        lastActivity: last?.finishedAt || null,
      };
    });

    // most active first, then name
    overview.sort((a, b) => (b.testsTaken - a.testsTaken) || a.name.localeCompare(b.name));
    return NextResponse.json({ students: overview });
  } catch (err) {
    console.error('[teacher/students GET]', err?.message);
    return NextResponse.json({ error: 'Failed to load student progress' }, { status: 500 });
  }
}
