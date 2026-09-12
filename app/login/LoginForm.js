'use client';

import { useState } from 'react';
import { Crown, Presentation, GraduationCap, User } from 'lucide-react';
import { signIn } from 'next-auth/react';
import Link from 'next/link';

const ROLE_ICONS = { ADMIN: Crown, TEACHER: Presentation, STUDENT: GraduationCap };

export default function LoginForm({ demoUsers = [] }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (!email.trim() || !password) {
      setError('Please enter your email and password.');
      return;
    }

    setBusy(true);
    try {
      // redirect: false so we can show errors inline.
      // On success we go to '/' — the home page reads the session
      // SERVER-SIDE and routes each role to its own dashboard.
      const res = await signIn('credentials', { email, password, redirect: false });

      if (res?.error) {
        if (res.error === 'CredentialsSignin') {
          setError('Invalid email or password.');
        } else {
          // MissingCSRF etc. — almost always cookies being blocked, e.g. when
          // the app is viewed inside an embedded preview iframe.
          setError(
            'Sign-in could not start because cookies are blocked in this view. ' +
              'If you are inside an embedded preview, open it in a full browser tab (↗) and try again.'
          );
        }
        setBusy(false);
        return;
      }

      window.location.href = '/';
    } catch {
      setError('Something went wrong. Please try again.');
      setBusy(false);
    }
  }

  return (
    <>
      <div className="text-center mb-8">
        <Link href="/" className="inline-flex items-center gap-2 font-bold text-xl">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Aimmers Nepal logo" className="w-8 h-8 rounded-lg object-cover" />
          Aimmers<span className="text-indigo-600"> Nepal</span>
        </Link>
        <h1 className="mt-4 text-2xl font-bold text-slate-900">Welcome back</h1>
        <p className="mt-1 text-sm text-slate-600">Sign in to continue to your dashboard</p>
      </div>

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
          <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1">
            Email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
            placeholder="you@school.edu"
          />
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-1">
            Password
          </label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
            placeholder="••••••••"
          />
        </div>

        <button
          type="submit"
          disabled={busy}
          className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold py-2.5 rounded-lg transition-colors"
        >
          {busy ? 'Signing in…' : 'Sign in'}
        </button>

        {demoUsers.length > 0 && (
          <div className="pt-1">
            <p className="text-xs text-slate-500 text-center mb-2">
              Quick fill (demo mode):
            </p>
            <div className="grid grid-cols-3 gap-2">
              {demoUsers.map((u) => {
                const RoleIcon = ROLE_ICONS[u.role] || User;
                return (
                <button
                  key={u.email}
                  type="button"
                  onClick={() => {
                    setEmail(u.email);
                    setPassword(u.password);
                    setError('');
                  }}
                  title={`${u.email} / ${u.password}`}
                  className="border border-slate-300 hover:border-indigo-400 hover:bg-indigo-50 rounded-lg px-2 py-2 text-xs font-semibold text-slate-700 transition-colors"
                >
                  <RoleIcon className="w-3.5 h-3.5 inline text-slate-400" aria-hidden />{' '}
                  {u.role === 'ADMIN' ? 'Admin' : u.role === 'TEACHER' ? 'Teacher' : 'Student'}
                </button>
                );
              })}
            </div>
          </div>
        )}

        <p className="text-center text-sm text-slate-600">
          New here?{' '}
          <Link href="/register" className="font-medium text-indigo-600 hover:underline">
            Create a student account
          </Link>
        </p>
      </form>
    </>
  );
}
