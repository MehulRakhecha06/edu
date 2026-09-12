/**
 * AI explanation for one question — students call this AFTER submitting a
 * test (so the answer is already known to them; no cheating vector).
 * The question is looked up server-side from the test — the client only
 * sends ids, never the text.
 */

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { explainSchema } from '@/lib/validators';
import { explainQuestion } from '@/lib/ai';
import { rateLimit, requestIp } from '@/lib/rate-limit';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const rl = rateLimit(`explain:${requestIp(request)}`, { limit: 30, windowMs: 5 * 60_000 });
  if (!rl.ok) {
    return NextResponse.json(
      { error: 'Too many explanation requests. Please wait a moment.' },
      { status: 429 }
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const parsed = explainSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
  }

  try {
    const test = await db.getTest(parsed.data.testId);
    if (!test) {
      return NextResponse.json({ error: 'Test not found' }, { status: 404 });
    }
    if (!test.questionIds.includes(parsed.data.questionId)) {
      return NextResponse.json({ error: 'Question not part of this test' }, { status: 400 });
    }

    const questions = await db.getQuestionsByIds([parsed.data.questionId]);
    const q = questions[0];
    if (!q) {
      return NextResponse.json({ error: 'Question not found' }, { status: 404 });
    }

    const result = await explainQuestion({
      question: q.questionText,
      options: q.options,
      correctAnswer: q.correctAnswer,
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error('[explain]', err?.message);
    return NextResponse.json({ error: 'Explanation failed' }, { status: 500 });
  }
}
