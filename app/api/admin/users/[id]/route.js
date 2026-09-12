/**
 * Single-user admin operations (admin only).
 *   PATCH  — change someone's role (STUDENT / TEACHER / ADMIN)
 *   DELETE — remove the account (you cannot delete yourself)
 */

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { updateUserRoleSchema } from '@/lib/validators';

export const runtime = 'nodejs';

export async function PATCH(request, { params }) {
  const session = await auth();
  if (session?.user?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;

  if (id === session.user.id) {
    return NextResponse.json(
      { error: 'You cannot change your own role while signed in — ask another admin.' },
      { status: 400 }
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const parsed = updateUserRoleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || 'Invalid input' },
      { status: 400 }
    );
  }

  try {
    const user = await db.updateUserRole(id, parsed.data.role);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    return NextResponse.json({
      ok: true,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    });
  } catch (err) {
    console.error('[admin users PATCH]', err?.message);
    return NextResponse.json({ error: 'Could not update the role' }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  const session = await auth();
  if (session?.user?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;

  if (id === session.user.id) {
    return NextResponse.json(
      { error: 'You cannot delete your own account while signed in.' },
      { status: 400 }
    );
  }

  try {
    const target = await db.findUserById(id);
    if (!target) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    await db.deleteUser(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[admin users DELETE]', err?.message);
    return NextResponse.json({ error: 'Delete failed' }, { status: 500 });
  }
}
