'use client';

import { useEffect, useState } from 'react';
import { Megaphone } from 'lucide-react';
import { formatDate } from '@/lib/format';

export default function NoticesPanel() {
  const [notices, setNotices] = useState([]);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');

  async function load() {
    try {
      const res = await fetch('/api/notices');
      if (res.ok) setNotices((await res.json()).notices || []);
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setMsg('');
    setBusy(true);
    try {
      const res = await fetch('/api/notices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, body }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Could not publish the notice.');
      } else {
        setMsg(`Published! Students will see “${data.notice.title}” on their dashboard.`);
        setTitle('');
        setBody('');
        load();
      }
    } catch {
      setError('Network error — please try again.');
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id) {
    if (!confirm('Delete this notice?')) return;
    await fetch(`/api/notices/${id}`, { method: 'DELETE' });
    load();
  }

  return (
    <section className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
      <h2 className="font-bold text-slate-900 flex items-center gap-2">
        <span className="inline-flex w-8 h-8 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
          <Megaphone className="w-4 h-4" aria-hidden />
        </span>
        Post a notice to students
      </h2>
      <p className="text-sm text-slate-600 mt-1">
        Announcements appear on every student&apos;s dashboard — test schedules, reminders, results news.
      </p>

      <form onSubmit={handleSubmit} className="mt-4 space-y-3">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={120}
          placeholder="Notice title — e.g. Science test on Friday"
          className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
          required
        />
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={2000}
          rows={3}
          placeholder="Details — date, time, chapters to study…"
          className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
          required
        />
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={busy}
            className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold text-sm px-5 py-2.5 rounded-xl"
          >
            {busy ? 'Publishing…' : 'Publish notice'}
          </button>
          {msg && <p className="text-sm text-emerald-600">{msg}</p>}
          {error && <p className="text-sm text-rose-600">{error}</p>}
        </div>
      </form>

      {notices.length > 0 && (
        <ul className="mt-6 space-y-3">
          {notices.map((n) => (
            <li key={n.id} className="border border-slate-100 rounded-xl px-4 py-3 flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-sm text-slate-800">{n.title}</p>
                <p className="text-sm text-slate-600 mt-0.5 whitespace-pre-wrap">{n.body}</p>
                <p className="text-xs text-slate-400 mt-1">{formatDate(n.createdAt)}</p>
              </div>
              <button
                onClick={() => handleDelete(n.id)}
                className="text-xs font-semibold text-rose-600 hover:text-rose-800 shrink-0"
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
