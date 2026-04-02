const fs = require("fs");
const path = require("path");
const sharp = require("sharp");
const { createSign } = require("crypto");

/**
 * 完全統合版: Google Gemini API + Google Custom Search API (OAuth2.0 認証)
 * URL全滅エラー回避仕様
 *
 * 環境変数（GitHub Secrets）:
 * - GOOGLESEARCH_SERVICE_ACCOUNT: Service Account JSON (private_key で OAuth認証)
 * - GOOGLESEARCH_CX: Google Custom Search Engine ID
 * - GEMINI_API_KEY20261336: Gemini API Key
 */

const API_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent";
const API_KEY = process.env.GEMINI_API_KEY20261336;
const GOOGLE_SEARCH_ENDPOINT = "https://www.googleapis.com/customsearch/v1";

// ========== 初期化: GitHub Secrets 読み込み ==========
console.log(`\n[INIT_SECRETS] ========== GitHub Secrets 環境変数の確認 ==========`);

const GOOGLESEARCH_CX = process.env.GOOGLESEARCH_CX;
let GOOGLESEARCH_SERVICE_ACCOUNT_JSON = null;
let GOOGLE_SEARCH_JWT_TOKEN = null;

// 1. GEMINI_API_KEY20261336 確認
console.log(`[INIT_SECRETS] GEMINI_API_KEY20261336: ${API_KEY ? '✅ 存在' : '❌ 未設定'}`);
if (!API_KEY) {
  console.error("[FATAL] ❌ GEMINI_API_KEY20261336 が設定されていません");
  process.exit(1);
}

// 2. GOOGLESEARCH_CX 確認
console.log(`[INIT_SECRETS] GOOGLESEARCH_CX: ${GOOGLESEARCH_CX ? '✅ 存在' : '❌ 未設定'}`);
if (!GOOGLESEARCH_CX) {
  console.error("[FATAL] ❌ GOOGLESEARCH_CX が設定されていません");
  process.exit(1);
}

// 3. GOOGLESEARCH_SERVICE_ACCOUNT 確認
console.log(`[INIT_SECRETS] GOOGLESEARCH_SERVICE_ACCOUNT: ${process.env.GOOGLESEARCH_SERVICE_ACCOUNT ? '✅ 存在' : '❌ 未設定'}`);
if (!process.env.GOOGLESEARCH_SERVICE_ACCOUNT) {
  console.error("[FATAL] ❌ GOOGLESEARCH_SERVICE_ACCOUNT が設定されていません");
  process.exit(1);
}

try {
  let serviceAccountStr = process.env.GOOGLESEARCH_SERVICE_ACCOUNT;
  console.log(`[DEBUG] Service Account 文字列の長さ: ${serviceAccountStr ? serviceAccountStr.length : 0}`);
  console.log(`[DEBUG] '{' を含む: ${serviceAccountStr && serviceAccountStr.includes('{') ? 'YES（JSON）' : 'NO（Base64？）'}`);

  // Base64 デコード対応
  if (serviceAccountStr && !serviceAccountStr.includes('{')) {
    console.log(`[DEBUG] Base64 エンコードされていると判断。デコード中...`);
    serviceAccountStr = Buffer.from(serviceAccountStr, 'base64').toString('utf-8');
    console.log(`[DEBUG] デコード後の長さ: ${serviceAccountStr.length}`);
  }

  if (!serviceAccountStr) {
    throw new Error("Service Account string is empty or undefined");
  }

  GOOGLESEARCH_SERVICE_ACCOUNT_JSON = JSON.parse(serviceAccountStr);
  console.log(`[INIT_SECRETS] GOOGLESEARCH_SERVICE_ACCOUNT: ✅ JSON パース成功`);

  // 必須フィールド確認
  if (!GOOGLESEARCH_SERVICE_ACCOUNT_JSON.client_email) {
    throw new Error("Service Account JSON に client_email がありません");
  }
  if (!GOOGLESEARCH_SERVICE_ACCOUNT_JSON.private_key) {
    throw new Error("Service Account JSON に private_key がありません");
  }
  if (!GOOGLESEARCH_SERVICE_ACCOUNT_JSON.project_id) {
    throw new Error("Service Account JSON に project_id がありません");
  }

  console.log(`[DEBUG] client_email: ${GOOGLESEARCH_SERVICE_ACCOUNT_JSON.client_email}`);
  console.log(`[DEBUG] project_id: ${GOOGLESEARCH_SERVICE_ACCOUNT_JSON.project_id}`);
  console.log(`[DEBUG] private_key 長: ${GOOGLESEARCH_SERVICE_ACCOUNT_JSON.private_key.length} 文字`);
  console.log(`[DEBUG] ✅ Service Account JSON は有効です`);
} catch (e) {
  console.error(`[FATAL] ❌ GOOGLESEARCH_SERVICE_ACCOUNT のパース失敗: ${e.message}`);
  console.error(`[FATAL] 確認項目:`);
  console.error(`[FATAL] 1. GitHub Secrets に GOOGLESEARCH_SERVICE_ACCOUNT が登録されているか`);
  console.error(`[FATAL] 2. JSON が正しい形式か（またはBase64エンコード）`);
  console.error(`[FATAL] 3. client_email, private_key, project_id が含まれているか`);
  console.error(`[DEBUG] スタックトレース: ${e.stack}`);
  process.exit(1);
}

