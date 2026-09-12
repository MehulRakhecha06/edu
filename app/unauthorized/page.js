import Link from 'next/link';
import { Ban } from 'lucide-react';

export const metadata = { title: 'Not allowed — Aimmers Nepal' };

export default function UnauthorizedPage() {
  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="text-center max-w-sm">
        <Ban className="w-12 h-12 mx-auto text-red-500" aria-hidden />
        <h1 className="mt-4 text-2xl font-bold text-slate-900">You&apos;re not allowed here</h1>
        <p className="mt-2 text-sm text-slate-600">
          Your account doesn&apos;t have permission to view that page.
        </p>
        <Link
          href="/"
          className="mt-6 inline-block bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-6 py-2.5 rounded-lg"
        >
          Back to my dashboard
        </Link>
      </div>
    </main>
  );
}
