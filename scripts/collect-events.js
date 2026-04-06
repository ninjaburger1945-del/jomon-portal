/**
 * Jomon Portal - Event Auto Collector
 *
 * GitHub Actions: 毎週日曜 0:00 JST に実行
 *
 * 処理フロー:
 * 1. facilities.json から全施設URLを取得
 * 2. 各URLをスクレイピング（cheerio）
 * 3. Gemini 2.5 Flash Lite を使用してイベント抽出
 * 4. events.json に追記/更新（重複排除）
 * 5. GitHub API でコミット
 */

const fs = require('fs');
const path = require('path');

// 必要なパッケージ: cheerio, axios, @google/generative-ai

async function collectEvents() {
  console.log('[collect-events] Starting event collection...');

  const eventsPath = path.join(__dirname, '../app/data/events.json');
  const facilitiesPath = path.join(__dirname, '../app/data/facilities.json');

  try {
    // 1. facilities.json を読み込み
    const facilitiesData = JSON.parse(fs.readFileSync(facilitiesPath, 'utf8'));
    console.log(`[collect-events] Loaded ${facilitiesData.length} facilities`);

    // 2. 既存の events.json を読み込み（重複排除用）
    let existingEvents = [];
    if (fs.existsSync(eventsPath)) {
      existingEvents = JSON.parse(fs.readFileSync(eventsPath, 'utf8'));
    }
    const existingIds = new Set(existingEvents.map(e => e.id));
    console.log(`[collect-events] Existing events: ${existingIds.size}`);

    // 3. 各施設をスクレイピング＋イベント抽出
    // 注: 実装にはcheério、axios、Google Generative AI SDK が必要
    // 以下はPseudocodeとなります

    const newEvents = [];

    for (const facility of facilitiesData) {
      if (!facility.url) continue;

      console.log(`[collect-events] Scraping ${facility.name}...`);

      try {
        // 疑似実装: URLをスクレイピング
        // const html = await axios.get(facility.url);
        // const $ = cheerio.load(html.data);
        // const textContent = $('body').text().slice(0, 5000);

        // 疑似実装: Gemini で イベント抽出
        // const prompt = `以下のテキストから、直近1ヶ月以内の縄文時代関連イベントを抽出してください。
        // 弥生時代、古墳時代など他の時代のイベントは除外してください。
        //
        // 返却形式: JSON配列 [{ date_start: "YYYY-MM-DD", date_end?: "YYYY-MM-DD", title: "...", description: "..." }]
        // テキスト: ${textContent}`;

        // const response = await genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' })
        //   .generateContent(prompt);

        // const extractedEvents = JSON.parse(response.response.text());
        // extractedEvents.forEach((evt, idx) => {
        //   const id = `evt-${Date.now()}-${idx}`;
        //   if (!existingIds.has(id)) {
        //     newEvents.push({
        //       id,
        //       title: evt.title,
        //       date_start: evt.date_start,
        //       date_end: evt.date_end || undefined,
        //       location_id: facility.id,
        //       facility_name: facility.name,
        //       prefecture: facility.prefecture,
        //       region: facility.region,
        //       url: facility.url,
        //       category: 'その他',
        //       description: evt.description || '',
        //     });
        //   }
        // });
      } catch (err) {
        console.warn(`[collect-events] Failed to scrape ${facility.name}:`, err.message);
      }
    }

    // 4. events.json に追記
    const updatedEvents = [...existingEvents, ...newEvents];
    fs.writeFileSync(eventsPath, JSON.stringify(updatedEvents, null, 2), 'utf8');
    console.log(`[collect-events] Updated events.json with ${newEvents.length} new events`);

    // 5. GitHub API でコミット（GitHub Actions環境での実装例）
    // const token = process.env.GITHUB_TOKEN;
    // const repo = process.env.GITHUB_REPOSITORY; // "owner/repo"
    // const branch = 'main';
    // const filePath = 'app/data/events.json';
    //
    // const octokit = new Octokit({ auth: token });
    // const [owner, repoName] = repo.split('/');
    //
    // // 既存ファイルのSHAを取得
    // const getFileRes = await octokit.rest.repos.getContent({
    //   owner, repo: repoName, path: filePath, ref: branch,
    // });
    //
    // // ファイルをコミット
    // await octokit.rest.repos.createOrUpdateFileContents({
    //   owner, repo: repoName, path: filePath, branch,
    //   message: `chore(events): auto-collect events from facilities`,
    //   content: Buffer.from(fs.readFileSync(eventsPath)).toString('base64'),
    //   sha: getFileRes.data.sha,
    // });
    //
    // console.log('[collect-events] Committed to GitHub');

    console.log('[collect-events] Event collection completed successfully');
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
  collectEvents().catch(console.error);
}

module.exports = { collectEvents };
