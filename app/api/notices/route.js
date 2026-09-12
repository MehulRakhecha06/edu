/**
 * Notices (teacher announcements shown on the student dashboard).
 *   GET  — any signed-in user (students see them on their dashboard)
 *   POST — teacher/admin publishes a notice
 */

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { createNoticeSchema } from '@/lib/validators';
import { rateLimit, requestIp } from '@/lib/rate-limit';

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
    const notices = await db.listNotices();
    return NextResponse.json({
      notices: notices.map((n) => ({
        id: n.id,
        title: n.title,
        body: n.body,
        createdAt: n.createdAt,
      })),
    });
  } catch (err) {
    console.error('[notices GET]', err?.message);
    return NextResponse.json({ error: 'Failed to load notices' }, { status: 500 });
  }
}

export async function POST(request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }
  if (!isTeacherOrAdmin(session.user.role)) {
    return NextResponse.json({ error: 'Only teachers and admins can post notices' }, { status: 403 });
  }

  const rl = rateLimit(`notice:${requestIp(request)}`, { limit: 20, windowMs: 10 * 60_000 });
  if (!rl.ok) {
    return NextResponse.json({ error: 'Too many notices. Please wait a bit.' }, { status: 429 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const parsed = createNoticeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || 'Invalid input' },
      { status: 400 }
    );
  }

  try {
    const notice = await db.createNotice({
      title: parsed.data.title,
      body: parsed.data.body,
      createdBy: session.user.id,
    });
    return NextResponse.json({ ok: true, notice }, { status: 201 });
  } catch (err) {
    console.error('[notices POST]', err?.message);
    return NextResponse.json({ error: 'Could not publish the notice' }, { status: 500 });
  }
}
