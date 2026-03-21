const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require("fs");
const path = require("path");
const https = require("https");

async function retryWithBackoff(asyncFn, maxRetries = 10, initialDelayMs = 2000) {
  let lastError;
  let totalWaitTime = 0;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`\n[ATTEMPT ${attempt}/${maxRetries}] API呼び出し開始...`);
      const startTime = Date.now();
      const result = await asyncFn();
      const elapsed = Date.now() - startTime;
      console.log(`[SUCCESS] 試行 ${attempt} で成功（${elapsed}ms）`);
      return result;
    } catch (error) {
      lastError = error;
      const message = (error.message || '').toLowerCase();
      const statusCode = error.status || error.statusCode || error.code || '';

      console.error(`\n[FAIL ${attempt}/${maxRetries}] API呼び出し失敗`);
      console.error(`  → ${error.message?.substring(0, 120)}`);
      console.error(`  → ステータス: ${statusCode}`);

      const isTemporaryError =
        statusCode === '503' || statusCode === 503 ||
        statusCode === '429' || statusCode === 429 ||
        message.includes('503') ||
        message.includes('429') ||
        message.includes('unavailable');

      if (!isTemporaryError) {
        console.error(`[FATAL] 永続的なエラー: ${error.message}`);
        throw error;
      }

      if (attempt === maxRetries) {
        console.error(`\n[EXHAUSTED] 全てのリトライが失敗`);
        throw error;
      }

      const delayMs = initialDelayMs * Math.pow(2, attempt - 1);
      totalWaitTime += delayMs;

      console.warn(`[BACKOFF] ${delayMs}ms 待機中...`);
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  throw lastError;
}

async function fetchOfficialUrl(facilityName, prefecture) {
  console.log(`[URL_SEARCH] 「${facilityName}」の公式URLを検索中...`);

  const urlMappings = {
    "池上曽根遺跡": [
      "https://www.city.izumiotsu.lg.jp/kakuka/kyoikuiinkai/ikegamisoneyayoigakusyuukan/index.html",
      "https://www.pref.osaka.lg.jp/o180150/bunkazaihogo/bunkazai/ikegamisone.html"
    ],
    "纒向遺跡": [
      "https://www.pref.nara.jp/miryoku/ikasu-nara/bunkashigen/main00601.html",
      "https://www.kashikoken.jp/museum/yamatonoiseki/kofun/makimuku.html"
    ],
    "唐古・鍵遺跡": [
      "https://www.town.tawaramoto.nara.jp/karako_kagi/iseki/about.html",
      "https://www.pref.nara.jp/miryoku/ikasu-nara/bunkashigen/main02001.html"
    ]
  };

  if (urlMappings[facilityName]) {
    for (const url of urlMappings[facilityName]) {
      if (await validateUrlQuick(url)) {
        console.log(`[URL_FOUND] ホワイトリストから発見: ${url}`);
        return { valid: true, url, verified: true };
      }
    }
  }

  console.log(`[URL_NOT_FOUND] URLが見つかりません: ${facilityName}`);
  return { valid: false, url: "", verified: false };
}

async function validateUrlQuick(url) {
  return new Promise((resolve) => {
    if (!url || !url.startsWith("http")) {
      resolve(false);
      return;
    }

    const options = {
      method: 'HEAD',
      timeout: 3000,
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
    };

    const protocol = url.startsWith("https") ? https : require("http");
    const req = protocol.request(url, options, (res) => {
      resolve(res.statusCode === 200);
      req.abort();
    }).on('error', () => {
      resolve(false);
    });

    req.setTimeout(3000, () => {
      req.abort();
      resolve(false);
    });

    req.end();
  });
}

