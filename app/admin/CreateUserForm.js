'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const ROLE_HINTS = {
  TEACHER: 'Can upload question banks and create tests',
  STUDENT: 'Can take tests and see AI explanations',
  ADMIN: 'Full access — manage all accounts',
};

export default function CreateUserForm() {
  const router = useRouter();
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'TEACHER' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function handleSubmit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setOk('');
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Could not create the account.');
      } else {
        setOk(`Created ${data.user.role.toLowerCase()} account for ${data.user.email}.`);
        setForm((f) => ({ ...f, name: '', email: '', password: '' }));
        router.refresh();
      }
    } catch {
      setError('Network error — please try again.');
    } finally {
      setBusy(false);
    }
  }

  function makePassword() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$';
    let pw = '';
    for (let i = 0; i < 12; i++) pw += chars[Math.floor(Math.random() * chars.length)];
    setForm((f) => ({ ...f, password: pw }));
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4"
    >
      <div>
        <h2 className="font-bold text-slate-900">Add an account</h2>
        <p className="text-sm text-slate-600 mt-1">
          Create a student, teacher, or another admin. (Students can also sign up
          themselves on the Register page.)
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label htmlFor="cu-name" className="block text-sm font-medium text-slate-700 mb-1">
            Full name
          </label>
          <input
            id="cu-name"
            required
            minLength={2}
            maxLength={100}
            value={form.name}
            onChange={set('name')}
            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
            placeholder="Maya Teacher"
          />
        </div>
        <div>
          <label htmlFor="cu-email" className="block text-sm font-medium text-slate-700 mb-1">
            Email
          </label>
          <input
            id="cu-email"
            type="email"
            required
            value={form.email}
            onChange={set('email')}
            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
            placeholder="teacher@school.edu"
          />
        </div>
        <div>
          <label
            htmlFor="cu-password"
            className="block text-sm font-medium text-slate-700 mb-1 flex justify-between"
          >
            <span>Password</span>
            <button
              type="button"
              onClick={makePassword}
              className="text-xs text-indigo-600 font-semibold hover:underline"
            >
              generate
            </button>
          </label>
          <input
            id="cu-password"
            type="text"
            required
            minLength={8}
            maxLength={128}
            value={form.password}
            onChange={set('password')}
            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm font-mono"
            placeholder="At least 8 characters"
          />
        </div>
        <div>
          <label htmlFor="cu-role" className="block text-sm font-medium text-slate-700 mb-1">
            Role
          </label>
          <select
            id="cu-role"
            value={form.role}
            onChange={set('role')}
            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm bg-white"
          >
            <option value="TEACHER">Teacher</option>
            <option value="STUDENT">Student</option>
            <option value="ADMIN">Admin</option>
          </select>
          <p className="text-xs text-slate-500 mt-1">{ROLE_HINTS[form.role]}</p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={busy}
          className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold text-sm px-5 py-2.5 rounded-lg"
        >
          {busy ? 'Creating…' : 'Create account'}
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
