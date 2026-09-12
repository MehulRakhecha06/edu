import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import Header from '@/components/Header';
import NoticesPanel from './NoticesPanel';
import ManualBankForm from './ManualBankForm';
import { Users, ClipboardList, BookOpen, FileCheck2 } from 'lucide-react';

import UploadForm from './UploadForm';
import GroundedChat from './GroundedChat';
import DocumentsTable from './DocumentsTable';

export const metadata = { title: 'Teacher Dashboard — Aimmers Nepal' };

export default async function TeacherPage() {
  const session = await auth();
  if (!session?.user) redirect('/login');
  const role = session.user.role;
  if (role !== 'TEACHER' && role !== 'TEACHERS' && role !== 'ADMIN') redirect('/unauthorized');

  const [documents, tests, attempts] = await Promise.all([
    db.listDocuments(),
    db.listTests(),
    db.listAttempts(),
  ]);

  const questionCounts = await Promise.all(
    documents.map(async (d) => (await db.listQuestions(d.id)).length)
  );
  const totalQuestions = questionCounts.reduce((a, b) => a + b, 0);

  const stats = [
    { label: 'Question banks', value: documents.length, Icon: BookOpen },
    { label: 'Extracted questions', value: totalQuestions, Icon: BookOpen },
    { label: 'Tests created', value: tests.length, Icon: ClipboardList },
    { label: 'Attempts by students', value: attempts.length, Icon: FileCheck2 },
  ];

  const docs = documents.map((d, i) => ({
    id: d.id,
    filename: d.filename,
    subject: d.subject || 'General',
    uploadedAt: d.uploadedAt,
    questionCount: questionCounts[i],
  }));

  return (
    <>
      <Header user={session.user} />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Teacher Dashboard</h1>
            <p className="text-sm text-slate-600 mt-1">
              Upload question banks, extract the questions, and publish mock tests.
            </p>
          </div>
          <div className="flex gap-2">
            <Link
              href="/teacher/students"
              className="text-sm font-semibold bg-white border border-slate-300 hover:border-indigo-400 text-slate-700 px-4 py-2.5 rounded-lg inline-flex items-center gap-1.5"
            >
              <Users className="w-4 h-4" aria-hidden /> Student progress
            </Link>
            <Link
              href="/teacher/tests"
              className="text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-lg inline-flex items-center gap-1.5"
            >
              <ClipboardList className="w-4 h-4" aria-hidden /> Manage tests →
            </Link>
          </div>
        </div>

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

        {/* Upload */}
        <UploadForm />
        <ManualBankForm />

        <GroundedChat />

        {/* Documents */}
        <section>
          <h2 className="font-bold text-slate-900 mb-3">Question banks</h2>
          <DocumentsTable documents={docs} />
        </section>

        {/* Notices */}
        <NoticesPanel />
      </main>
    </>
  );
}
