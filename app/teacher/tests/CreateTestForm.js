'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FlaskConical, Scale } from 'lucide-react';

const ATTEMPT_OPTIONS = [
  { value: 1, label: '1 (no retakes)' },
  { value: 2, label: '2 attempts' },
  { value: 3, label: '3 attempts' },
  { value: 5, label: '5 attempts' },
  { value: 0, label: 'Unlimited retakes' },
];

export default function CreateTestForm({ documents, preselect }) {
  const router = useRouter();
  const usableDocs = documents.filter((d) => d.questionCount > 0);

  const [selectedIds, setSelectedIds] = useState(() => {
    if (preselect && usableDocs.some((d) => d.id === preselect)) return [preselect];
    return usableDocs.length ? [usableDocs[0].id] : [];
  });
  const [form, setForm] = useState({
    title: '',
    questionCount: 10,
    timeLimitMinutes: 30,
    passingPercentage: 40,
    maxAttempts: 1,
    isPractice: false,
    availableFrom: '',
    availableTo: '',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');

  const selectedDocs = useMemo(
    () => usableDocs.filter((d) => selectedIds.includes(d.id)),
    [usableDocs, selectedIds]
  );

  const maxAvailable = selectedDocs.reduce((sum, d) => sum + d.questionCount, 0);
  const subjectsSelected = new Set(selectedDocs.map((d) => d.subject || 'General')).size;

  const effectiveCount = Math.min(Number(form.questionCount) || 0, maxAvailable);
  // preview of the balanced split, e.g. 10 questions / 2 banks -> 5 + 5
  const splitPreview = useMemo(() => {
    if (selectedDocs.length === 0 || effectiveCount === 0) return [];
    const base = Math.floor(effectiveCount / selectedDocs.length);
    let remainder = effectiveCount % selectedDocs.length;
    return selectedDocs.map((d) => {
      const take = Math.min(base + (remainder > 0 ? 1 : 0), d.questionCount);
      if (remainder > 0) remainder -= 1;
      return { name: d.subject || d.filename, take };
    });
  }, [selectedDocs, effectiveCount]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  function toggle(id) {
    setSelectedIds((ids) =>
      ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]
    );
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setOk('');
    try {
      const res = await fetch('/api/tests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentIds: selectedIds,
          title: form.title,
          questionCount: Number(form.questionCount),
          timeLimitMinutes: Number(form.timeLimitMinutes),
          passingPercentage: Number(form.passingPercentage),
          maxAttempts: Number(form.maxAttempts),
          isPractice: Boolean(form.isPractice),
          // datetime-local values are the teacher's LOCAL wall-clock time.
          // Convert them to real UTC instants in the browser, otherwise the
          // server cannot know the timezone and Nepal (+5:45) shifts them.
          availableFrom: form.availableFrom
            ? new Date(form.availableFrom).toISOString()
            : undefined,
          availableTo: form.availableTo
            ? new Date(form.availableTo).toISOString()
            : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Could not create the test.');
      } else {
        const attempts =
          data.test.isPractice || data.test.maxAttempts === 0
            ? 'unlimited retakes'
            : `${data.test.maxAttempts} attempt${data.test.maxAttempts === 1 ? '' : 's'}`;
        setOk(
          `Created “${data.test.title}”: ${data.test.questionCount} questions, ${data.test.timeLimitMinutes} min, pass at ${data.test.passingPercentage}%, ${attempts}${
            data.test.isPractice ? ' (practice mode)' : ''
          }${data.note ? ` — ${data.note}` : ''}. Students can now take it.`
        );
        setForm((f) => ({ ...f, title: '' }));
        router.refresh();
      }
    } catch {
      setError('Network error — please try again.');
    } finally {
      setBusy(false);
    }
  }

  if (usableDocs.length === 0) {
    return (
      <div className="bg-white border border-dashed border-slate-300 rounded-2xl p-6 text-sm text-slate-500">
        You need at least one question bank with extracted questions before creating a test.
        Upload a PDF on the dashboard and click “Extract questions”.
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-5"
    >
      <div>
        <h2 className="font-bold text-slate-900">Create a new test</h2>
        <p className="text-sm text-slate-600 mt-1">
          Pick one or many question banks — questions are balanced evenly across the
          selected subjects.
        </p>
      </div>

      {/* Bank selection */}
      <div>
        <p className="block text-sm font-medium text-slate-700 mb-2">
          Question banks{' '}
          <span className="text-slate-400 font-normal">
            ({selectedIds.length} selected · {maxAvailable} questions available)
          </span>
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          {usableDocs.map((d) => {
            const checked = selectedIds.includes(d.id);
            return (
              <label
                key={d.id}
                className={`flex items-center gap-3 border rounded-xl px-3 py-2.5 cursor-pointer transition-colors ${
                  checked ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200'
                }`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggle(d.id)}
                  className="accent-indigo-600"
                />
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-medium text-slate-800 truncate">
                    {d.filename}
                  </span>
                  <span className="block text-xs text-slate-500">
                    <span className="inline-flex px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700 font-semibold">
                      {d.subject || 'General'}
                    </span>{' '}
                    {d.chapter ? (
                      <span className="inline-flex px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600 font-semibold">
                        {d.chapter}
                      </span>
                    ) : null}{' '}
                    · {d.questionCount} questions
                  </span>
                </span>
              </label>
            );
          })}
        </div>
      </div>

      {selectedIds.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label htmlFor="title" className="block text-sm font-medium text-slate-700 mb-1">
              Test title
            </label>
            <input
              id="title"
              required
              minLength={3}
              maxLength={200}
              value={form.title}
              onChange={set('title')}
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
              placeholder={
                subjectsSelected > 1
                  ? 'e.g. Combined Practice Test — Science + Math'
                  : 'e.g. Chapter 3 — Science Practice Test'
              }
            />
          </div>

          <div>
            <label
              htmlFor="count"
              className="block text-sm font-medium text-slate-700 mb-1 flex justify-between"
            >
              <span>Number of questions</span>
              <span className="text-xs text-slate-400">max {Math.min(100, maxAvailable)}</span>
            </label>
            <input
              id="count"
              type="number"
              min={1}
              max={Math.min(100, maxAvailable)}
              required
              value={form.questionCount}
              onChange={set('questionCount')}
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
            />
            <p className="text-xs text-slate-500 mt-1">
              Each question carries <strong>1 mark</strong>. 1–100 questions.
            </p>
          </div>

          <div>
            <label
              htmlFor="time"
              className="block text-sm font-medium text-slate-700 mb-1 flex justify-between"
            >
              <span>Time limit (minutes)</span>
              <span className="text-xs text-slate-400">max 180</span>
            </label>
            <input
              id="time"
              type="number"
              min={1}
              max={180}
              required
              value={form.timeLimitMinutes}
              onChange={set('timeLimitMinutes')}
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
            />
          </div>

          <div>
            <label
              htmlFor="passing"
              className="block text-sm font-medium text-slate-700 mb-1 flex justify-between"
            >
              <span>Passing criteria (%)</span>
              <span className="text-xs text-slate-400">default 40%</span>
            </label>
            <input
              id="passing"
              type="number"
              min={1}
              max={100}
              required
              value={form.passingPercentage}
              onChange={set('passingPercentage')}
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
            />
            <p className="text-xs text-slate-500 mt-1">
              Students scoring at or above this percentage pass.
            </p>
          </div>

          <div>
            <label htmlFor="attempts" className="block text-sm font-medium text-slate-700 mb-1">
              <span>Retakes allowed</span>
              <span className="text-xs text-slate-400">students can retake if you allow</span>
            </label>
            <select
              id="attempts"
              value={form.maxAttempts}
              onChange={(e) => setForm((f) => ({ ...f, maxAttempts: Number(e.target.value) }))}
              disabled={form.isPractice}
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm disabled:bg-slate-100 disabled:text-slate-400"
            >
              {ATTEMPT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-start gap-3 bg-sky-50 border border-sky-200 rounded-xl p-3">
            <input
              id="practice"
              type="checkbox"
              checked={form.isPractice}
              onChange={(e) => setForm((f) => ({ ...f, isPractice: e.target.checked }))}
              className="mt-0.5 accent-sky-600"
            />
            <label htmlFor="practice" className="text-sm text-slate-700">
              <span className="font-medium inline-flex items-center gap-1.5"><FlaskConical className="w-4 h-4 inline text-indigo-600" aria-hidden /> Practice mode</span>
              <span className="block text-xs text-slate-500">
                Unlimited retakes, marked “Practice” for students and excluded from progress stats.
              </span>
            </label>
          </div>

          <div>
            <label htmlFor="availableFrom" className="block text-sm font-medium text-slate-700 mb-1">
              <span>Opens (optional)</span>
              <span className="text-xs text-slate-400">schedule the test</span>
            </label>
            <input
              id="availableFrom"
              type="datetime-local"
              value={form.availableFrom || ''}
              onChange={(e) => setForm((f) => ({ ...f, availableFrom: e.target.value }))}
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
            />
          </div>

          <div>
            <label htmlFor="availableTo" className="block text-sm font-medium text-slate-700 mb-1">
              <span>Closes (optional)</span>
              <span className="text-xs text-slate-400">students can&apos;t start after this</span>
            </label>
            <input
              id="availableTo"
              type="datetime-local"
              value={form.availableTo || ''}
              onChange={(e) => setForm((f) => ({ ...f, availableTo: e.target.value }))}
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
            />
            <p className="text-xs text-slate-500 mt-1">
              Leave both empty for “always available”.
            </p>
          </div>

          {selectedIds.length > 1 && effectiveCount > 0 && (
            <div className="sm:col-span-2 bg-indigo-50 border border-indigo-200 rounded-xl p-3 text-xs text-indigo-900">
              <p className="font-semibold mb-1 inline-flex items-center gap-1.5"><Scale className="w-3.5 h-3.5" aria-hidden /> Balanced automatically:</p>
              <p>
                {splitPreview.map((s) => `${s.take} from ${s.name}`).join(' · ')}
              </p>
            </div>
          )}
        </div>
      )}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={busy || selectedIds.length === 0 || !form.title}
          className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold text-sm px-5 py-2.5 rounded-lg"
        >
          {busy ? 'Creating…' : 'Publish test'}
        </button>
        {ok && <p className="text-sm text-emerald-700">{ok}</p>}
      </div>

      {error && (
        <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </p>
      )}
    </form>
  );
}
