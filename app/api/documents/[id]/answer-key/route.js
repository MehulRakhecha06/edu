/**
 * AI answer-key completion: fill in missing answers (draft questions) of a
 * document. The teacher reviews the result in the bank's review page.
 *   POST /api/documents/[id]/answer-key  (teacher/admin)
 */

import { collectAnswerKeyExcerpt } from '@/lib/mcq';
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { isUuid } from '@/lib/validators';
import { completeAnswerKey, getAiInfo } from '@/lib/ai';
import { rateLimit, requestIp } from '@/lib/rate-limit';

export const runtime = 'nodejs';
export const maxDuration = 120;

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

  const rl = rateLimit(`answerkey:${requestIp(request)}`, { limit: 10, windowMs: 10 * 60_000 });
  if (!rl.ok) {
    return NextResponse.json({ error: 'Too many requests. Please wait a bit.' }, { status: 429 });
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

    const questions = await db.listQuestions(id);
    const drafts = questions.filter((q) => !q.correctAnswer);
    if (drafts.length === 0) {
      return NextResponse.json(
        { error: 'All questions in this bank already have answers.' },
        { status: 400 }
      );
    }

    // The Python service is OPTIONAL — any configured cloud provider
    // (Groq, Mistral, Gemini…) completes the key without it.
    const aiInfo = await getAiInfo();
    if (aiInfo.provider === 'fallback') {
      return NextResponse.json(
        {
          error:
            'No AI provider is configured. Set one up in Admin → AI Settings — a cloud API (Groq, Mistral, Gemini…) works without the Python service — or fill the answers manually in the review page.',
        },
        { status: 502 }
      );
    }

    let answers;
    try {
      answers = await completeAnswerKey(drafts, {
        answerContext: collectAnswerKeyExcerpt(doc.rawText),
        timeoutMs: 120_000,
      });
    } catch (err) {
      // the message already says exactly what broke (HTTP 401/402/429,
      // unreachable URL, timeout…) and what to do about it
      return NextResponse.json(
        { error: `The AI could not complete the answer key — ${err?.message || 'unknown error'}. Fix it in Admin → AI Settings, or fill the answers manually in the review page.` },
        { status: 502 }
      );
    }
    if (!answers || answers.length === 0) {
      return NextResponse.json(
        {
          error:
            'The AI replied but with no usable answers — try again, or fill the answers manually in the review page.',
        },
        { status: 502 }
      );
    }

    let filled = 0;
    for (const a of answers) {
      const q = drafts[a.index];
      if (!q) continue;
      const updated = await db.updateQuestion(q.id, { correctAnswer: a.answer });
      if (updated) filled += 1;
    }

    return NextResponse.json({
      ok: true,
      filled,
      remaining: drafts.length - filled,
    });
  } catch (err) {
    console.error('[documents/answer-key POST]', err?.message);
    return NextResponse.json({ error: 'Could not complete the answer key' }, { status: 500 });
  }
}