console.log(`[INIT] ✅ 全ての環境変数が正常に読み込まれました\n`);

// ========== JWT 生成関数 ==========
function generateGoogleJWT() {
  if (!GOOGLESEARCH_SERVICE_ACCOUNT_JSON) {
    throw new Error("Service Account JSON not loaded");
  }

  const header = {
    alg: "RS256",
    typ: "JWT"
  };

  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: GOOGLESEARCH_SERVICE_ACCOUNT_JSON.client_email,
    scope: "https://www.googleapis.com/auth/cse",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now
  };

  const headerEncoded = Buffer.from(JSON.stringify(header)).toString('base64url');
  const payloadEncoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signatureInput = `${headerEncoded}.${payloadEncoded}`;

  const signer = createSign('RSA-SHA256');
  signer.update(signatureInput);
  const signatureEncoded = signer.sign(GOOGLESEARCH_SERVICE_ACCOUNT_JSON.private_key, 'base64url');

  return `${signatureInput}.${signatureEncoded}`;
}

// ========== Google OAuth Token 取得 ==========
async function getGoogleAccessToken() {
  try {
    const jwt = generateGoogleJWT();
    console.log(`[AUTH] JWT 生成成功。OAuth token を要求中...`);

    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`
    });

    console.log(`[AUTH] OAuth レスポンス: ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[AUTH] ❌ OAuth token 取得失敗: HTTP ${response.status}`);
      console.error(`[AUTH] エラー詳細: ${errorText.substring(0, 500)}`);

      if (response.status === 400) {
        console.error(`[AUTH] 【400 Bad Request】`);
        console.error(`[AUTH] - Service Account JSON の client_email が無効`);
        console.error(`[AUTH] - private_key が破損している`);
        console.error(`[AUTH] - JWT 生成に失敗している`);
      }

      return null;
    }

    const data = await response.json();
    if (!data.access_token) {
      console.error(`[AUTH] ❌ access_token がレスポンスに含まれていません`);
      console.error(`[AUTH] レスポンス: ${JSON.stringify(data).substring(0, 200)}`);
      return null;
    }

    console.log(`[AUTH] ✅ OAuth token 取得成功`);
    return data.access_token;

  } catch (error) {
    console.error(`[AUTH] ❌ OAuth token 取得例外: ${error.message}`);
    console.error(`[AUTH] スタックトレース: ${error.stack}`);
    return null;
  }
}

// ========== リトライ機能付き fetch ==========
async function fetchWithRetry(url, options, maxRetries = 5) {
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

// ========== Google Custom Search API で検索（最優先） ==========
async function searchUrlsViaGoogleCustomSearch(facilityName, prefectureName) {
  console.log(`\n[SEARCH_API] ========== Google Custom Search API 実行 ==========`);
  console.log(`[SEARCH_API] 施設名: ${facilityName}`);
  console.log(`[SEARCH_API] 都道府県: ${prefectureName}`);

  try {
    // OAuth token 取得
    const accessToken = await getGoogleAccessToken();
    if (!accessToken) {
      console.error(`[SEARCH_API] ❌ OAuth token 取得失敗`);
      console.error(`[SEARCH_API] 【Google Cloud 課金確認】`);
      console.error(`[SEARCH_API] 以下を確認してください:`);
      console.error(`[SEARCH_API] 1. Google Cloud Console → Billing → 課金アカウントが有効か`);
      console.error(`[SEARCH_API] 2. プロジェクトに課金アカウントが紐付けられているか`);
      console.error(`[SEARCH_API] 3. APIs & Services → Enabled APIs に "Custom Search API" があるか`);
      return [];
    }

    const searchQuery = `${facilityName} ${prefectureName} 遺跡 公式`;
    console.log(`[SEARCH_API] 検索キーワード: "${searchQuery}"`);

    const params = new URLSearchParams({
      cx: GOOGLESEARCH_CX,
      q: searchQuery,
      num: 10
    });

    const response = await fetch(`${GOOGLE_SEARCH_ENDPOINT}?${params}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      },
      timeout: 10000
    });

    console.log(`[SEARCH_API] HTTP レスポンス: ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[SEARCH_API] 🔴 API エラー: HTTP ${response.status}`);

      // 403 Forbidden - 課金関連の問題
      if (response.status === 403) {
        console.error(`[SEARCH_API] 【403 Forbidden】課金が有効になっていない可能性があります`);
        console.error(`[SEARCH_API] 対応:`);
        console.error(`[SEARCH_API] 1. Google Cloud Console → Billing`);
        console.error(`[SEARCH_API] 2. 課金アカウントを作成・確認`);
        console.error(`[SEARCH_API] 3. プロジェクトに課金アカウントを紐付け`);
        console.error(`[SEARCH_API] 4. GitHub Actions を再実行`);
      }

      // 401 Unauthorized - 認証エラー
      if (response.status === 401) {
        console.error(`[SEARCH_API] 【401 Unauthorized】Service Account 認証失敗`);
        console.error(`[SEARCH_API] Service Account JSON が正しいか確認してください`);
      }

      console.error(`[SEARCH_API] レスポンス詳細: ${errorText.substring(0, 300)}`);
      return [];
    }

    const data = await response.json();

    if (!data.items || data.items.length === 0) {
      console.warn(`[SEARCH_API] ⚠️ 検索結果が見つかりません（クエリが無効の可能性）`);
      return [];
    }

    console.log(`[SEARCH_API] ✅ ${data.items.length} 件の結果を取得`);

    // 優先度付きでソート
    const priorityDomains = [
      { domain: '.lg.jp', priority: 3, label: '🏛️ 自治体公式' },
      { domain: '.go.jp', priority: 3, label: '🏢 政府機関' },
      { domain: '.or.jp', priority: 2, label: '📋 公開サイト' }
    ];

    const sortedItems = data.items
      .filter(item => item.link && item.link.startsWith('http'))
      .map(item => {
        let priority = 1;
        let label = '📌 その他';
        for (const pd of priorityDomains) {
          if (item.link.includes(pd.domain)) {
            priority = pd.priority;
            label = pd.label;
            break;
          }
        }
        return { ...item, priority, label };
      })
      .sort((a, b) => b.priority - a.priority);

    const urls = [];
    console.log(`[SEARCH_API] 結果（優先度順）:`);
    sortedItems.forEach((item, index) => {
      urls.push(item.link);
      console.log(`[SEARCH_API] ${index + 1}. ${item.label} ${item.title.substring(0, 40)}`);
      console.log(`[SEARCH_API]    ${item.link}`);
    });

    console.log(`[SEARCH_API] ✅ ${urls.length} 件の URL を取得`);
    return urls;

  } catch (error) {
    console.error(`[SEARCH_API] ❌ エラー: ${error.message}`);
    console.error(`[SEARCH_API] スタックトレース: ${error.stack}`);
    return [];
  }
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

    console.warn(`[FETCH_FAIL] ${url} → HTTP ${res.status}`);
    return { success: false, content: '', statusCode: res.status };

  } catch (e) {
    console.warn(`[FETCH_ERROR] ${url} → ${e.message}`);
    return { success: false, content: '', statusCode: 0 };
  }
}

