/**
 * DELETE a document (and its questions) — teacher/admin only.
 */

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { isUuid } from '@/lib/validators';

export const runtime = 'nodejs';

function isTeacherOrAdmin(role) {
  return role === 'TEACHER' || role === 'TEACHERS' || role === 'ADMIN';
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
    // Only the uploading teacher (or an admin) may delete a bank — other
    // teachers can still USE it (parse, build tests) but not destroy it.
    const doc = await db.getDocument(id);
    if (!doc) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }
    const isOwner = doc.uploadedBy === session.user.id;
    const isAdmin = session.user.role === 'ADMIN';
    if (!isOwner && !isAdmin) {
      return NextResponse.json(
        { error: 'Only the teacher who uploaded this bank (or an admin) can delete it.' },
        { status: 403 }
      );
    }
    const ok = await db.deleteDocument(id);
    if (!ok) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[documents DELETE]', err?.message);
    return NextResponse.json({ error: 'Delete failed' }, { status: 500 });
  }
}
