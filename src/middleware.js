import { NextResponse } from 'next/server';

export function middleware(request) {
  const { pathname } = request.nextUrl;

  // Skip auth for login page, API routes, and static assets
  if (
    pathname === '/' ||
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  // Protect /dashboard routes
  if (pathname.startsWith('/dashboard')) {
    const token = request.cookies.get('admin_token')?.value;
    
    if (!token) {
      return NextResponse.redirect(new URL('/', request.url));
    }

    // Basic token structure validation (full verification happens in API routes)
    try {
      const parts = token.split('.');
      if (parts.length !== 3) throw new Error('Invalid token structure');
      const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
      if (payload.exp < Date.now()) throw new Error('Token expired');
    } catch {
      const response = NextResponse.redirect(new URL('/', request.url));
      response.cookies.delete('admin_token');
      return response;
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
