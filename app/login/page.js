import { DEMO_USERS, isDemoMode } from '@/lib/db';
import LoginForm from './LoginForm';

export const metadata = { title: 'Sign in — Aimmers Nepal' };
// Always render at request time so demo-mode detection is accurate
export const dynamic = 'force-dynamic';

export default function LoginPage() {
  const demo = isDemoMode();

  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        {demo && (
          <div className="mb-4 bg-amber-50 border border-amber-200 rounded-2xl p-4 text-sm">
            <p className="font-semibold text-amber-900">
              Demo mode — pick an account and use the quick-fill buttons below:
            </p>
            <div className="mt-2 space-y-1">
              {DEMO_USERS.map((u) => (
                <div key={u.email} className="flex items-center gap-2 text-xs sm:text-sm">
                  <span className="w-16 shrink-0 font-semibold text-amber-800">{u.role}</span>
                  <code className="text-amber-900 truncate">{u.email}</code>
                  <span className="text-amber-600">·</span>
                  <code className="text-amber-900 whitespace-nowrap">{u.password}</code>
                </div>
              ))}
            </div>
            <p className="mt-2 text-xs text-amber-700">
              Type the email in the email box and the password in the password box —
              or just tap a button below to fill both.
            </p>
          </div>
        )}
        <LoginForm demoUsers={demo ? DEMO_USERS : []} />
      </div>
    </main>
  );
}
