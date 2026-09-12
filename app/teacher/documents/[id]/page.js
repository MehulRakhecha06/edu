import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import Header from '@/components/Header';
import QuestionReview from './QuestionReview';
import { FileSearch } from 'lucide-react';

export const metadata = { title: 'Review questions — Aimmers Nepal' };

export default async function ReviewDocumentPage({ params }) {
  const session = await auth();
  if (!session?.user) redirect('/login');
  if (!['TEACHER', 'TEACHERS', 'ADMIN'].includes(session.user.role)) redirect('/unauthorized');

  const { id } = await params;
  const doc = await db.getDocument(id);
  if (!doc) notFound();

  const [questions, allQuestions] = await Promise.all([
    db.listQuestions(id),
    db.listAllQuestions(), // single query — powers duplicate detection
  ]);

  // duplicate detection: normalized question text that exists in OTHER banks
  const dupSet = new Set();
  for (const q of allQuestions) {
    if (q.documentId === id) continue;
    dupSet.add(String(q.questionText || '').toLowerCase().replace(/[^a-z0-9]/g, ''));
  }
  const questionsWithFlags = questions.map((q, i) => ({
    ...q,
    index: i + 1,
    duplicate: dupSet.has(String(q.questionText || '').toLowerCase().replace(/[^a-z0-9]/g, '')),
  }));

  const pending = questionsWithFlags.filter((q) => (q.status || 'approved') === 'pending').length;
  const missingKey = questionsWithFlags.filter((q) => !q.correctAnswer).length;

  return (
    <>
      <Header user={session.user} />
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <div>
          <Link href="/teacher" className="text-xs font-semibold text-indigo-600 hover:text-indigo-800">
            ← Dashboard
          </Link>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900 mt-1">
            <FileSearch className="w-6 h-6 text-indigo-600 shrink-0" aria-hidden /> Review: {doc.filename}
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            <span className="inline-flex px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 text-xs font-semibold">
              {doc.subject || 'General'}
            </span>
            {doc.chapter ? (
              <span className="ml-1 inline-flex px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-xs font-semibold">
                {doc.chapter}
              </span>
            ) : null}
            {' '}· edit questions, fix answers, approve them for tests. Only approved questions
            can be used in new tests.
          </p>
        </div>

        <QuestionReview
          documentId={id}
          questions={questionsWithFlags}
          pendingCount={pending}
          missingKeyCount={missingKey}
        />
      </main>
    </>
  );
}
