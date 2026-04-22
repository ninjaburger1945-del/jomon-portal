import { NextResponse, NextRequest } from 'next/server';
import { readdirSync, unlinkSync, existsSync } from 'fs';
import { readFileSync } from 'fs';

export const maxDuration = 300; // 5 minutes timeout for large cleanups

// 🔴 唯一の正解：/root/jomon-portal/app/data/facilities.json
const DATA_FACILITIES_PATH = '/root/jomon-portal/app/data/facilities.json';
const IMAGES_DIR = '/root/jomon-portal/public/images/facilities';

export async function POST(request: NextRequest) {
  try {
    // ★ GitHub credentials チェックなし。ローカルファイル操作のみ
    console.log('[cleanup-images] Starting cleanup (local mode)...');

    // facilities.json をローカルから読み込み
    console.log('[cleanup-images] Reading from:', DATA_FACILITIES_PATH);

    if (!existsSync(DATA_FACILITIES_PATH)) {
      throw new Error(`facilities.json not found at ${DATA_FACILITIES_PATH}`);
    }

    const facilitiesContent = readFileSync(DATA_FACILITIES_PATH, 'utf-8');
    const facilities = JSON.parse(facilitiesContent);

    const usedImages = new Set(
      facilities
        .map((f: any) => f.thumbnail)
        .filter((t: string) => t && t.includes('/images/facilities/'))
    );

    console.log('[cleanup-images] Found', usedImages.size, 'used images');

    // public/images/facilities/ ディレクトリから全ファイル取得
    if (!existsSync(IMAGES_DIR)) {
      console.log('[cleanup-images] Images directory does not exist:', IMAGES_DIR);
      return NextResponse.json({ success: true, deletedCount: 0 });
    }

    const files = readdirSync(IMAGES_DIR);
    console.log('[cleanup-images] Found', files.length, 'files in directory');

    const imagesToDelete = files.filter((filename: string) => {
      const fullPath = `/images/facilities/${filename}`;
      return !usedImages.has(fullPath);
    });

    console.log('[cleanup-images] Found', imagesToDelete.length, 'unused images to delete');

    if (imagesToDelete.length === 0) {
      console.log('[cleanup-images] No unused images to clean up');
      return NextResponse.json({ success: true, deletedCount: 0 });
    }

    // ローカルから不要なファイルを削除
    let successCount = 0;
    let failureCount = 0;

    for (const filename of imagesToDelete) {
      try {
        const filePath = `${IMAGES_DIR}/${filename}`;
        unlinkSync(filePath);
        console.log('[cleanup-images] Deleted', filename);
        successCount++;
      } catch (err) {
        console.error('[cleanup-images] Failed to delete', filename, ':', err);
        failureCount++;
      }
    }

    console.log('[cleanup-images] Cleanup complete! Deleted:', successCount, 'Failed:', failureCount);

    return NextResponse.json({
      success: true,
      deletedCount: successCount,
      failureCount: failureCount,
    });
  } catch (error) {
    console.error('[cleanup-images] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
