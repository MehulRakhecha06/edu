import Link from 'next/link';
import SignOutButton from './SignOutButton';

const ROLE_STYLES = {
  ADMIN: 'bg-purple-100 text-purple-700',
  TEACHER: 'bg-indigo-100 text-indigo-700',
  TEACHERS: 'bg-indigo-100 text-indigo-700',
  STUDENT: 'bg-emerald-100 text-emerald-700',
};

export default function Header({ user }) {
  if (!user) return null;

  const role = user.role || 'STUDENT';
  const initials = (user.name || user.email || '?')
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
        <Link href="/" className="flex items-center gap-2 font-bold text-lg text-slate-900">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Aimmers Nepal logo" className="w-8 h-8 rounded-lg object-cover" />
          <span>
            Aimmers<span className="text-indigo-600"> Nepal</span>
          </span>
        </Link>

        <div className="flex items-center gap-3">
          <span
            className={`hidden sm:inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
              ROLE_STYLES[role] || ROLE_STYLES.STUDENT
            }`}
          >
            {role === 'TEACHERS' ? 'TEACHER' : role}
          </span>
          <span
            title={user.email}
            className="w-8 h-8 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center"
          >
            {initials}
          </span>
          <SignOutButton />
        </div>
      </div>
    </header>
  );
}
