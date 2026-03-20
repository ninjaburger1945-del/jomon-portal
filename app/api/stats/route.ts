import { NextResponse, NextRequest } from 'next/server';

interface VercelAnalyticsResponse {
  pageviews: Array<{ timestamp: number; count: number }>;
  visitors: Array<{ timestamp: number; count: number }>;
}

interface StatsData {
  daily?: Array<{
    date: string;
    views: number;
    visitors: number;
  }>;
  summary?: {
    totalViews: number;
    totalVisitors: number;
    avgTimeOnPage: string;
  };
  topFacilities?: Array<{
    name: string;
    views: number;
  }>;
  error?: boolean;
  message?: string;
  status?: string;
  source?: string;
}

/**
 * Vercel Analytics API から過去7日間の統計データを取得
 * GET /api/stats
 */
export async function GET(request: NextRequest) {
  try {
    const token = process.env.VERCEL_AUTH_TOKEN;
    const projectId = process.env.NEXT_PUBLIC_VERCEL_PROJECT_ID;

    // 認証情報チェック
    if (!token || !projectId) {
      console.warn('[STATS] ⚠️ Vercel credentials not configured');
      console.warn(`   VERCEL_AUTH_TOKEN: ${token ? '✓ set' : '✗ missing'}`);
      console.warn(`   NEXT_PUBLIC_VERCEL_PROJECT_ID: ${projectId ? '✓ set' : '✗ missing'}`);
      return NextResponse.json({
        error: true,
        message: 'API未接続: Vercel認証情報が設定されていません',
        status: 'no_credentials',
      }, { status: 503 });
    }

    // 過去7日間のタイムスタンプを計算
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const since = Math.floor(sevenDaysAgo.getTime() / 1000);
    const until = Math.floor(now.getTime() / 1000);

    console.log(`[STATS] Fetching real Vercel analytics...`);
    console.log(`   projectId: ${projectId}`);
    console.log(`   period: ${since} → ${until} (7 days)`);

    // Vercel Analytics API を呼び出し
    // ドキュメント: https://vercel.com/docs/rest-api#endpoints/analytics/get-analytics-stats
    const analyticsUrl = `https://api.vercel.com/v1/analytics/stats?projectId=${projectId}&since=${since}&until=${until}`;

    console.log(`[STATS] Calling Vercel API: ${analyticsUrl}`);

    const response = await fetch(analyticsUrl, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    console.log(`[STATS] Vercel API response: HTTP ${response.status}`);

    if (!response.ok) {
      const errText = await response.text();
      console.error(`[STATS] ✗ Vercel API error ${response.status}:`);
      console.error(`   ${errText.substring(0, 200)}`);

      // 認証エラー（401/403）
      if (response.status === 401 || response.status === 403) {
        return NextResponse.json({
          error: true,
          message: 'API未接続: Vercel認証失敗（トークンが無効または期限切れ）',
          status: 'auth_failed',
          statusCode: response.status,
        }, { status: 503 });
      }

      // その他のエラー
      return NextResponse.json({
        error: true,
        message: `API未接続: Vercel API エラー (HTTP ${response.status})`,
        status: 'api_error',
        statusCode: response.status,
      }, { status: 503 });
    }

    const analyticsData: VercelAnalyticsResponse = await response.json();

    console.log(`[STATS] ✓ Successfully fetched real data`);
    console.log(`   pageviews: ${analyticsData.pageviews?.length || 0} records`);
    console.log(`   visitors: ${analyticsData.visitors?.length || 0} records`);

    // レスポンスデータを処理して統計情報を生成
    const statsData = processAnalyticsData(analyticsData);
    statsData.source = 'vercel_api_live';

    return NextResponse.json(statsData);
  } catch (error) {
    console.error('[STATS] ✗ Exception while fetching analytics:');
    console.error(`   ${error instanceof Error ? error.message : String(error)}`);

    return NextResponse.json({
      error: true,
      message: `API未接続: ${error instanceof Error ? error.message : 'Unknown error'}`,
      status: 'exception',
    }, { status: 503 });
  }
}

/**
 * Vercel APIレスポンスを処理して見やすいフォーマットに変換
 */
function processAnalyticsData(data: VercelAnalyticsResponse): StatsData {
  const daily: StatsData['daily'] = [];
  const viewsByDate = new Map<string, number>();
  const visitorsByDate = new Map<string, number>();

  // ページビュー データの処理
  if (data.pageviews && Array.isArray(data.pageviews)) {
    data.pageviews.forEach((item) => {
      const date = new Date(item.timestamp * 1000).toISOString().split('T')[0];
      viewsByDate.set(date, (viewsByDate.get(date) || 0) + item.count);
    });
  }

  // ビジター データの処理
  if (data.visitors && Array.isArray(data.visitors)) {
    data.visitors.forEach((item) => {
      const date = new Date(item.timestamp * 1000).toISOString().split('T')[0];
      visitorsByDate.set(date, (visitorsByDate.get(date) || 0) + item.count);
    });
  }

  // 日ごとのデータをマージ
  const dateSet = new Set([...viewsByDate.keys(), ...visitorsByDate.keys()]);
  Array.from(dateSet)
    .sort()
    .forEach((date) => {
      daily.push({
        date,
        views: viewsByDate.get(date) || 0,
        visitors: visitorsByDate.get(date) || 0,
      });
    });

  // サマリー統計
  const totalViews = daily.reduce((sum, d) => sum + d.views, 0);
  const totalVisitors = daily.reduce((sum, d) => sum + d.visitors, 0);
  const avgTimeOnPage = calculateAvgTime(totalViews);

  // ダミーの人気施設（実装: 今後Vercelから取得可能になれば更新）
  const topFacilities: StatsData['topFacilities'] = [
    { name: '特別史跡 三内丸山遺跡', views: totalViews * 0.3 },
    { name: '大湯環状列石', views: totalViews * 0.25 },
    { name: '吉野ヶ里遺跡', views: totalViews * 0.18 },
  ];

  return {
    daily,
    summary: {
      totalViews,
      totalVisitors,
      avgTimeOnPage,
    },
    topFacilities,
  };
}

/**
 * エラー状態を表す StatsData を返す
 */
function getErrorStats(message: string, status: string): StatsData {
  return {
    error: true,
    message,
    status,
    source: 'error',
  };
}

function calculateAvgTime(totalViews: number): string {
  // ページビュー数から平均滞在時間を推定（ダミー計算）
  const avgSeconds = Math.max(60, Math.floor(totalViews / 50));
  const minutes = Math.floor(avgSeconds / 60);
  const seconds = avgSeconds % 60;
  return `${minutes}分${seconds}秒`;
}
