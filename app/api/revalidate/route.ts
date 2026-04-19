import { NextResponse, NextRequest } from 'next/server';
import { revalidatePath } from 'next/cache';

export async function POST(request: NextRequest) {
  try {
    console.log('[API] === REVALIDATE API CALLED ===');

    // Secret token チェック（オプション。なければスキップ）
    const secret = request.headers.get('x-revalidate-secret');
    const configSecret = process.env.REVALIDATE_SECRET;

    if (configSecret && secret !== configSecret) {
      console.warn('[API] Revalidate secret mismatch');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // リバリデーション対象のパスを一括処理
    const paths = [
      '/',
      '/facilities',
      '/facility',
      '/admin',
      '/about',
      '/search',
    ];

    console.log('[API] Revalidating paths:', paths);

    paths.forEach((path) => {
      try {
        revalidatePath(path, 'page');
        console.log(`[API] Revalidated path: ${path}`);
      } catch (err) {
        console.warn(`[API] Failed to revalidate path ${path}:`, err);
      }
    });

    // ルートレイアウトもリバリデーション
    try {
      revalidatePath('/', 'layout');
      console.log('[API] Revalidated root layout');
    } catch (err) {
      console.warn('[API] Failed to revalidate root layout:', err);
    }

    // ✓ パスベースのリバリデーションで十分（タグベースは不要）

    console.log('[API] Revalidation complete!');

    return NextResponse.json({
      success: true,
      message: 'Pages revalidated successfully',
      revalidatedPaths: paths,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[API] Revalidation error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