async function main() {
  const repoRoot = path.dirname(path.dirname(__dirname));
  const filePath = path.join(repoRoot, "app/data/facilities.json");

  console.log(`[CRAWLER] Starting crawler (timeout: 45min)`);

  let existingData = [];
  if (fs.existsSync(filePath)) {
    const raw = fs.readFileSync(filePath, "utf-8");
    existingData = JSON.parse(raw);
    console.log(`[CRAWLER] Loaded ${existingData.length} existing facilities`);
  }

  const existingNames = existingData.map(f => `- ${f.name}`).join('\n');

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY が設定されていません");

  const client = new GoogleGenerativeAI({ apiKey });
  const model = client.getGenerativeModel({ model: "gemini-2.5-pro" });
  console.log('[MODEL] Using gemini-2.5-pro');

  const regions = ["北海道", "東北", "関東", "中部", "近畿", "中国", "四国", "九州"];
  const randomRegion = regions[Math.floor(Math.random() * regions.length)];

  const prompt = `
あなたは日本の縄文時代における遺跡・博物館の専門家です。
以下の「すでに登録済みの施設リスト」に含まれていない、日本国内の重要な縄文時代の遺跡・博物館・考古館を必ず3件ピックアップしてください。
弥生時代以降は除外してください。縄文時代のみです。

【既存リスト（これらは除外）】
${existingNames}

【条件】
- ターゲット地方: ${randomRegion}地方
- 縄文時代のみ（弥生時代は除外）
- 公立博物館または国指定史跡

【重要な指示】
- urlフィールドは必ず空文字で返してください
- URLの検証は別プロセスで行うため、AIが推測で生成しないでください

【出力要件】
完全なJSON配列のみを出力：
[{
  "id": "英数字のハイフン繋ぎ",
  "name": "施設の正式名称",
  "region": "Hokkaido / Tohoku / Kanto / Chubu / Kinki / Chugoku / Shikoku / Kyushu",
  "prefecture": "都道府県名",
  "address": "住所",
  "description": "200〜400文字の紹介文",
  "url": "",
  "thumbnail": "",
  "tags": ["世界遺産","博物館","貝塚","環状列石","土器","土偶","国宝"]から最大2個,
  "lat": 緯度,
  "lng": 経度,
  "access": {
    "train": "最寄り駅からのアクセス",
    "bus": "バス停からのアクセス",
    "car": "ICからのアクセス",
    "rank": "S/A/B/C"
  },
  "copy": "14文字以内のキャッチコピー",
  "name_en": "",
  "description_en": "",
  "location_en": "",
  "address_en": "",
  "access_public": "駅・バス停からのアクセス",
  "access_public_en": "",
  "access_car": "車でのアクセス",
  "access_car_en": ""
}]
`;

  console.log(`[CRAWLER] Gemini AI にリクエスト (地方: ${randomRegion})...`);

  let candidates = [];
  try {
    const result = await retryWithBackoff(() => model.generateContent(prompt));

    if (!result?.response) throw new Error("AI レスポンスが null");

    let jsonStr = result.response.text().trim();
    if (jsonStr.startsWith('```json')) jsonStr = jsonStr.slice(7);
    if (jsonStr.startsWith('```')) jsonStr = jsonStr.slice(3);
    if (jsonStr.endsWith('```')) jsonStr = jsonStr.slice(0, -3);
    jsonStr = jsonStr.trim();

    candidates = JSON.parse(jsonStr);
    if (!Array.isArray(candidates)) throw new Error("JSON が配列ではない");

    console.log(`[CRAWLER] ✓ AI が ${candidates.length} 件の候補を返却`);

  } catch (aiError) {
    console.error(`[CRAWLER_FAILURE] AI リクエスト失敗: ${aiError.message}`);
    console.log(`[RESULT] 既存 ${existingData.length} 件のデータを維持`);
    process.exit(0);
  }

  console.log(`[CRAWLER] 候補を検証中...`);

  let addedCount = 0;
  for (const nf of candidates) {
    if (addedCount >= 1) {
      console.log(`[LIMIT] 1件制限に達しました`);
      break;
    }

    const isDuplicate = existingData.some(f =>
      f.name.includes(nf.name) || nf.name.includes(f.name)
    );
    if (isDuplicate) {
      console.log(`[DUPLICATE] スキップ: ${nf.name}`);
      continue;
    }

    console.log(`[VALIDATE] ${nf.name}: 公式URLを検索中...`);
    const validation = await fetchOfficialUrl(nf.name, nf.prefecture);

    if (!validation.valid) {
      console.error(`[URL_FAIL] 施設を追加不可: 公式URLが見つかりません - ${nf.name}`);
      continue;
    }

    nf.url = validation.url;
    nf.verified = validation.verified;

    const access = nf.access || {};
    if (!access.train || !access.bus || !access.car || !access.rank) {
      console.error(`[ACCESS_WARN] アクセス情報が不完全: ${nf.name}`);
      continue;
    }

    existingData.push(nf);
    addedCount++;
    console.log(`[ADDED] ✓ 施設を追加: ${nf.name}`);
  }

  try {
    fs.writeFileSync(filePath, JSON.stringify(existingData, null, 2));
    console.log(`[RESULT] ✅ ${addedCount} 件追加、合計 ${existingData.length} 件`);
  } catch (saveErr) {
    console.error(`[SAVE] ファイル保存失敗: ${saveErr.message}`);
    throw saveErr;
  }

  console.log("[CRAWLER] ✓ 完了");
}

main().catch(error => {
  console.error(`[FATAL] ${error.message}`);
  process.exit(1);
});
