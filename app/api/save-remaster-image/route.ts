import { NextResponse, NextRequest } from 'next/server';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { rename } from 'fs/promises';
import path from 'path';

export const maxDuration = 60;

const MAX_BASE64_SIZE = 15 * 1024 * 1024; // 15MB
const VALID_CONCEPT_LABELS = ['a', 'b', 'c'];
const IMAGES_DIR = path.join(process.cwd(), 'public', 'images', 'facilities');

function getImageBuffer(source: string): Promise<Buffer> {
  if (source.startsWith('data:image')) {
    // Data URL: data:image/png;base64,<base64>
    const match = source.match(/base64,(.+)$/);
    if (!match) throw new Error('Invalid data URL format');

    const base64 = match[1];
    if (base64.length > MAX_BASE64_SIZE) {
      throw new Error(`Base64 data exceeds ${MAX_BASE64_SIZE / 1024 / 1024}MB limit`);
    }

    return Promise.resolve(Buffer.from(base64, 'base64'));
  } else {
    // Fetch from URL
    return fetch(source, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; JomonPortalBot/1.0)' },
    }).then(async (res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      return Buffer.from(await res.arrayBuffer());
    });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // フィールド名マッピング（複数のフィールド名に対応）
    const imageUrl = body.pollinationsUrl || body.imageUrl;
    const facilityId = body.facilityId || body.id;
    const conceptLabel = body.conceptLabel || body.concept;

    // バリデーション
    if (!imageUrl) {
      return NextResponse.json(
        { error: 'imageUrl (or pollinationsUrl) is required' },
        { status: 400 }
      );
    }
    if (!facilityId) {
      return NextResponse.json(
        { error: 'facilityId (or id) is required' },
        { status: 400 }
      );
    }
    if (!conceptLabel) {
      return NextResponse.json(
        { error: 'conceptLabel (or concept) is required' },
        { status: 400 }
      );
    }
    if (!VALID_CONCEPT_LABELS.includes(conceptLabel)) {
      return NextResponse.json(
        { error: `conceptLabel must be one of: ${VALID_CONCEPT_LABELS.join(', ')}` },
        { status: 400 }
      );
    }

    // 画像バッファを取得
    const imageBuffer = await getImageBuffer(imageUrl);

    // ディレクトリ作成
    if (!existsSync(IMAGES_DIR)) {
      mkdirSync(IMAGES_DIR, { recursive: true });
    }

    // ファイル保存（atomic write）
    const filename = `${facilityId}_remaster_${conceptLabel}.png`;
    const filePath = path.join(IMAGES_DIR, filename);
    const tmpPath = `${filePath}.tmp`;

    writeFileSync(tmpPath, imageBuffer);
    // atomic rename
    await rename(tmpPath, filePath);

    console.log('[API] Saved remaster image:', filePath);

    return NextResponse.json({
      success: true,
      localPath: `/images/facilities/${filename}`,
      size: imageBuffer.length,
    });
  } catch (error) {
    console.error('[save-remaster-image] Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
