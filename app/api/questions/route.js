/**
 * Manual question entry.
 *   POST /api/questions  {documentId, questionText, options, correctAnswer?}  (teacher/admin)
 * Questions with an answer are approved immediately; without one they are
 * saved as pending drafts (complete the key later with AI or by editing).
 */

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { questionSchema } from '@/lib/validators';
import { rateLimit, requestIp } from '@/lib/rate-limit';

export const runtime = 'nodejs';

function isTeacherOrAdmin(role) {
  return role === 'TEACHER' || role === 'TEACHERS' || role === 'ADMIN';
}

export async function POST(request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }
  if (!isTeacherOrAdmin(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const rl = rateLimit(`addq:${requestIp(request)}`, { limit: 60, windowMs: 10 * 60_000 });
  if (!rl.ok) {
    return NextResponse.json({ error: 'Too many requests. Please wait a bit.' }, { status: 429 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const parsed = questionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || 'Invalid input' },
      { status: 400 }
    );
  }

  try {
    const doc = await db.getDocument(parsed.data.documentId);
    if (!doc) {
      return NextResponse.json({ error: 'Question bank not found' }, { status: 404 });
    }

    const q = await db.addQuestion({
      documentId: parsed.data.documentId,
      questionText: parsed.data.questionText,
      options: parsed.data.options,
      correctAnswer: parsed.data.correctAnswer || '',
      status: parsed.data.correctAnswer ? 'approved' : 'pending',
    });
    return NextResponse.json({ ok: true, question: q }, { status: 201 });
  } catch (err) {
    console.error('[questions POST]', err?.message);
    return NextResponse.json({ error: 'Could not add the question' }, { status: 500 });
  }
}
