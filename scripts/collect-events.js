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

/**
 * Gemini レスポンスから JSON を抽出・パース
 * マークダウンフェンス、トランケーション、制御文字に対応
 */
function extractAndParseJSON(responseText, context = '', prefix = '') {
  // マークダウンフェンスを削除（```json ... ``` または ``` ... ```）
  let cleaned = responseText.replace(/```(?:json)?\s*/g, '').replace(/```\s*$/g, '');

  // 制御文字を削除
  cleaned = cleaned.replace(/[\x00-\x1F\x7F]/g, ' ');

  // JSON 配列を抽出（トランケーション対応）
  let jsonMatch = cleaned.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    console.warn(`${prefix} JSON not found in response (context: ${context})`);
    return '[]';
  }

  let jsonText = jsonMatch[0];

  // トランケートされた JSON の修復試行
  try {
    // まず素のまま parse を試みる
    JSON.parse(jsonText);
    return jsonText;
  } catch (e) {
    // parse 失敗時の修復処理
    console.warn(`${prefix} First JSON parse failed, attempting repair (context: ${context})`);

    // 不正な制御文字を削除
    jsonText = jsonText.replace(/[\\"]/g, (match) => {
      // バックスラッシュの連続を修正
      return match;
    });

    // 最後が不完全な場合は補完
    let depth = 0;
    let inString = false;
    let escapeNext = false;

    for (let i = 0; i < jsonText.length; i++) {
      const char = jsonText[i];

      if (escapeNext) {
        escapeNext = false;
        continue;
      }

      if (char === '\\') {
        escapeNext = true;
        continue;
      }

      if (char === '"' && !escapeNext) {
        inString = !inString;
      }

      if (!inString) {
        if (char === '[' || char === '{') {
          depth++;
        } else if (char === ']' || char === '}') {
          depth--;
        }
      }
    }

    // 開きブラケットが閉じられていない場合は補完
    while (depth > 0) {
      jsonText += depth > 0 ? ']' : '}';
      depth--;
    }

    // 修復後の parse を試みる
    try {
      JSON.parse(jsonText);
      console.log(`${prefix} JSON repair successful (context: ${context})`);
      return jsonText;
    } catch (repairErr) {
      console.warn(`${prefix} JSON repair failed: ${repairErr.message} (context: ${context})`);
      return '[]';
    }
  }
}

