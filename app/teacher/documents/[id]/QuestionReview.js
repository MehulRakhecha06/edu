'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Plus, Pencil, Trash2, Check, Sparkles, Eye } from 'lucide-react';

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

export default function QuestionReview({ documentId, questions, pendingCount, missingKeyCount }) {
  const router = useRouter();
  const [editingId, setEditingId] = useState(null);
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [adding, setAdding] = useState(false);

  // add-question form state
  const [newQ, setNewQ] = useState({ text: '', options: ['', '', '', ''], answer: '' });

  // edit form state (per question)
  const [edit, setEdit] = useState({ text: '', options: [], answer: '' });

  function startEdit(q) {
    setEditingId(q.id);
    setEdit({ text: q.questionText, options: [...q.options], answer: q.correctAnswer || '' });
    setMsg('');
    setError('');
  }

  async function call(path, method, body) {
    const res = await fetch(path, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : {},
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data;
  }

  async function saveEdit(q) {
    setBusy(q.id);
    setError('');
    try {
      await call(`/api/questions/${q.id}`, 'PATCH', {
        questionText: edit.text,
        options: edit.options.filter((o) => o !== ''),
        correctAnswer: edit.answer,
        status: edit.answer ? 'approved' : 'pending',
      });
      setEditingId(null);
      setMsg('Question saved.');
      router.refresh();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy('');
    }
  }

  async function remove(q) {
    if (!confirm('Delete this question? Published tests keep their copy of the results, but new tests will no longer include it.')) return;
    setBusy(q.id);
    try {
      await call(`/api/questions/${q.id}`, 'DELETE');
      setMsg('Question deleted.');
      router.refresh();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy('');
    }
  }

  async function approve(q) {
    if (!q.correctAnswer) {
      setError('This question has no answer yet — add the correct answer first (or use “Complete answer key with AI”).');
      return;
    }
    setBusy(q.id);
    try {
      await call(`/api/questions/${q.id}`, 'PATCH', { status: 'approved' });
      router.refresh();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy('');
    }
  }

  async function approveAll() {
    if (missingKeyCount > 0 && !confirm(`${missingKeyCount} question(s) have no answer key — they will stay as drafts. Approve the rest?`)) return;
    setBusy('all');
    try {
      const data = await call(`/api/documents/${documentId}/approve`, 'POST');
      setMsg(`${data.approved} question(s) approved.`);
      router.refresh();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy('');
    }
  }

  async function completeKey() {
    setBusy('ai');
    setError('');
    setMsg('');
    try {
      const data = await call(`/api/documents/${documentId}/answer-key`, 'POST');
      setMsg(`AI filled in ${data.filled} answer(s). Check them below and approve.`);
      router.refresh();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy('');
    }
  }

  async function addQuestion(e) {
    e.preventDefault();
    setBusy('add');
    setError('');
    try {
      await call('/api/questions', 'POST', {
        documentId,
        questionText: newQ.text,
        options: newQ.options.filter((o) => o !== ''),
        correctAnswer: newQ.answer,
      });
      setNewQ({ text: '', options: ['', '', '', ''], answer: '' });
      setMsg('Question added.');
      router.refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy('');
    }
  }

  function setEditOption(i, v) {
    setEdit((e) => ({ ...e, options: e.options.map((o, j) => (j === i ? v : o)) }));
  }

  return (
    <div className="space-y-4">
      {/* toolbar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-wrap items-center gap-3">
        <p className="text-sm text-slate-600 flex-1 min-w-[200px]">
          <strong>{questions.length}</strong> questions
          {pendingCount > 0 && (
            <span className="ml-1 text-amber-600 font-semibold">· {pendingCount} need review</span>
          )}
          {missingKeyCount > 0 && (
            <span className="ml-1 text-rose-600 font-semibold">· {missingKeyCount} missing answers</span>
          )}
        </p>
        {missingKeyCount > 0 && (
          <button
            onClick={completeKey}
            disabled={busy !== ''}
            className="text-sm font-semibold bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg"
          >
            {busy === 'ai' ? 'Asking the AI…' : (
            <>
              <Sparkles className="w-4 h-4 inline" aria-hidden /> Complete answer key with AI
            </>
          )}
          </button>
        )}
        {pendingCount > 0 && (
          <button
            onClick={approveAll}
            disabled={busy !== ''}
            className="text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg"
          >
            {busy === 'all' ? 'Approving…' : `✓ Approve all${missingKeyCount > 0 ? ' (with answers)' : ''}`}
          </button>
        )}
        <button
          onClick={() => setAdding((a) => !a)}
          className="text-sm font-semibold bg-white border border-slate-300 hover:border-indigo-400 text-slate-700 px-4 py-2 rounded-lg"
        >
          {adding ? 'Close' : (
            <>
              <Plus className="w-4 h-4 inline" aria-hidden /> Add question
            </>
          )}
        </button>
      </div>

      {msg && <p className="text-sm text-emerald-600">{msg}</p>}
      {error && <p className="text-sm text-rose-600">{error}</p>}

      {/* add question form */}
      {adding && (
        <form onSubmit={addQuestion} className="bg-sky-50 border border-sky-200 rounded-2xl p-5 space-y-3">
          <textarea
            value={newQ.text}
            onChange={(e) => setNewQ((f) => ({ ...f, text: e.target.value }))}
            placeholder="Type the question…"
            rows={2}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            required
          />
          <div className="grid sm:grid-cols-2 gap-2">
            {newQ.options.map((o, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-500 w-4">{LETTERS[i]}</span>
                <input
                  value={o}
                  onChange={(e) =>
                    setNewQ((f) => ({ ...f, options: f.options.map((x, j) => (j === i ? e.target.value : x)) }))
                  }
                  placeholder={`Option ${LETTERS[i]}${i > 1 ? ' (optional)' : ''}`}
                  className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <label className="text-sm text-slate-600">Correct answer:</label>
            <select
              value={newQ.answer}
              onChange={(e) => setNewQ((f) => ({ ...f, answer: e.target.value }))}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">I don&apos;t know yet (AI can fill it later)</option>
              {LETTERS.slice(0, Math.max(2, newQ.options.filter((o) => o !== '').length)).map((l) => (
                <option key={l} value={l}>{l}</option>
              ))}
            </select>
            <button
              type="submit"
              disabled={busy !== ''}
              className="ml-auto bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold text-sm px-5 py-2.5 rounded-xl"
            >
              {busy === 'add' ? 'Adding…' : 'Add question'}
            </button>
          </div>
        </form>
      )}

      {/* question list */}
      {questions.length === 0 ? (
        <div className="bg-white border border-dashed border-slate-300 rounded-2xl p-10 text-center text-sm text-slate-500">
          No questions yet — extract them from the file on the dashboard, or add them manually with
          the button above.
        </div>
      ) : (
        <ul className="space-y-3">
          {questions.map((q) => (
            <li
              key={q.id}
              className={`bg-white border rounded-2xl p-4 ${
                q.status === 'pending' ? 'border-amber-300' : 'border-slate-200'
              }`}
            >
              {editingId === q.id ? (
                <div className="space-y-3">
                  <textarea
                    value={edit.text}
                    onChange={(e) => setEdit((f) => ({ ...f, text: e.target.value }))}
                    rows={2}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                  <div className="grid sm:grid-cols-2 gap-2">
                    {edit.options.map((o, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-500 w-4">{LETTERS[i]}</span>
                        <input
                          value={o}
                          onChange={(e) => setEditOption(i, e.target.value)}
                          className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
                        />
                      </div>
                    ))}
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <label className="text-sm text-slate-600">Answer:</label>
                    <select
                      value={edit.answer}
                      onChange={(e) => setEdit((f) => ({ ...f, answer: e.target.value }))}
                      className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    >
                      <option value="">No answer yet</option>
                      {LETTERS.slice(0, edit.options.length).map((l) => (
                        <option key={l} value={l}>{l}</option>
                      ))}
                    </select>
                    <div className="ml-auto flex gap-2">
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="text-sm font-semibold text-slate-500 hover:text-slate-700 px-3 py-2"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => saveEdit(q)}
                        disabled={busy !== ''}
                        className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold text-sm px-4 py-2 rounded-lg"
                      >
                        Save
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-800">
                      <span className="text-slate-400 mr-1">{q.index}.</span>
                      {q.questionText}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      {q.options.map((o, i) => `${LETTERS[i]}) ${o}`).join(' · ')}
                    </p>
                    <p className="flex flex-wrap gap-2 items-center mt-2 text-xs">
                      {q.correctAnswer ? (
                        <span className="font-bold text-emerald-700 bg-emerald-100 rounded-full px-2 py-0.5">
                          Answer: {q.correctAnswer}
                        </span>
                      ) : (
                        <span className="font-bold text-rose-700 bg-rose-100 rounded-full px-2 py-0.5">
                          no answer key
                        </span>
                      )}
                      {q.status === 'pending' && (
                        <span className="font-bold text-amber-700 bg-amber-100 rounded-full px-2 py-0.5">
                          needs review
                        </span>
                      )}
                      {q.duplicate && (
                        <span className="font-bold text-orange-700 bg-orange-100 rounded-full px-2 py-0.5">
                          possible duplicate of another bank
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-1 shrink-0">
                    {q.status !== 'approved' && (
                      <button
                        onClick={() => approve(q)}
                        disabled={busy !== ''}
                        className="text-xs font-semibold text-emerald-700 hover:bg-emerald-50 border border-emerald-200 rounded-lg px-2.5 py-1.5"
                      >
                        <Check className="w-3.5 h-3.5 inline" aria-hidden /> Approve
                      </button>
                    )}
                    <button
                      onClick={() => startEdit(q)}
                      className="text-xs font-semibold text-indigo-700 hover:bg-indigo-50 border border-indigo-200 rounded-lg px-2.5 py-1.5"
                    >
                      <Pencil className="w-3.5 h-3.5 inline" aria-hidden /> Edit
                    </button>
                    <button
                      onClick={() => remove(q)}
                      disabled={busy !== ''}
                      className="text-xs font-semibold text-rose-700 hover:bg-rose-50 border border-rose-200 rounded-lg px-2.5 py-1.5"
                    >
                      <Trash2 className="w-3.5 h-3.5 inline" aria-hidden />
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
