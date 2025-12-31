import { NextRequest, NextResponse } from 'next/server';

const authRoutes = ['/sign-in', '/sign-up'];
const protectedRoutes = ['/settings'];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get('local.session')?.value || null;
  let session;
  session = !!token;

  let response = NextResponse.next();

  if (pathname === '/api/search' || pathname.startsWith('/api/search/') || pathname.startsWith('/api/upload')) {
    return response;
  }

  if (session && authRoutes.some((route) => pathname.startsWith(route))) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  if (!session && protectedRoutes.some((route) => pathname.startsWith(route))) {
    return NextResponse.redirect(new URL('/sign-in', request.url));
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
};