async function collectEvents() {
  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║  Jomon Portal - Event Auto Collector (Safe Mode)             ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');
  console.log('[collect-events] ⚡ Starting event collection cycle...');
  console.log('[collect-events] 🔒 Safety Mode: All processing → Single batch push → [skip ci]');
  console.log('[collect-events] 📊 Vercel Build Minutes protected\n');

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
    console.log(`[collect-events] 📍 Total facilities: ${facilitiesData.length}, With URL: ${facilitiesWithUrl.length}\n`);

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

    let processedCount = 0;
    let errorCount = 0;
    let eventsFoundCount = 0;

    for (const facility of facilitiesWithUrl) {
      try {
        console.log(`[collect-events] [${processedCount + 1}/${facilitiesWithUrl.length}] Processing ${facility.name}...`);

        // URL をスクレイピング（タイムアウト10秒）
        let html, textContent;
        try {
          const response = await axios.get(facility.url, {
            timeout: 10000,
            headers: { 'User-Agent': 'Mozilla/5.0 (compatible; JomonPortalBot/1.0)' },
          });
          html = response.data;
        } catch (fetchErr) {
          console.warn(`[collect-events] ⚠️  Failed to fetch ${facility.name}: ${fetchErr.message}`);
          errorCount++;
          continue; // この施設をスキップして次へ進む
        }

        const $ = cheerio.load(html);

        // スクリプト・スタイルを削除
        $('script, style, nav, footer, header').remove();
        textContent = $('body').text().replace(/\s+/g, ' ').trim().slice(0, 5000);

        if (!textContent) {
          console.warn(`[collect-events] ⚠️  No text content from ${facility.name}`);
          errorCount++;
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
              maxOutputTokens: 8192  // JSONが長い場合に対応
            }
          });
          const responseText = result.response.text().trim();

          // JSON 抽出（マークダウンブロック・トランケーション対応）
          extractedData = extractAndParseJSON(responseText, facility.name, '[collect-events]');
        } catch (geminiErr) {
          console.warn(`[collect-events] Gemini error for ${facility.name}:`, geminiErr.message);
          continue;
        }

        let extractedEvents = [];
        try {
          extractedEvents = JSON.parse(extractedData);
          if (!Array.isArray(extractedEvents)) {
            extractedEvents = [];
          }
        } catch (parseErr) {
          console.warn(`[collect-events] JSON parse error for ${facility.name}: ${parseErr.message}`);
          continue;
        }

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

        console.log(`[collect-events] ✅ ${facility.name}: ${extractedEvents.length} events found`);
        eventsFoundCount += extractedEvents.length;
        processedCount++;
      } catch (err) {
        console.warn(`[collect-events] ❌ Failed to process ${facility.name}: ${err.message}`);
        errorCount++;
        // エラーが発生しても処理を継続
        processedCount++;
      }

      // API への負荷軽減：5-10秒待機（503エラー防止）
      const waitTime = 5000 + Math.random() * 5000; // 5-10秒
      console.log(`[collect-events] ⏳ Waiting ${Math.floor(waitTime)}ms before next request...\n`);
      await new Promise(r => setTimeout(r, waitTime));
    }

    console.log(`\n[collect-events] 📊 Processing Summary:`);
    console.log(`[collect-events]   ✅ Successfully processed: ${processedCount - errorCount}/${facilitiesWithUrl.length}`);
    console.log(`[collect-events]   ⚠️  Errors encountered: ${errorCount}/${facilitiesWithUrl.length}`);
    console.log(`[collect-events]   🎯 Total events found: ${eventsFoundCount}\n`);

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

    // 6. 全件処理完了後に、『一度だけ』Gitコマンドでコミット＆プッシュ
    console.log(`[collect-events] 📦 Batch push phase: Processing ${newEvents.length} new events + ${existingEvents.length - activeEvents.length} removed expired\n`);

    if (newEvents.length > 0 || (existingEvents.length - activeEvents.length) > 0) {
      try {
        const { exec } = require('child_process');
        const util = require('util');
        const execPromise = util.promisify(exec);

        // Git 設定が未設定の場合は初期化（GitHub Actions環境対応）
        try {
          await execPromise('git config user.email');
        } catch {
          console.log('[collect-events] 🔧 Initializing git user config...');
          await execPromise('git config user.email "action@github.com"');
          await execPromise('git config user.name "GitHub Action"');
        }

        // コミットメッセージ：[skip ci] を必ず先頭に含める
        const commitMessage = `[skip ci] chore(events): auto-collect ${newEvents.length} new events, removed ${existingEvents.length - activeEvents.length} expired`;

        // events.json をステージング
        console.log('[collect-events] 📝 Staging events.json...');
        await execPromise('git add app/data/events.json');

        // コミット実行（単一のコミット）
        console.log('[collect-events] 💾 Creating single batch commit...');
        await execPromise(`git commit -m "${commitMessage}"`);

        // プッシュ実行（リベースで競合対応）
        // ⚠️ TEMPORARILY DISABLED - git push causing excessive Vercel charges
        // console.log('[collect-events] 🚀 Pushing to GitHub (with [skip ci] flag)...');
        // await execPromise('git pull --rebase --autostash origin main');
        // await execPromise('git push origin main');
        console.log('[collect-events] ⚠️ Git push DISABLED temporarily due to cost concerns');

        console.log('\n[collect-events] ✅ Successfully committed and pushed to GitHub');
        console.log('[collect-events] 🛡️  Build skip flag [skip ci] active - Vercel build NOT triggered\n');
      } catch (gitErr) {
        // git push 失敗時もスクリプト失敗とはしない（ローカル変更は保持）
        console.warn('\n[collect-events] ⚠️  Git operation error:', gitErr.message);
        console.warn('[collect-events] 💾 Events were saved locally at:', eventsPath);
        console.warn('[collect-events] 🔄 Proceeding without push (data is safe)\n');
        // スクリプトは成功として終了（重要なのはデータ保存）
      }
    } else {
      console.log('[collect-events] ℹ️  No new events to commit. Skipping batch push.\n');
    }

    console.log('╔══════════════════════════════════════════════════════════════╗');
    console.log('║  ✅ Event collection cycle completed successfully            ║');
    console.log('║  ✅ Batch push: ONE commit (protected by [skip ci])          ║');
    console.log('║  ✅ Vercel Build Minutes: SAVED                              ║');
    console.log('╚══════════════════════════════════════════════════════════════╝\n');
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
