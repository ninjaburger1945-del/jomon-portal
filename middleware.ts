import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const response = NextResponse.next();

  // 全キャッシュ層を完全に無効化
  response.headers.set('Cache-Control', 'no-cache, no-store, max-age=0, must-revalidate, proxy-revalidate');
  response.headers.set('Pragma', 'no-cache');
  response.headers.set('Expires', '-1');
  response.headers.set('Surrogate-Control', 'no-store');
  response.headers.set('Vary', '*');

  return response;
}

// API と全ページに適用
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon|public).*)'],
};
