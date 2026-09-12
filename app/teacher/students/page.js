import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import Header from '@/components/Header';
import { Users } from 'lucide-react';
import { formatDate } from '@/lib/format';

export const metadata = { title: 'Student progress — Aimmers Nepal' };

export default async function TeacherStudentsPage() {
  const session = await auth();
  if (!session?.user) redirect('/login');
  if (!['TEACHER', 'TEACHERS', 'ADMIN'].includes(session.user.role)) redirect('/unauthorized');

  const [users, attempts, tests] = await Promise.all([
    db.listUsers(),
    db.listAttempts(),
    db.listTests(),
  ]);
  const testById = new Map(tests.map((t) => [t.id, t]));
  const students = users.filter((u) => (u.role || 'STUDENT') === 'STUDENT');

  const byStudent = new Map();
  for (const a of attempts) {
    if (!byStudent.has(a.studentId)) byStudent.set(a.studentId, []);
    byStudent.get(a.studentId).push(a);
  }

  const rows = students
    .map((u) => {
      // practice attempts don't count towards progress statistics
      const mine = (byStudent.get(u.id) || []).filter((a) => !testById.get(a.testId)?.isPractice);
      const percentages = mine.filter((a) => a.total > 0).map((a) => (a.score / a.total) * 100);
      const avg = percentages.length
        ? Math.round(percentages.reduce((s, v) => s + v, 0) / percentages.length)
        : null;
      const passed = mine.filter((a) => {
        const passing = testById.get(a.testId)?.passingPercentage ?? 40;
        return a.total > 0 && (a.score / a.total) * 100 >= passing;
      }).length;
      const last = mine.slice().sort((x, y) => new Date(y.finishedAt) - new Date(x.finishedAt))[0];
      return {
        id: u.id,
        name: u.name,
        email: u.email,
        testsTaken: mine.length,
        avg,
        passed,
        lastActivity: last?.finishedAt || null,
      };
    })
    .sort((a, b) => b.testsTaken - a.testsTaken || a.name.localeCompare(b.name));

  return (
    <>
      <Header user={session.user} />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
            <Users className="w-6 h-6 text-indigo-600" aria-hidden /> Student progress
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            How every student is doing across all your tests (practice attempts excluded from stats).
            Click a student for their full history.
          </p>
        </div>

        {rows.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center text-slate-500">
            No students yet — students register themselves on the sign-up page.
          </div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                    <th className="px-4 py-3 font-semibold">Student</th>
                    <th className="px-4 py-3 font-semibold">Tests taken</th>
                    <th className="px-4 py-3 font-semibold">Average score</th>
                    <th className="px-4 py-3 font-semibold">Passed</th>
                    <th className="px-4 py-3 font-semibold hidden sm:table-cell">Last activity</th>
                    <th className="px-4 py-3 font-semibold text-right">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="border-t border-slate-100">
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-800">{r.name}</p>
                        <p className="text-xs text-slate-500">{r.email}</p>
                      </td>
                      <td className="px-4 py-3 text-slate-700">{r.testsTaken}</td>
                      <td className="px-4 py-3">
                        {r.avg === null ? (
                          <span className="text-slate-400">—</span>
                        ) : (
                          <span
                            className={`font-semibold ${
                              r.avg >= 40 ? 'text-emerald-600' : 'text-rose-600'
                            }`}
                          >
                            {r.avg}%
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {r.testsTaken === 0 ? '—' : `${r.passed}/${r.testsTaken}`}
                      </td>
                      <td className="px-4 py-3 text-slate-500 hidden sm:table-cell">
                        {r.lastActivity ? formatDate(r.lastActivity) : '—'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/teacher/students/${r.id}`}
                          className="text-indigo-600 hover:text-indigo-800 font-semibold text-xs whitespace-nowrap"
                        >
                          View history →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </>
  );
}
