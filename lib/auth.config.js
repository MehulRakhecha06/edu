/**
 * Edge-safe NextAuth configuration.
 *
 * This file contains ONLY the parts of the NextAuth config that are safe
 * to run in the edge/proxy runtime (no bcrypt, no database imports).
 * `proxy.js` imports it to protect routes; `lib/auth.js` extends it with
 * the Credentials provider for the real sign-in.
 */

// True when Supabase is configured (i.e. NOT demo mode). Kept inline so this
// file stays dependency-free and safe for the edge/proxy runtime.
const SUPABASE_CONFIGURED = Boolean(
  (process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL) &&
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Fail loudly (without crashing) when Supabase mode is on but no secret is set.
// Without a fixed AUTH_SECRET, sessions can be signed by one secret and read by
// another after a restart — every user then sees JWTSessionError until their
// cookie is cleared. This message makes that misconfiguration self-explanatory.
if (SUPABASE_CONFIGURED && !process.env.AUTH_SECRET && !process.env.NEXTAUTH_SECRET) {
  console.error(
    '[auth] CONFIG ERROR: Supabase is configured but AUTH_SECRET is missing.\n' +
      '       Add AUTH_SECRET=<long random string> to .env.local and restart the app.\n' +
      '       Anyone signed in before the fix must sign out and back in once.'
  );
}

export const authConfig = {
  pages: {
    signIn: '/login',
    error: '/login',
  },

  // Trust the incoming host header (localhost, the Vercel domain, previews…)
  trustHost: true,

  // The SAME secret must be used by the proxy instance and the full auth
  // instance, otherwise the proxy cannot decode the session cookie.
  // In demo mode (no Supabase) a fixed fallback keeps things working with
  // zero setup; with Supabase configured you MUST set AUTH_SECRET.
  secret:
    process.env.AUTH_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    (SUPABASE_CONFIGURED ? undefined : 'demo-mode-only-secret-not-for-production'),

  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },

  callbacks: {
    // Put the user's id + role inside the JWT on first sign-in
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
      }
      return token;
    },

    // Expose id + role on the session object
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id;
        session.user.role = token.role;
      }
      return session;
    },
  },

  providers: [], // providers with Node-only deps are added in lib/auth.js
};
