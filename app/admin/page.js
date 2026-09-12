import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { getAiInfo } from '@/lib/ai';
import Header from '@/components/Header';
import CreateUserForm from './CreateUserForm';
import CsvImportForm from './CsvImportForm';
import { GraduationCap, Presentation, BookOpen, FileCheck2 } from 'lucide-react';
import UsersTable from './UsersTable';
import FilesTable from './FilesTable';

export const metadata = { title: 'Admin Dashboard — Aimmers Nepal' };

const AI_BADGES = {
  local: { label: 'Local model', cls: 'bg-emerald-100 text-emerald-700' },
  huggingface: { label: 'Hugging Face', cls: 'bg-indigo-100 text-indigo-700' },
  fallback: { label: 'Built-in answers', cls: 'bg-slate-200 text-slate-700' },
};

export default async function AdminPage() {
  const session = await auth();
  if (!session?.user) redirect('/login');
  if (session.user.role !== 'ADMIN') redirect('/unauthorized');

  const [users, documents, tests, attempts, aiInfo, allQuestions] = await Promise.all([
    db.listUsers(),
    db.listDocuments(),
    db.listTests(),
    db.listAttempts(),
    getAiInfo(),
    db.listAllQuestions(),
  ]);

  // Files section — every bank, enriched with uploader / counts / test usage
  const userById = new Map(users.map((u) => [u.id, u]));
  const testsByDoc = new Map();
  for (const t of tests) {
    for (const docId of t.documentIds || []) {
      testsByDoc.set(docId, (testsByDoc.get(docId) || 0) + 1);
    }
  }
  const files = documents.map((d) => {
    const qs = allQuestions.filter((q) => q.documentId === d.id);
    return {
      id: d.id,
      filename: d.filename,
      subject: d.subject,
      fileKind: d.fileKind,
      uploadedAt: d.uploadedAt,
      uploader: userById.get(d.uploadedBy) || null,
      questionCount: qs.filter((q) => q.status === 'approved').length,
      draftCount: qs.filter((q) => q.status !== 'approved').length,
      testsCount: testsByDoc.get(d.id) || 0,
    };
  });

  const counts = {
    students: users.filter((u) => u.role === 'STUDENT').length,
    teachers: users.filter((u) => u.role === 'TEACHER' || u.role === 'TEACHERS').length,
    admins: users.filter((u) => u.role === 'ADMIN').length,
  };

  const stats = [
    { label: 'Students', value: counts.students, Icon: GraduationCap },
    { label: 'Teachers', value: counts.teachers, Icon: Presentation },
    { label: 'Question banks', value: documents.length, Icon: BookOpen },
    { label: 'Tests / attempts', value: `${tests.length} / ${attempts.length}`, Icon: FileCheck2 },
  ];

  return (
    <>
      <Header user={session.user} />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Admin Dashboard</h1>
          <p className="text-sm text-slate-600 mt-1">
            Add or remove anyone — students, teachers, or admins — and change roles
            anytime. Students can also register themselves.
          </p>
        </div>

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

        {/* AI provider status */}
        <Link
          href="/admin/ai"
          className="flex flex-wrap items-center justify-between gap-3 bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:border-indigo-300 transition-colors"
        >
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
              AI provider
            </p>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <span
                className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                  (AI_BADGES[aiInfo?.provider] || AI_BADGES.fallback).cls
                }`}
              >
                {(AI_BADGES[aiInfo?.provider] || AI_BADGES.fallback).label}
              </span>
              {aiInfo?.model && (
                <code className="text-sm text-slate-700 bg-slate-100 px-2 py-1 rounded">
                  {aiInfo.model}
                </code>
              )}
              {aiInfo?.source && (
                <span className="text-xs text-slate-500">
                  · {aiInfo.source === 'admin' ? 'set by admin' : 'from environment'}
                </span>
              )}
            </div>
          </div>
          <span className="text-sm font-semibold text-indigo-600">Configure →</span>
        </Link>

        <CreateUserForm />
        <CsvImportForm />

        <section>
          <h2 className="font-bold text-slate-900 mb-3">
            All accounts ({users.length}) — change a role or delete with the controls in
            each row
          </h2>
          <UsersTable
            users={users.map((u) => ({
              id: u.id,
              name: u.name,
              email: u.email,
              role: u.role,
              createdAt: u.createdAt,
            }))}
            currentUserId={session.user.id}
          />
        </section>

        <section>
          <h2 className="font-bold text-slate-900 mb-1">
            All question-bank files ({files.length})
          </h2>
          <p className="text-sm text-slate-600 mb-3">
            Every file any teacher uploaded. Deleting a bank also deletes its
            questions — tests built from it will lose those questions, but past
            student attempts are kept.
          </p>
          <FilesTable files={files} />
        </section>
      </main>
    </>
  );
}
