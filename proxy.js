/**
 * Route protection — Next.js 16 "proxy" (formerly middleware).
 *
 * Runs on the edge runtime, so it uses the split auth config from
 * lib/auth.config.js (no bcrypt / database imports here).
 *
 * Role rules:
 *   /admin/**      -> ADMIN only
 *   /teacher/**    -> TEACHER (or ADMIN) only
 *   /student/**    -> STUDENT (or TEACHER/ADMIN previewing) only
 *   /api/admin/**  -> ADMIN only
 *   /api/documents/**, /api/tests/**, /api/attempts/** -> signed-in users
 *
 * Public: /, /login, /register, /unauthorized, /api/auth/**, /api/ai/**,
 *         /api/health
 */

import NextAuth from 'next-auth';
import { authConfig } from '@/lib/auth.config';

const { auth } = NextAuth(authConfig);

const PUBLIC_PAGES = ['/', '/login', '/register', '/unauthorized'];

function homeFor(role) {
  switch (role) {
    case 'ADMIN':
      return '/admin';
    case 'TEACHER':
    case 'TEACHERS':
      return '/teacher';
    default:
      return '/student';
  }
}

export default auth((req) => {
  const { nextUrl } = req;
  const path = nextUrl.pathname;
  const session = req.auth;
  const role = session?.user?.role || null;

  // 1. Signed-in users shouldn't see login/register — send them home
  if (session && (path === '/login' || path === '/register')) {
    return Response.redirect(new URL(homeFor(role), nextUrl));
  }

  // 2. Public pages & auth endpoints
  if (
    PUBLIC_PAGES.includes(path) ||
    path.startsWith('/api/auth') ||
    path.startsWith('/api/health')
  ) {
    return;
  }

  // 3. Role rules
  const isAdminArea = path.startsWith('/admin') || path.startsWith('/api/admin');
  const isTeacherArea = path.startsWith('/teacher');
  const isStudentArea = path.startsWith('/student');
  const isProtectedApi =
    path.startsWith('/api/documents') ||
    path.startsWith('/api/tests') ||
    path.startsWith('/api/attempts');

  if (!isAdminArea && !isTeacherArea && !isStudentArea && !isProtectedApi) {
    return; // anything else (e.g. static, /api/ai) is public
  }

  if (!session) {
    // API routes get a clean 401, pages get redirected to login
    if (path.startsWith('/api/')) {
      return Response.json({ error: 'Not authenticated' }, { status: 401 });
    }
    const loginUrl = new URL('/login', nextUrl);
    return Response.redirect(loginUrl);
  }

  if (isAdminArea && role !== 'ADMIN') {
    if (path.startsWith('/api/')) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }
    return Response.redirect(new URL('/unauthorized', nextUrl));
  }

  if (isTeacherArea && role !== 'TEACHER' && role !== 'TEACHERS' && role !== 'ADMIN') {
    if (path.startsWith('/api/')) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }
    return Response.redirect(new URL('/unauthorized', nextUrl));
  }

  if (isStudentArea && role !== 'STUDENT' && role !== 'TEACHER' && role !== 'TEACHERS' && role !== 'ADMIN') {
    if (path.startsWith('/api/')) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }
    return Response.redirect(new URL('/unauthorized', nextUrl));
  }

  // Signed in with a valid role — allow
});

export const config = {
  matcher: [
    // Skip static assets & Next internals; run on everything else
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|ico|webp|gif|txt|xml|webmanifest)$).*)',
  ],
};
