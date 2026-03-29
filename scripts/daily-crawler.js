const fs = require("fs");
const path = require("path");

/**
 * REST API形式で Google Gemini API (v1安定版) を直接叩く
 * 3月16日の Paid Tier/Spend Caps ルール対応版
 */

const API_ENDPOINT = "https://generativelanguage.googleapis.com/v1/models/gemini-1.5-pro:generateContent";
const API_KEY = process.env.GEMINI_API_KEY20261336;

if (!API_KEY) {
  console.error("[FATAL] GEMINI_API_KEY20261336 環境変数が設定されていません");
  process.exit(1);
}

console.log('[DEBUG] API_KEY status:');
console.log(`  - 長さ: ${API_KEY.length}`);
console.log(`  - プレフィックス: ${API_KEY.substring(0, 10)}`);
console.log(`  - 形式チェック: ${API_KEY.startsWith('AIza') ? '✓ Valid' : '✗ Invalid'}`);

/**
 * リトライ機能付き fetch
 */
async function fetchWithRetry(url, options, maxRetries = 5) {
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[ATTEMPT ${attempt}/${maxRetries}] API呼び出し開始...`);
      const response = await fetch(url, options);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[HTTP_ERROR] ステータス: ${response.status}`);
        console.error(`[HTTP_ERROR] レスポンス: ${errorText.substring(0, 200)}`);

        // 400, 401, 403 は永続的エラー（リトライしない）
        if ([400, 401, 403].includes(response.status)) {
          throw new Error(`[PERMANENT] HTTP ${response.status}: ${errorText.substring(0, 100)}`);
        }

        // 429, 503 はリトライ
        if ([429, 500, 503].includes(response.status)) {
          throw new Error(`[TEMPORARY] HTTP ${response.status}`);
        }

        throw new Error(`[UNKNOWN] HTTP ${response.status}`);
      }

      const data = await response.json();
      console.log(`[SUCCESS] 試行 ${attempt} で成功`);
      return data;

    } catch (error) {
      lastError = error;
      console.error(`[FAIL ${attempt}/${maxRetries}] ${error.message}`);

      // 永続的エラーはリトライしない
      if (error.message.includes('[PERMANENT]') || error.message.includes('[400]')) {
        console.error(`[FATAL] 永続的エラーのためリトライを中止`);
        throw error;
      }

      if (attempt < maxRetries) {
        const delayMs = 2000 * Math.pow(2, attempt - 1);
        console.warn(`[BACKOFF] ${delayMs}ms 待機...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
  }

  throw lastError;
}

/**
 * Gemini API を REST API経由で呼び出し
 */
async function callGeminiAPI(prompt) {
  const requestBody = {
    contents: [
      {
        parts: [
          {
            text: prompt
          }
        ]
      }
    ],
    generationConfig: {
      temperature: 1,
      topK: 40,
      topP: 0.95,
      maxOutputTokens: 8192
    }
  };

  const response = await fetchWithRetry(
    `${API_ENDPOINT}?key=${API_KEY}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (compatible; JomonPortal/1.0)'
      },
      body: JSON.stringify(requestBody),
      timeout: 60000
    }
  );

  if (!response.candidates || response.candidates.length === 0) {
    throw new Error('No candidates in API response');
  }

  const content = response.candidates[0].content;
  if (!content || !content.parts || content.parts.length === 0) {
    throw new Error('No text content in API response');
  }

  return content.parts[0].text;
}

/**
 * URL検証
 */
async function validateUrl(url) {
  if (!url || !url.startsWith('http')) {
    return { valid: false, url: '' };
  }

  try {
    const response = await fetch(url, {
      method: 'HEAD',
      timeout: 5000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
      }
    });

    if (response.status === 200) {
      return { valid: true, url };
    }
    return { valid: false, url: '' };
  } catch (err) {
    console.log(`[URL_CHECK] ${url} - ${err.message}`);
    return { valid: false, url: '' };
  }
}

/**
 * メイン処理
 */
async function main() {
  const filePath = path.join(__dirname, '../app/data/facilities.json');

  console.log('[CRAWLER] クローラー開始');
  console.log(`[CRAWLER] データファイル: ${filePath}`);

  // 既存データ読み込み
  let existingData = [];
  if (fs.existsSync(filePath)) {
    const raw = fs.readFileSync(filePath, 'utf-8');
    existingData = JSON.parse(raw);
    console.log(`[CRAWLER] 既存データ: ${existingData.length} 件読み込み`);
  }

  const existingNames = existingData.map(f => `- ${f.name}`).join('\n');

  const regions = ['北海道', '東北', '関東', '中部', '近畿', '中国', '四国', '九州'];
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
施設の公式ウェブサイトURLが存在する場合は、自治体公式サイト(.lg.jp, .pref など)のURLを記載してください。
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

  try {
    console.log(`[CRAWLER] Gemini API にリクエスト (地方: ${randomRegion})...`);
    console.log(`[CRAWLER] エンドポイント: ${API_ENDPOINT}`);

    const responseText = await callGeminiAPI(prompt);

    // JSON抽出
    let jsonStr = responseText.trim();
    if (jsonStr.startsWith('```json')) jsonStr = jsonStr.slice(7);
    if (jsonStr.startsWith('```')) jsonStr = jsonStr.slice(3);
    if (jsonStr.endsWith('```')) jsonStr = jsonStr.slice(0, -3);
    jsonStr = jsonStr.trim();

    const candidates = JSON.parse(jsonStr);
    if (!Array.isArray(candidates) || candidates.length === 0) {
      console.log('[CRAWLER] 有効な候補がありません');
      console.log(`[RESULT] 既存 ${existingData.length} 件のデータを維持`);
      return;
    }

    console.log(`[CRAWLER] AI が ${candidates.length} 件の候補を返却`);

    // 1件制限で追加
    let addedCount = 0;
    for (const candidate of candidates) {
      if (addedCount >= 1) break;

      const isDuplicate = existingData.some(f =>
        f.name.includes(candidate.name) || candidate.name.includes(f.name)
      );

      if (isDuplicate) {
        console.log(`[DUPLICATE] スキップ: ${candidate.name}`);
        continue;
      }

      // URL検証
      console.log(`[VALIDATE] ${candidate.name}: ${candidate.url}`);
      const validation = await validateUrl(candidate.url);

      if (!validation.valid && candidate.url) {
        console.warn(`[URL_INVALID] スキップ: ${candidate.name}`);
        continue;
      }

      candidate.url = validation.url;

      // アクセス情報チェック
      if (!candidate.access || !candidate.access.train || !candidate.access.bus || !candidate.access.car) {
        console.warn(`[ACCESS_INCOMPLETE] ${candidate.name} - アクセス情報が不完全`);
        continue;
      }

      existingData.push(candidate);
      addedCount++;
      console.log(`[ADDED] ✓ ${candidate.name}`);
    }

    // ファイル保存
    fs.writeFileSync(filePath, JSON.stringify(existingData, null, 2), 'utf-8');
    console.log(`[RESULT] ✅ ${addedCount} 件追加、合計 ${existingData.length} 件`);

  } catch (error) {
    console.error(`[FATAL] クローラーエラー: ${error.message}`);
    console.log(`[RESULT] 既存 ${existingData.length} 件のデータを維持`);
    process.exit(0);
  }
}

main().catch(error => {
  console.error(`[ERROR] ${error.message}`);
  process.exit(1);
});
