/**
 * "Test connection" for the admin AI settings page.
 * Tests the values currently typed in the form — nothing is saved.
 */

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { aiTestSchema } from '@/lib/validators';
import { testProvider } from '@/lib/ai';
import { rateLimit, requestIp } from '@/lib/rate-limit';

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function POST(request) {
  const session = await auth();
  if (session?.user?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const rl = rateLimit(`ai-test:${requestIp(request)}`, { limit: 15, windowMs: 5 * 60_000 });
  if (!rl.ok) {
    return NextResponse.json({ error: 'Too many test requests. Please wait.' }, { status: 429 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const parsed = aiTestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || 'Invalid input' },
      { status: 400 }
    );
  }

  const result = await testProvider(parsed.data);
  return NextResponse.json(result);
}
