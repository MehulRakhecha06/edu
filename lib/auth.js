/**
 * Full NextAuth (Auth.js v5) configuration — Node runtime only.
 * Used by app/api/auth/[...nextauth]/route.js and by server components
 * through `auth()`. NEVER import this from proxy.js (edge) — proxy.js
 * uses the split config in lib/auth.config.js instead.
 */

import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { authConfig } from './auth.config';
import { db } from './db';
import { loginRateLimit } from './rate-limit';

// A real bcrypt hash (cost 12) of a throwaway value — compared against when
// the email does not exist, so login timing is identical whether or not the
// account exists (same anti-enumeration trick the register route uses).
const DUMMY_HASH = '$2b$12$mxbSgoNwQtzu.JrKEm5hIexyrE1krHDbrxZoICsy4UpBytspMlXwy';

function clientIp(request) {
  const fwd = request?.headers?.get?.('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();
  return request?.headers?.get?.('x-real-ip') || 'local';
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,

  providers: [
    Credentials({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials, request) {
        const email = String(credentials?.email || '').toLowerCase().trim();
        const password = String(credentials?.password || '');

        if (!email || !password) return null;

        // Simple brute-force protection
        const ip = clientIp(request);
        const limited = loginRateLimit(ip);
        if (!limited.ok) {
          console.warn(`[auth] rate limit hit for ${ip}`);
          return null;
        }

        try {
          const user = await db.findUserByEmail(email);
          if (!user) {
            // Anti-enumeration: spend the SAME ~bcrypt time as the "user
            // exists" path, so response timing cannot reveal which emails
            // have accounts (same trick the register route uses).
            await bcrypt.compare(password, DUMMY_HASH);
            return null;
          }

          const valid = await bcrypt.compare(password, user.passwordHash);
          if (!valid) return null;

          loginRateLimit.reset(ip);

          return {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role, // 'ADMIN' | 'TEACHER' | 'STUDENT'
          };
        } catch (err) {
          console.error('[auth] authorize error:', err?.message);
          return null;
        }
      },
    }),
  ],

  // secret + trustHost come from the shared authConfig so that this instance
  // and the proxy instance always agree.
});
