/**
 * Jomon Portal - Event Auto Collector
 *
 * GitHub Actions: 毎週日曜 0:00 JST に実行
 *
 * 処理フロー:
 * 1. facilities.json から url フィールドがある施設のみを取得
 * 2. 各URLをスクレイピング（cheerio）
 * 3. Gemini 2.5 Flash Lite を使用してイベント抽出
 * 4. events.json に追記/更新（重複排除）
 * 5. GitHub API でコミット
 */

const fs = require('fs');
const path = require('path');

async function collectEvents() {
  console.log('[collect-events] Starting event collection...');

  const eventsPath = path.join(__dirname, '../app/data/events.json');
  const facilitiesPath = path.join(__dirname, '../app/data/facilities.json');

  try {
    // 依存ライブラリの動的import
    const axios = require('axios');
    const cheerio = require('cheerio');
    const { GoogleGenerativeAI } = require('@google/generative-ai');
    const { Octokit } = require('@octokit/rest');

    // 1. facilities.json を読み込み
    const facilitiesData = JSON.parse(fs.readFileSync(facilitiesPath, 'utf8'));

    // url フィールドがある施設のみをフィルタ
    const facilitiesWithUrl = facilitiesData.filter(f => f.url && f.url.trim() !== '');
    console.log(`[collect-events] Total facilities: ${facilitiesData.length}, With URL: ${facilitiesWithUrl.length}`);

    // 2. 既存の events.json を読み込み（重複排除用）
    let existingEvents = [];
    if (fs.existsSync(eventsPath)) {
      existingEvents = JSON.parse(fs.readFileSync(eventsPath, 'utf8'));
    }
    const existingIds = new Set(existingEvents.map(e => e.id));
    console.log(`[collect-events] Existing events: ${existingIds.size}`);

    // Gemini API 初期化
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY environment variable not set');
    }
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-flash-latest' });

    // 3. 各施設をスクレイピング＋イベント抽出
    const newEvents = [];
    const today = new Date();
    const oneMonthLater = new Date(today);
    oneMonthLater.setMonth(oneMonthLater.getMonth() + 1);

    for (const facility of facilitiesWithUrl) {
      console.log(`[collect-events] Processing ${facility.name}...`);

      try {
        // URL をスクレイピング（タイムアウト10秒）
        const response = await axios.get(facility.url, {
          timeout: 10000,
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; JomonPortalBot/1.0)' },
        });

        const html = response.data;
        const $ = cheerio.load(html);

        // スクリプト・スタイルを削除
        $('script, style, nav, footer, header').remove();
        const textContent = $('body').text().replace(/\s+/g, ' ').trim().slice(0, 5000);

        if (!textContent) {
          console.warn(`[collect-events] No text content from ${facility.name}`);
          continue;
        }

        // Gemini で イベント抽出（厳格なフィルタリングルール適用）
        const geminiPrompt = `以下のテキストから、直近1ヶ月以内（${today.toISOString().split('T')[0]}〜${oneMonthLater.toISOString().split('T')[0]}）の縄文時代関連イベント情報を抽出してください。

【ネガティブ・フィルタリング（完全に排除）】
以下のいずれかに該当するテキストは『イベントではない』として完全に破棄してください：

1. 休館・閉館情報: 「冬季閉鎖」「臨時休館」「施設メンテナンス」「工事のお知らせ」など
2. 事務的告知: 「入館料改定」「パンフレット更新」「スタッフ募集」「組織変更」など
3. 縄文以外の時代: 弥生時代、古墳時代、中世、江戸時代など、縄文時代に『直接関係のない』催事
4. その他ノイズ: 緊急通知、配置転換、業務連絡

【抽出対象の厳選】
ユーザーが現地で『観る』または『体験する』ことができるポジティブな催し のみを抽出：
- ✅ 企画展、常設展
- ✅ ワークショップ、土器作り体験
- ✅ 現地説明会、ガイドツアー
- ✅ 講演会、セミナー（現地実施）
- ✅ 縄文文化の体験・学習イベント
- ❌ 営業通知、施設案内のみのニュース

【判定ロジックの強化】
テキスト内に『開催期間』『時間』『場所』の3要素が揃っていない情報は除外してください：
- 開催期間: 日付範囲（例: 2026年4月7日-10日、または単日）
- 時間: 時刻情報（例: 10:00-17:00、午後など）
- 場所: 開催地点の明記（例: 館内特別展示室、屋外広場など）

【返却形式】
JSON配列: [
  {
    "date_start": "YYYY-MM-DD",
    "date_end": "YYYY-MM-DD（複数日の場合。単日はdate_startのみ）",
    "time": "HH:MM-HH:MM 形式（例: 10:00-17:00、または時間が不明な場合は null）",
    "title": "イベント名",
    "description": "説明文（1-2文）",
    "location": "具体的な開催場所（例: 館内展示室、屋外広場など）",
    "event_url": "イベント詳細ページへのURL（見つからない場合は null）"
  }
]

【重要な注意】
- イベント情報が見当たらない、または3要素が揃わない場合は空配列[] を返してください
- URL が見つからない場合は null で結構です（後処理で対応）
- 弥生・古墳などの時代関連は『完全に破棄』してください
- 営業情報やお知らせだけのニュースは除外してください

【テキスト内容】
${textContent}`;

        let extractedData = '[]';
        try {
          const result = await model.generateContent({
            contents: [{ role: 'user', parts: [{ text: geminiPrompt }] }],
            tools: [],
            generationConfig: {
              temperature: 0.1,
              maxOutputTokens: 2048
            }
          });
          const responseText = result.response.text().trim();

          // JSON 抽出（マークダウンブロック対応）
          const jsonMatch = responseText.match(/\[[\s\S]*\]/);
          if (jsonMatch) {
            extractedData = jsonMatch[0];
          }
        } catch (geminiErr) {
          console.warn(`[collect-events] Gemini error for ${facility.name}:`, geminiErr.message);
          continue;
        }

        const extractedEvents = JSON.parse(extractedData);

        // イベントを events.json 形式に変換（リンク完全性ルール適用）
        extractedEvents.forEach((evt, idx) => {
          // 3要素チェック（開催期間・時間・場所が揃っているか）
          const hasRequiredFields =
            evt.date_start &&
            evt.time &&
            evt.location;

          if (!hasRequiredFields) {
            console.log(`[collect-events] Skipping event "${evt.title}" (missing required fields: date/time/location)`);
            return; // スキップ
          }

          // URL検証: トップページのみ（/）をイベントURLとしない
          let eventUrl = evt.event_url || null;
          if (eventUrl && (eventUrl === facility.url || eventUrl === facility.url.replace(/\/$/, '') || eventUrl === '/')) {
            console.log(`[collect-events] Skipping event "${evt.title}" (no event-specific URL found)`);
            return; // スキップ
          }

          // 相対パスを絶対化
          if (eventUrl && !eventUrl.startsWith('http')) {
            try {
              const urlObj = new URL(facility.url);
              if (eventUrl.startsWith('/')) {
                eventUrl = `${urlObj.protocol}//${urlObj.host}${eventUrl}`;
              } else {
                eventUrl = `${urlObj.href.replace(/\/$/, '')}/${eventUrl}`;
              }
            } catch (e) {
              console.warn(`[collect-events] Failed to convert relative URL for "${evt.title}"`);
              eventUrl = null;
            }
          }

          const eventId = `evt-${facility.id}-${Date.now()}-${idx}`;

          // 重複チェック（施設ID + イベント名 + 開始日）
          const isDuplicate = existingEvents.some(
            e => e.location_id === facility.id &&
                 e.title === evt.title &&
                 e.date_start === evt.date_start
          );

          if (!isDuplicate) {
            newEvents.push({
              id: eventId,
              title: evt.title,
              date_start: evt.date_start,
              date_end: evt.date_end || undefined,
              time: evt.time || undefined,
              location: evt.location || undefined,
              location_id: facility.id,
              facility_name: facility.name,
              prefecture: facility.prefecture,
              region: facility.region,
              url: eventUrl || facility.url, // イベント詳細URL、なければ施設URL
              category: '企画展', // Gemini が分類する場合はここ
              description: evt.description || '',
            });
          }
        });

        console.log(`[collect-events] ${facility.name}: ${extractedEvents.length} events found`);
      } catch (err) {
        console.warn(`[collect-events] Failed to process ${facility.name}:`, err.message);
      }
    }

    // 4. 期限切れイベントを削除
    const activeEvents = existingEvents.filter(e => {
      const endDate = new Date(e.date_end || e.date_start);
      endDate.setHours(23, 59, 59, 999);
      return endDate >= today;
    });

    console.log(`[collect-events] Removed ${existingEvents.length - activeEvents.length} expired events`);

    // 5. events.json に追記
    const updatedEvents = [...activeEvents, ...newEvents];
    fs.writeFileSync(eventsPath, JSON.stringify(updatedEvents, null, 2) + '\n', 'utf8');
    console.log(`[collect-events] Updated events.json: ${newEvents.length} new events added, total: ${updatedEvents.length}`);

    // 5. GitHub API でコミット（環境変数が設定されている場合のみ）
    const token = process.env.GITHUB_TOKEN;
    const repo = process.env.GITHUB_REPOSITORY;

    if (token && repo && newEvents.length > 0) {
      try {
        const octokit = new Octokit({ auth: token });
        const [owner, repoName] = repo.split('/');
        const branch = 'main';
        const filePath = 'app/data/events.json';

        // 既存ファイルのSHAを取得
        let sha = null;
        try {
          const getRes = await octokit.rest.repos.getContent({
            owner,
            repo: repoName,
            path: filePath,
            ref: branch,
          });
          sha = getRes.data.sha;
        } catch (err) {
          console.log('[collect-events] New file will be created');
        }

        // ファイルをコミット
        const fileContent = fs.readFileSync(eventsPath, 'utf8');
        const putParams = {
          owner,
          repo: repoName,
          path: filePath,
          branch,
          message: `chore(events): auto-collect ${newEvents.length} new events`,
          content: Buffer.from(fileContent).toString('base64'),
        };

        if (sha) {
          putParams.sha = sha;
        }

        await octokit.rest.repos.createOrUpdateFileContents(putParams);
        console.log('[collect-events] Committed to GitHub');
      } catch (githubErr) {
        console.error('[collect-events] GitHub API error:', githubErr.message);
        // GitHub 失敗はスクリプトの失敗とはしない（ローカル変更は保持）
      }
    } else if (!token || !repo) {
      console.log('[collect-events] GitHub credentials not set. Skipping commit. (OK for local testing)');
    } else {
      console.log('[collect-events] No new events to commit');
    }

    console.log('[collect-events] Event collection completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('[collect-events] Fatal error:', error);
    process.exit(1);
  }
}

// GitHub Actions workflow 実装例（.github/workflows/collect-events.yml）:
// ```yaml
// name: Collect Jomon Events
//
// on:
//   schedule:
//     - cron: '0 0 * * 0'  # Every Sunday 0:00 UTC (9:00 JST)
//   workflow_dispatch:
//
// jobs:
//   collect:
//     runs-on: ubuntu-latest
//     steps:
//       - uses: actions/checkout@v4
//       - uses: actions/setup-node@v4
//         with:
//           node-version: '18'
//       - run: npm install cheerio axios @google/generative-ai @octokit/rest
//       - run: node scripts/collect-events.js
//         env:
//           GEMINI_API_KEY: ${{ secrets.GEMINI_API_KEY }}
//           GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
//           GITHUB_REPOSITORY: ${{ github.repository }}
// ```

if (require.main === module) {
  collectEvents().catch(err => {
    console.error('[collect-events] Unhandled error:', err);
    process.exit(1);
  });
}

module.exports = { collectEvents };
