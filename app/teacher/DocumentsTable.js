'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { formatDate } from '@/lib/format';
import { FileImage, FileType, FileText } from 'lucide-react';

export default function DocumentsTable({ documents }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState(null);
  const [message, setMessage] = useState(null); // { type: 'ok'|'err', text }

  async function extract(id) {
    setBusyId(id);
    setMessage(null);
    try {
      const res = await fetch(`/api/documents/${id}/parse`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ type: 'err', text: data.error || 'Extraction failed.' });
      } else {
        setMessage({
          type: 'ok',
          text: `Extracted ${data.count} questions${
            data.source === 'ai' ? ' (AI-assisted)' : ''
          }. You can now create a test from this bank.`,
        });
        router.refresh();
      }
    } catch {
      setMessage({ type: 'err', text: 'Network error — please try again.' });
    } finally {
      setBusyId(null);
    }
  }

  async function remove(id) {
    if (!confirm('Delete this question bank and all its extracted questions?')) return;
    setBusyId(id);
    setMessage(null);
    try {
      const res = await fetch(`/api/documents/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json();
        setMessage({ type: 'err', text: data.error || 'Delete failed.' });
      } else {
        router.refresh();
      }
    } catch {
      setMessage({ type: 'err', text: 'Network error — please try again.' });
    } finally {
      setBusyId(null);
    }
  }

  if (documents.length === 0) {
    return (
      <div className="bg-white border border-dashed border-slate-300 rounded-2xl p-10 text-center text-sm text-slate-500">
        No question banks yet — upload your first PDF above.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {message && (
        <p
          className={`text-sm rounded-lg px-3 py-2 border ${
            message.type === 'ok'
              ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
              : 'text-red-700 bg-red-50 border-red-200'
          }`}
        >
          {message.text}
        </p>
      )}

      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="px-4 py-3 font-semibold">File</th>
              <th className="px-4 py-3 font-semibold">Subject</th>
              <th className="px-4 py-3 font-semibold">Subject</th>
              <th className="px-4 py-3 font-semibold">Questions</th>
              <th className="px-4 py-3 font-semibold hidden sm:table-cell">Uploaded</th>
              <th className="px-4 py-3 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {documents.map((d) => (
              <tr key={d.id} className="border-t border-slate-100">
                <td className="px-4 py-3 font-medium text-slate-800 max-w-[220px] truncate">
                  <span className="inline-flex w-6 h-6 mr-1 items-center justify-center rounded-md bg-slate-100 text-slate-500 align-middle">
                    {d.fileKind === 'image' || d.fileKind === 'pdf-scan' ? (
                      <FileImage className="w-3.5 h-3.5" aria-hidden />
                    ) : d.fileKind === 'docx' ? (
                      <FileType className="w-3.5 h-3.5" aria-hidden />
                    ) : (
                      <FileText className="w-3.5 h-3.5" aria-hidden />
                    )}
                  </span>
                  {d.filename}
                </td>
                <td className="px-4 py-3">
                  <span className="inline-flex px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 text-xs font-semibold whitespace-nowrap">
                    {d.subject || 'General'}
                  </span>
                  {d.chapter ? (
                    <span className="ml-1 inline-flex px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-xs font-semibold whitespace-nowrap">
                      {d.chapter}
                    </span>
                  ) : null}
                </td>
                <td className="px-4 py-3">
                  {d.questionCount > 0 ? (
                    <span className="inline-flex px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-xs font-semibold">
                      {d.questionCount} ready
                    </span>
                  ) : (
                    <span className="inline-flex px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-xs font-semibold">
                      not extracted
                    </span>
                  )}
                  {d.pendingCount > 0 && (
                    <span className="ml-1 inline-flex px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-xs font-semibold whitespace-nowrap">
                      {d.pendingCount} to review
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-slate-500 hidden sm:table-cell">
                  {formatDate(d.uploadedAt)}
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => extract(d.id)}
                      disabled={busyId === d.id}
                      className="text-xs font-semibold text-indigo-700 hover:bg-indigo-50 border border-indigo-200 rounded-lg px-2.5 py-1.5 disabled:opacity-50"
                    >
                      {busyId === d.id
                        ? 'Working…'
                        : d.questionCount > 0
                          ? 'Re-extract'
                          : 'Extract questions'}
                    </button>
                    {(d.questionCount > 0 || d.pendingCount > 0) && (
                      <Link
                        href={`/teacher/documents/${d.id}`}
                        className="text-xs font-semibold text-amber-700 hover:bg-amber-50 border border-amber-300 rounded-lg px-2.5 py-1.5 whitespace-nowrap"
                      >
                        {d.pendingCount > 0 ? `Review (${d.pendingCount})` : 'Review questions'}
                      </Link>
                    )}
                    {d.questionCount > 0 && (
                      <Link
                        href={`/teacher/tests?doc=${d.id}`}
                        className="text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg px-2.5 py-1.5"
                      >
                        Create test
                      </Link>
                    )}
                    <button
                      onClick={() => remove(d.id)}
                      disabled={busyId === d.id}
                      className="text-xs font-semibold text-red-700 hover:bg-red-50 border border-red-200 rounded-lg px-2.5 py-1.5 disabled:opacity-50"
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
