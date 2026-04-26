import { NextResponse } from 'next/server';
import { unstable_noStore as noStore } from 'next/cache';
import { headers } from 'next/headers';
import fs from 'fs';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// 🔴 OS 絶対パス（必要に応じて修正）
const DATA_FACILITIES_PATH = '/root/jomon-portal/app/data/facilities.json';

export async function GET() {
  // Next.js に「このAPIは動的である」と強制認識させる
  headers();
  noStore();
  const _dynamicBuster = Date.now();
  const _requestId = Math.random().toString(36).substring(2);

  try {
    console.log(`[GET /api/facilities] Dynamic request ${_requestId} at ${new Date(_dynamicBuster).toISOString()} - Reading from: ${DATA_FACILITIES_PATH}`);
    const fileContent = fs.readFileSync(DATA_FACILITIES_PATH, 'utf-8');
    const facilities = JSON.parse(fileContent);

    console.log(`[GET /api/facilities] Loaded from: ${DATA_FACILITIES_PATH}`);
    console.log(`[GET /api/facilities] First 50 chars: ${fileContent.substring(0, 50)}`);

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
