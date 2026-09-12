/**
 * Approve all pending questions of a document ("review queue" bulk action).
 *   POST /api/documents/[id]/approve  (teacher/admin)
 */

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { isUuid } from '@/lib/validators';

export const runtime = 'nodejs';

function isTeacherOrAdmin(role) {
  return role === 'TEACHER' || role === 'TEACHERS' || role === 'ADMIN';
}

export async function POST(request, { params }) {
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
    const doc = await db.getDocument(id);
    if (!doc) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }
    const approved = await db.approveAllQuestions(id);
    return NextResponse.json({ ok: true, approved });
  } catch (err) {
    console.error('[documents/approve POST]', err?.message);
    return NextResponse.json({ error: 'Could not approve questions' }, { status: 500 });
  }
}
