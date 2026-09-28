/**
 * The site's canonical URL.
 *
 * Priority order:
 *   1. NEXT_PUBLIC_SITE_URL  — set this in Vercel when you add a custom
 *      domain (e.g. https://aimmers.edu.np). Also fine to point at the
 *      vercel.app URL if you do not have a domain yet.
 *   2. VERCEL_PROJECT_PRODUCTION_URL — automatically provided by Vercel
 *      for production deployments (e.g. edu-two-rose.vercel.app).
 *   3. http://localhost:3000 — local development fallback.
 */

export const siteUrl = (
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : 'http://localhost:3000')
).replace(/\/$/, '');
