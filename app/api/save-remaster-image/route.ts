import { NextResponse, NextRequest } from 'next/server';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import path from 'path';

export const maxDuration = 60; // ConoHa timeout

export async function POST(request: NextRequest) {
  try {
    const { pollinationsUrl, facilityId, conceptLabel } = await request.json();

    if (!pollinationsUrl || !facilityId || !conceptLabel) {
      return NextResponse.json(
        { error: 'pollinationsUrl, facilityId, conceptLabel are required' },
        { status: 400 }
      );
    }

    if (!['a', 'b', 'c'].includes(conceptLabel)) {
      return NextResponse.json(
        { error: 'conceptLabel must be a, b, or c' },
        { status: 400 }
      );
    }

    // ★ GitHub 認証なし。ローカルに直接保存
    console.log('[API] save-remaster-image: Using local file save (no GitHub token required)');

    // Extract Base64 from data URL or fetch from URL
    let imageBuffer: Buffer;

    if (pollinationsUrl.startsWith('data:image')) {
      // Data URL format: data:image/png;base64,<base64>
      const match = pollinationsUrl.match(/base64,(.+)$/);
      if (!match) {
        return NextResponse.json(
          { error: 'Invalid data URL format' },
          { status: 400 }
        );
      }
      imageBuffer = Buffer.from(match[1], 'base64');
    } else {
      // Fetch image from URL (Pollinations or other)
      const imgRes = await fetch(pollinationsUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; JomonPortalBot/1.0)' },
      });

      if (!imgRes.ok) {
        return NextResponse.json(
          { error: `Failed to fetch image: ${imgRes.status}` },
          { status: 502 }
        );
      }

      imageBuffer = Buffer.from(await imgRes.arrayBuffer());
    }

    // ★ ローカルファイルに直接保存（GitHub API は使わない）
    const filename = `${facilityId}_remaster_${conceptLabel}.png`;
    const imagesDir = path.join(process.cwd(), 'public', 'images', 'facilities');

    // ディレクトリが存在しなければ作成
    if (!existsSync(imagesDir)) {
      mkdirSync(imagesDir, { recursive: true });
      console.log('[API] Created images directory:', imagesDir);
    }

    const filePath = path.join(imagesDir, filename);
    writeFileSync(filePath, imageBuffer);
    console.log('[API] Saved remaster image to:', filePath);

    const localPath = `/images/facilities/${filename}`;
    return NextResponse.json({ success: true, localPath });
  } catch (error) {
    console.error('[save-remaster-image] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
