const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

/**
 * Jomon Portal クローラー v3.0 (Gemini 強化版)
 *
 * 設計思想:
 * - Google Custom Search API は無料版で制限あり（ウェブ全体検索不可） → 使わない
 * - Gemini が .lg.jp や公式サイトなど信頼度の高い URL を 5個以上提案
 * - それらを順番に fetch して、404でないものを採用
 * - kunishitei は最終手段のみ
 *
 * 環境変数（GitHub Secrets）:
 * - GEMINI_API_KEY20261336: Gemini API Key（これだけで動く）
 */

const API_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent";
const API_KEY = process.env.GEMINI_API_KEY20261336;

// ========== 初期化 ==========
console.log(`\n[INIT] ========== Jomon Portal Crawler v3.0 ==========`);
console.log(`[INIT] GEMINI_API_KEY20261336: ${API_KEY ? '✅ 存在' : '❌ 未設定'}`);

if (!API_KEY) {
  console.error("[FATAL] ❌ GEMINI_API_KEY20261336 が設定されていません");
  process.exit(1);
}

console.log(`[INIT] ✅ 初期化完了。Google Custom Search API は不要（Gemini のみで動作）\n`);

// ========== リトライ機能付き fetch ==========
async function fetchWithRetry(url, options, maxRetries = 3) {
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[HTTP_ERROR] ステータス: ${response.status}`);

        if ([400, 401, 403, 404].includes(response.status)) {
          throw new Error(`[PERMANENT] HTTP ${response.status}`);
        }

        if ([429, 500, 503].includes(response.status)) {
          throw new Error(`[TEMPORARY] HTTP ${response.status}`);
        }

        throw new Error(`[UNKNOWN] HTTP ${response.status}`);
      }

      const data = await response.json();
      return data;

    } catch (error) {
      lastError = error;
      console.error(`[ATTEMPT ${attempt}/${maxRetries}] ${error.message}`);

      if (error.message.includes('[PERMANENT]')) {
        throw error;
      }

      if (attempt < maxRetries) {
        const delayMs = 2000 * Math.pow(2, attempt - 1);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
  }

  throw lastError;
}

// ========== Gemini API 呼び出し ==========
async function callGeminiAPI(prompt) {
  const requestBody = {
    contents: [{
      parts: [{ text: prompt }]
    }],
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

// ========== ページ内容取得 ==========
async function fetchPageContent(url) {
  if (!url || !url.startsWith('http')) {
    return { success: false, content: '', statusCode: 0 };
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const res = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    clearTimeout(timeoutId);

    if (res.ok) {
      const html = await res.text();
      return { success: true, content: html, statusCode: res.status };
    }

    console.warn(`[FETCH_FAIL] HTTP ${res.status}`);
    return { success: false, content: '', statusCode: res.status };

  } catch (e) {
    console.warn(`[FETCH_ERROR] ${e.message}`);
    return { success: false, content: '', statusCode: 0 };
  }
}

// ========== URL 内容検証 ==========
async function validateUrlWithContent(url, facilityName, address) {
  if (!url || !url.startsWith('http')) {
    return { valid: false, score: 0 };
  }

  console.log(`[VALIDATE] ${url} を検証中...`);

  const pageResult = await fetchPageContent(url);
  if (!pageResult.success) {
    console.warn(`[VALIDATE] ❌ ページ取得失敗: HTTP ${pageResult.statusCode}`);
    return { valid: false, score: 0 };
  }

  const html = pageResult.content;
  const text = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .toLowerCase();

  // 404 検出
  const notFoundPatterns = ['404', 'ページが見つかり', 'not found', 'お探しのページ'];
  if (notFoundPatterns.some(p => text.includes(p))) {
    console.warn(`[VALIDATE] ❌ 404 またはエラーページ検出`);
    return { valid: false, score: 0 };
  }

  // キーワード検証
  const keywords = ['縄文', '遺跡', '史跡', '考古', '土器', '貝塚'];
  const foundKeywords = keywords.filter(kw => text.includes(kw));

  if (foundKeywords.length === 0) {
    console.warn(`[VALIDATE] ❌ 縄文関連キーワード未検出`);
    return { valid: false, score: 0 };
  }

  // テキスト長チェック
  if (text.length < 300) {
    console.warn(`[VALIDATE] ❌ コンテンツが短すぎる（${text.length}文字）`);
    return { valid: false, score: 0 };
  }

  // 施設名判定（柔軟）
  const facilityNameLower = facilityName.toLowerCase();
  let nameFound = text.includes(facilityNameLower);

  if (!nameFound) {
    const mainPart = facilityName.split(/[遺跡史跡博物館]/)[0].trim();
    nameFound = mainPart.length > 2 && text.includes(mainPart.toLowerCase());
  }

  let score = foundKeywords.length * 10 + (text.length / 100);
  console.log(`[VALIDATE] ✅ 検証成功 (スコア: ${Math.floor(score)})`);
  return { valid: true, score: score };
}

// ========== kunishitei フォールバック（最終手段） ==========
async function findUrlViaKunishitei(facilityName, address) {
  console.log(`\n[FALLBACK] ========== kunishitei.bunka.go.jp 最終検索 ==========`);
  console.log(`[FALLBACK] Gemini の候補がすべて失敗。最後の手段として kunishitei を検索`);

  const fallbackPrompt = `
あなたは国指定史跡データベース（kunishitei.bunka.go.jp）の専門家です。
施設「${facilityName}」に関するページのURLを kunishitei.bunka.go.jp 内で探してください。

以下のいずれかを返す（JSON のみ）：
1. 見つかった場合: {"found": true, "url": "https://kunishitei.bunka.go.jp/..."}
2. 見つからない場合: {"found": false}

ハルシネーション厳禁。kunishitei.bunka.go.jp ドメインのURLのみ。
`;

  try {
    const fallbackResponse = await callGeminiAPI(fallbackPrompt);
    const jsonStart = fallbackResponse.indexOf('{');
    const jsonEnd = fallbackResponse.lastIndexOf('}');

    if (jsonStart === -1 || jsonEnd === -1) {
      console.warn(`[FALLBACK] JSON 形式のレスポンスが見つかりません`);
      return { valid: false, url: '' };
    }

    const result = JSON.parse(fallbackResponse.substring(jsonStart, jsonEnd + 1));

    if (result.found && result.url) {
      console.log(`[FALLBACK] kunishitei URL 候補: ${result.url}`);
      const validation = await validateUrlWithContent(result.url, facilityName, address);
      if (validation.valid) {
        console.log(`[FALLBACK] ✅ kunishitei から採用: ${result.url}`);
        return { valid: true, url: result.url };
      }
    }

    console.warn(`[FALLBACK] kunishitei に該当ページが見つかりません`);
    return { valid: false, url: '' };

  } catch (error) {
    console.warn(`[FALLBACK] エラー: ${error.message}`);
    return { valid: false, url: '' };
  }
}

// ========== URL 検証フロー（Gemini 候補を順番に検証） ==========
async function validateCandidateUrls(candidateUrls, facilityName, address, prefecture) {
  console.log(`\n[VALIDATE_FLOW] ========== URL 検証開始（${candidateUrls.length} 候補） ==========`);

  // フェーズ1: Gemini 候補を順番に検証（404チェック + コンテンツ検証）
  console.log(`[VALIDATE_FLOW] フェーズ1: Gemini 候補を順番に検証`);

  for (let index = 0; index < candidateUrls.length; index++) {
    const url = candidateUrls[index];
    if (!url || url.trim() === '') continue;

    console.log(`[VALIDATE_FLOW] 候補 ${index + 1}/${candidateUrls.length}: ${url}`);

    // ページ取得 + 404チェック
    const pageResult = await fetchPageContent(url);

    if (!pageResult.success || pageResult.statusCode === 404) {
      console.warn(`[VALIDATE_FLOW] ❌ 404 またはアクセス不可`);
      continue;
    }

    // コンテンツ検証
    const result = await validateUrlWithContent(url, facilityName, address);
    if (result.valid) {
      console.log(`[VALIDATE_FLOW] ✅ 採用: ${url}`);
      return { valid: true, url: url, source: 'Gemini候補', score: result.score };
    }

    console.warn(`[VALIDATE_FLOW] ⚠️ コンテンツ検証失敗`);
  }

  console.warn(`[VALIDATE_FLOW] ⚠️ Gemini の ${candidateUrls.length} 候補がすべて失敗`);

  // フェーズ2: kunishitei フォールバック（本当の最終手段）
  const fallbackResult = await findUrlViaKunishitei(facilityName, address);
  if (fallbackResult.valid) {
    return { valid: true, url: fallbackResult.url, source: 'kunishitei', score: 50 };
  }

  console.error(`[VALIDATE_FLOW] ❌ 全ての検索方法で有効な URL が見つかりません`);
  return { valid: false, url: '' };
}

// ========== 画像生成 ==========
async function generateFacilityImage(facilityId, facilityName, description) {
  const imagesDir = path.join(__dirname, '../public/images/facilities');

  if (!fs.existsSync(imagesDir)) {
    fs.mkdirSync(imagesDir, { recursive: true });
  }

  const outputPath = path.join(imagesDir, `${facilityId}_ai.png`);

  console.log(`[IMAGE] 10秒待機中...`);
  await new Promise(resolve => setTimeout(resolve, 10000));

  try {
    const prompt = `日本の縄文時代の遺跡「${facilityName}」のAIイラストを生成してください。
特徴：${description.substring(0, 200)}...
要件：縄文時代の雰囲気、土器・貝塚・環状列石などを含める、暖色系、教育的価値`;

    const requestBody = {
      instances: [{ prompt: prompt }],
      parameters: {
        sampleCount: 1,
        aspectRatio: "4:3",
        outputMimeType: "image/png"
      }
    };

    const response = await fetchWithRetry(
      `https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-generate-001:predict?key=${API_KEY}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (compatible; JomonPortal/1.0)'
        },
        body: JSON.stringify(requestBody),
        timeout: 60000
      },
      3
    );

    if (response.predictions && response.predictions.length > 0 && response.predictions[0].bytesBase64Encoded) {
      const imageBuffer = Buffer.from(response.predictions[0].bytesBase64Encoded, 'base64');
      fs.writeFileSync(outputPath, imageBuffer);
      console.log(`[IMAGE] ✅ 生成成功`);
      return `/images/facilities/${facilityId}_ai.png`;
    }

    return '';

  } catch (error) {
    console.warn(`[IMAGE] ❌ 生成失敗: ${error.message}`);
    return '';
  }
}