// ========== URL 内容検証 ==========
async function validateUrlWithContent(url, facilityName, address) {
  if (!url || !url.startsWith('http')) {
    return { valid: false, score: 0 };
  }

  const pageResult = await fetchPageContent(url);
  if (!pageResult.success) {
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
    return { valid: false, score: 0 };
  }

  // キーワード検証
  const keywords = ['縄文', '遺跡', '史跡', '考古', '土器', '貝塚'];
  const foundKeywords = keywords.filter(kw => text.includes(kw));

  if (foundKeywords.length === 0) {
    return { valid: false, score: 0 };
  }

  // テキスト長チェック
  if (text.length < 300) {
    return { valid: false, score: 0 };
  }

  // 施設名判定（柔軟）
  const facilityNameLower = facilityName.toLowerCase();
  let nameFound = text.includes(facilityNameLower);

  if (!nameFound) {
    const mainPart = facilityName.split(/[遺跡史跡博物館]/)[0].trim();
    nameFound = mainPart.length > 2 && text.includes(mainPart.toLowerCase());
  }

  if (!nameFound && !foundKeywords.some(kw => text.includes(kw))) {
    return { valid: false, score: 0 };
  }

  let score = foundKeywords.length * 10 + (text.length / 100);
  console.log(`[VALIDATED] ✅ ${url} (スコア: ${Math.floor(score)})`);
  return { valid: true, score: score };
}

