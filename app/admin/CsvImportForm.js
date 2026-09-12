'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FileUp } from 'lucide-react';

export default function CsvImportForm() {
  const router = useRouter();
  const inputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setResult(null);
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/admin/users/import', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Import failed.');
      } else {
        setResult(data);
        if (inputRef.current) inputRef.current.value = '';
        setFile(null);
        router.refresh();
      }
    } catch {
      setError('Network error — please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
      <h2 className="flex items-center gap-2 font-bold text-slate-900"><FileUp className="w-4.5 h-4.5 text-indigo-600" aria-hidden /> Import students from CSV</h2>
      <p className="text-sm text-slate-600 mt-1">
        Add a whole class in one go. CSV columns: <code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded">name, email, password</code> —
        with or without a header row. Every row becomes a <strong>student</strong> account (passwords
        must be 8+ characters). Duplicate emails are skipped and reported.
      </p>
      <form onSubmit={handleSubmit} className="mt-4 flex flex-col sm:flex-row gap-3">
        <label className="flex-1 cursor-pointer border-2 border-dashed border-slate-300 hover:border-indigo-400 rounded-xl px-4 py-3 text-sm text-slate-600 flex items-center justify-between gap-3 transition-colors">
          <span className="truncate">{file ? file.name : 'Choose a .csv file…'}</span>
          <span className="shrink-0 text-xs font-semibold text-indigo-600">Browse</span>
          <input
            ref={inputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />
        </label>
        <button
          type="submit"
          disabled={!file || busy}
          className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold text-sm px-5 py-3 rounded-xl"
        >
          {busy ? 'Importing…' : 'Import students'}
        </button>
      </form>

      {error && <p className="text-sm text-rose-600 mt-3">{error}</p>}

      {result && (
        <div className="mt-4 border border-slate-100 rounded-xl p-4 text-sm space-y-2">
          <p>
            <span className="font-bold text-emerald-600">{result.createdCount} created</span>
            {result.skippedCount > 0 && (
              <>
                {' '}· <span className="font-bold text-amber-600">{result.skippedCount} skipped</span>
              </>
            )}
          </p>
          {result.skipped?.length > 0 && (
            <ul className="text-xs text-slate-500 space-y-0.5 max-h-32 overflow-y-auto">
              {result.skipped.map((s, i) => (
                <li key={i}>
                  Row {s.row}: {s.reason}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
