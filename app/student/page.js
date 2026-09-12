import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { formatDateTime } from '@/lib/format';
import Header from '@/components/Header';
import { FileText, Flag, BarChart3, Trophy, Hourglass, Lock, Megaphone } from 'lucide-react';

export const metadata = { title: 'Student Dashboard — Aimmers Nepal' };

export default async function StudentPage() {
  const session = await auth();
  if (!session?.user) redirect('/login');

  const [tests, attempts, notices] = await Promise.all([
    db.listTests(),
    db.listAttemptsByStudent(session.user.id),
    db.listNotices(),
  ]);

  const testById = new Map(tests.map((t) => [t.id, t]));

  const scores = attempts.filter((a) => a.total > 0).map((a) => a.score / a.total);
  const average = scores.length > 0 ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 100) : null;
  const best = scores.length > 0 ? Math.round(Math.max(...scores) * 100) : null;

  const stats = [
    { label: 'Tests available', value: tests.length, Icon: FileText },
    { label: 'Tests taken', value: attempts.length, Icon: Flag },
    { label: 'Average score', value: average === null ? '—' : `${average}%`, Icon: BarChart3 },
    { label: 'Best score', value: best === null ? '—' : `${best}%`, Icon: Trophy },
  ];

  return (
    <>
      <Header user={session.user} />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Hi {session.user.name?.split(' ')[0]} 👋
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Take a mock test, then read the AI explanation for every question.
          </p>
        </div>

        {/* Notices from teachers */}
        {notices.length > 0 && (
          <section>
            <h2 className="flex items-center gap-2 font-bold text-slate-900 mb-3">
              <Megaphone className="w-4.5 h-4.5 text-indigo-600" aria-hidden /> Notices
            </h2>
            <div className="space-y-3">
              {notices.slice(0, 3).map((n) => (
                <div key={n.id} className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
                  <p className="font-bold text-slate-900 text-sm">{n.title}</p>
                  <p className="text-sm text-slate-700 mt-1 whitespace-pre-wrap">{n.body}</p>
                  <p className="text-xs text-slate-400 mt-1">{formatDateTime(n.createdAt)}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((s) => (
            <div key={s.label} className="card-lift bg-white border border-slate-200 rounded-2xl p-5">
              <span className="inline-flex w-10 h-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                <s.Icon className="w-5 h-5" aria-hidden />
              </span>
              <p className="mt-2 text-2xl font-bold text-slate-900">{s.value}</p>
              <p className="text-xs text-slate-500 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Available tests */}
        <section>
          <h2 className="font-bold text-slate-900 mb-3">Available tests</h2>
          {tests.length === 0 ? (
            <div className="bg-white border border-dashed border-slate-300 rounded-2xl p-10 text-center text-sm text-slate-500">
              No tests have been published yet — check back soon!
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {tests.map((t) => {
                const now = Date.now();
                const opens = t.availableFrom ? new Date(t.availableFrom).getTime() : null;
                const closes = t.availableTo ? new Date(t.availableTo).getTime() : null;
                const notOpenYet = opens !== null && now < opens;
                const closed = closes !== null && now > closes;
                return (
                <div
                  key={t.id}
                  className={`bg-white border rounded-2xl p-5 flex flex-col shadow-sm ${
                    closed ? 'border-slate-200 opacity-60' : notOpenYet ? 'border-slate-200' : 'border-slate-200'
                  }`}
                >
                  <span
                    className={`inline-flex w-12 h-12 items-center justify-center rounded-2xl ${
                      closed
                        ? 'bg-slate-100 text-slate-400'
                        : notOpenYet
                          ? 'bg-amber-50 text-amber-500'
                          : 'bg-indigo-50 text-indigo-600'
                    }`}
                  >
                    {closed ? (
                      <Lock className="w-6 h-6" aria-hidden />
                    ) : notOpenYet ? (
                      <Hourglass className="w-6 h-6" aria-hidden />
                    ) : (
                      <FileText className="w-6 h-6" aria-hidden />
                    )}
                  </span>
                  <h3 className="mt-3 font-bold text-slate-900">
                    {t.isPractice && (
                      <span className="mr-1 text-[10px] font-bold bg-sky-100 text-sky-700 rounded-full px-2 py-0.5 align-middle">
                        PRACTICE
                      </span>
                    )}
                    {t.title}
                  </h3>
                  <p className="text-sm text-slate-500 mt-1">
                    {t.questionIds.length} questions · {t.timeLimitMinutes} minutes
                    {!t.isPractice && (t.maxAttempts ?? 1) !== 1 ? (
                      t.maxAttempts === 0 ? ' · unlimited retakes' : ` · ${t.maxAttempts} attempts`
                    ) : null}
                  </p>
                  {(notOpenYet || closed) && (
                    <p className="mt-3 text-xs font-semibold text-slate-500">
                      {notOpenYet
                        ? `Opens ${formatDateTime(t.availableFrom)}`
                        : `Closed ${formatDateTime(t.availableTo)}`}
                    </p>
                  )}
                  {notOpenYet || closed ? (
                    <span className="mt-4 text-center bg-slate-200 text-slate-400 text-sm font-semibold py-2.5 rounded-lg cursor-not-allowed">
                      {closed ? 'Test closed' : 'Not open yet'}
                    </span>
                  ) : (
                    <Link
                      href={`/student/test/${t.id}`}
                      className="mt-4 text-center bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold py-2.5 rounded-lg"
                    >
                      Start test →
                    </Link>
                  )}
                </div>
                );
              })}
            </div>
          )}
        </section>

        {/* History */}
        <section>
          <h2 className="font-bold text-slate-900 mb-3">Your past attempts</h2>
          {attempts.length === 0 ? (
            <div className="bg-white border border-dashed border-slate-300 rounded-2xl p-8 text-center text-sm text-slate-500">
              You haven&apos;t taken any tests yet.
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                    <th className="px-4 py-3 font-semibold">Test</th>
                    <th className="px-4 py-3 font-semibold">Score</th>
                    <th className="px-4 py-3 font-semibold">Percentage</th>
                    <th className="px-4 py-3 font-semibold">Result</th>
                    <th className="px-4 py-3 font-semibold hidden sm:table-cell">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {attempts.map((a) => {
                    const pct = a.total > 0 ? Math.round((a.score / a.total) * 100) : 0;
                    return (
                      <tr key={a.id} className="border-t border-slate-100">
                        <td className="px-4 py-3 font-medium text-slate-800">
                          {testById.get(a.testId)?.title || 'Deleted test'}
                        </td>
                        <td className="px-4 py-3">
                          {a.score} / {a.total}
                        </td>
                        <td className="px-4 py-3">{pct}%</td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex px-2 py-0.5 rounded-full text-xs font-bold ${
                              (testById.get(a.testId)?.passingPercentage ?? 40) <= pct
                                ? 'bg-emerald-100 text-emerald-700'
                                : 'bg-red-100 text-red-700'
                            }`}
                          >
                            {(testById.get(a.testId)?.passingPercentage ?? 40) <= pct ? 'PASSED' : 'FAILED'}
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
      </main>
    </>
  );
}
