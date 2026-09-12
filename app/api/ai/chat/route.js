/**
 * The bottom-right assistant chat. Public (guests can ask about the app),
 * rate limited, and sanitizes every message.
 */

import { NextResponse } from 'next/server';
import { chatSchema } from '@/lib/validators';
import { assistantReply } from '@/lib/ai';
import { rateLimit, requestIp } from '@/lib/rate-limit';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(request) {
  const rl = rateLimit(`chat:${requestIp(request)}`, { limit: 20, windowMs: 5 * 60_000 });
  if (!rl.ok) {
    return NextResponse.json(
      { error: 'You are sending messages too quickly. Please wait a moment.' },
      { status: 429 }
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const parsed = chatSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Message is empty or too long' }, { status: 400 });
  }

  try {
    const history = Array.isArray(body.history) ? body.history : [];
    const result = await assistantReply(parsed.data.message, history);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error('[chat]', err?.message);
    return NextResponse.json({ error: 'The assistant is unavailable right now.' }, { status: 500 });
  }
}
