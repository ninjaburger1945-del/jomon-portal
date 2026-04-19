import { NextResponse, NextRequest } from 'next/server';
import { readdirSync, unlinkSync, existsSync } from 'fs';
import { readFileSync } from 'fs';
import path from 'path';

export const maxDuration = 300; // 5 minutes timeout for large cleanups

export async function POST(request: NextRequest) {
  try {
    // ★ GitHub credentials チェックなし。ローカルファイル操作のみ
    console.log('[cleanup-images] Starting cleanup (local mode)...');

    // facilities.json をローカルから読み込み
    console.log('[cleanup-images] Reading facilities.json from local file...');
    const facilitiesPath = path.join(process.cwd(), 'app', 'data', 'facilities.json');

    if (!existsSync(facilitiesPath)) {
      throw new Error(`facilities.json not found at ${facilitiesPath}`);
    }

    const facilitiesContent = readFileSync(facilitiesPath, 'utf-8');
    const facilities = JSON.parse(facilitiesContent);

    const usedImages = new Set(
      facilities
        .map((f: any) => f.thumbnail)
        .filter((t: string) => t && t.includes('/images/facilities/'))
    );

    console.log('[cleanup-images] Found', usedImages.size, 'used images');

    // public/images/facilities/ ディレクトリから全ファイル取得
    const imagesDir = path.join(process.cwd(), 'public', 'images', 'facilities');

    if (!existsSync(imagesDir)) {
      console.log('[cleanup-images] Images directory does not exist:', imagesDir);
      return NextResponse.json({ success: true, deletedCount: 0 });
    }

    const files = readdirSync(imagesDir);
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
        const filePath = path.join(imagesDir, filename);
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
