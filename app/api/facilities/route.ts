import { NextResponse } from 'next/server';
import { unstable_noStore as noStore } from 'next/cache';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  noStore();
  try {
    const filePath = path.join(process.cwd(), 'app/data/facilities.json');
    console.log('[GET /api/facilities] process.cwd():', process.cwd());
    console.log('[GET /api/facilities] filePath:', filePath);
    const fileContent = fs.readFileSync(filePath, 'utf-8');
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
    console.error('Failed to load facilities:', error);
    return NextResponse.json(
      { error: 'Failed to load facilities' },
      { status: 500 }
    );
  }
}
