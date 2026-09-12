'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, Terminal, Cloud, Monitor } from 'lucide-react';

const PROVIDER_BADGES = {
  local: { label: 'Local model', cls: 'bg-emerald-100 text-emerald-700' },
  huggingface: { label: 'Hugging Face', cls: 'bg-indigo-100 text-indigo-700' },
  fallback: { label: 'Built-in answers', cls: 'bg-slate-200 text-slate-700' },
};

function EffectiveCard({ effective }) {
  const badge = PROVIDER_BADGES[effective?.provider] || PROVIDER_BADGES.fallback;
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
        Active right now
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${badge.cls}`}>
          {badge.label}
        </span>
        {effective?.model && (
          <code className="text-sm text-slate-700 bg-slate-100 px-2 py-1 rounded">
            {effective.model}
          </code>
        )}
        {effective?.source && (
          <span className="text-xs text-slate-500">
            · set by {effective.source === 'admin' ? 'you (admin)' : 'environment (.env.local)'}
          </span>
        )}
      </div>
      {effective?.note && (
        <p className="mt-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          <AlertTriangle className="w-4 h-4 inline" aria-hidden /> {effective.note}
        </p>
      )}
      {effective?.pythonService && (
        <p className="mt-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
          <Terminal className="w-4 h-4 inline" aria-hidden /> Connected to the Aimmers Python AI service
          {effective.pythonService.version ? ` (v${effective.pythonService.version})` : ''}
          {effective.pythonService.backend ? ` — backend: ${effective.pythonService.backend}` : ''}.
          Questions parsing, explanations and the assistant are handled in Python.
        </p>
      )}
      <p className="mt-2 text-xs text-slate-500">
        Check the live status anytime at <code>/api/health</code>.
      </p>
    </div>
  );
}

export default function AiSettingsForm() {
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    provider: 'auto',
    local: { baseUrl: '', model: '', apiKey: '' },
    huggingface: { model: '', apiKey: '' },
    removeApiKey: false,
    removeLocalApiKey: false,
  });
  // test results render INLINE, right under the button that was pressed —
  // a single message box at the top of a long page is easy to miss entirely.
  const [testResult, setTestResult] = useState({}); // { local: {type,text}, huggingface: {...} }
  const [saved, setSaved] = useState(null); // { provider, hasApiKey, apiKeyHint }
  const [env, setEnv] = useState(null);
  const [effective, setEffective] = useState(null);
  const [message, setMessage] = useState(null); // { type: 'ok'|'err'|'warn', text }
  const [busy, setBusy] = useState(false);
  const [testing, setTesting] = useState(null); // 'local' | 'huggingface'

  async function load() {
    try {
      const res = await fetch('/api/admin/ai/settings');
      const data = await res.json();
      if (!res.ok) {
        setMessage({ type: 'err', text: data.error || 'Failed to load settings.' });
        return;
      }
      setForm({
        provider: data.setting.provider,
        local: {
          baseUrl: data.setting.local.baseUrl,
          model: data.setting.local.model,
          apiKey: '',
        },
        huggingface: { model: data.setting.huggingface.model, apiKey: '' },
        removeApiKey: false,
        removeLocalApiKey: false,
      });
      setSaved(data.setting);
      setEnv(data.environment);
      setEffective(data.effective);
    } catch {
      setMessage({ type: 'err', text: 'Network error — could not load settings.' });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const set = (path, value) =>
    setForm((f) => {
      const next = structuredClone(f);
      if (path.includes('.')) {
        const [section, key] = path.split('.');
        next[section][key] = value;
      } else {
        next[path] = value;
      }
      return next;
    });

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch('/api/admin/ai/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ type: 'err', text: data.error || 'Could not save.' });
      } else {
        setMessage({
          type: data.warning ? 'warn' : 'ok',
          text: data.warning || 'Saved — the app now uses the selected AI provider.',
        });
        await load();
      }
    } catch {
      setMessage({ type: 'err', text: 'Network error — could not save.' });
    } finally {
      setBusy(false);
    }
  }

  async function test(provider) {
    setTesting(provider);
    setTestResult((r) => ({ ...r, [provider]: null }));
    try {
      const res = await fetch('/api/admin/ai/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider,
          baseUrl: form.local.baseUrl,
          model: provider === 'local' ? form.local.model : form.huggingface.model,
          apiKey: provider === 'local' ? form.local.apiKey : form.huggingface.apiKey,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setTestResult((r) => ({
          ...r,
          [provider]: { type: 'err', text: data.error || 'Test failed.' },
        }));
      } else {
        setTestResult((r) => ({
          ...r,
          [provider]: {
            type: data.ok ? 'ok' : 'err',
            text: `${data.ok ? '✓' : '✗'} ${data.message}${data.ok ? ` (${data.latencyMs} ms)` : ''}`,
          },
        }));
      }
    } catch {
      setTestResult((r) => ({
        ...r,
        [provider]: { type: 'err', text: 'Network error — test failed.' },
      }));
    } finally {
      setTesting(null);
    }
  }

  if (loading) {
    return (
      <div className="space-y-4" aria-label="Loading settings">
        <div className="skeleton h-5 w-40" />
        <div className="skeleton h-10 w-full" />
        <div className="skeleton h-5 w-32" />
        <div className="skeleton h-10 w-full" />
        <div className="skeleton h-10 w-32" />
      </div>
    );
  }

  return (
    <form onSubmit={save} className="space-y-6">
      {effective && <EffectiveCard effective={effective} />}

      {message && (
        <p
          className={`text-sm rounded-lg px-3 py-2 border ${
            message.type === 'ok'
              ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
              : message.type === 'warn'
                ? 'text-amber-800 bg-amber-50 border-amber-200'
                : 'text-red-700 bg-red-50 border-red-200'
          }`}
        >
          {message.text}
        </p>
      )}

      {/* Provider choice */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-3">
        <h2 className="font-bold text-slate-900">Which AI should the app use?</h2>

        <label
          className={`flex gap-3 border rounded-xl p-4 cursor-pointer transition-colors ${
            form.provider === 'auto' ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200'
          }`}
        >
          <input
            type="radio"
            name="provider"
            checked={form.provider === 'auto'}
            onChange={() => set('provider', 'auto')}
            className="mt-1 accent-indigo-600"
          />
          <span>
            <span className="font-semibold text-slate-900 text-sm">Automatic</span>
            <span className="block text-xs text-slate-600 mt-0.5">
              Use whatever is configured — admin settings first, then{' '}
              <code>.env.local</code>. Local model has priority.
            </span>
          </span>
        </label>

        <label
          className={`flex gap-3 border rounded-xl p-4 cursor-pointer transition-colors ${
            form.provider === 'local' ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200'
          }`}
        >
          <input
            type="radio"
            name="provider"
            checked={form.provider === 'local'}
            onChange={() => set('provider', 'local')}
            className="mt-1 accent-indigo-600"
          />
          <span>
            <span className="font-semibold text-slate-900 text-sm">
              <Monitor className="w-4 h-4 inline" aria-hidden /> Local model / other
              provider
            </span>
            <span className="block text-xs text-slate-600 mt-0.5">
              Your own AI on your own server (Ollama, LM Studio, llama.cpp, vLLM…) —
              unlimited and free — or any OpenAI-compatible cloud API (Mistral, Groq,
              Gemini, OpenRouter…).
            </span>
          </span>
        </label>

        <label
          className={`flex gap-3 border rounded-xl p-4 cursor-pointer transition-colors ${
            form.provider === 'huggingface'
              ? 'border-indigo-500 bg-indigo-50'
              : 'border-slate-200'
          }`}
        >
          <input
            type="radio"
            name="provider"
            checked={form.provider === 'huggingface'}
            onChange={() => set('provider', 'huggingface')}
            className="mt-1 accent-indigo-600"
          />
          <span>
            <span className="font-semibold text-slate-900 text-sm"><Cloud className="w-4 h-4 inline" aria-hidden /> Hugging Face</span>
            <span className="block text-xs text-slate-600 mt-0.5">
              Hosted for you — best when the app runs on Vercel.
            </span>
          </span>
        </label>
      </div>

      {/* Local model config */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-bold text-slate-900">Local model / other provider</h2>
          <button
            type="button"
            onClick={() => test('local')}
            disabled={testing === 'local'}
            className="text-xs font-semibold text-indigo-700 hover:bg-indigo-50 border border-indigo-200 rounded-lg px-3 py-1.5 disabled:opacity-50"
          >
            {testing === 'local' ? 'Testing…' : 'Test connection'}
          </button>
        </div>
        {testResult.local && (
          <p
            className={`text-sm rounded-lg px-3 py-2 border ${
              testResult.local.type === 'ok'
                ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                : 'text-red-700 bg-red-50 border-red-200'
            }`}
          >
            {testResult.local.text}
          </p>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="localUrl" className="block text-sm font-medium text-slate-700 mb-1">
              Base URL
            </label>
            <input
              id="localUrl"
              value={form.local.baseUrl}
              onChange={(e) => set('local.baseUrl', e.target.value)}
              placeholder="http://localhost:11434/v1"
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm font-mono"
            />
            <p className="text-xs text-slate-500 mt-1">
              Ollama <code>:11434/v1</code> · LM Studio <code>:1234/v1</code> ·{' '}
              <strong>Aimmers Python service</strong> <code>:8000/v1</code> (auto-detected)
              — or any OpenAI-compatible cloud API (see below).
            </p>
          </div>
          <div>
            <label htmlFor="localModel" className="block text-sm font-medium text-slate-700 mb-1">
              Model name
            </label>
            <input
              id="localModel"
              value={form.local.model}
              onChange={(e) => set('local.model', e.target.value)}
              placeholder="llama3.2:1b"
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm font-mono"
            />
            <p className="text-xs text-slate-500 mt-1">
              Light &amp; free: <code>llama3.2:1b</code> · better extraction:{' '}
              <code>qwen2.5:3b</code>
            </p>
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="localKey" className="block text-sm font-medium text-slate-700 mb-1">
              API key{' '}
              {saved?.local?.hasApiKey && !form.removeLocalApiKey && (
                <span className="font-normal text-xs text-slate-500">
                  (saved: {saved.local.apiKeyHint} — leave blank to keep)
                </span>
              )}
            </label>
            <input
              id="localKey"
              type="password"
              value={form.local.apiKey}
              onChange={(e) => set('local.apiKey', e.target.value)}
              placeholder="Only needed for cloud APIs (Mistral, Groq, Gemini, OpenRouter…) — leave empty for Ollama"
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm font-mono"
              autoComplete="off"
            />
            <label className="flex items-center gap-2 mt-2 text-xs text-slate-600">
              <input
                type="checkbox"
                checked={form.removeLocalApiKey}
                onChange={(e) => set('removeLocalApiKey', e.target.checked)}
                className="accent-red-600"
              />
              Remove the saved key
            </label>
          </div>
        </div>

        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs text-slate-600 leading-relaxed">
          <p className="font-semibold text-slate-800">
            Works with your own model AND free cloud APIs
          </p>
          <p className="mt-1">
            Any OpenAI-compatible endpoint works — paste the Base URL, model and API
            key from the provider:
          </p>
          <ul className="mt-2 space-y-1">
            <li>
              <strong>Mistral</strong> (free tier, ~1B tokens/mo):{' '}
              <code>https://api.mistral.ai/v1</code> · model{' '}
              <code>open-mistral-nemo</code> or <code>mistral-small-latest</code> — key
              at console.mistral.ai
            </li>
            <li>
              <strong>Groq</strong> (free, very fast, no card):{' '}
              <code>https://api.groq.com/openai/v1</code> · model{' '}
              <code>llama-3.3-70b-versatile</code> — key at console.groq.com
            </li>
            <li>
              <strong>Google Gemini</strong> (generous free tier):{' '}
              <code>https://generativelanguage.googleapis.com/v1beta/openai</code> ·
              model <code>gemini-2.0-flash</code> — key at aistudio.google.com
            </li>
            <li>
              <strong>OpenRouter</strong> (many models, free ones marked{' '}
              <code>:free</code>): <code>https://openrouter.ai/api/v1</code> — key at
              openrouter.ai
            </li>
          </ul>
        </div>
        {env?.hasLocalUrl && !form.local.baseUrl && (
          <p className="text-xs text-slate-500">
            Note: <code>.env.local</code> already defines a local AI (
            <code>{env.localModel || 'default model'}</code>) — it will be used when
            &quot;Local&quot; is selected without a URL above.
          </p>
        )}
      </div>

      {/* Hugging Face config */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-bold text-slate-900">Hugging Face</h2>
          <button
            type="button"
            onClick={() => test('huggingface')}
            disabled={testing === 'huggingface'}
            className="text-xs font-semibold text-indigo-700 hover:bg-indigo-50 border border-indigo-200 rounded-lg px-3 py-1.5 disabled:opacity-50"
          >
            {testing === 'huggingface' ? 'Testing…' : 'Test connection'}
          </button>
        </div>
        {testResult.huggingface && (
          <p
            className={`text-sm rounded-lg px-3 py-2 border ${
              testResult.huggingface.type === 'ok'
                ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                : 'text-red-700 bg-red-50 border-red-200'
            }`}
          >
            {testResult.huggingface.text}
          </p>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="hfKey" className="block text-sm font-medium text-slate-700 mb-1">
              API key{' '}
              {saved?.huggingface?.hasApiKey && !form.removeApiKey && (
                <span className="font-normal text-xs text-slate-500">
                  (saved: {saved.huggingface.apiKeyHint} — leave blank to keep)
                </span>
              )}
            </label>
            <input
              id="hfKey"
              type="password"
              value={form.huggingface.apiKey}
              onChange={(e) => set('huggingface.apiKey', e.target.value)}
              placeholder="hf_..."
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm font-mono"
              autoComplete="off"
            />
            <label className="flex items-center gap-2 mt-2 text-xs text-slate-600">
              <input
                type="checkbox"
                checked={form.removeApiKey}
                onChange={(e) => set('removeApiKey', e.target.checked)}
                className="accent-red-600"
              />
              Remove the saved key
            </label>
          </div>
          <div>
            <label htmlFor="hfModel" className="block text-sm font-medium text-slate-700 mb-1">
              Model (optional)
            </label>
            <input
              id="hfModel"
              value={form.huggingface.model}
              onChange={(e) => set('huggingface.model', e.target.value)}
              placeholder="Qwen/Qwen2.5-7B-Instruct"
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm font-mono"
            />
          </div>
        </div>

        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs text-slate-600 leading-relaxed">
          <p className="font-semibold text-slate-800">Is Hugging Face free?</p>
          <p className="mt-1">
            Partially. The <strong>free plan</strong> includes only a small amount of
            inference credits per month (~$0.10) with rate limits — enough to try it and
            run short demos. For a whole class you would need <strong>PRO ($9/month)</strong>.
            A <strong>locally hosted model is unlimited and completely free</strong> — that&apos;s
            the recommended option for regular school use. Get a free token at{' '}
            <a
              href="https://huggingface.co/settings/tokens"
              target="_blank"
              rel="noreferrer"
              className="text-indigo-600 font-medium hover:underline"
            >
              huggingface.co/settings/tokens
            </a>
            .
          </p>
          {env?.hasHuggingFaceKey && (
            <p className="mt-2">
              Note: <code>.env.local</code> already defines a Hugging Face key — it is used
              when no key is saved here.
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={busy}
          className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold text-sm px-5 py-2.5 rounded-lg"
        >
          {busy ? 'Saving…' : 'Save AI settings'}
        </button>
        <Link href="/admin" className="text-sm font-medium text-slate-500 hover:text-slate-800">
          ← Back to admin dashboard
        </Link>
      </div>
    </form>
  );
}
