import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { unstable_noStore as noStore } from 'next/cache';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  noStore();
  try {
    const filePath = path.join(process.cwd(), 'app/data/events.json');
    console.log('[GET /api/events] process.cwd():', process.cwd());
    console.log('[GET /api/events] filePath:', filePath);
    const fileContents = fs.readFileSync(filePath, 'utf8');
    const events = JSON.parse(fileContents);

    const response = NextResponse.json(events);
    response.headers.set('Cache-Control', 'no-cache, no-store, max-age=0, must-revalidate, proxy-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '-1');
    response.headers.set('Surrogate-Control', 'no-store');
    response.headers.set('Vary', '*');
    response.headers.delete('ETag');
    response.headers.delete('Last-Modified');
    return response;
  } catch (error) {
    console.error('[api/events]', error);
    return NextResponse.json(
      { error: 'Failed to load events', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
