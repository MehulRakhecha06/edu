/**
 * sitemap.xml — the list of pages search engines should index.
 *
 * Only the public pages are listed: the landing page, sign-in and
 * registration. Everything else (dashboards, tests, documents) lives
 * behind a login and holds personal data — it must never be indexed.
 */

import { siteUrl } from '@/lib/site';

export default function sitemap() {
  const lastModified = new Date();

  return [
    {
      url: `${siteUrl}/`,
      lastModified,
      changeFrequency: 'weekly',
      priority: 1,
    },
    {
      url: `${siteUrl}/login`,
      lastModified,
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: `${siteUrl}/register`,
      lastModified,
      changeFrequency: 'monthly',
      priority: 0.7,
    },
  ];
}
