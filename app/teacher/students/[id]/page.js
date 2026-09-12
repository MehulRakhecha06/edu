import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import Header from '@/components/Header';
import { formatDateTime } from '@/lib/format';

export const metadata = { title: 'Student history — Aimmers Nepal' };

export default async function StudentHistoryPage({ params }) {
  const session = await auth();
  if (!session?.user) redirect('/login');
  if (!['TEACHER', 'TEACHERS', 'ADMIN'].includes(session.user.role)) redirect('/unauthorized');

  const { id } = await params;
  const [user] = (await db.listUsers()).filter((u) => u.id === id);
  if (!user || (user.role || 'STUDENT') !== 'STUDENT') notFound();

  const [attempts, tests] = await Promise.all([db.listAttempts(), db.listTests()]);
  const testById = new Map(tests.map((t) => [t.id, t]));

  const history = attempts
    .filter((a) => a.studentId === id)
    .sort((x, y) => new Date(y.finishedAt) - new Date(x.finishedAt))
    .map((a) => {
      const test = testById.get(a.testId);
      const passing = test?.passingPercentage ?? 40;
      const percentage = a.total > 0 ? Math.round((a.score / a.total) * 100) : 0;
      return {
        id: a.id,
        testId: a.testId,
        testTitle: test?.title || 'Deleted test',
        isPractice: Boolean(test?.isPractice),
        score: a.score,
        total: a.total,
        percentage,
        passed: percentage >= passing,
        finishedAt: a.finishedAt,
      };
    });

  const graded = history.filter((h) => !h.isPractice);
  const avg = graded.length
    ? Math.round(graded.reduce((s, h) => s + h.percentage, 0) / graded.length)
    : null;

  return (
    <>
      <Header user={session.user} />
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <Link href="/teacher/students" className="text-xs font-semibold text-indigo-600 hover:text-indigo-800">
              ← All students
            </Link>
            <h1 className="text-2xl font-bold text-slate-900 mt-1">{user.name}</h1>
            <p className="text-sm text-slate-600">{user.email}</p>
          </div>
          <div className="flex gap-3 text-center">
            <div className="bg-white border border-slate-200 rounded-xl px-4 py-3">
              <p className="text-2xl font-bold text-slate-900">{graded.length}</p>
              <p className="text-xs text-slate-500">graded tests</p>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl px-4 py-3">
              <p className={`text-2xl font-bold ${avg === null ? 'text-slate-400' : avg >= 40 ? 'text-emerald-600' : 'text-rose-600'}`}>
                {avg === null ? '—' : `${avg}%`}
              </p>
              <p className="text-xs text-slate-500">average</p>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl px-4 py-3">
              <p className="text-2xl font-bold text-slate-900">{history.filter((h) => h.isPractice).length}</p>
              <p className="text-xs text-slate-500">practice runs</p>
            </div>
          </div>
        </div>

        {history.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center text-slate-500">
            This student hasn&apos;t taken any tests yet.
          </div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3 font-semibold">Test</th>
                  <th className="px-4 py-3 font-semibold">Score</th>
                  <th className="px-4 py-3 font-semibold">Result</th>
                  <th className="px-4 py-3 font-semibold hidden sm:table-cell">When</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h) => (
                  <tr key={h.id} className="border-t border-slate-100">
                    <td className="px-4 py-3 font-medium text-slate-800 max-w-[240px] truncate">
                      {h.isPractice && (
                        <span className="mr-1 text-[10px] font-bold bg-sky-100 text-sky-700 rounded-full px-2 py-0.5 align-middle">
                          PRACTICE
                        </span>
                      )}
                      {h.testTitle}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {h.score}/{h.total} <span className="text-slate-400">({h.percentage}%)</span>
                    </td>
                    <td className="px-4 py-3">
                      {h.isPractice ? (
                        <span className="text-slate-400">—</span>
                      ) : h.passed ? (
                        <span className="text-xs font-bold text-emerald-700 bg-emerald-100 rounded-full px-2 py-0.5">PASSED</span>
                      ) : (
                        <span className="text-xs font-bold text-rose-700 bg-rose-100 rounded-full px-2 py-0.5">FAILED</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-500 hidden sm:table-cell">{formatDateTime(h.finishedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </>
  );
}
