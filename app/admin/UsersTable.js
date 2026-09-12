'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatDate } from '@/lib/format';

const ROLE_STYLES = {
  ADMIN: 'bg-purple-100 text-purple-700',
  TEACHER: 'bg-indigo-100 text-indigo-700',
  TEACHERS: 'bg-indigo-100 text-indigo-700',
  STUDENT: 'bg-emerald-100 text-emerald-700',
};

const ROLE_OPTIONS = ['STUDENT', 'TEACHER', 'ADMIN'];

const normRole = (r) => (r === 'TEACHERS' ? 'TEACHER' : r);

export default function UsersTable({ users, currentUserId }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return users.filter((u) => {
      if (roleFilter !== 'ALL' && normRole(u.role) !== roleFilter) return false;
      if (q && !u.name.toLowerCase().includes(q) && !u.email.toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });
  }, [users, query, roleFilter]);

  async function remove(user) {
    if (
      !confirm(
        `Delete the ${normRole(user.role).toLowerCase()} account “${user.email}”? This cannot be undone.`
      )
    )
      return;

    setBusyId(user.id);
    setError('');
    setNotice('');
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Delete failed.');
      } else {
        setNotice(`Removed ${user.email}.`);
        router.refresh();
      }
    } catch {
      setError('Network error — please try again.');
    } finally {
      setBusyId(null);
    }
  }

  async function changeRole(user, newRole) {
    if (newRole === normRole(user.role)) return;
    if (
      !confirm(
        `Change ${user.name} (${user.email}) from ${normRole(user.role)} to ${newRole}?`
      )
    )
      return;

    setBusyId(user.id);
    setError('');
    setNotice('');
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Could not change the role.');
      } else {
        setNotice(
          `${user.name} is now a ${newRole.toLowerCase()}. They must sign out and back in for it to take effect.`
        );
        router.refresh();
      }
    } catch {
      setError('Network error — please try again.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-3">
      {error && (
        <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </p>
      )}
      {notice && (
        <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
          {notice}
        </p>
      )}

      {/* Search + role filter */}
      <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name or email…"
          className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          aria-label="Filter by role"
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
        >
          <option value="ALL">All roles</option>
          <option value="STUDENT">Students</option>
          <option value="TEACHER">Teachers</option>
          <option value="ADMIN">Admins</option>
        </select>
        <span className="text-xs text-slate-500 whitespace-nowrap">
          {filtered.length} of {users.length}
        </span>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="px-4 py-3 font-semibold">Name</th>
              <th className="px-4 py-3 font-semibold">Email</th>
              <th className="px-4 py-3 font-semibold">Role</th>
              <th className="px-4 py-3 font-semibold hidden sm:table-cell">Created</th>
              <th className="px-4 py-3 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((u) => {
              const isSelf = u.id === currentUserId;
              return (
                <tr key={u.id} className="border-t border-slate-100">
                  <td className="px-4 py-3 font-medium text-slate-800">
                    {u.name}
                    {isSelf && <span className="ml-2 text-xs text-slate-400">(you)</span>}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{u.email}</td>
                  <td className="px-4 py-3">
                    {isSelf ? (
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${
                          ROLE_STYLES[u.role] || ROLE_STYLES.STUDENT
                        }`}
                      >
                        {normRole(u.role)}
                      </span>
                    ) : (
                      <select
                        value={normRole(u.role)}
                        disabled={busyId === u.id}
                        onChange={(e) => changeRole(u, e.target.value)}
                        aria-label={`Change role for ${u.name}`}
                        className={`rounded-full text-xs font-semibold border-0 cursor-pointer px-2 py-1 focus:outline-none ${
                          ROLE_STYLES[u.role] || ROLE_STYLES.STUDENT
                        }`}
                      >
                        {ROLE_OPTIONS.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </select>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-500 hidden sm:table-cell">
                    {formatDate(u.createdAt)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {isSelf ? (
                      <span className="text-xs text-slate-400">—</span>
                    ) : (
                      <button
                        onClick={() => remove(u)}
                        disabled={busyId === u.id}
                        className="text-xs font-semibold text-red-700 hover:bg-red-50 border border-red-200 rounded-lg px-2.5 py-1.5 disabled:opacity-50"
                      >
                        {busyId === u.id ? 'Working…' : 'Delete'}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                  No accounts match your search.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
