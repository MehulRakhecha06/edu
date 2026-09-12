/**
 * Admin user management.
 *   GET  — list all users (admin only)
 *   POST — create a user with any role (admin only)
 */

import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { createUserSchema } from '@/lib/validators';
import { rateLimit, requestIp } from '@/lib/rate-limit';

export const runtime = 'nodejs';

export async function GET() {
  const session = await auth();
  if (session?.user?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const users = await db.listUsers();
    return NextResponse.json({
      users: users.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        createdAt: u.createdAt,
      })),
    });
  } catch (err) {
    console.error('[admin users GET]', err?.message);
    return NextResponse.json({ error: 'Failed to load users' }, { status: 500 });
  }
}

export async function POST(request) {
  const session = await auth();
  if (session?.user?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const rl = rateLimit(`admin-create:${requestIp(request)}`, { limit: 30, windowMs: 10 * 60_000 });
  if (!rl.ok) {
    return NextResponse.json({ error: 'Too many requests. Please wait.' }, { status: 429 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const parsed = createUserSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || 'Invalid input' },
      { status: 400 }
    );
  }

  try {
    const passwordHash = await bcrypt.hash(parsed.data.password, 12);
    const user = await db.createUser({ ...parsed.data, passwordHash });

    return NextResponse.json({
      ok: true,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    });
  } catch (err) {
    if (err?.code === 'EMAIL_TAKEN') {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    console.error('[admin users POST]', err?.message);
    return NextResponse.json({ error: 'Could not create the user' }, { status: 500 });
  }
}
