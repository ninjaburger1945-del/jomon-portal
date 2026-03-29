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

async function validateUrl(url) {
  if (!url || !url.startsWith("http")) {
    return { valid: false, url: "", verified: false };
  }

  return new Promise((resolve) => {
    const options = {
      method: 'HEAD',
      timeout: 5000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
      }
    };

    const protocol = url.startsWith("https") ? https : require("http");
    const req = protocol.request(url, options, (res) => {
      if (res.statusCode === 200) {
        resolve({ valid: true, url, verified: true });
      } else {
        console.log(`[HTTP_${res.statusCode}] ${url}`);
        resolve({ valid: false, url: "", verified: false });
      }
      req.abort();
    }).on('error', (err) => {
      console.log(`[FETCH_ERROR] ${err.message}`);
      resolve({ valid: false, url: "", verified: false });
    });

    req.setTimeout(5000, () => {
      req.abort();
      resolve({ valid: false, url: "", verified: false });
    });

    req.end();
  });
}

async function main() {
  const repoRoot = process.cwd();
  const filePath = path.join(repoRoot, "app/data/facilities.json");

  console.log(`[CRAWLER] Starting crawler (timeout: 45min)`);
  console.log(`[DEBUG] repoRoot: ${repoRoot}`);
  console.log(`[DEBUG] filePath: ${filePath}`);
  console.log(`[DEBUG] ファイル存在: ${fs.existsSync(filePath)}`);

  let existingData = [];
  if (fs.existsSync(filePath)) {
    const raw = fs.readFileSync(filePath, "utf-8");
    existingData = JSON.parse(raw);
    console.log(`[CRAWLER] Loaded ${existingData.length} existing facilities`);
  }

  const existingNames = existingData.map(f => `- ${f.name}`).join('\n');

  const apiKey = process.env.GEMINI_API_KEY20261336;
  if (!apiKey) throw new Error("GEMINI_API_KEY20261336 が設定されていません");

  const client = new GoogleGenerativeAI({ apiKey });
  const model = client.getGenerativeModel({ model: "gemini-1.5-pro" });
  console.log('[MODEL] Using gemini-1.5-pro');

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

【URLについて】
施設の公式ウェブサイトURLが存在する場合は、自治体公式サイト(.lg.jp, .pref など)の URL を記載してください。
見つからない場合は空文字("")にしてください。

【出力要件】
完全なJSON配列のみを出力：
[{
  "id": "英数字のハイフン繋ぎ",
  "name": "施設の正式名称",
  "region": "Hokkaido / Tohoku / Kanto / Chubu / Kinki / Chugoku / Shikoku / Kyushu",
  "prefecture": "都道府県名",
  "address": "住所",
  "description": "200〜400文字の紹介文",
  "url": "公式サイトのURL、見つからなければ空文字",
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

    console.log(`[VALIDATE] ${nf.name}: URLを検証中... (${nf.url})`);
    const validation = await validateUrl(nf.url);

    if (!validation.valid) {
      console.error(`[URL_FAIL] 施設を追加不可: URLが無効です - ${nf.name}`);
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
