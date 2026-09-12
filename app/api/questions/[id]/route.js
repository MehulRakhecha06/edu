/**
 * Edit / approve / delete a single question (teacher/admin).
 *   PATCH  /api/questions/[id]  {questionText?, options?, correctAnswer?, status?}
 *   DELETE /api/questions/[id]
 */

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { isUuid } from '@/lib/validators';
import { db } from '@/lib/db';
import { updateQuestionSchema } from '@/lib/validators';

export const runtime = 'nodejs';

function isTeacherOrAdmin(role) {
  return role === 'TEACHER' || role === 'TEACHERS' || role === 'ADMIN';
}

export async function PATCH(request, { params }) {
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

  const parsed = updateQuestionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || 'Invalid input' },
      { status: 400 }
    );
  }

  const { id } = await params;
  if (!isUuid(id)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  try {
    const updated = await db.updateQuestion(id, parsed.data);
    if (!updated) {
      return NextResponse.json({ error: 'Question not found' }, { status: 404 });
    }
    return NextResponse.json({ ok: true, question: updated });
  } catch (err) {
    console.error('[questions PATCH]', err?.message);
    return NextResponse.json({ error: 'Could not update the question' }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }
  if (!isTeacherOrAdmin(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  if (!isUuid(id)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  try {
    const deleted = await db.deleteQuestion(id);
    if (!deleted) {
      return NextResponse.json({ error: 'Question not found' }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[questions DELETE]', err?.message);
    return NextResponse.json({ error: 'Could not delete the question' }, { status: 500 });
  }
}
