/**
 * Public student self-registration.
 * Role is hardcoded to STUDENT — teachers and admins are created by the
 * admin from /admin. Rate limited to stop abuse.
 *
 * Anti-enumeration: a registration with an ALREADY-USED email returns the
 * exact same response (status, body, timing) as a successful one. The
 * existing account is untouched. (Admin-side flows DO report duplicates —
 * the admin is a trusted role and needs actionable errors.)
 */

import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { db } from '@/lib/db';
import { registerSchema } from '@/lib/validators';
import { rateLimit, requestIp } from '@/lib/rate-limit';

export const runtime = 'nodejs';

export async function POST(request) {
  const ip = requestIp(request);
  // 20 signups / 15 min per IP: generous enough for a whole class behind one
  // school network, still blocks scripted abuse.
  const rl = rateLimit(`register:${ip}`, { limit: 20, windowMs: 15 * 60_000 });
  if (!rl.ok) {
    return NextResponse.json(
      { error: 'Too many registration attempts. Try again later.' },
      { status: 429 }
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || 'Invalid input' },
      { status: 400 }
    );
  }

  try {
    // NOTE: the password is hashed BEFORE the duplicate check runs, so both
    // paths (created / already-taken) spend the same ~300ms in bcrypt —
    // response timing can't reveal whether the email exists.
    const passwordHash = await bcrypt.hash(parsed.data.password, 12);
    await db.createUser({
      email: parsed.data.email,
      name: parsed.data.name,
      passwordHash,
      role: 'STUDENT', // always — public signup can never create teachers/admins
    });

    // ANTI-ENUMERATION: the response is IDENTICAL whether the account was
    // created or the email was already taken (see the catch below) — an
    // outsider cannot probe which emails have accounts.
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err?.code === 'EMAIL_TAKEN') {
      // Same response as success; the bcrypt hash above already ran, so the
      // timing matches too. The existing account is left untouched.
      return NextResponse.json({ ok: true });
    }
    console.error('[register]', err?.message);
    return NextResponse.json({ error: 'Could not create the account' }, { status: 500 });
  }
}
