import { NextRequest, NextResponse } from 'next/server';

// Simple JWT verification for Edge Runtime
function extractTokenFromHeader(authHeader: string | null): string | null {
  if (!authHeader) {
    return null;
  }

  // Expected format: "Bearer <token>"
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return null;
  }

  return parts[1];
}

// Simple JWT payload extraction (without verification for Edge Runtime)
function extractJWTPayload(token: string): { userId: number; email: string } | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }

    // Decode the payload (second part)
    let payload = parts[1];

    // Add padding if needed for base64 decoding
    while (payload.length % 4) {
      payload += '=';
    }

    // Replace URL-safe characters
    payload = payload.replace(/-/g, '+').replace(/_/g, '/');

    const decoded = JSON.parse(atob(payload));

    // Check if token is expired
    if (decoded.exp && decoded.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }

    return decoded;
  } catch {
    return null;
  }
}

// Define protected routes that require authentication
const protectedRoutes = [
  '/dashboard',
  '/profile',
  '/boards',
  '/api/protected', // Example protected API route
  '/api/boards',
  '/api/invitations',
];

// Define auth routes that should redirect to dashboard if user is already logged in
const authRoutes = [
  '/',
  '/auth/login',
  '/auth/register',
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  console.log('[Middleware] Request to:', pathname);

  // Get token from Authorization header or cookie
  const authHeader = request.headers.get('authorization');
  const token = extractTokenFromHeader(authHeader) || request.cookies.get('token')?.value;

  console.log('[Middleware] Auth header exists:', !!authHeader, 'Token exists:', !!token, 'Token length:', token?.length);

  // Extract JWT payload (simplified for Edge Runtime)
  let user = null;
  if (token) {
    user = extractJWTPayload(token);
    console.log('[Middleware] JWT payload extracted:', !!user, 'userId:', user?.userId);
  } else {
    console.log('[Middleware] No token found');
  }

  // Check if current route is protected
  const isProtectedRoute = protectedRoutes.some(route =>
    pathname.startsWith(route)
  );

  // Check if current route is an auth route
  const isAuthRoute = authRoutes.some(route =>
    route === '/' ? pathname === '/' : pathname.startsWith(route)
  );

  console.log('[Middleware] Route checks - isProtected:', isProtectedRoute, 'isAuth:', isAuthRoute);

  // Handle protected routes without valid token
  if (isProtectedRoute && !user) {
    console.warn('[Middleware] Protected route without valid token. Pathname:', pathname);
    // For API routes, return 401 JSON response
    if (pathname.startsWith('/api/')) {
      console.warn('[Middleware] Returning 401 for API route');
      return NextResponse.json(
        { success: false, message: 'Authentication required' },
        { status: 401 }
      );
    }

    // For page routes, redirect to homepage (which is now the login page)
    console.warn('[Middleware] Redirecting to login for page route');
    const loginUrl = new URL('/', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Redirect to dashboard if accessing auth routes with valid token
  if (isAuthRoute && user) {
    console.log('[Middleware] Auth route with valid token, redirecting to dashboard');
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  // For API routes, add user info to headers if authenticated
  if (pathname.startsWith('/api/') && user) {
    console.log('[Middleware] Adding user headers to API request. userId:', user.userId, 'email:', user.email);
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-user-id', user.userId.toString());
    requestHeaders.set('x-user-email', user.email);

    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
  }

  console.log('[Middleware] Passing request through');
  return NextResponse.next();
}

// Configure which routes the middleware should run on
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api/auth (authentication endpoints)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder files
     */
    '/((?!api/auth|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
