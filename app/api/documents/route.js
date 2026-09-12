/**
 * Documents (question banks).
 *   GET  — list documents (teacher/admin)
 *   POST — upload a question bank (teacher/admin)
 *
 * Accepted formats:
 *   PDF, TXT, MD, DOCX                 -> text is extracted and stored
 *   PNG / JPG / WEBP (photos of papers) -> stored as bytes, questions are
 *                                          read by the AI vision endpoint
 *   Scanned PDFs (images only, no text) -> kept like photos: the AI vision
 *                                          endpoint reads them at parse time
 */

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { rateLimit, requestIp } from '@/lib/rate-limit';
import { cleanText } from '@/lib/validators';
import { extractText } from '@/lib/pdf';

export const runtime = 'nodejs';
export const maxDuration = 60;

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED_TYPES = [
  'application/pdf',
  'text/plain',
  'text/markdown',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
  'image/png',
  'image/jpeg',
  'image/webp',
];

const IMAGE_RE = /\.(png|jpe?g|webp)$/i;
const TEXT_RE = /\.(txt|md)$/i;
const DOCX_RE = /\.docx$/i;

function isTeacherOrAdmin(role) {
  return role === 'TEACHER' || role === 'TEACHERS' || role === 'ADMIN';
}

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }
  if (!isTeacherOrAdmin(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const [docs, allQuestions] = await Promise.all([
      db.listDocuments(),
      db.listAllQuestions(), // ONE query instead of one per document (N+1 fix)
    ]);
    const approvedByDoc = new Map();
    const pendingByDoc = new Map();
    for (const q of allQuestions) {
      const approved = (q.status || 'approved') === 'approved';
      const a = (approvedByDoc.get(q.documentId) || 0) + (approved ? 1 : 0);
      const pn = (pendingByDoc.get(q.documentId) || 0) + (approved ? 0 : 1);
      approvedByDoc.set(q.documentId, a);
      pendingByDoc.set(q.documentId, pn);
    }
    // Never ship the raw text to the list view (it can be big)
    const withCounts = docs.map((d) => ({
      id: d.id,
      filename: d.filename,
      subject: d.subject || 'General',
      chapter: d.chapter || '',
      fileKind: d.fileKind || 'text',
      uploadedAt: d.uploadedAt,
      questionCount: approvedByDoc.get(d.id) || 0,
      pendingCount: pendingByDoc.get(d.id) || 0,
    }));
    return NextResponse.json({ documents: withCounts });
  } catch (err) {
    console.error('[documents GET]', err?.message);
    return NextResponse.json({ error: 'Failed to load documents' }, { status: 500 });
  }
}

export async function POST(request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }
  if (!isTeacherOrAdmin(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const rl = rateLimit(`upload:${requestIp(request)}`, { limit: 10, windowMs: 10 * 60_000 });
  if (!rl.ok) {
    return NextResponse.json({ error: 'Too many uploads. Please wait a bit.' }, { status: 429 });
  }

  let formData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: 'Invalid upload' }, { status: 400 });
  }

  const file = formData.get('file');
  if (!file || typeof file === 'string') {
    return NextResponse.json({ error: 'No file received' }, { status: 400 });
  }

  const type = file.type || '';
  const name = file.name || 'document';
  const isPdfByName = /\.pdf$/i.test(name);
  const isTextByName = TEXT_RE.test(name);
  const isImageByName = IMAGE_RE.test(name);
  const isDocxByName = DOCX_RE.test(name);

  const isImage = ALLOWED_TYPES.includes(type) && type.startsWith('image/') || isImageByName;

  if (!ALLOWED_TYPES.includes(type) && !isPdfByName && !isTextByName && !isImageByName && !isDocxByName) {
    return NextResponse.json(
      { error: 'Supported formats: PDF, DOCX, TXT, MD, PNG, JPG, WEBP.' },
      { status: 400 }
    );
  }
  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json({ error: 'File is larger than 10 MB.' }, { status: 400 });
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const subject = cleanText(formData.get('subject') || '', 60) || 'General';
    const chapter = cleanText(formData.get('chapter') || '', 60);

    // ---- photos of question papers: no text to extract, store the bytes --
    if (isImage) {
      const mime = type && type.startsWith('image/') ? type : `image/${(name.split('.').pop() || 'png').toLowerCase().replace('jpg', 'jpeg')}`;
      const doc = await db.createDocument({
        filename: cleanText(name, 200) || 'photo',
        subject,
        chapter,
        rawText: '',
        fileKind: 'image',
        fileMime: mime,
        fileData: buffer.toString('base64'),
        uploadedBy: session.user.id,
      });
      return NextResponse.json({
        ok: true,
        document: {
          id: doc.id,
          filename: doc.filename,
          subject: doc.subject,
          uploadedAt: doc.uploadedAt,
        },
        warning: 'Photo uploaded — use "Extract questions" and the AI will read the questions from the image.',
      });
    }

    // ---- text-based files (PDF / DOCX / TXT / MD) ------------------------
    let extracted;
    try {
      extracted = await extractText(buffer, isPdfByName || type === 'application/pdf', name);
    } catch {
      // Corrupt/fake file (e.g. an .exe renamed to .pdf) — say what happened
      // instead of an "Upload failed" 500.
      return NextResponse.json(
        {
          error:
            'This file could not be read. Make sure it is a valid PDF, Word document or text file (a renamed file of another type will not work).',
        },
        { status: 400 }
      );
    }
    const { text, warning } = extracted;

    let fileKind = 'text';
    if (isPdfByName || type === 'application/pdf') fileKind = 'pdf';
    else if (isDocxByName) fileKind = 'docx';

    // Scanned PDF: has (almost) no extractable text — keep it as a photo-like
    // document so the AI vision endpoint can read it at parse time.
    const isScan = fileKind === 'pdf' && (!text || text.trim().length < 20);

    if (!isScan && (!text || text.trim().length < 20)) {
      return NextResponse.json(
        {
          error:
            'Could not read any text from this file. If it is a scanned PDF, please re-upload it — scanned PDFs are now supported via AI vision.',
        },
        { status: 422 }
      );
    }

    const doc = await db.createDocument({
      filename: cleanText(name, 200) || 'document',
      subject,
      chapter,
      rawText: isScan ? '' : text.slice(0, 200_000),
      fileKind: isScan ? 'pdf-scan' : fileKind,
      fileMime: isScan ? 'application/pdf' : null,
      fileData: isScan ? buffer.toString('base64') : null,
      uploadedBy: session.user.id,
    });

    return NextResponse.json({
      ok: true,
      document: {
        id: doc.id,
        filename: doc.filename,
        subject: doc.subject,
        uploadedAt: doc.uploadedAt,
      },
      warning: isScan
        ? 'This PDF has no selectable text (it looks like a scan/photo). The AI will read the questions from the pages when you click "Extract questions".'
        : warning || null,
    });
  } catch (err) {
    console.error('[documents POST]', err?.message);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}
