import { NextResponse, NextRequest } from 'next/server';
import { revalidatePath } from 'next/cache';
import fs from 'fs/promises';
import fsSyncOps from 'fs';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface Facility {
  id: string;
  name: string;
  [key: string]: unknown;
}

// 🔴 唯一の正解：/root/jomon-portal/app/data/facilities.json
const DATA_FACILITIES_PATH = '/root/jomon-portal/app/data/facilities.json';

export async function POST(request: NextRequest) {
  try {
    const { facilities } = await request.json();

    console.log('[POST /api/save-facilities] === CALLED ===');
    console.log('[POST /api/save-facilities] Received facilities count:', facilities.length);
    console.log('[POST /api/save-facilities] Writing to:', DATA_FACILITIES_PATH);

    // バリデーション
    for (let i = 0; i < facilities.length; i++) {
      const facility = facilities[i];
      try {
        JSON.stringify(facility);
      } catch (err) {
        console.error(`[POST /api/save-facilities] Facility ${i} (ID: ${facility?.id}) is not JSON serializable:`, err);
        throw new Error(`Facility ${facility?.id || i} contains non-serializable data`);
      }
    }

    // ラベルが削除された施設に userApproved フラグを設定
    const facilitiesWithApprovalFlags = facilities.map((facility: Facility) => {
      if (!facility.name?.includes('【要確認】')) {
        return { ...facility, userApproved: true };
      }
      return facility;
    });

    // Atomic write: tmp ファイル経由でファイル書き込み（競合・破損防止）
    const tmpPath = `${DATA_FACILITIES_PATH}.tmp`;
    const jsonContent = JSON.stringify(facilitiesWithApprovalFlags, null, 2);

    // app/data/ に書き込み（唯一の正解ファイル）
    fsSyncOps.writeFileSync(tmpPath, jsonContent);
    await fs.rename(tmpPath, DATA_FACILITIES_PATH);
    console.log('[POST /api/save-facilities] ✅ Saved to:', DATA_FACILITIES_PATH);

    // ISR: Revalidate all affected paths
    try {
      revalidatePath('/');
      revalidatePath('/facilities');
      revalidatePath('/facility');
      revalidatePath('/admin');
      revalidatePath('/about');
      revalidatePath('/search');
      revalidatePath('/', 'layout');
      console.log('[POST /api/save-facilities] Cache revalidated');
    } catch (err) {
      console.warn('[POST /api/save-facilities] Revalidation warning:', err);
    }

    return NextResponse.json({
      success: true,
      message: 'Facilities saved successfully',
    });
  } catch (error) {
    console.error('[POST /api/save-facilities] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
