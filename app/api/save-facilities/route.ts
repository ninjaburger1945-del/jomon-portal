import { NextResponse, NextRequest } from 'next/server';
import { revalidatePath } from 'next/cache';
import fs from 'fs';
import path from 'path';

export async function POST(request: NextRequest) {
  try {
    const { facilities } = await request.json();

    console.log('[API] === SAVE-FACILITIES API CALLED ===');
    console.log('[API] Received facilities count:', facilities.length);

    // Validate each facility can be JSON stringified
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
    const facilitiesWithApprovalFlags = facilities.map((facility: any) => {
      if (!facility.name?.includes('【要確認】')) {
        return { ...facility, userApproved: true };
      }
      return facility;
    });

    // ★ シンプルにローカルファイルに直接上書き
    const filePath = path.join(process.cwd(), 'app/data/facilities.json');
    fs.writeFileSync(filePath, JSON.stringify(facilitiesWithApprovalFlags, null, 2));
    console.log('[API] Successfully saved to:', filePath);

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