// ========== 404 対応 + Google 検索で代替 URL ==========
async function searchAndFixUrlViaGoogle(url, facilityName, prefectureName) {
  console.log(`[URL_CHECK] ${url} を検証中...`);

  const pageResult = await fetchPageContent(url);

  if (!pageResult.success || pageResult.statusCode === 404) {
    console.warn(`[URL_DEAD] ❌ URL が無効: ${url}`);

    // Google 検索で代替 URL を発見
    console.log(`[URL_FIX] Google 検索で代替 URL を探索中...`);
    const searchUrls = await searchUrlsViaGoogleCustomSearch(facilityName, prefectureName);

    if (searchUrls.length > 0) {
      for (const candidateUrl of searchUrls) {
        if (candidateUrl === url) continue;

        const candidateResult = await fetchPageContent(candidateUrl);
        if (candidateResult.success && candidateResult.statusCode !== 404) {
          console.log(`[URL_FIX_SUCCESS] ✅ 代替 URL 発見: ${candidateUrl}`);
          return { valid: true, url: candidateUrl, fixed: true };
        }
      }
    }

    return { valid: false, url: '', fixed: false };
  }

  return { valid: true, url: url, fixed: false };
}

// ========== kunishitei フォールバック ==========
async function findUrlViaKunishitei(facilityName, address) {
  console.log(`[FALLBACK] kunishitei.bunka.go.jp で検索: ${facilityName}`);

  const fallbackPrompt = `
あなたは国指定史跡データベース（kunishitei.bunka.go.jp）の専門家です。
施設「${facilityName}」に関するページのURLを kunishitei.bunka.go.jp 内で探してください。

以下のいずれかを返す：
1. 見つかった場合: {"found": true, "url": "https://kunishitei.bunka.go.jp/..."}
2. 見つからない場合: {"found": false}

ハルシネーション厳禁。kunishitei.bunka.go.jp ドメインのURLのみ。
`;

  try {
    const fallbackResponse = await callGeminiAPI(fallbackPrompt);
    const jsonStart = fallbackResponse.indexOf('{');
    const jsonEnd = fallbackResponse.lastIndexOf('}');

    if (jsonStart === -1 || jsonEnd === -1) {
      return { valid: false, url: '' };
    }

    const result = JSON.parse(fallbackResponse.substring(jsonStart, jsonEnd + 1));

    if (result.found && result.url) {
      const validation = await validateUrlWithContent(result.url, facilityName, address);
      if (validation.valid) {
        console.log(`[FALLBACK] ✅ ${result.url}`);
        return { valid: true, url: result.url };
      }
    }

    return { valid: false, url: '' };

  } catch (error) {
    console.warn(`[FALLBACK] エラー: ${error.message}`);
    return { valid: false, url: '' };
  }
}

