/**
 * "Ask your materials" — grounded chat over the uploaded question banks.
 *   POST /api/assistant/grounded  { query }   (teacher/admin only)
 *
 * Retrieval is dependency-free BM25 (lib/retrieval.js) — instant on any
 * hardware — and the AI only WRITES the answer from the found passages,
 * so it stays grounded in the teachers' actual content.
 */

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { groundedReply } from '@/lib/ai';
import { buildRetrievalIndex, searchIndex, makeSnippet } from '@/lib/retrieval';
import { rateLimit, requestIp } from '@/lib/rate-limit';

export const runtime = 'nodejs';
export const maxDuration = 120;

function isTeacherOrAdmin(role) {
  return role === 'TEACHER' || role === 'TEACHERS' || role === 'ADMIN';
}

export async function POST(request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }
  if (!isTeacherOrAdmin(session.user.role)) {
    return NextResponse.json(
      { error: 'Ask-your-materials is a teacher tool.' },
      { status: 403 }
    );
  }

  const rl = rateLimit(`grounded:${requestIp(request)}`, {
    limit: 20,
    windowMs: 10 * 60_000,
  });
  if (!rl.ok) {
    return NextResponse.json(
      { error: 'Too many questions — please wait a moment.' },
      { status: 429 }
    );
  }

  let query = '';
  try {
    const body = await request.json();
    query = String(body?.query || '').trim();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }
  if (query.length < 3 || query.length > 500) {
    return NextResponse.json(
      { error: 'Please ask a question between 3 and 500 characters.' },
      { status: 400 }
    );
  }

  try {
    const docs = await db.listDocumentsForRetrieval();
    const index = buildRetrievalIndex(docs);
    if (index.length === 0) {
      return NextResponse.json({
        reply:
          'No searchable materials yet — upload a question bank (PDF, Word or text) first, then ask again.',
        passages: [],
        source: 'none',
      });
    }

    const hits = searchIndex(index, query, 5);
    if (hits.length === 0) {
      return NextResponse.json({
        reply:
          'Nothing in the uploaded banks matches those words. Try different wording, or check that the relevant bank has been uploaded.',
        passages: [],
        source: 'none',
      });
    }

    const passages = hits.map((h) => ({
      filename: h.filename,
      subject: h.subject,
      snippet: makeSnippet(h.text, query),
      text: h.text, // full passage — used for the AI, not returned to the browser
    }));

    let answer = await groundedReply(query, passages);
    if (!answer) {
      // No AI configured — the passages alone are still genuinely useful.
      const list = passages
        .map((p) => `• [${p.filename}] ${p.snippet}`)
        .join('\n');
      return NextResponse.json({
        reply: `No AI is configured right now, but here are the matching passages from your banks:\n${list}`,
        passages: passages.map(({ text, ...rest }) => rest),
        source: 'fallback',
      });
    }

    return NextResponse.json({
      reply: answer.reply,
      passages: passages.map(({ text, ...rest }) => rest),
      source: answer.source,
    });
  } catch (err) {
    console.error('[grounded]', err?.message);
    return NextResponse.json(
      { error: 'Something went wrong — please try again.' },
      { status: 500 }
    );
  }
}
