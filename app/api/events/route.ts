import { NextResponse } from 'next/server';
import fs from 'fs';
import { unstable_noStore as noStore } from 'next/cache';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// 🔴 OS 絶対パス（必要に応じて修正）
const DATA_EVENTS_PATH = '/root/jomon-portal/app/data/events.json';

export async function GET() {
  noStore();
  try {
    console.log('[GET /api/events] Reading from:', DATA_EVENTS_PATH);
    const fileContents = fs.readFileSync(DATA_EVENTS_PATH, 'utf8');
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
    console.error('[GET /api/events] Error:', error);
    return NextResponse.json(
      { error: 'Failed to load events', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
