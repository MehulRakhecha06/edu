/**
 * Tests.
 *   GET  — list tests with question counts (any signed-in user;
 *          students need this to see available tests)
 *   POST — create a test from a parsed document (teacher/admin)
 */

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { createTestSchema, toNptWindow } from '@/lib/validators';

export const runtime = 'nodejs';

function isTeacherOrAdmin(role) {
  return role === 'TEACHER' || role === 'TEACHERS' || role === 'ADMIN';
}

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  try {
    const tests = await db.listTests();
    const enriched = await Promise.all(
      tests.map(async (t) => {
        const questions = await db.getQuestionsByIds(t.questionIds);
        return {
          id: t.id,
          title: t.title,
          timeLimitMinutes: t.timeLimitMinutes,
          passingPercentage: t.passingPercentage ?? 40,
          createdAt: t.createdAt,
          questionCount: t.questionIds.length,
          parsedCount: questions.length,
        };
      })
    );
    return NextResponse.json({ tests: enriched });
  } catch (err) {
    console.error('[tests GET]', err?.message);
    return NextResponse.json({ error: 'Failed to load tests' }, { status: 500 });
  }
}

export async function POST(request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }
  if (!isTeacherOrAdmin(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  // Naive datetime-local strings (no timezone) are Nepal wall-clock time —
  // normalize them to full ISO BEFORE validation so the stored instant is
  // correct no matter which client called the API.
  if (body && typeof body === 'object') {
    body = {
      ...body,
      availableFrom: toNptWindow(body.availableFrom),
      availableTo: toNptWindow(body.availableTo),
    };
  }

  const parsed = createTestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || 'Invalid input' },
      { status: 400 }
    );
  }

  const { title, questionCount, timeLimitMinutes, passingPercentage, maxAttempts, isPractice, availableFrom, availableTo } = parsed.data;

  // Accept one id (documentId) or many (documentIds); always work with a list
  const docIds = [
    ...new Set(parsed.data.documentIds?.length ? parsed.data.documentIds : [parsed.data.documentId]),
  ].filter(Boolean);

  try {
    // Gather the question pool of every selected bank
    const pools = [];
    for (const id of docIds) {
      const doc = await db.getDocument(id);
      if (!doc) {
        return NextResponse.json({ error: 'Question bank not found' }, { status: 404 });
      }
      const questions = (await db.listQuestions(id)).filter(
        (q) => (q.status || 'approved') === 'approved' && q.correctAnswer
      );
      if (questions.length === 0) {
        return NextResponse.json(
          { error: `"${doc.filename}" has no approved questions yet. Extract questions and approve them in the bank's review page first.` },
          { status: 400 }
        );
      }
      // shuffle inside each subject so the round-robin below is random but balanced
      pools.push(questions.slice().sort(() => Math.random() - 0.5));
    }
    // also shuffle the pools themselves (start order random)
    pools.sort(() => Math.random() - 0.5);

    const totalAvailable = pools.reduce((sum, p) => sum + p.length, 0);
    const n = Math.min(questionCount, totalAvailable);

    // BALANCED selection: round-robin across the banks so multiple subjects
    // get a fair share of the questions (e.g. 10 questions from 2 subjects -> 5+5)
    // DUPLICATE DETECTION: the same question appearing in several banks (e.g.
    // the same exercise uploaded twice) is skipped — only the first copy is used.
    const normalize = (t) =>
      String(t || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const seen = new Set();
    const selected = [];
    let duplicatesSkipped = 0;
    let exhausted = false;
    while (selected.length < n && !exhausted) {
      exhausted = true;
      for (const pool of pools) {
        if (selected.length >= n) break;
        const q = pool.pop();
        if (q) {
          exhausted = false;
          const key = normalize(q.questionText);
          if (key && seen.has(key)) {
            duplicatesSkipped += 1;
            continue; // same question text already picked from another bank
          }
          if (key) seen.add(key);
          selected.push(q);
        }
      }
    }
    // if duplicates shrank the pool, top up with any remaining unseen questions
    if (selected.length < n) {
      for (const pool of pools) {
        for (const q of pool) {
          if (selected.length >= n) break;
          const key = normalize(q.questionText);
          if (key && seen.has(key)) { duplicatesSkipped += 1; continue; }
          if (key) seen.add(key);
          selected.push(q);
        }
        if (selected.length >= n) break;
      }
    }

    const test = await db.createTest({
      title,
      documentId: docIds[0],
      documentIds: docIds,
      createdBy: session.user.id,
      timeLimitMinutes,
      passingPercentage,
      maxAttempts,
      isPractice,
      availableFrom: availableFrom || null,
      availableTo: availableTo || null,
      questionIds: selected.map((q) => q.id),
    });

    const notes = [];
    if (selected.length < questionCount) {
      notes.push(
        `Only ${selected.length} questions were available across the selected banks — all of them were used.`
      );
    }
    if (duplicatesSkipped > 0) {
      notes.push(
        `${duplicatesSkipped} duplicate question${duplicatesSkipped === 1 ? ' was' : 's were'} found across the selected banks and skipped.`
      );
    }

    return NextResponse.json({
      ok: true,
      test: {
        id: test.id,
        title: test.title,
        questionCount: test.questionIds.length,
        timeLimitMinutes: test.timeLimitMinutes,
        passingPercentage: test.passingPercentage,
        maxAttempts: test.maxAttempts,
        isPractice: test.isPractice,
      },
      note: notes.length > 0 ? notes.join(' ') : null,
    });
  } catch (err) {
    console.error('[tests POST]', err?.message);
    return NextResponse.json({ error: 'Could not create the test' }, { status: 500 });
  }
}