// ========== URL 検証フロー（優先度順） ==========
async function validateCandidateUrls(candidateUrls, facilityName, address, prefecture) {
  console.log(`[PRIORITY] ========== 優先度フロー開始 ==========`);

  // フェーズ1: Google Custom Search API（最優先）
  console.log(`[PRIORITY] フェーズ1: Google Custom Search API を実行`);
  const googleSearchUrls = await searchUrlsViaGoogleCustomSearch(facilityName, prefecture);

  if (googleSearchUrls.length > 0) {
    console.log(`[PRIORITY] Google Search で ${googleSearchUrls.length} 件取得。検証中...`);
    for (const url of googleSearchUrls) {
      const result = await validateUrlWithContent(url, facilityName, address);
      if (result.valid) {
        console.log(`[BEST_URL] ✅ Google Search から採用: ${url}`);
        return { valid: true, url: url, source: 'Google Search' };
      }
    }
    console.warn(`[PRIORITY] Google Search 結果は全て検証失敗。フェーズ2に進みます`);
  } else {
    console.warn(`[PRIORITY] ⚠️ Google Search API がURL を返しません`);
    console.warn(`[PRIORITY] → 課金が有効か、Service Account が正しいか確認してください`);
    console.warn(`[PRIORITY] → Gemini 候補をより積極的に検証します`);
  }

  // フェーズ2: Gemini 候補 URL（Google Search 失敗時は積極的に検証）
  console.log(`[PRIORITY] フェーズ2: Gemini 候補 URL を詳細検証`);

  if (candidateUrls.length === 0) {
    console.warn(`[PRIORITY] ⚠️ Gemini から URL 候補がありません`);
  } else {
    console.log(`[PRIORITY] ${candidateUrls.length} 個の Gemini 候補を検証します`);
  }

  for (const url of candidateUrls) {
    if (!url || url.trim() === '') continue;

    console.log(`[PRIORITY] Gemini 候補を検証: ${url}`);

    // 404 対応（代替 URL を探す）
    const fixResult = await searchAndFixUrlViaGoogle(url, facilityName, prefecture);

    if (fixResult.valid) {
      const result = await validateUrlWithContent(fixResult.url, facilityName, address);
      if (result.valid) {
        console.log(`[BEST_URL] ✅ Gemini 候補から採用: ${fixResult.url}`);
        if (fixResult.fixed) {
          console.log(`[NOTE] Gemini の元の URL が無効だったため、Google 検索で代替 URL に置換`);
        }
        return { valid: true, url: fixResult.url, fixed: fixResult.fixed, source: 'Gemini' };
      } else {
        console.warn(`[PRIORITY] 検証失敗。内容チェックに引っかかった: ${fixResult.url}`);
      }
    } else {
      console.warn(`[PRIORITY] 検証失敗。404 かアクセス不可: ${url}`);
    }
  }

  console.warn(`[PRIORITY] ⚠️ Gemini 候補はすべて検証失敗`);

  // フェーズ3: kunishitei フォールバック（本当の最終手段）
  console.log(`[PRIORITY] フェーズ3: kunishitei.bunka.go.jp フォールバック（最終手段）`);
  const fallbackResult = await findUrlViaKunishitei(facilityName, address);
  if (fallbackResult.valid) {
    console.log(`[BEST_URL] ✅ kunishitei から採用: ${fallbackResult.url}`);
    console.log(`[WARNING] Google Search が失敗したため kunishitei にフォールバック`);
    return { valid: true, url: fallbackResult.url, source: 'kunishitei' };
  }

  console.error(`[FINAL_FAILURE] ❌ 全ての検索方法で有効な URL が見つかりません`);
  console.error(`[FINAL_FAILURE] 対応:`);
  console.error(`[FINAL_FAILURE] 1. Google Cloud の課金が有効か確認`);
  console.error(`[FINAL_FAILURE] 2. Service Account が正しいか確認`);
  console.error(`[FINAL_FAILURE] 3. Gemini プロンプトを修正（より詳しい URL 候補を提案させる）`);

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

【重要：実際に存在し、アクセス可能なURLのみを返してください】

【URLについて - 優先順位付き】
【優先度1】施設専用ドメイン: sannaimaruyama.pref.aomori.jp, jomon-no-mori.jp など
【優先度2】自治体公式サイト: city.chino.lg.jp/site/togariishi/ など
【優先度3】公式な文化財・遺跡情報サイト: kunishitei.bunka.go.jp など

【絶対禁止】
- Wikipedia, SNS（X/Twitter等）
- 404/5xxエラーが返されるURL
- ハルシネーション（存在しないURL）

【出力要件】
完全なJSON配列のみを出力：
[{
  "id": "英数字のハイフン繋ぎ",
  "name": "施設の正式名称",
  "region": "Hokkaido / Tohoku / Kanto / Chubu / Kinki / Chugoku / Shikoku / Kyushu",
  "prefecture": "都道府県名",
  "address": "住所",
  "description": "200〜400文字の紹介文",
  "url": "Google検索で1位に出そうなURL",
  "candidates": ["Google検索1位想定", "Google検索2位想定", "Google検索3位想定"],
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

      console.log(`[PROCESS] ${candidate.name} - URL 検証開始`);
      const candidateUrls = candidate.candidates || (candidate.url ? [candidate.url] : []);

      const urlValidation = await validateCandidateUrls(
        candidateUrls,
        candidate.name,
        candidate.address,
        candidate.prefecture
      );

      if (!urlValidation.valid) {
        console.warn(`[URL_FAILED] ${candidate.name} - 検証失敗`);
        continue;
      }

      candidate.url = urlValidation.url;
      delete candidate.candidates;

      console.log(`[URL_CONFIRMED] ✅ ${candidate.name} → ${candidate.url}`);

      if (!candidate.access || !candidate.access.train || !candidate.access.bus || !candidate.access.car) {
        console.warn(`[ACCESS_INCOMPLETE] ${candidate.name}`);
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
    console.log(`[RESULT] ✅ ${addedCount} 件追加、合計 ${existingData.length} 件`);

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
