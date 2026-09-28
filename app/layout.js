import './globals.css';
import { Plus_Jakarta_Sans } from 'next/font/google';
import { isDemoMode } from '@/lib/db';
import { siteUrl } from '@/lib/site';
import AssistantWidget from '@/components/AssistantWidget';

// Self-hosted by Next.js at build time (no external font requests, CSP-safe).
const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-jakarta',
  display: 'swap',
});

export const metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'Aimmers Nepal — Mock Tests with AI Explanations',
    template: '%s',
  },
  description:
    'Free timed mock tests for students. Teachers upload question banks (PDF, Word or photos), students take timed tests, and AI explains every answer. Built for schools in Nepal.',
  keywords: [
    'mock test', 'practice exam', 'MCQ test', 'entrance preparation',
    'Nepal education', 'tuition centre', 'question bank', 'AI explanation',
    'timed test', 'exam practice',
  ],
  icons: { icon: '/logo.png' },
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    siteName: 'Aimmers Nepal',
    title: 'Aimmers Nepal — Mock Tests with AI Explanations',
    description:
      'Teachers upload question banks, students take timed mock tests, and AI explains every answer.',
    url: '/',
    images: [{ url: '/logo.png', width: 512, height: 512, alt: 'Aimmers Nepal' }],
  },
  twitter: {
    card: 'summary',
    title: 'Aimmers Nepal — Mock Tests with AI Explanations',
    description:
      'Free timed mock tests with an AI explanation for every answer. Built for schools in Nepal.',
  },
  robots: {
    index: true,
    follow: true,
  },
  // Google Search Console verification — set GOOGLE_SITE_VERIFICATION in
  // Vercel (value from Search Console's "HTML tag" method) and this tag
  // appears automatically. Harmless when unset.
  ...(process.env.GOOGLE_SITE_VERIFICATION && {
    verification: { google: process.env.GOOGLE_SITE_VERIFICATION },
  }),
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
