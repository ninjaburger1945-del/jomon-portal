import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// キャッシュを完全に無効化 - 常に最新の facilities.json を返す
export const revalidate = 0;

export async function GET() {
  try {
    const filePath = path.join(process.cwd(), 'app/data/facilities.json');
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const facilities = JSON.parse(fileContent);

    // 明示的にキャッシュヘッダーを設定
    const response = NextResponse.json(facilities);
    response.headers.set('Cache-Control', 'no-store, must-revalidate');
    response.headers.set('Pragma', 'no-cache');
    return response;
  } catch (error) {
    console.error('Failed to load facilities:', error);
    return NextResponse.json(
      { error: 'Failed to load facilities' },
      { status: 500 }
    );
  }
}
