/**
 * Extract MCQs from a document.
 *   0. Photos / scanned PDFs — no text: the AI service READS the pages (vision).
 *   1. Text documents — AI parsing first (questions copied verbatim).
 *   2. Deterministic fallback (needs an answer key in the text).
 *   3. Text PDF where no MCQs were found — vision retries from the page images.
 * Extracted questions REPLACE any previously stored ones for this document.
 */

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { isUuid } from '@/lib/validators';
import { parseQuestionsAI, parseQuestionsVision, getAiInfo, completeAnswerKey } from '@/lib/ai';
import {
  parseMcqs,
  parseMcqBlocks,
  validateQuestions,
  validateQuestionDrafts,
  collectAnswerKeyExcerpt,
} from '@/lib/mcq';

const normalizeText = (t) => String(t || '').toLowerCase().replace(/[^a-z0-9]/g, '');

async function countDuplicates(id, questions) {
  // how many of these questions already exist in OTHER banks?
  // (single query — no per-document loop)
  const all = await db.listAllQuestions();
  const existing = new Set();
  for (const q of all) {
    if (q.documentId === id) continue;
    existing.add(normalizeText(q.questionText));
  }
  let n = 0;
  for (const q of questions) {
    if (existing.has(normalizeText(q.questionText))) n += 1;
  }
  return n;
}
import { rateLimit, requestIp } from '@/lib/rate-limit';

