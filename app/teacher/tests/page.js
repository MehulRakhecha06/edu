import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import Header from '@/components/Header';
import CreateTestForm from './CreateTestForm';

export const metadata = { title: 'Tests — Aimmers Nepal' };

export default async function TeacherTestsPage({ searchParams }) {
  const session = await auth();
  if (!session?.user) redirect('/login');
  const role = session.user.role;
  if (role !== 'TEACHER' && role !== 'TEACHERS' && role !== 'ADMIN') redirect('/unauthorized');

  const { doc } = await searchParams;

  const [documents, tests] = await Promise.all([db.listDocuments(), db.listTests()]);

  const readyDocs = await Promise.all(
    documents.map(async (d) => ({
      id: d.id,
      filename: d.filename,
      subject: d.subject || 'General',
      questionCount: (await db.listQuestions(d.id)).length,
    }))
  );
  const usable = readyDocs.filter((d) => d.questionCount > 0);

  const allAttempts = await db.listAttempts();
  const testsWithCounts = await Promise.all(
    tests.map(async (t) => ({
      id: t.id,
      title: t.title,
      timeLimitMinutes: t.timeLimitMinutes,
      passingPercentage: t.passingPercentage ?? 40,
      questionCount: t.questionIds.length,
      createdAt: t.createdAt,
      attempts: allAttempts.filter((a) => a.testId === t.id).length,
    }))
  );

  return (
    <>
      <Header user={session.user} />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Mock Tests</h1>
            <p className="text-sm text-slate-600 mt-1">
              Build a timed test from an extracted question bank.
            </p>
          </div>
          <Link
            href="/teacher"
            className="text-sm font-medium text-slate-600 hover:text-slate-900"
          >
            ← Back to dashboard
          </Link>
        </div>

        <CreateTestForm documents={usable} preselect={doc || ''} />

        <section>
          <h2 className="font-bold text-slate-900 mb-3">Published tests</h2>
          {testsWithCounts.length === 0 ? (
            <div className="bg-white border border-dashed border-slate-300 rounded-2xl p-10 text-center text-sm text-slate-500">
              No tests yet — create your first one above.
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                    <th className="px-4 py-3 font-semibold">Title</th>
                    <th className="px-4 py-3 font-semibold">Questions</th>
                    <th className="px-4 py-3 font-semibold hidden sm:table-cell">Time limit</th>
                    <th className="px-4 py-3 font-semibold hidden sm:table-cell">Passing</th>
                    <th className="px-4 py-3 font-semibold hidden sm:table-cell">Attempts</th>
                    <th className="px-4 py-3 font-semibold text-right">Open</th>
                  </tr>
                </thead>
                <tbody>
                  {testsWithCounts.map((t) => (
                    <tr key={t.id} className="border-t border-slate-100">
                      <td className="px-4 py-3 font-medium text-slate-800 max-w-[240px] truncate">
                        {t.isPractice && (
                          <span className="mr-1 text-[10px] font-bold bg-sky-100 text-sky-700 rounded-full px-2 py-0.5 align-middle">
                            PRACTICE
                          </span>
                        )}
                        {t.title}
                      </td>
                      <td className="px-4 py-3">{t.questionCount}</td>
                      <td className="px-4 py-3 hidden sm:table-cell">
                        {t.timeLimitMinutes} min
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell">{t.passingPercentage}%</td>
                      <td className="px-4 py-3 hidden sm:table-cell">{t.attempts}</td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/teacher/tests/${t.id}`}
                          className="text-xs font-semibold text-indigo-700 hover:bg-indigo-50 border border-indigo-200 rounded-lg px-2.5 py-1.5"
                        >
                          View & results
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </>
  );
}
