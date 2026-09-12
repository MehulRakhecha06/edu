/**
 * Create a manual question bank (no file) — the teacher types questions
 * directly in the bank's review page afterwards.
 *   POST /api/documents/manual  {title, subject?, chapter?}  (teacher/admin)
 */

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { manualBankSchema } from '@/lib/validators';
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

  const rl = rateLimit(`manualbank:${requestIp(request)}`, { limit: 20, windowMs: 10 * 60_000 });
  if (!rl.ok) {
    return NextResponse.json({ error: 'Too many requests. Please wait a bit.' }, { status: 429 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const parsed = manualBankSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || 'Invalid input' },
      { status: 400 }
    );
  }

  try {
    const doc = await db.createDocument({
      filename: parsed.data.title,
      subject: parsed.data.subject || 'General',
      chapter: parsed.data.chapter || '',
      rawText: '',
      fileKind: 'manual',
      uploadedBy: session.user.id,
    });
    return NextResponse.json({
      ok: true,
      document: {
        id: doc.id,
        filename: doc.filename,
        subject: doc.subject,
        chapter: doc.chapter,
        uploadedAt: doc.uploadedAt,
      },
    });
  } catch (err) {
    console.error('[documents/manual POST]', err?.message);
    return NextResponse.json({ error: 'Could not create the bank' }, { status: 500 });
  }
}
