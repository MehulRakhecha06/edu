'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

const SUBJECT_SUGGESTIONS = [
  'Mathematics', 'Science', 'Physics', 'Chemistry', 'Biology',
  'English', 'Nepali', 'Social Studies', 'Computer', 'General',
];

const CHAPTER_SUGGESTIONS = [
  'Chapter 1', 'Chapter 2', 'Chapter 3', 'Chapter 4', 'Chapter 5',
  'Chapter 6', 'Chapter 7', 'Chapter 8', 'Chapter 9', 'Chapter 10',
  'Unit 1', 'Unit 2', 'Unit 3', 'Unit 4',
  'Full syllabus', 'Final revision',
];

export default function UploadForm() {
  const router = useRouter();
  const inputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [subject, setSubject] = useState('');
  const [chapter, setChapter] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    if (!file) return;

    setBusy(true);
    setError('');
    setOk('');

    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('subject', subject);
      fd.append('chapter', chapter);

      const res = await fetch('/api/documents', { method: 'POST', body: fd });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Upload failed.');
      } else {
        setOk(
          `Uploaded “${data.document.filename}”${data.document.subject ? ` (${data.document.subject})` : ''}. Now extract its questions below.`
        );
        setFile(null);
        if (inputRef.current) inputRef.current.value = '';
        router.refresh();
      }
    } catch {
      setError('Network error — please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm"
    >
      <h2 className="font-bold text-slate-900">Upload a question bank</h2>
      <p className="text-sm text-slate-600 mt-1">
        PDF, DOCX, TXT/MD — or a <strong>photo/scan of the questions</strong> (PNG, JPG, WEBP).
        Text files work best with numbered questions, options A–D, and an answer key like{' '}
        <code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded">Answer: B</code>.
        For photos and scanned PDFs the AI reads the questions straight from the image. Max 10 MB.
        Upload as many files as you like — one per subject works best.
      </p>

      <div className="mt-4">
        <label htmlFor="subject" className="block text-sm font-medium text-slate-700 mb-1">
          Subject <span className="text-slate-400 font-normal">(optional — for organizing banks)</span>
        </label>
        <input
          id="subject"
          list="subject-suggestions"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          maxLength={60}
          placeholder="e.g. Physics"
          className="w-full sm:max-w-xs rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
        />
        <datalist id="subject-suggestions">
          {SUBJECT_SUGGESTIONS.map((s2) => (
            <option key={s2} value={s2} />
          ))}
        </datalist>
      </div>

      <div className="mt-4">
        <label htmlFor="chapter" className="block text-sm font-medium text-slate-700 mb-1">
          Chapter / unit <span className="text-slate-400 font-normal">(optional — lets you build chapter-wise tests)</span>
        </label>
        <input
          id="chapter"
          list="chapter-suggestions"
          value={chapter}
          onChange={(e) => setChapter(e.target.value)}
          maxLength={60}
          placeholder="e.g. Chapter 2"
          className="w-full sm:max-w-xs rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
        />
        <datalist id="chapter-suggestions">
          {CHAPTER_SUGGESTIONS.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
      </div>

      <div className="mt-4 flex flex-col sm:flex-row gap-3">
        <label className="flex-1 cursor-pointer border-2 border-dashed border-slate-300 hover:border-indigo-400 rounded-xl px-4 py-3 text-sm text-slate-600 flex items-center justify-between gap-3 transition-colors">
          <span className="truncate">{file ? file.name : 'Choose a file — PDF, DOCX, TXT or a photo…'}</span>
          <span className="shrink-0 text-xs font-semibold text-indigo-600">Browse</span>
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,.docx,.txt,.md,.png,.jpg,.jpeg,.webp,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown,image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />
        </label>
        <button
          type="submit"
          disabled={!file || busy}
          className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold text-sm px-5 py-3 rounded-xl"
        >
          {busy ? 'Uploading…' : 'Upload'}
        </button>
      </div>

      {error && (
        <p className="mt-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </p>
      )}
      {ok && (
        <p className="mt-3 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
          {ok}
        </p>
      )}
    </form>
  );
}