// ========== メイン処理 ==========
async function main() {
  const filePath = path.join(__dirname, '../app/data/facilities.json');

  console.log('\n[CRAWLER] ========== クローラー開始 ==========');
  console.log(`[CRAWLER] データファイル: ${filePath}`);

  // 既存データ読み込み
  let existingData = [];
  if (fs.existsSync(filePath)) {
    const raw = fs.readFileSync(filePath, 'utf-8');
    existingData = JSON.parse(raw);
    console.log(`[CRAWLER] 既存データ: ${existingData.length} 件`);
  }

  const existingNames = existingData.map(f => `- ${f.name}`).join('\n');
  const regions = ['北海道', '東北', '関東', '中部', '近畿', '中国', '四国', '九州'];
  const randomRegion = regions[Math.floor(Math.random() * regions.length)];

  const prompt = `
あなたは日本の縄文時代における遺跡・博物館の専門家です。
「すでに登録済みの施設リスト」に含まれていない、日本国内の重要な縄文時代の遺跡・博物館・考古館を必ず3件ピックアップしてください。
弥生時代以降は除外。縄文時代のみです。

【既存リスト（これらは除外）】
${existingNames}

【条件】
- ターゲット地方: ${randomRegion}地方
- 縄文時代のみ（弥生時代は除外）
- 公立博物館または国指定史跡

【🔍 重要：信頼度の高いURLを5個以上提案してください】

あなたのタスク：
1. 施設名で検索した場合の有名なURL候補を推定
2. 優先順位：.lg.jp （自治体公式）> .go.jp （政府）> .or.jp （公開）
3. 候補URL数は質を優先：検証可能な信頼できるものだけを 5個以上、厳選

【URLの優先順位】

【優先度1：.lg.jp（自治体公式）】
例：sannaimaruyama.pref.aomori.jp, city.chino.lg.jp/site/togariishi/, www.city.chiba.jp/kasori/
→ ほぼ確実に存在

【優先度2：.go.jp（政府機関）】
例：kunishitei.bunka.go.jp/... (ただしこれは最終手段)

【優先度3：.or.jp（公開サイト・学術機関）】
例：jomon-japan.jp, nabunken.go.jp

【優先度4：その他の公式サイト】
自治体観光ポータル、学術機関など

【絶対禁止】
- Wikipedia
- SNS（X/Twitter等）
- 404/削除済みページ
- ハルシネーション（存在しないURL）

【出力要件】
完全なJSON配列のみを出力。candidatesは優先度順に記載：

[{
  "id": "英数字のハイフン繋ぎ",
  "name": "施設の正式名称",
  "region": "Hokkaido / Tohoku / Kanto / Chubu / Kinki / Chugoku / Shikoku / Kyushu",
  "prefecture": "都道府県名",
  "address": "住所",
  "description": "200〜400文字の紹介文",
  "url": "最も信頼性の高いURL（通常は .lg.jp）",
  "candidates": [
    "候補1（最優先の .lg.jp など）",
    "候補2（.go.jp など）",
    "候補3",
    "候補4",
    "候補5"
  ],
  "thumbnail": "",
  "tags": ["博物館","貝塚","遺跡"]から最大2個,
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

    const responseText = await callGeminiAPI(prompt);

    // JSON 抽出
    let jsonStr = responseText.trim();
    if (jsonStr.startsWith('```json')) jsonStr = jsonStr.slice(7);
    else if (jsonStr.startsWith('```')) jsonStr = jsonStr.slice(3);

    const jsonStart = jsonStr.indexOf('[');
    const jsonEnd = jsonStr.lastIndexOf(']');

    if (jsonStart === -1 || jsonEnd === -1) {
      throw new Error('JSON array not found');
    }

    jsonStr = jsonStr.substring(jsonStart, jsonEnd + 1).trim();
    const candidates = JSON.parse(jsonStr);

    if (!Array.isArray(candidates) || candidates.length === 0) {
      console.log('[CRAWLER] 有効な候補がありません');
      console.log(`[RESULT] 既存 ${existingData.length} 件を維持`);
      return;
    }

    console.log(`[CRAWLER] AI が ${candidates.length} 件の候補を返却`);

    // 1 件制限で追加
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

      console.log(`\n[PROCESS] ${candidate.name} - URL 検証開始`);
      const candidateUrls = candidate.candidates || (candidate.url ? [candidate.url] : []);

      if (candidateUrls.length === 0) {
        console.warn(`[PROCESS] ⚠️ candidates 配列が空です。候補URL: ${candidate.url}`);
        candidateUrls.push(candidate.url);
      }

      const urlValidation = await validateCandidateUrls(
        candidateUrls,
        candidate.name,
        candidate.address,
        candidate.prefecture
      );

      if (!urlValidation.valid) {
        console.warn(`[PROCESS] ❌ ${candidate.name} - URL 検証失敗（全候補が不適切）`);
        continue;
      }

      candidate.url = urlValidation.url;
      delete candidate.candidates;

      console.log(`[URL_CONFIRMED] ✅ ${candidate.name} → ${candidate.url}`);

      if (!candidate.access || !candidate.access.train || !candidate.access.bus || !candidate.access.car) {
        console.warn(`[ACCESS_INCOMPLETE] ${candidate.name} - アクセス情報が不完全`);
        continue;
      }

      const nextId = String(existingData.length + 1).padStart(3, '0');
      candidate.id = nextId;

      const imageUrl = await generateFacilityImage(nextId, candidate.name, candidate.description);
      candidate.thumbnail = imageUrl || '';

      existingData.push(candidate);
      addedCount++;
      console.log(`[ADDED] ✓ ${nextId} - ${candidate.name}`);
    }

    // ファイル保存
    fs.writeFileSync(filePath, JSON.stringify(existingData, null, 2), 'utf-8');
    console.log(`\n[RESULT] ✅ ${addedCount} 件追加、合計 ${existingData.length} 件`);

  } catch (error) {
    console.error(`[FATAL] クローラーエラー: ${error.message}`);
    console.log(`[RESULT] 既存 ${existingData.length} 件を維持`);
    process.exit(0);
  }
}

// ========== 実行 ==========
main().catch(error => {
  console.error(`[ERROR] ${error.message}`);
  process.exit(1);
});
