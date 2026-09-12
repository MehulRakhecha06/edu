'use client';

/**
 * The little assistant in the bottom-right corner.
 * Public (works for guests), rate-limited server-side, remembers the last
 * few messages of the conversation. Shows which AI backend is answering
 * (locally hosted model / Hugging Face / built-in fallback).
 */

import { useEffect, useRef, useState } from 'react';
import { Bot, X, Send } from 'lucide-react';

const SUGGESTIONS = [
  'What is Aimmers Nepal?',
  'How do I create a test?',
  'Can the AI run locally?',
  'How do accounts work?',
];

const AI_LABELS = {
  local: (info) => `local AI · ${info.model}`,
  huggingface: () => 'Hugging Face AI',
  fallback: () => 'built-in answers',
};

export default function AssistantWidget() {
  const [open, setOpen] = useState(false);
  const [aiInfo, setAiInfo] = useState(null);
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: "Hi! I'm the Aimmers Nepal assistant 🤖 — ask me anything about how this app works.",
    },
  ]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const listRef = useRef(null);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages, open]);

  // Fetch which AI backend is live (shown in the panel header)
  useEffect(() => {
    if (!open || aiInfo !== null) return;
    fetch('/api/health')
      .then((r) => r.json())
      .then((d) => setAiInfo(d?.ai || { provider: 'fallback', model: null }))
      .catch(() => setAiInfo({ provider: 'fallback', model: null }));
  }, [open, aiInfo]);

  const aiLabel = aiInfo ? (AI_LABELS[aiInfo.provider] || AI_LABELS.fallback)(aiInfo) : null;

  async function send(text) {
    const message = (text ?? input).trim();
    if (!message || busy) return;

    setInput('');
    setBusy(true);
    const history = messages.slice(-6);
    setMessages((m) => [...m, { role: 'user', content: message }]);

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, history }),
      });
      const data = await res.json();
      setMessages((m) => [
        ...m,
        {
          role: 'assistant',
          content:
            data.reply ||
            data.error ||
            'Sorry, something went wrong. Please try again in a moment.',
        },
      ]);
    } catch {
      setMessages((m) => [
        ...m,
        { role: 'assistant', content: 'Network error — please try again.' },
      ]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {/* Floating button */}
      <button
        type="button"
        aria-label={open ? 'Close assistant' : 'Open assistant'}
        onClick={() => setOpen((o) => !o)}
        className="fixed bottom-5 right-5 z-50 w-14 h-14 rounded-full bg-indigo-600 text-white text-2xl shadow-lg shadow-indigo-600/30 hover:bg-indigo-700 transition-colors flex items-center justify-center"
      >
        {open ? <X className="w-6 h-6" aria-hidden /> : <Bot className="w-6 h-6" aria-hidden />}
      </button>

      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-24 right-5 z-50 w-[calc(100vw-2.5rem)] sm:w-96 h-[28rem] rounded-2xl bg-white border border-slate-200 shadow-2xl flex flex-col overflow-hidden">
          <div className="bg-indigo-600 text-white px-4 py-3">
            <div className="flex items-center justify-between gap-2">
              <p className="font-semibold text-sm flex items-center gap-1.5">
                <Bot className="w-4 h-4" aria-hidden /> Aimmers Assistant
              </p>
              {aiLabel && (
                <span className="text-[10px] font-semibold bg-indigo-500/60 border border-indigo-400/40 rounded-full px-2 py-0.5">
                  {aiLabel}
                </span>
              )}
            </div>
            <p className="text-indigo-200 text-xs">Ask me about the app</p>
          </div>

          <div ref={listRef} className="flex-1 overflow-y-auto p-3 space-y-2.5">
            {messages.map((m, i) => (
              <div
                key={i}
                className={`max-w-[85%] px-3 py-2 rounded-xl text-sm leading-relaxed ${
                  m.role === 'user'
                    ? 'ml-auto bg-indigo-600 text-white rounded-br-sm'
                    : 'mr-auto bg-slate-100 text-slate-800 rounded-bl-sm'
                }`}
              >
                {m.content}
              </div>
            ))}
            {busy && (
              <div className="mr-auto bg-slate-100 text-slate-500 px-3 py-2 rounded-xl text-sm rounded-bl-sm">
                Thinking…
              </div>
            )}
          </div>

          {messages.length <= 1 && (
            <div className="px-3 pb-2 flex flex-wrap gap-1.5">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => send(s)}
                  className="text-xs px-2.5 py-1.5 rounded-full border border-indigo-200 text-indigo-700 hover:bg-indigo-50"
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
            className="border-t border-slate-200 p-2 flex gap-2"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              maxLength={500}
              placeholder="Type a question…"
              className="flex-1 min-w-0 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none"
            />
            <button
              type="submit"
              disabled={busy || !input.trim()}
              aria-label="Send"
              className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white text-sm font-medium px-4 rounded-lg inline-flex items-center gap-1.5"
            >
              <Send className="w-4 h-4" aria-hidden /> Send
            </button>
          </form>
        </div>
      )}
    </>
  );
}
