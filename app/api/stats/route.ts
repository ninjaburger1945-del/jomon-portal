import { NextResponse, NextRequest } from 'next/server';

interface VercelStatsResponse {
  data?: {
    total?: number;
    archives?: Array<{ timestamp: number; count: number }>;
  };
}

interface StatsData {
  pageviews: number;
  visitors: number;
  daily: Array<{ date: string; views: number; visitors: number }>;
  error?: string;
}

/**
 * Vercel Analytics API から統計データを取得
 * GET /api/stats
 */
export async function GET(request: NextRequest) {
  const projectId = process.env.PROJECT_ID;
  const token = process.env.VERCEL_AUTH_TOKEN;

  console.log('[STATS] API request started');
  console.log(`  PROJECT_ID: ${projectId ? '✓ set' : '✗ missing'}`);
  console.log(`  VERCEL_AUTH_TOKEN: ${token ? '✓ set' : '✗ missing'}`);

  // 認証情報チェック - デバッグ情報を詳しく返す
  if (!projectId || !token) {
    const debugInfo = [
      `PROJECT_ID: ${projectId ? '✓ set (' + projectId.substring(0, 10) + '...)' : '✗ MISSING'}`,
      `VERCEL_AUTH_TOKEN: ${token ? '✓ set (' + token.substring(0, 10) + '...)' : '✗ MISSING'}`
    ].join(' | ');

    console.warn('[STATS] Missing Vercel credentials:', debugInfo);
    return NextResponse.json({
      pageviews: 0,
      visitors: 0,
      daily: [],
      error: `環境変数が正しく設定されていません → ${debugInfo}`
    }, { status: 200 });
  }

  try {
    // 過去7日間のタイムスタンプを計算
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const since = Math.floor(sevenDaysAgo.getTime() / 1000);
    const until = Math.floor(now.getTime() / 1000);

    console.log('[STATS] Fetching Vercel Analytics...');
    console.log(`  Period: ${new Date(since * 1000).toISOString()} to ${new Date(until * 1000).toISOString()}`);

    // Pageviews データ取得
    console.log('[STATS] Fetching pageviews...');
    const pageviewsUrl = `https://api.vercel.com/v1/analytics/stats?projectId=${projectId}&since=${since}&until=${until}`;
    console.log(`  URL: ${pageviewsUrl.split('?')[0]}?...`);

    const pageviewsRes = await fetch(pageviewsUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!pageviewsRes.ok) {
      const errText = await pageviewsRes.text();
      console.error(`[STATS] Pageviews API error: HTTP ${pageviewsRes.status}`);
      console.error(`  Response: ${errText.substring(0, 300)}`);
      throw new Error(`Vercel API error: ${pageviewsRes.status}`);
    }

    const pageviewsData = await pageviewsRes.json();
    console.log('[STATS] Pageviews response received');
    console.log(`  Data structure:`, Object.keys(pageviewsData));

    // Visitors データ取得
    console.log('[STATS] Fetching visitors...');
    const visitorsUrl = `https://api.vercel.com/v1/analytics/stats?projectId=${projectId}&since=${since}&until=${until}&metric=visitors`;
    const visitorsRes = await fetch(visitorsUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!visitorsRes.ok) {
      const errText = await visitorsRes.text();
      console.error(`[STATS] Visitors API error: HTTP ${visitorsRes.status}`);
      console.error(`  Response: ${errText.substring(0, 300)}`);
      throw new Error(`Vercel API error: ${visitorsRes.status}`);
    }

    const visitorsData = await visitorsRes.json();
    console.log('[STATS] Visitors response received');

    // データをパース
    const stats = parseVercelResponse(pageviewsData, visitorsData);

    console.log('[STATS] ✓ Successfully parsed data');
    console.log(`  Total pageviews: ${stats.pageviews}`);
    console.log(`  Total visitors: ${stats.visitors}`);
    console.log(`  Daily data points: ${stats.daily.length}`);

    return NextResponse.json(stats);
  } catch (error) {
    console.error('[STATS] ✗ Exception in stats API:');
    console.error(`  ${error instanceof Error ? error.message : String(error)}`);
    console.error(`  Stack: ${error instanceof Error ? error.stack : 'N/A'}`);

    // エラー時も正常な JSON を返す
    return NextResponse.json({
      pageviews: 0,
      visitors: 0,
      daily: [],
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 200 });
  }
}

/**
 * Vercel API レスポンスをパース
 */
function parseVercelResponse(pageviewsData: any, visitorsData: any): StatsData {
  console.log('[STATS] Parsing Vercel response...');

  // データ構造の確認
  console.log(`  Pageviews data type: ${typeof pageviewsData}`);
  console.log(`  Pageviews keys: ${pageviewsData ? Object.keys(pageviewsData).join(', ') : 'null'}`);

  // 複数のデータ構造パターンに対応
  const pageviewsTotal = extractTotal(pageviewsData);
  const pageviewsArchives = extractArchives(pageviewsData);
  const visitorsTotal = extractTotal(visitorsData);
  const visitorsArchives = extractArchives(visitorsData);

  console.log(`  Pageviews total: ${pageviewsTotal}`);
  console.log(`  Pageviews archives: ${pageviewsArchives.length} points`);
  console.log(`  Visitors total: ${visitorsTotal}`);
  console.log(`  Visitors archives: ${visitorsArchives.length} points`);

  // 日ごとのデータを構築
  const daily: StatsData['daily'] = [];
  const dateMap = new Map<string, { views: number; visitors: number }>();

  // ページビューデータを追加
  pageviewsArchives.forEach(({ timestamp, count }) => {
    const date = new Date(timestamp * 1000).toISOString().split('T')[0];
    if (!dateMap.has(date)) {
      dateMap.set(date, { views: 0, visitors: 0 });
    }
    dateMap.get(date)!.views += count;
  });

  // ビジターデータを追加
  visitorsArchives.forEach(({ timestamp, count }) => {
    const date = new Date(timestamp * 1000).toISOString().split('T')[0];
    if (!dateMap.has(date)) {
      dateMap.set(date, { views: 0, visitors: 0 });
    }
    dateMap.get(date)!.visitors += count;
  });

  // ソートして daily に追加
  Array.from(dateMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .forEach(([date, data]) => {
      daily.push({
        date,
        views: data.views,
        visitors: data.visitors,
      });
    });

  return {
    pageviews: pageviewsTotal,
    visitors: visitorsTotal,
    daily,
  };
}

/**
 * レスポンスから total を抽出（複数のパターンに対応）
 */
function extractTotal(data: any): number {
  if (!data) return 0;

  // パターン1: data.total
  if (typeof data.total === 'number') {
    return data.total;
  }

  // パターン2: data.data.total
  if (data.data && typeof data.data.total === 'number') {
    return data.data.total;
  }

  // パターン3: archives から集計
  const archives = extractArchives(data);
  return archives.reduce((sum, item) => sum + item.count, 0);
}

/**
 * レスポンスから archives を抽出（複数のパターンに対応）
 */
function extractArchives(
  data: any
): Array<{ timestamp: number; count: number }> {
  if (!data) return [];

  // パターン1: data.archives
  if (Array.isArray(data.archives)) {
    return data.archives.filter(
      (item: any) => typeof item.timestamp === 'number' && typeof item.count === 'number'
    );
  }

  // パターン2: data.data.archives
  if (data.data && Array.isArray(data.data.archives)) {
    return data.data.archives.filter(
      (item: any) => typeof item.timestamp === 'number' && typeof item.count === 'number'
    );
  }

  return [];
}
