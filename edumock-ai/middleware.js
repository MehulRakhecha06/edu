import { auth } from '@/lib/auth';
import { NextResponse } from 'next/server';

// Routes that require specific roles
const roleRoutes = {
  admin: ['/admin'],
  teacher: ['/teacher'],
  student: ['/student', '/dashboard'],
};

// Routes that are public (no auth required)
const publicRoutes = ['/', '/login', '/register', '/api/auth'];

export default auth((req) => {
  const { nextUrl } = req;
  const isLoggedIn = !!req.auth;
  const userRole = req.auth?.user?.role?.toUpperCase();
  const pathname = nextUrl.pathname;

  // 1. Allow public routes and auth API routes
  if (publicRoutes.some(route => pathname.startsWith(route))) {
    // If logged in user tries to access login/register, redirect to dashboard
    if (isLoggedIn && (pathname === '/login' || pathname === '/register')) {
      return NextResponse.redirect(new URL('/dashboard', nextUrl));
    }
    return NextResponse.next();
  }

  // 2. If not logged in, redirect to login
  if (!isLoggedIn) {
    const loginUrl = new URL('/login', nextUrl);
    loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // 3. Check Role-Based Access Control (RBAC)
  for (const [role, paths] of Object.entries(roleRoutes)) {
    for (const path of paths) {
      if (pathname.startsWith(path)) {
        // Admin can access everything
        if (userRole === 'ADMIN') {
          return NextResponse.next();
        }
        // Check if user has the required role
        if (userRole !== role.toUpperCase()) {
          return NextResponse.redirect(new URL('/unauthorized', nextUrl));
        }
        return NextResponse.next();
      }
    }
  }

  // 4. Allow all other authenticated routes
  return NextResponse.next();
});

// Configure which routes the middleware runs on
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (images, etc.)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)',
  ],
};