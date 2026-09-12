'use client';

/**
 * "Ask your materials" — teachers ask a question, the answer comes from
 * the uploaded question banks (BM25 retrieval + AI answer with citations).
 */

import { useState } from 'react';
import { BookOpen, Send, Loader2 } from 'lucide-react';

export default function GroundedChat() {
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [items, setItems] = useState([]); // [{ q, reply, passages, source }]

  async function ask(e) {
    e.preventDefault();
    const q = query.trim();
    if (q.length < 3 || busy) return;

    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/assistant/grounded', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Something went wrong.');
      } else {
        setItems((prev) =>
          [
            { q, reply: data.reply, passages: data.passages || [], source: data.source },
            ...prev,
          ].slice(0, 5)
        );
        setQuery('');
      }
    } catch {
      setError('Network error — please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
      <div className="flex items-center gap-2">
        <span className="inline-flex w-9 h-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
          <BookOpen className="w-5 h-5" aria-hidden />
        </span>
        <div>
          <h3 className="font-bold text-slate-900">Ask your materials</h3>
          <p className="text-xs text-slate-500">
            Answers come only from your uploaded question banks, with the source shown.
          </p>
        </div>
      </div>

      <form onSubmit={ask} className="flex gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="e.g. What does the book say about magnetic flux?"
          maxLength={500}
          className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none"
          aria-label="Ask your materials"
        />
        <button
          type="submit"
          disabled={busy || query.trim().length < 3}
          className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden /> : <Send className="w-4 h-4" aria-hidden />}
          {busy ? 'Searching…' : 'Ask'}
        </button>
      </form>

      {error && (
        <p className="rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-sm px-3 py-2">
          {error}
        </p>
      )}

      {items.length === 0 && !busy && (
        <p className="text-sm text-slate-500">
          Try asking about a topic in your banks — the matching passages are found
          instantly and the AI explains what they say.
        </p>
      )}

      <div className="space-y-4">
        {items.map((it, i) => (
          <div key={i} className="border-t border-slate-100 pt-4 space-y-2">
            <p className="text-sm font-semibold text-slate-800">{it.q}</p>
            <p className="text-sm text-slate-700 whitespace-pre-wrap">{it.reply}</p>
            {it.passages?.length > 0 && (
              <details className="text-xs">
                <summary className="cursor-pointer text-indigo-600 font-semibold">
                  {it.passages.length} matching passage
                  {it.passages.length === 1 ? '' : 's'} from your banks
                </summary>
                <ul className="mt-2 space-y-2">
                  {it.passages.map((p, j) => (
                    <li key={j} className="rounded-lg bg-slate-50 border border-slate-200 p-2">
                      <span className="font-semibold text-slate-700">
                        {p.filename}
                      </span>
                      <span className="text-slate-400"> · {p.subject}</span>
                      <p className="mt-1 text-slate-600">{p.snippet}</p>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
