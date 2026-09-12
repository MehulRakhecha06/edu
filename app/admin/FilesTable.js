'use client';

/**
 * Admin — question-bank files.
 *
 * Lists EVERY uploaded bank (any teacher's) and lets the admin delete any
 * of them. Deletion goes through the same API the teacher's own bank page
 * uses (DELETE /api/documents/[id]) — admins are already allowed there —
 * this just gives them a screen to do it from.
 */

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatDate } from '@/lib/format';

const KIND_BADGES = {
  pdf: { label: 'PDF', cls: 'bg-rose-100 text-rose-700' },
  'pdf-scan': { label: 'Scanned PDF', cls: 'bg-amber-100 text-amber-700' },
  image: { label: 'Photo', cls: 'bg-sky-100 text-sky-700' },
  docx: { label: 'DOCX', cls: 'bg-blue-100 text-blue-700' },
  text: { label: 'Text', cls: 'bg-slate-100 text-slate-700' },
};

export default function FilesTable({ files }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return files;
    return files.filter(
      (f) =>
        f.filename.toLowerCase().includes(q) ||
        (f.subject || '').toLowerCase().includes(q) ||
        (f.uploader?.name || '').toLowerCase().includes(q) ||
        (f.uploader?.email || '').toLowerCase().includes(q)
    );
  }, [files, query]);

  async function remove(file) {
    const usingTests = file.testsCount > 0;
    const message = usingTests
      ? `Delete “${file.filename}”?\n\nThis permanently removes the bank, its ${file.questionCount} question(s), and ${file.draftCount > 0 ? `${file.draftCount} draft(s), ` : ''}${file.testsCount} test(s) were built from it — those tests will lose the questions that came from this bank. Past student attempts are kept. This cannot be undone.`
      : `Delete “${file.filename}” and its ${file.questionCount} question(s)? This cannot be undone.`;
    if (!confirm(message)) return;

    setBusyId(file.id);
    setError('');
    setNotice('');
    try {
      const res = await fetch(`/api/documents/${file.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Delete failed.');
      } else {
        setNotice(`Deleted “${file.filename}”.`);
        router.refresh();
      }
    } catch {
      setError('Network error — please try again.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by file, subject or uploader…"
          className="flex-1 min-w-52 max-w-md rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none"
          aria-label="Search files"
        />
        <p className="text-xs text-slate-500">
          {filtered.length} of {files.length} file(s)
        </p>
      </div>

      {error && (
        <p className="rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-sm px-3 py-2">
          {error}
        </p>
      )}
      {notice && (
        <p className="rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm px-3 py-2">
          {notice}
        </p>
      )}

      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="px-4 py-3">File</th>
              <th className="px-4 py-3">Uploaded by</th>
              <th className="px-4 py-3">Questions</th>
              <th className="px-4 py-3">Used in tests</th>
              <th className="px-4 py-3">Uploaded</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                  No files match.
                </td>
              </tr>
            )}
            {filtered.map((f) => {
              const badge = KIND_BADGES[f.fileKind] || KIND_BADGES.text;
              const busy = busyId === f.id;
              return (
                <tr key={f.id} className="border-t border-slate-100 align-top">
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-900 break-words">{f.filename}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${badge.cls}`}>
                        {badge.label}
                      </span>
                      <span className="text-xs text-slate-500">{f.subject || 'General'}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    {f.uploader ? (
                      <>
                        <p>{f.uploader.name}</p>
                        <p className="text-xs text-slate-500">{f.uploader.email}</p>
                      </>
                    ) : (
                      <span className="text-slate-400">Unknown</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    {f.questionCount > 0 ? (
                      <>
                        {f.questionCount}{' '}
                        {f.draftCount > 0 && (
                          <span className="text-xs text-amber-600">
                            (+{f.draftCount} draft{f.draftCount === 1 ? '' : 's'} missing keys)
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {f.testsCount > 0 ? (
                      <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-700">
                        {f.testsCount} test{f.testsCount === 1 ? '' : 's'}
                      </span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                    {formatDate(f.uploadedAt)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => remove(f)}
                      disabled={busy}
                      className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
                    >
                      {busy ? 'Deleting…' : 'Delete'}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
