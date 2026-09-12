'use client';

import { useState } from 'react';
import { PartyPopper } from 'lucide-react';
import Link from 'next/link';

export default function RegisterPage() {
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' });
  const [error, setError] = useState('');
  const [ok, setOk] = useState(false);
  const [busy, setBusy] = useState(false);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (form.password !== form.confirm) {
      setError('Passwords do not match.');
      return;
    }
    if (form.password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    setBusy(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: form.name, email: form.email, password: form.password }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Registration failed.');
        setBusy(false);
        return;
      }
      setOk(true);
    } catch {
      setError('Network error — please try again.');
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 font-bold text-xl">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="Aimmers Nepal logo" className="w-8 h-8 rounded-lg object-cover" />
            Aimmers<span className="text-indigo-600"> Nepal</span>
          </Link>
          <h1 className="mt-4 text-2xl font-bold text-slate-900">Create your student account</h1>
          <p className="mt-1 text-sm text-slate-600">
            Free account for students — take mock tests instantly
          </p>
        </div>

        {ok ? (
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-8 text-center">
            <PartyPopper className="w-10 h-10 mx-auto text-emerald-500" aria-hidden />
            <h2 className="mt-3 font-bold text-lg text-slate-900">Almost there!</h2>
            <p className="mt-1 text-sm text-slate-600">
              If this email is new, your student account is ready — go to sign-in and
              use the email and password you just chose.
            </p>
            <p className="mt-2 text-xs text-slate-400">
              If signing in fails, this email may already have an account (for example
              from an earlier registration or your teacher&apos;s class list) — ask your
              teacher or the admin to reset your password.
            </p>
            <Link
              href="/login"
              className="mt-5 inline-block bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-6 py-2.5 rounded-lg"
            >
              Go to sign in
            </Link>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 sm:p-8 space-y-5"
          >
            {error && (
              <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <div>
              <label htmlFor="name" className="block text-sm font-medium text-slate-700 mb-1">
                Full name
              </label>
              <input
                id="name"
                required
                minLength={2}
                maxLength={100}
                value={form.name}
                onChange={set('name')}
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
                placeholder="Sam Student"
              />
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1">
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={form.email}
                onChange={set('email')}
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
                placeholder="you@school.edu"
              />
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="password"
                  className="block text-sm font-medium text-slate-700 mb-1"
                >
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  value={form.password}
                  onChange={set('password')}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
                  placeholder="At least 8 characters"
                />
              </div>
              <div>
                <label
                  htmlFor="confirm"
                  className="block text-sm font-medium text-slate-700 mb-1"
                >
                  Confirm
                </label>
                <input
                  id="confirm"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  value={form.confirm}
                  onChange={set('confirm')}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
                  placeholder="Repeat password"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={busy}
              className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold py-2.5 rounded-lg transition-colors"
            >
              {busy ? 'Creating account…' : 'Create account'}
            </button>

            <p className="text-center text-sm text-slate-600">
              Already have an account?{' '}
              <Link href="/login" className="font-medium text-indigo-600 hover:underline">
                Sign in
              </Link>
            </p>
          </form>
        )}
      </div>
    </main>
  );
}
