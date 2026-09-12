'use client';

import { signOut } from 'next-auth/react';
import { useState } from 'react';

export default function SignOutButton() {
  const [busy, setBusy] = useState(false);

  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await signOut({ redirectTo: '/login' });
      }}
      className="text-sm font-medium text-slate-600 hover:text-slate-900 disabled:opacity-50"
    >
      {busy ? 'Signing out…' : 'Sign out'}
    </button>
  );
}
