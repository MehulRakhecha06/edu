import './globals.css';
import { Plus_Jakarta_Sans } from 'next/font/google';
import { isDemoMode } from '@/lib/db';
import AssistantWidget from '@/components/AssistantWidget';

// Self-hosted by Next.js at build time (no external font requests, CSP-safe).
const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-jakarta',
  display: 'swap',
});

export const metadata = {
  title: 'Aimmers Nepal — Mock Tests with AI Explanations',
  icons: { icon: '/logo.png' },
  description:
    'Teachers upload question banks, students take timed mock tests, and AI explains every answer. Built for classroom demos.',
};

export default function RootLayout({ children }) {
  const demo = isDemoMode();

  return (
    <html lang="en" className={jakarta.variable}>
      <body>
        {demo && (
          <div className="bg-amber-100 text-amber-900 text-xs sm:text-sm text-center px-4 py-2 border-b border-amber-200">
            <strong>Demo Mode</strong> — running on a temporary in-memory database with sample
            data. Add your Supabase keys to <code>.env.local</code> to persist real data. ·{' '}
            <a href="/api/health" className="underline font-medium">
              status
            </a>
          </div>
        )}
        {children}
        <AssistantWidget />
      </body>
    </html>
  );
}
