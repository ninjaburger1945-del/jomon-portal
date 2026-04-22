import { NextResponse, NextRequest } from 'next/server';
import { revalidatePath } from 'next/cache';
import fs from 'fs/promises';
import fsSyncOps from 'fs';
import path from 'path';

interface Facility {
  id: string;
  name: string;
  [key: string]: unknown;
}

export async function POST(request: NextRequest) {
  try {
    const { facilities } = await request.json();

    console.log('[API] === SAVE-FACILITIES API CALLED ===');
    console.log('[API] Received facilities count:', facilities.length);

    // バリデーション
    for (let i = 0; i < facilities.length; i++) {
      const facility = facilities[i];
      try {
        JSON.stringify(facility);
      } catch (err) {
        console.error(`[API] Facility ${i} (ID: ${facility?.id}) is not JSON serializable:`, err);
        throw new Error(`Facility ${facility?.id || i} contains non-serializable data`);
      }
    }

    // 【要確認】ラベルが削除された施設に userApproved フラグを設定
    const facilitiesWithApprovalFlags = facilities.map((facility: Facility) => {
      if (!facility.name?.includes('【要確認】')) {
        return { ...facility, userApproved: true };
      }
      return facility;
    });

    // Atomic write: tmp ファイル経由でファイル書き込み（競合・破損防止）
    const filePath = path.join(process.cwd(), 'app/data/facilities.json');
    const tmpPath = `${filePath}.tmp`;
    const publicFilePath = path.join(process.cwd(), 'public/facilities.json');
    const publicTmpPath = `${publicFilePath}.tmp`;
    const jsonContent = JSON.stringify(facilitiesWithApprovalFlags, null, 2);

    console.log('[POST /api/save-facilities] process.cwd():', process.cwd());
    console.log('[POST /api/save-facilities] filePath:', filePath);

    // app/data/ に書き込み
    fsSyncOps.writeFileSync(tmpPath, jsonContent);
    await fs.rename(tmpPath, filePath);
    console.log('[API] Successfully saved to:', filePath);

    // public/ にも同期（クライアントサイドfetchの参照先）
    fsSyncOps.writeFileSync(publicTmpPath, jsonContent);
    await fs.rename(publicTmpPath, publicFilePath);
    console.log('[API] Successfully synced to:', publicFilePath);

    // ISR: Revalidate all affected paths
    try {
      revalidatePath('/');
      revalidatePath('/facilities');
      revalidatePath('/facility');
      revalidatePath('/admin');
      revalidatePath('/about');
      revalidatePath('/search');
      revalidatePath('/', 'layout');
      console.log('[API] Cache revalidated');
    } catch (err) {
      console.warn('[API] Revalidation warning:', err);
    }

    return NextResponse.json({
      success: true,
      message: 'Facilities saved successfully',
    });
  } catch (error) {
    console.error('[API] Save error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
