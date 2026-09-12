'use client';

import { useState } from 'react';
import { PlusCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function ManualBankForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('');
  const [chapter, setChapter] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const res = await fetch('/api/documents/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, subject, chapter }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Could not create the bank.');
      } else {
        router.push(`/teacher/documents/${data.document.id}`);
      }
    } catch {
      setError('Network error — please try again.');
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full border-2 border-dashed border-slate-300 hover:border-indigo-400 rounded-2xl px-4 py-3 text-sm font-semibold text-slate-600 hover:text-indigo-600 transition-colors"
      >
        <PlusCircle className="w-4 h-4 inline" aria-hidden /> …or create a manual bank and type the questions yourself
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-sky-50 border border-sky-200 rounded-2xl p-5 space-y-3"
    >
      <p className="flex items-center gap-1.5 font-bold text-slate-900 text-sm">
        <PlusCircle className="w-4 h-4 text-indigo-600" aria-hidden /> New manual question bank
      </p>
      <p className="text-xs text-slate-600">
        No file needed — you&apos;ll type the questions on the review page.
      </p>
      <div className="grid sm:grid-cols-3 gap-2">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Bank title, e.g. Friday quiz"
          maxLength={200}
          className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
          required
        />
        <input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Subject (optional)"
          maxLength={60}
          className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
        />
        <input
          value={chapter}
          onChange={(e) => setChapter(e.target.value)}
          placeholder="Chapter (optional)"
          maxLength={60}
          className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
        />
      </div>
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={busy}
          className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold text-sm px-5 py-2.5 rounded-xl"
        >
          {busy ? 'Creating…' : 'Create bank'}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-sm font-semibold text-slate-500 hover:text-slate-700"
        >
          Cancel
        </button>
        {error && <p className="text-sm text-rose-600">{error}</p>}
      </div>
    </form>
  );
}
