import { NextResponse } from 'next/server';
import { unstable_noStore as noStore } from 'next/cache';
import fs from 'fs';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// 🔴 OS 絶対パス（必要に応じて修正）
const DATA_FACILITIES_PATH = '/root/jomon-portal/app/data/facilities.json';

export async function GET() {
  noStore();
  try {
    console.log('[GET /api/facilities] Reading from:', DATA_FACILITIES_PATH);
    const fileContent = fs.readFileSync(DATA_FACILITIES_PATH, 'utf-8');
    const facilities = JSON.parse(fileContent);

    const response = NextResponse.json(facilities);
    response.headers.set('Cache-Control', 'no-cache, no-store, max-age=0, must-revalidate, proxy-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '-1');
    response.headers.set('Surrogate-Control', 'no-store');
    response.headers.set('Vary', '*');
    response.headers.delete('ETag');
    response.headers.delete('Last-Modified');
    return response;
  } catch (error) {
    console.error('[GET /api/facilities] Error:', error);
    return NextResponse.json(
      { error: 'Failed to load facilities', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