export const runtime = 'nodejs';
export const maxDuration = 300;

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

  const rl = rateLimit(`parse:${requestIp(request)}`, { limit: 12, windowMs: 10 * 60_000 });
  if (!rl.ok) {
    return NextResponse.json({ error: 'Too many parse requests. Please wait a bit.' }, { status: 429 });
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

    let questions = [];
    let source = 'none';
    let note = null;
    let drafts = false;
    let aiResult = { questions: [], chunks: 0, chunksFailed: 0, lastError: null };

    // 0. Photos & scanned PDFs — no text at all, the AI must READ the pages
    const isVisualDoc = doc.fileKind === 'image' || doc.fileKind === 'pdf-scan';
    if (isVisualDoc && doc.fileData) {
      const visionQuestions = await parseQuestionsVision(doc.fileData, doc.fileMime || 'image/png');
      if (visionQuestions.length > 0) {
        const savedVision = await db.saveQuestions(id, visionQuestions, { status: 'pending' });
        const dupCount = await countDuplicates(id, savedVision);
        return NextResponse.json({
          ok: true,
          source: 'ai',
          count: savedVision.length,
          pendingReview: true,
          note:
            `${savedVision.length} questions extracted — review and approve them before building tests.` +
            (dupCount > 0 ? ` ${dupCount} look like duplicates of existing banks.` : ''),
          questions: savedVision.map((q) => ({
            id: q.id,
            questionText: q.questionText,
            options: q.options,
            correctAnswer: q.correctAnswer,
          })),
        });
      }
      return NextResponse.json(
        {
          error:
            doc.fileKind === 'image'
              ? 'The AI could not read questions from this image. Make sure the Python AI service is running (npm run ai) with a vision-capable backend (e.g. Ollama + "ollama pull llama3.2-vision"), and that the photo is clear and upright.'
              : 'This PDF looks like a scan, and the AI vision service could not read its pages. Make sure the Python AI service is running (npm run ai) with a vision-capable backend (e.g. Ollama + "ollama pull llama3.2-vision").',
        },
        { status: 422 }
      );
    }

    // 1. Deterministic detector FIRST — instant, free, and the questions
    //    are copied VERBATIM by construction. The AI is only asked to
    //    complete missing answer keys (one cheap call per 100 questions)
    //    instead of re-reading the whole document chunk by chunk. This is
    //    what makes extraction fast even on small CPU-only models.
    const blocks = parseMcqBlocks(doc.rawText);
    let detectorDone = false;
    if (blocks.length >= 3) {
      const missing = blocks.filter((b) => !b.correctAnswer);
      let aiFilled = 0;
      let fillError = null;
      if (missing.length > 0) {
        try {
          const BATCH = 100;
          for (let i = 0; i < missing.length; i += BATCH) {
            const batch = missing.slice(i, i + BATCH);
            const answers = await completeAnswerKey(batch, {
              answerContext: collectAnswerKeyExcerpt(doc.rawText),
              timeoutMs: 240_000,
            });
            if (Array.isArray(answers)) {
              for (const a of answers) {
                const b = batch[a.index];
                if (
                  b &&
                  /^[A-F]$/.test(a.answer || '') &&
                  'ABCDEF'.indexOf(a.answer) < b.options.length
                ) {
                  b.correctAnswer = a.answer;
                  aiFilled += 1;
                }
              }
            }
          }
        } catch (err) {
          fillError = err?.message || String(err);
        }
      }
      const answered = validateQuestions(blocks.filter((b) => b.correctAnswer));
      const draftQuestions = validateQuestionDrafts(
        blocks.filter((b) => !b.correctAnswer)
      );
      questions = answered.concat(draftQuestions);
      drafts = draftQuestions.length > 0;
      source = aiFilled > 0 ? 'ai' : 'parser';
      if (fillError) {
        note =
          `AI answer-key completion failed (${fillError}) — ` +
          `${missing.length} question${missing.length === 1 ? ' was' : 's were'} saved as draft${missing.length === 1 ? '' : 's'}.`;
      }
      detectorDone = questions.length > 0;
    }

    // 2. AI parse (verbatim questions) — only when the detector could not
    //    structure the document (truly unusual layouts need the model's
    //    flexibility; it is slower but more tolerant)
    if (!detectorDone) {
      aiResult = await parseQuestionsAI(doc.rawText);
      if (aiResult.questions.length > 0) {
        questions = aiResult.questions;
        source = 'ai';
        if (aiResult.chunksFailed > 0) {
          note =
            `The AI failed on ${aiResult.chunksFailed} of ${aiResult.chunks} parts ` +
            `(${aiResult.lastError}) — some questions may be missing; fix the AI and extract again.`;
        }
      }
    }

    // 2. Deterministic fallback
    if (questions.length === 0) {
      const regexQuestions = parseMcqs(doc.rawText);
      if (regexQuestions.length > 0) {
        questions = validateQuestions(regexQuestions);
        source = 'parser';
      }
    }

    // 3b. No answer key in the document? Keep the questions as DRAFTS —
    //     the teacher completes the key later (manually or with AI).
    if (questions.length === 0) {
      const lenientQuestions = parseMcqs(doc.rawText, { lenient: true });
      if (lenientQuestions.length > 0) {
        questions = lenientQuestions;
        source = 'parser';
        drafts = true;
      }
    }

    // 3. PDF with text but no MCQs found — maybe the questions are pictures
    //    inside the PDF. If we have the bytes, let vision try.
    if (questions.length === 0 && doc.fileKind === 'pdf' && doc.fileData) {
      const visionQuestions = await parseQuestionsVision(doc.fileData, 'application/pdf');
      if (visionQuestions.length > 0) {
        questions = visionQuestions;
        source = 'ai';
        note = 'Questions were read from the images inside this PDF by the AI.';
      }
    }

    if (questions.length === 0) {
      // Tell the teacher WHY, not just "nothing found":
      //  a) the AI provider itself failed on every part (misconfiguration) — 502
      //  b) a real AI ran but could not structure anything (model too small) — 422
      //  c) no AI configured at all and the regex found nothing — 422
      const aiInfo = await getAiInfo();
      const allChunksFailed = aiResult.chunks > 0 && aiResult.chunksFailed === aiResult.chunks;
      if (allChunksFailed) {
        return NextResponse.json(
          {
            error: `The AI provider failed on every part of this document: ${aiResult.lastError}. Fix the AI (see Admin → AI Settings and the service terminal) and try again.`,
          },
          { status: 502 }
        );
      }
      const aiActive = aiInfo.provider !== 'fallback';
      return NextResponse.json(
        {
          error: aiActive
            ? 'The AI read the whole document but could not structure any questions out of it. This usually means the layout is too unusual for the model (or it timed out on slow hardware). Try a larger model — e.g. "ollama pull llama3.1:8b" and set OLLAMA_MODEL in ai-service/.env — or upload photos/scans so the vision model can read them.'
            : 'No multiple-choice questions found. Make sure the document contains numbered questions with options (A-D) and, ideally, an answer key like "Answer: B". If the questions are photos or the PDF is a scan, upload it as a photo/scan and the AI will read it with vision.',
        },
        { status: 422 }
      );
    }

    const saved = await db.saveQuestions(id, questions, { status: 'pending' });
    const dupCount = await countDuplicates(id, saved);
    const missingKey = saved.filter((q) => !q.correctAnswer).length;

    const notes = [];
    if (note) notes.push(note);
    if (drafts || missingKey > 0) {
      notes.push(
        `${missingKey} question${missingKey === 1 ? ' has' : 's have'} no answer key — use “Complete answer key with AI” or edit them in the review page.`
      );
    }
    if (dupCount > 0) {
      notes.push(`${dupCount} question${dupCount === 1 ? ' looks' : ' look'} like duplicates of existing banks — check them in the review page.`);
    }

    return NextResponse.json({
      ok: true,
      source,
      count: saved.length,
      pendingReview: true,
      note: notes.length > 0 ? notes.join(' ') : `${saved.length} questions extracted — review and approve them before building tests.`,
      questions: saved.map((q) => ({
        id: q.id,
        questionText: q.questionText,
        options: q.options,
        correctAnswer: q.correctAnswer,
      })),
    });
  } catch (err) {
    console.error('[parse]', err?.message);
    return NextResponse.json({ error: 'Parsing failed' }, { status: 500 });
  }
}
