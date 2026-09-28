/**
 * robots.txt — tells search engines and AI crawlers what they may index.
 *
 * Public, content-bearing pages are open (landing, login, register). The
 * signed-in areas (student / teacher / admin) and all API routes are
 * private by nature — they require a session and hold personal data, so
 * they are explicitly excluded.
 *
 * AI crawlers (GPTBot, ClaudeBot, PerplexityBot, Google-Extended…) are
 * welcome — they are covered by the wildcard rule below.
 */

import { siteUrl } from '@/lib/site';

export default function robots() {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/admin/', '/teacher/', '/student/'],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
