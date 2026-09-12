import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { formatDateTime } from '@/lib/format';
import Header from '@/components/Header';

export const metadata = { title: 'Test detail — Aimmers Nepal' };

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

export default async function TestDetailPage({ params }) {
  const session = await auth();
  if (!session?.user) redirect('/login');
  const role = session.user.role;
  if (role !== 'TEACHER' && role !== 'TEACHERS' && role !== 'ADMIN') redirect('/unauthorized');

  const { id } = await params;

  const test = await db.getTest(id);
  if (!test) notFound();

  const [questionsRaw, attempts, users] = await Promise.all([
    db.getQuestionsByIds(test.questionIds),
    db.listAttempts(),
    db.listUsers(),
  ]);

  const byId = new Map(questionsRaw.map((q) => [q.id, q]));
  const questions = test.questionIds.map((qid) => byId.get(qid)).filter(Boolean);

  const testAttempts = attempts
    .filter((a) => a.testId === test.id)
    .sort((a, b) => new Date(b.finishedAt) - new Date(a.finishedAt));
  const userById = new Map(users.map((u) => [u.id, u]));

  const passing = test.passingPercentage ?? 40;
  const average =
    testAttempts.length > 0
      ? Math.round(
          (testAttempts.reduce((sum, a) => sum + a.score / a.total, 0) / testAttempts.length) * 100
        )
      : null;
  const passedCount = testAttempts.filter((a) =>
    a.total > 0 ? Math.round((a.score / a.total) * 100) >= passing : false
  ).length;

  return (
    <>
      <Header user={session.user} />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <Link
              href="/teacher/tests"
              className="text-sm font-medium text-slate-500 hover:text-slate-800"
            >
              ← All tests
            </Link>
            <h1 className="mt-2 text-2xl font-bold text-slate-900">{test.title}</h1>
            <p className="text-sm text-slate-600 mt-1">
              {questions.length} questions · 1 mark each · {test.timeLimitMinutes} minute
              limit · passing at {passing}%
              {average !== null && ` · class average ${average}%`}
              {testAttempts.length > 0 &&
                ` · ${passedCount}/${testAttempts.length} students passed`}
            </p>
          </div>
        </div>

        {/* Results */}
        <section>
          <h2 className="font-bold text-slate-900 mb-3">Student results</h2>
          {testAttempts.length === 0 ? (
            <div className="bg-white border border-dashed border-slate-300 rounded-2xl p-8 text-center text-sm text-slate-500">
              No student has taken this test yet.
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                    <th className="px-4 py-3 font-semibold">Student</th>
                    <th className="px-4 py-3 font-semibold">Score</th>
                    <th className="px-4 py-3 font-semibold">Percentage</th>
                    <th className="px-4 py-3 font-semibold">Result</th>
                    <th className="px-4 py-3 font-semibold hidden sm:table-cell">Finished</th>
                  </tr>
                </thead>
                <tbody>
                  {testAttempts.map((a) => {
                    const pct = a.total > 0 ? Math.round((a.score / a.total) * 100) : 0;
                    return (
                      <tr key={a.id} className="border-t border-slate-100">
                        <td className="px-4 py-3 font-medium text-slate-800">
                          {userById.get(a.studentId)?.name || 'Unknown student'}
                        </td>
                        <td className="px-4 py-3">
                          {a.score} / {a.total}
                        </td>
                        <td className="px-4 py-3">{pct}%</td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex px-2 py-0.5 rounded-full text-xs font-bold ${
                              pct >= passing
                                ? 'bg-emerald-100 text-emerald-700'
                                : 'bg-red-100 text-red-700'
                            }`}
                          >
                            {pct >= passing ? 'PASSED' : 'FAILED'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-500 hidden sm:table-cell">
                          {formatDateTime(a.finishedAt)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Questions (exact text, with answers) */}
        <section>
          <h2 className="font-bold text-slate-900 mb-3">
            Questions <span className="text-slate-400 font-normal text-sm">(exact text from the PDF)</span>
          </h2>
          <div className="space-y-4">
            {questions.map((q, i) => (
              <div key={q.id} className="bg-white border border-slate-200 rounded-2xl p-5">
                <p className="font-medium text-slate-900">
                  {i + 1}. {q.questionText}
                </p>
                <ul className="mt-3 grid gap-1.5 sm:grid-cols-2">
                  {q.options.map((opt, j) => {
                    const isCorrect = LETTERS[j] === q.correctAnswer;
                    return (
                      <li
                        key={j}
                        className={`text-sm px-3 py-2 rounded-lg border ${
                          isCorrect
                            ? 'border-emerald-300 bg-emerald-50 text-emerald-800 font-medium'
                            : 'border-slate-200 text-slate-700'
                        }`}
                      >
                        {LETTERS[j]}) {opt}
                        {isCorrect && <span className="ml-2 text-xs">✓ correct</span>}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </section>
      </main>
    </>
  );
}
