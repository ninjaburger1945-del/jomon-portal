const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

/**
 * Jomon Portal クローラー v5.2 (Gemini シンプル版)
 *
 * 設計思想:
 * - Gemini に施設名から推測できる最もシンプルな自治体URL（/rekishiru）を最優先で提案させる
 * - 自治体公式サイト（.lg.jp）はキーワードチェック免除（信頼度が高い）
 * - Google Custom Search API は環境変数があれば利用
 * - それらを検証して、最高スコアのものを採用
 *
 * 環境変数（GitHub Secrets）:
 * - GEMINI_API_KEY20261336: Gemini API Key（必須）
 * - GOOGLE_SEARCH_API_KEY: Google Custom Search API Key（オプション）
 * - GOOGLE_SEARCH_ENGINE_ID: Google Custom Search Engine ID（オプション）
 */

// Gemini API
const API_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent";
const API_KEY = process.env.GEMINI_API_KEY20261336;

// OpenAI API (DALL-E 3用)
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_API_ENDPOINT = "https://api.openai.com/v1/images/generations";

// Google Custom Search API（オプション）
const GOOGLE_SEARCH_API_KEY = process.env.GOOGLE_SEARCH_API_KEY || process.env.GOOGLE_CUSTOM_SEARCH_API_KEY;
const GOOGLE_SEARCH_ENGINE_ID = process.env.GOOGLE_SEARCH_ENGINE_ID || process.env.GOOGLE_CUSTOM_SEARCH_ENGINE_ID;

// ========== 初期化 ==========
console.log(`\n[INIT] ========== Jomon Portal Crawler v5.4 (DALL-E 3) ==========`);
console.log(`[INIT] GEMINI_API_KEY20261336: ${API_KEY ? '✅ 存在' : '❌ 未設定'}`);
console.log(`[INIT] OPENAI_API_KEY: ${OPENAI_API_KEY ? '✅ 存在' : '⚠️ 未設定'}`);

if (!API_KEY) {
  console.error("[FATAL] ❌ GEMINI_API_KEY20261336 が設定されていません");
  process.exit(1);
}

const useGoogleSearch = GOOGLE_SEARCH_API_KEY && GOOGLE_SEARCH_ENGINE_ID;
console.log(`[INIT] Google Custom Search API: ${useGoogleSearch ? '✅ 有効' : '⚠️ 無効'}`);
console.log(`[INIT] 画像生成: ${OPENAI_API_KEY ? '✅ DALL-E 3 (OpenAI)' : '❌ DALL-E 3 未設定'}`);

if (!OPENAI_API_KEY) {
  console.warn("[INIT] ⚠️ OPENAI_API_KEY が未設定のため、画像生成はスキップされます");
}

console.log(`[INIT] ✅ 初期化完了\n`);

// ========== JSON 抽出・クリーニング関数 v2 ==========
function cleanAndExtractJson(responseText, isArray = true) {
  console.log(`[JSON_CLEAN] 開始（配列: ${isArray}）`);

  // Step 1: Markdownデコレーション完全除去
  let cleaned = responseText
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/gi, '')
    .trim();

  // Step 2: [ または { まで前の部分を削除
  if (isArray) {
    const startIdx = cleaned.indexOf('[');
    if (startIdx !== -1) {
      cleaned = cleaned.substring(startIdx);
    }
  } else {
    const startIdx = cleaned.indexOf('{');
    if (startIdx !== -1) {
      cleaned = cleaned.substring(startIdx);
    }
  }

  // Step 3: 末尾から逆向きに ] または } を探す
  if (isArray) {
    const endIdx = cleaned.lastIndexOf(']');
    if (endIdx !== -1) {
      cleaned = cleaned.substring(0, endIdx + 1);
    }
  } else {
    const endIdx = cleaned.lastIndexOf('}');
    if (endIdx !== -1) {
      cleaned = cleaned.substring(0, endIdx + 1);
    }
  }

  console.log(`[JSON_CLEAN] 抽出結果（先頭100文字）: ${cleaned.substring(0, 100).replace(/\n/g, '\\n')}`);
  console.log(`[JSON_CLEAN] 抽出結果（末尾100文字）: ${cleaned.substring(Math.max(0, cleaned.length - 100)).replace(/\n/g, '\\n')}`);
  console.log(`[JSON_CLEAN] 全体長: ${cleaned.length}文字`);

  return cleaned;
}

// ========== JSON 修復ロジック v4 ==========
function repairJsonSyntax(jsonStr) {
  console.log(`[JSON_REPAIR] 構文修復開始`);

  let repaired = jsonStr.trim();

  // Step 0: 不正な *** を削除
  repaired = repaired.replace(/\*\*\*/g, '');

  // Step 1: 不正な制御文字を削除（改行は許可）
  repaired = repaired.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');

  // Step 2: 末尾のカンマを除去（ネストされた構造対応）
  repaired = repaired.replace(/,(\s*[\]}])/g, '$1');

  // Step 3: キー名のシングルクォートをダブルクォートに変換
  repaired = repaired.replace(/'([^']*)'(\s*:)/g, '"$1"$2');

  // Step 4: 値のシングルクォートをダブルクォートに変換
  repaired = repaired.replace(/:\s*'([^']*)'([,\}\]])/g, ': "$1"$2');

  // Step 5: 複数行文字列を1行に統一
  repaired = repaired.replace(/"([^"]*)[\n\r]+([^"]*)"/g, (match, part1, part2) => {
    const combined = (part1 + ' ' + part2).replace(/[\n\r]+/g, ' ').trim();
    return `"${combined}"`;
  });

  // Step 6: 配列内の不正な改行を削除
  repaired = repaired.replace(/\[\s*[\n\r]+/g, '[');
  repaired = repaired.replace(/[\n\r]+\s*\]/g, ']');
  repaired = repaired.replace(/,\s*[\n\r]+/g, ',');

  // Step 7: 連続するクォートを修正
  repaired = repaired.replace(/""(\s*[:,\]}])/g, '$1');

  // Step 8: 不正な括弧組み合わせ修正（{[ など）
  repaired = repaired.replace(/\{(\s*\[)/g, '[');
  repaired = repaired.replace(/(\])\s*\}/g, ']');

  // Step 9: キーなし値（"value" だけ）をスキップ
  repaired = repaired.replace(/,\s*"[^"]*"\s*([,\]}])/g, '$1');

  console.log(`[JSON_REPAIR] 修復完了`);
  return repaired;
}

// ========== JSON パース（自動修復 + リトライ対応） v2 ==========
async function parseJsonWithFallback(responseText, facilityName = '', isArray = true, retryCount = 0) {
  if (retryCount > 1) {
    console.error(`[JSON_PARSE] リトライ上限に到達`);
    return null;
  }

  // Step 1: クリーニング
  let cleaned = cleanAndExtractJson(responseText, isArray);

  // Step 2: 直接パース試行
  try {
    const result = JSON.parse(cleaned);
    console.log(`[JSON_PARSE] ✅ パース成功（リトライ: ${retryCount}回目）`);
    return result;
  } catch (parseError) {
    const errorPos = parseError.message.match(/position (\d+)/);
    const errorPosition = errorPos ? parseInt(errorPos[1]) : -1;

    console.warn(`[JSON_PARSE] ❌ パース失敗: ${parseError.message}`);
    if (errorPosition !== -1) {
      const start = Math.max(0, errorPosition - 100);
      const end = Math.min(cleaned.length, errorPosition + 100);
      console.warn(`[JSON_PARSE] エラー位置 ${errorPosition} 付近：`);
      console.warn(`  ...${cleaned.substring(start, end)}...`);
    }

    // Step 3: 修復ロジック試行
    if (retryCount === 0) {
      console.log(`[JSON_PARSE] 修復ロジックを試行...`);
      try {
        const repaired = repairJsonSyntax(cleaned);
        const result = JSON.parse(repaired);
        console.log(`[JSON_PARSE] ✅ 修復後のパース成功`);
        return result;
      } catch (repairError) {
        const repairErrorPos = repairError.message.match(/position (\d+)/);
        console.warn(`[JSON_PARSE] 修復でもパース失敗: ${repairError.message}`);
        if (repairErrorPos) {
          console.warn(`[JSON_PARSE] 修復後も position ${repairErrorPos[1]} で失敗`);
        }
      }
    }

    // Step 4: Gemini 再送（修復に失敗した場合のみ）
    if (retryCount === 0 && facilityName) {
      console.log(`[JSON_PARSE] ⚠️ 修復失敗。Gemini に正しい形式での再送を要求（${retryCount + 1}回目）...`);

      const retryPrompt = `
前のレスポンスが無効な形式でした。以下を厳密に守ってください：

${isArray ?
`1. JSON配列のみを返す（説明や前置きは一切不要）
2. 各オブジェクトの "description" フィールドは最大100文字で、改行（\\n）を含めない
3. 以下の形式で返す：
[{"key": "value"}, ...]` :
`1. JSON オブジェクトのみを返す（説明や前置きは一切不要）
2. "description" フィールドは最大100文字で、改行（\\n）を含めない
3. 以下の形式で返す：
{...}`}
`;

      try {
        const retryResponse = await callGeminiAPI(retryPrompt);
        return await parseJsonWithFallback(retryResponse, facilityName, isArray, retryCount + 1);
      } catch (retryError) {
        console.error(`[JSON_PARSE] Gemini 再送失敗: ${retryError.message}`);
        return null;
      }
    }

    return null;
  }
}

// ========== リトライ機能付き fetch v2 ==========
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

        // 503 は長めの待機を推奨
        if (response.status === 503) {
          console.warn(`[TEMPORARY] HTTP 503 (Service Unavailable) - Gemini が一時的にダウン中`);
          throw new Error(`[TEMPORARY] HTTP 503`);
        }

        if ([429, 500].includes(response.status)) {
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
        // 503 の場合は長めに待機（30秒 * attempt）
        const is503 = error.message.includes('503');
        const delayMs = is503 ? 30000 * attempt : 2000 * Math.pow(2, attempt - 1);
        console.log(`[RETRY] ${delayMs}ms 待機後にリトライ...`);
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

// ========== Google Custom Search API 検索（オプション） ==========
async function searchWithGoogleAPI(facilityName, address) {
  if (!useGoogleSearch) {
    return [];
  }

  try {
    console.log(`[GOOGLE_SEARCH] "${facilityName}" で検索中...`);

    const query = `${facilityName} 縄文 遺跡`;
    const response = await fetch(
      `https://www.googleapis.com/customsearch/v1?q=${encodeURIComponent(query)}&key=${GOOGLE_SEARCH_API_KEY}&cx=${GOOGLE_SEARCH_ENGINE_ID}&num=10`,
      { timeout: 10000 }
    );

    if (!response.ok) {
      console.warn(`[GOOGLE_SEARCH] HTTP ${response.status}`);
      return [];
    }

    const data = await response.json();
    const urls = (data.items || []).map(item => item.link).slice(0, 5);

    console.log(`[GOOGLE_SEARCH] ✅ ${urls.length}個のURL取得`);
    return urls;
  } catch (error) {
    console.warn(`[GOOGLE_SEARCH] エラー: ${error.message}`);
    return [];
  }
}

// ========== HTMLからタイトルを抽出 ==========
function extractPageTitle(html) {
  const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/i);
  if (titleMatch && titleMatch[1]) {
    return titleMatch[1]
      .replace(/<[^>]+>/g, '')
      .trim()
      .toLowerCase();
  }
  return '';
}

// ========== HTMLから見出し（h1-h2）を抽出 ==========
function extractHeadings(html) {
  const headings = [];
  const h1Matches = html.match(/<h1[^>]*>(.*?)<\/h1>/gi);
  const h2Matches = html.match(/<h2[^>]*>(.*?)<\/h2>/gi);

  if (h1Matches) {
    h1Matches.forEach(match => {
      const text = match
        .replace(/<[^>]+>/g, '')
        .trim()
        .toLowerCase();
      if (text) headings.push(text);
    });
  }

  if (h2Matches) {
    h2Matches.forEach(match => {
      const text = match
        .replace(/<[^>]+>/g, '')
        .trim()
        .toLowerCase();
      if (text) headings.push(text);
    });
  }

  return headings;
}

// ========== HTML から画像数をカウント ==========
function countImages(html) {
  const imgMatches = html.match(/<img[^>]*>/gi);
  return imgMatches ? imgMatches.length : 0;
}

// ========== 施設名から愛称を抽出 ==========
function extractNickname(facilityName) {
  // 例：「なじょもん」「レキシルとくしま」などの愛称を抽出
  // パターン：「正式名称（愛称：愛称名）」または「正式名称〜愛称」
  const nickMatch = facilityName.match(/[（(](?:愛称|昵称)？[:：]?([^）)]+)[）)]/);
  if (nickMatch && nickMatch[1]) {
    return nickMatch[1].trim();
  }

  // 括弧内のテキストが愛称の可能性
  const bracketMatch = facilityName.match(/[（(]([^）)]+)[）)]/);
  if (bracketMatch && bracketMatch[1]) {
    const bracketed = bracketMatch[1].trim();
    // 「県」「市」などを含まない短い文字列は愛称の可能性が高い
    if (!bracketed.includes('県') && !bracketed.includes('市') && bracketed.length <= 15) {
      return bracketed;
    }
  }

  return null;
}

// ========== URL スコアリング（ドメイン解析）v5.3 - 愛称優先版 ==========
function scoreUrlByDomain(url, facilityName, address, boostWikipedia = false) {
  try {
    const urlObj = new URL(url);
    const domain = urlObj.hostname.toLowerCase();
    const facilityNameLower = facilityName.toLowerCase();

    let domainScore = 0;
    let scoreReason = '';

    // 【v5.3】愛称を含む独自ドメイン → 110点（最優先）
    const nickname = extractNickname(facilityName);
    if (nickname) {
      const nicknameFormatted = nickname.toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '');

      if (domain.includes(nicknameFormatted)) {
        domainScore = 110;
        scoreReason = `愛称ドメイン「${nickname}」`;
      }
    }

    // 【100点】施設名が含まれる独自ドメイン
    if (domainScore === 0 && domain.includes(facilityNameLower)) {
      domainScore = 100;
      scoreReason = '施設名を含む独自ドメイン';
    }
    // 【100点】.lg.jp（自治体公式）
    if (domainScore === 0 && domain.includes('.lg.jp')) {
      domainScore = 100;
      scoreReason = '.lg.jp（自治体公式）';
    }
    // 【80点】.or.jp（公開サイト・振興会等）
    if (domainScore === 0 && domain.includes('.or.jp')) {
      domainScore = 80;
      scoreReason = '.or.jp（公開サイト）';
    }
    // 【80点 / 90点（優遇時）】Wikipedia
    if (domainScore === 0 && domain.includes('ja.wikipedia.org')) {
      domainScore = boostWikipedia ? 90 : 80;
      scoreReason = `ja.wikipedia.org${boostWikipedia ? '（自治体全滅時・優遇）' : ''}`;
    }
    // 【30点】kunishitei.bunka.go.jp（文化庁DB）
    if (domainScore === 0 && domain.includes('kunishitei.bunka.go.jp')) {
      domainScore = 30;
      scoreReason = 'kunishitei.bunka.go.jp（文化庁DB）';
    }
    // 【その他】
    if (domainScore === 0) {
      domainScore = 10;
      scoreReason = 'その他のドメイン';
    }

    console.log(`[DOMAIN_SCORE] ${scoreReason} → ${domainScore}点`);
    return domainScore;
  } catch (e) {
    console.warn(`[DOMAIN_SCORE] URL 解析失敗: ${e.message}`);
    return 0;
  }
}

// ========== URL 内容検証 v5.1 - キーワード厳格化版+Wikipedia優遇 ==========
async function validateUrlWithContent(url, facilityName, address, boostWikipedia = false) {
  if (!url || !url.startsWith('http')) {
    return { valid: false, score: 0, domainScore: 0 };
  }

  console.log(`[VALIDATE] ${url} を検証中...${boostWikipedia ? ' (Wikipedia優遇モード)' : ''}`);

  const pageResult = await fetchPageContent(url);
  if (!pageResult.success) {
    console.warn(`[VALIDATE] ❌ ページ取得失敗: HTTP ${pageResult.statusCode}`);
    return { valid: false, score: 0, domainScore: 0 };
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
    return { valid: false, score: 0, domainScore: 0 };
  }

  // ドメインスコア取得（Wikipedia優遇フラグ付き）
  const domainScore = scoreUrlByDomain(url, facilityName, address, boostWikipedia);

  // 【v5.2 新ルール1】縄文キーワード検知（自治体.lg.jp は免除）
  const urlObj = new URL(url);
  const domain = urlObj.hostname.toLowerCase();
  const isLgJp = domain.includes('.lg.jp');

  if (!isLgJp) {
    // 自治体以外はキーワードチェック必須
    const jomonKeywords = ['縄文', '縄紋', 'じょうもん', 'jomon'];
    const relatedKeywords = ['貝塚', '土器', '草創期', '晩期', '定住化'];
    const allJomonKeywords = [...jomonKeywords, ...relatedKeywords];

    const hasJomonKeyword = allJomonKeywords.some(kw => text.includes(kw.toLowerCase()));

    if (!hasJomonKeyword) {
      console.warn(`[VALIDATE] ❌ 縄文関連キーワード未検出（${domain}） → 破棄`);
      return { valid: false, score: 0, domainScore };
    }
    console.log(`[VALIDATE] ✅ 縄文キーワード確認`);
  } else {
    // 自治体公式サイト（.lg.jp）はキーワードチェック免除
    console.log(`[VALIDATE] ✅ 自治体公式サイト（.lg.jp）→ キーワード検判定免除`);
  }

  // 【v5.0 新ルール2】NGキーワードによる即時除外
  // NGワード: 弥生時代, 古墳時代, 戦国, 江戸, お城
  // 縄文の文字がない場合のみ除外
  const ngKeywords = ['弥生時代', '古墳時代', '戦国', '江戸', 'お城'];
  const hasJomonText = jomonKeywords.some(kw => text.includes(kw.toLowerCase()));

  if (!hasJomonText) {
    // 縄文の文字がない場合、NGキーワードをチェック
    const hasNgKeyword = ngKeywords.some(kw => text.includes(kw.toLowerCase()));
    if (hasNgKeyword) {
      console.warn(`[VALIDATE] ❌ NGキーワード検出（縄文なし） → 破棄`);
      return { valid: false, score: 0, domainScore };
    }
  } else {
    // 縄文の文字がある場合はOK（「縄文から古墳まで」のような表記も許可）
    console.log(`[VALIDATE] ✅ 縄文が主体 → NGキーワードチェック不要`);
  }

  // 【v5.3】画像数をカウント
  const imageCount = countImages(html);
  console.log(`[VALIDATE] 画像数: ${imageCount}枚`);

  // 【v5.3】文字数と画像の判定：テキスト200文字以下で画像0枚は「ゴミ」
  if (text.length <= 200 && imageCount === 0) {
    console.warn(`[VALIDATE] ❌ コンテンツが貧弱（テキスト${text.length}文字、画像0枚） → 破棄`);
    return { valid: false, score: 0, domainScore };
  }

  // テキスト長チェック（通常：300文字以上）
  if (text.length < 300) {
    console.warn(`[VALIDATE] ⚠️ コンテンツが短い（${text.length}文字、画像${imageCount}枚）`);
    // 画像が2枚以上あれば許容
    if (imageCount < 2) {
      console.warn(`[VALIDATE] ❌ テキスト短 + 画像不足 → 破棄`);
      return { valid: false, score: 0, domainScore };
    }
  }

  // 【v5.3 新ルール】文化庁DB（kunishitei）の厳格化
  const isKunishitei = domain.includes('kunishitei.bunka.go.jp');

  if (isKunishitei) {
    // 文化庁DB は施設名とタイトルの100%一致 + 画像1枚以上が必須
    const kunPageTitle = extractPageTitle(html);
    const kunFacilityNameLower = facilityName.toLowerCase();
    const kunTitleContainsName = kunPageTitle.includes(kunFacilityNameLower);

    if (!kunTitleContainsName || imageCount === 0) {
      console.warn(`[VALIDATE] ❌ 文化庁DB: タイトル一致=${kunTitleContainsName}, 画像=${imageCount}枚 → 採用禁止`);
      return { valid: false, score: 0, domainScore };
    }
    console.log(`[VALIDATE] ✅ 文化庁DB: タイトル一致 ✓、画像 ${imageCount}枚 ✓ → 許可`);
  }

  // 【v5.0 新ルール3】施設名の厳格マッチング（title/h1-h2検査）
  const pageTitle = extractPageTitle(html);
  const headings = extractHeadings(html);
  const facilityNameLower = facilityName.toLowerCase();

  // スコアリング：title または h1/h2 に含まれるか
  let nameMatchScore = 0;
  let nameMatchLocation = '';

  if (pageTitle.includes(facilityNameLower)) {
    nameMatchScore = 100;
    nameMatchLocation = 'title';
  } else if (headings.some(h => h.includes(facilityNameLower))) {
    nameMatchScore = 80;
    nameMatchLocation = 'h1/h2';
  } else if (text.includes(facilityNameLower)) {
    nameMatchScore = 50;
    nameMatchLocation = '本文';
  } else {
    // 施設名全体が含まれていない場合、破棄
    console.warn(`[VALIDATE] ❌ 施設名「${facilityName}」が本文に1文字も含まれていない → 破棄`);
    return { valid: false, score: 0, domainScore };
  }

  console.log(`[VALIDATE] ✅ 施設名マッチング: ${nameMatchLocation}に確認 (スコア: ${nameMatchScore})`);

  // 30点以下のURLで施設名「完全一致」チェック
  if (domainScore <= 30 && nameMatchScore < 50) {
    console.warn(`[VALIDATE] ❌ ドメインスコア≤30点で施設名が本文外 → 破棄`);
    return { valid: false, score: 0, domainScore };
  }

  // スコア計算（コンテンツスコア）
  let contentScore = (hasJomonKeyword ? 10 : 0) + (text.length / 100) + nameMatchScore;

  // 総合スコア = ドメイン重視 + コンテンツスコア
  let totalScore = domainScore * 2 + contentScore;

  console.log(`[VALIDATE] ✅ 検証成功 (ドメイン: ${domainScore}, コンテンツ: ${Math.floor(contentScore)}, 名前マッチ: ${nameMatchScore}, 合計: ${Math.floor(totalScore)})`);
  return { valid: true, score: totalScore, domainScore, contentScore, nameMatchScore };
}

// ========== Gemini 再試行（404 回避） v5.1 ==========
async function retryGeminiForUrls(failedUrls, facilityName, retryCount = 0) {
  const maxRetries = failedUrls.length >= 5 ? 3 : 2;

  if (retryCount >= maxRetries) {
    console.warn(`[RETRY_GEMINI] ℹ️ リトライ上限（${maxRetries}回）に達しました`);
    return [];
  }

  console.log(`\n[RETRY_GEMINI] ========== Gemini 再試行（第${retryCount + 1}回）==========`);
  console.log(`[RETRY_GEMINI] 失敗した候補: ${failedUrls.join(', ')}`);

  // 5つ全滅時の特別なメッセージ
  const isFullFailure = failedUrls.length >= 5 && retryCount === 0;

  const retryPrompt = isFullFailure
    ? `
施設「${facilityName}」について、さっきのURL候補がすべてアクセスできませんでした。

もう一度だけ、『縄文』や『貝塚』という言葉が**確実に含まれている**公式サイトをあと3つ探してください。

【特に以下のパターンを優先推測】
- https://www.pref.{都道府県}.lg.jp/{施設名ローマ字}
- https://city.{市名}.lg.jp/{施設名ローマ字}
- https://www.pref.{都道府県}.lg.jp/{愛称ローマ字}

優先順位：
1. 自治体公式サイト（.lg.jp）下の施設名/愛称パターン
2. 文化庁データベース（kunishitei.bunka.go.jp）
3. 観光協会・Wikipedia など

**JSON配列のみを返してください（説明不要）：**
["url1", "url2", "url3"]
`
    : `
施設「${facilityName}」について、以下のURLはすべてアクセスできませんでした：
${failedUrls.map((u, i) => `${i + 1}. ${u}`).join('\n')}

別の公開情報源から、この施設に関する信頼度の高いURLを3つ提案してください。

【自治体.lg.jp パターン優先】
特に以下のパターンを試してください：
- https://www.pref.{都道府県}.lg.jp/{施設名ローマ字}
- https://city.{市名}.lg.jp/{施設名ローマ字}

優先順位：
1. 公開サイト（.lg.jp、.go.jp、.or.jp など）
2. 学術機関（大学、博物館公式サイト）
3. Wikipedia

**JSON配列のみを返してください（説明不要）：**
["url1", "url2", "url3"]
`;

  try {
    const response = await callGeminiAPI(retryPrompt);
    const urls = await parseJsonWithFallback(response, facilityName, true, 0);

    if (!urls || !Array.isArray(urls)) {
      console.warn(`[RETRY_GEMINI] JSON パース失敗`);
      return [];
    }

    console.log(`[RETRY_GEMINI] ✅ ${urls.length}個の新候補を取得: ${urls.join(', ')}`);
    return urls || [];
  } catch (error) {
    console.warn(`[RETRY_GEMINI] エラー: ${error.message}`);
    return [];
  }
}

// ========== kunishitei フォールバック（最終手段） ==========
async function findUrlViaKunishitei(facilityName, address) {
  console.log(`\n[FALLBACK] ========== kunishitei.bunka.go.jp 最終検索 ==========`);
  console.log(`[FALLBACK] Gemini の候補がすべて失敗。最後の手段として kunishitei を検索`);

  const fallbackPrompt = `
あなたは国指定史跡データベース（kunishitei.bunka.go.jp）の専門家です。
施設「${facilityName}」に関するページのURLを kunishitei.bunka.go.jp 内で探してください。

JSONオブジェクトのみを返してください（説明不要）：
見つかった場合: {"found": true, "url": "https://kunishitei.bunka.go.jp/..."}
見つからない場合: {"found": false}
`;

  try {
    const fallbackResponse = await callGeminiAPI(fallbackPrompt);
    const result = await parseJsonWithFallback(fallbackResponse, facilityName, false, 0);

    if (!result) {
      console.warn(`[FALLBACK] JSON パース失敗`);
      return { valid: false, url: '' };
    }

    if (result.found && result.url) {
      console.log(`[FALLBACK] kunishitei URL 候補: ${result.url}`);
      const validation = await validateUrlWithContent(result.url, facilityName, address, false);
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

// ========== URL 検証フロー（Gemini 候補 → リトライ → kunishitei） v5.1 ==========
async function validateCandidateUrls(candidateUrls, facilityName, address, prefecture) {
  console.log(`\n[VALIDATE_FLOW] ========== URL 検証開始（${candidateUrls.length} 候補） ==========`);
  console.log(`[VALIDATE_FLOW] 全ての候補を検証し、最高スコアを採用します`);

  // 【v5.3】愛称を最優先で抽出
  const nickname = extractNickname(facilityName);
  console.log(`[VALIDATE_FLOW] 施設名: ${facilityName}`);
  if (nickname) {
    console.log(`[VALIDATE_FLOW] 愛称を検出: ${nickname}`);
  }

  // ステップ0: 候補URLをドメインスコア順にソート（高スコアから試す）
  let allUrls = [...candidateUrls];

  // 【v5.3】愛称を含むURLを優先候補に追加
  if (nickname) {
    const nicknameUrls = [
      `https://${nickname.toLowerCase()}.jp/`,
      `https://www.${nickname.toLowerCase()}.jp/`,
      `https://${nickname.toLowerCase()}.com/`,
      `https://www.${nickname.toLowerCase()}.com/`
    ];
    console.log(`[VALIDATE_FLOW] 愛称関連URL候補を追加: ${nicknameUrls.join(', ')}`);
    allUrls = [...nicknameUrls, ...allUrls];
  }

  // Google Custom Search API が有効なら結果を追加
  if (useGoogleSearch) {
    const googleUrls = await searchWithGoogleAPI(facilityName, address);
    if (googleUrls.length > 0) {
      console.log(`[VALIDATE_FLOW] Google 検索結果を追加`);
      allUrls = [...allUrls, ...googleUrls];
    }
  }

  const scoredUrls = allUrls
    .filter(url => url && url.trim() !== '')
    .map(url => ({
      url: url.trim(),
      domainScore: scoreUrlByDomain(url, facilityName, address, false)
    }))
    .sort((a, b) => b.domainScore - a.domainScore);

  // 重複排除
  const uniqueUrls = [];
  const seen = new Set();
  for (const item of scoredUrls) {
    if (!seen.has(item.url.toLowerCase())) {
      seen.add(item.url.toLowerCase());
      uniqueUrls.push(item);
    }
  }

  console.log(`[VALIDATE_FLOW] ドメインスコア順にソート（重複排除後: ${uniqueUrls.length}個）:`);
  uniqueUrls.slice(0, 5).forEach(item => {
    console.log(`  - ${item.url} (${item.domainScore}点)`);
  });

  // フェーズ1: Gemini 初期候補を全て検証（404チェック + コンテンツ検証 + スコアリング）
  console.log(`[VALIDATE_FLOW] フェーズ1: ${scoredUrls.length} 個の候補を全検証`);

  const validResults = [];
  const failedUrls = [];

  for (let index = 0; index < uniqueUrls.length; index++) {
    const item = uniqueUrls[index];
    const url = item.url;

    console.log(`\n[VALIDATE_FLOW] [${index + 1}/${uniqueUrls.length}] ${url} (推定スコア: ${item.domainScore}点)`);

    // ページ取得 + 404チェック
    const pageResult = await fetchPageContent(url);

    if (!pageResult.success || pageResult.statusCode === 404) {
      console.warn(`[VALIDATE_FLOW] ❌ 404 またはアクセス不可`);
      failedUrls.push(url);
      continue;
    }

    // コンテンツ検証（スコア付き）- 最初のフェーズではWikipedia優遇なし
    const result = await validateUrlWithContent(url, facilityName, address, false);
    if (result.valid) {
      console.log(`[VALIDATE_FLOW] ✅ 有効 (スコア: ${Math.floor(result.score)})`);
      validResults.push({ url, score: result.score, domainScore: result.domainScore, contentScore: result.contentScore });
    } else {
      console.warn(`[VALIDATE_FLOW] ❌ コンテンツ検証失敗`);
      failedUrls.push(url);
    }
  }

  // 有効な候補があればベストを返す
  if (validResults.length > 0) {
    const best = validResults.reduce((a, b) => a.score > b.score ? a : b);
    console.log(`\n[VALIDATE_FLOW] 🏆 最高スコア採用: ${best.url}`);
    console.log(`[VALIDATE_FLOW] スコア内訳：ドメイン=${best.domainScore}, コンテンツ=${Math.floor(best.contentScore)}, 合計=${Math.floor(best.score)}`);
    return { valid: true, url: best.url, source: 'Gemini候補', score: best.score, domainScore: best.domainScore };
  }

  console.warn(`[VALIDATE_FLOW] ⚠️ 有効な候補がありません。Gemini リトライに進みます`);

  // 自治体サイト（.lg.jp）が全滅したかチェック
  const hasLgJpUrl = failedUrls.some(url => url.includes('.lg.jp'));
  const noLgJpValid = !validResults.some(r => r.domainScore >= 100);
  const allLgJpFailed = hasLgJpUrl && noLgJpValid;

  if (allLgJpFailed) {
    console.warn(`[VALIDATE_FLOW] ⚠️ 自治体サイト（.lg.jp）が全滅。Wikipedia優遇モードに切り替え`);
  }

  // フェーズ2: Gemini 再試行（最大2回、ただし5候補全滅時のみ追加リトライ）
  let retryUrls = [];
  let maxRetryAttempts = failedUrls.length >= 5 ? 3 : 2;

  for (let retryAttempt = 0; retryAttempt < maxRetryAttempts; retryAttempt++) {
    console.log(`[VALIDATE_FLOW] フェーズ2-${retryAttempt + 1}: Gemini 再試行（${maxRetryAttempts}回まで）`);

    const newUrls = await retryGeminiForUrls(failedUrls.slice(0, 5), facilityName, retryAttempt);
    if (newUrls.length === 0) {
      console.warn(`[VALIDATE_FLOW] 再試行でも新候補を取得できません`);
      continue;
    }

    // 再試行候補もドメインスコア順にソート（自治体全滅時はWikipedia優遇）
    const sortedRetryUrls = newUrls
      .filter(url => url && url.trim() !== '')
      .map(url => ({
        url: url.trim(),
        domainScore: scoreUrlByDomain(url, facilityName, address, allLgJpFailed)
      }))
      .sort((a, b) => b.domainScore - a.domainScore);

    retryUrls = sortedRetryUrls.map(item => item.url);
    const retryResults = [];

    // 再試行候補を検証
    for (let index = 0; index < sortedRetryUrls.length; index++) {
      const item = sortedRetryUrls[index];
      const url = item.url;

      console.log(`\n[VALIDATE_FLOW] [リトライ ${retryAttempt + 1}回目-${index + 1}/${sortedRetryUrls.length}] ${url} (推定スコア: ${item.domainScore}点)`);

      const pageResult = await fetchPageContent(url);
      if (!pageResult.success || pageResult.statusCode === 404) {
        console.warn(`[VALIDATE_FLOW] ❌ 404 またはアクセス不可`);
        continue;
      }

      const result = await validateUrlWithContent(url, facilityName, address, allLgJpFailed);
      if (result.valid) {
        console.log(`[VALIDATE_FLOW] ✅ 有効 (スコア: ${Math.floor(result.score)})`);
        retryResults.push({ url, score: result.score, domainScore: result.domainScore, contentScore: result.contentScore });
      }
    }

    // 再試行で有効候補が見つかれば採用
    if (retryResults.length > 0) {
      const best = retryResults.reduce((a, b) => a.score > b.score ? a : b);
      console.log(`\n[VALIDATE_FLOW] 🏆 再試行から採用: ${best.url}`);
      console.log(`[VALIDATE_FLOW] スコア内訳：ドメイン=${best.domainScore}, コンテンツ=${Math.floor(best.contentScore)}, 合計=${Math.floor(best.score)}`);
      return { valid: true, url: best.url, source: 'Gemini再試行', score: best.score, domainScore: best.domainScore };
    }
  }

  console.warn(`[VALIDATE_FLOW] ⚠️ Gemini リトライも失敗。kunishitei に進みます`);

  // フェーズ3: kunishitei フォールバック（最終手段）
  console.log(`[VALIDATE_FLOW] フェーズ3: kunishitei.bunka.go.jp 最終検索`);
  const fallbackResult = await findUrlViaKunishitei(facilityName, address);
  if (fallbackResult.valid) {
    console.log(`[VALIDATE_FLOW] kunishitei から採用 (ドメインスコア: 30)`);
    return { valid: true, url: fallbackResult.url, source: 'kunishitei', score: 50, domainScore: 30 };
  }

  console.error(`[VALIDATE_FLOW] ❌ 全ての検索方法で有効な URL が見つかりません`);
  return { valid: false, url: '' };
}

// ========== 画像生成 v2.0 (DALL-E 3) ==========
async function generateFacilityImage(facilityId, facilityName, description) {
  if (!OPENAI_API_KEY) {
    console.warn(`[IMAGE] ⚠️ OPENAI_API_KEY が未設定のため、画像生成をスキップ`);
    return '';
  }

  const imagesDir = path.join(__dirname, '../public/images/facilities');

  if (!fs.existsSync(imagesDir)) {
    fs.mkdirSync(imagesDir, { recursive: true });
  }

  const outputPath = path.join(imagesDir, `${facilityId}_ai.png`);

  try {
    const prompt = `CRITICAL: Full-bleed edge-to-edge composition filling entire frame. ABSOLUTELY NO TEXT, LETTERS, LOGOS, CAPTIONS, OR JAPANESE CHARACTERS. NO SIGNAGE. NO PADDING OR WHITE BORDERS.

Ancient Jomon archaeological site in natural earth. Weathered clay soil with pottery fragments, shell middens, and stone arrangements. National Geographic raw documentary style with authentic weathered textures and film grain. Natural daylight with soft shadows. Ground-level perspective showing real excavated artifacts naturally embedded in earth. Earthy palette of browns, ochres, rust, and burnt sienna. Archaeological realism. NO MODERN ELEMENTS. NO TEXT ANYWHERE.`;

    console.log(`[IMAGE] DALL-E 3 にリクエスト中...`);

    const response = await fetch(OPENAI_API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'dall-e-3',
        prompt: prompt,
        n: 1,
        size: '1024x1024',
        quality: 'hd',
        style: 'natural'
      }),
      timeout: 120000
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`DALL-E 3 API エラー: ${response.status} - ${JSON.stringify(errorData)}`);
    }

    const data = await response.json();

    if (data.data && data.data.length > 0 && data.data[0].url) {
      const imageUrl = data.data[0].url;
      console.log(`[IMAGE] DALL-E 3 URL取得: ${imageUrl.substring(0, 50)}...`);

      // URL から画像をダウンロード
      const imageResponse = await fetch(imageUrl, { timeout: 30000 });
      if (!imageResponse.ok) {
        throw new Error(`画像ダウンロード失敗: HTTP ${imageResponse.status}`);
      }

      // arrayBuffer() を使用してバイナリデータを取得（node-fetch 最新仕様）
      const arrayBuffer = await imageResponse.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      fs.writeFileSync(outputPath, buffer);
      console.log(`[IMAGE] ✅ 生成・保存成功: ${facilityId}_ai.png`);
      return `/images/facilities/${facilityId}_ai.png`;
    }

    console.warn(`[IMAGE] ❌ DALL-E 3 レスポンスが無効`);
    return '';

  } catch (error) {
    console.warn(`[IMAGE] ❌ 生成失敗: ${error.message}`);
    return '';
  }
}

// ========== 一括画像再生成（指定IDの画像を再生成） ==========
async function regenerateImages(facilityData, startId = 52, endId = 67) {
  console.log(`\n[REGENERATE] ========== 画像一括再生成開始 (ID ${startId}-${endId}) ==========`);

  if (!OPENAI_API_KEY) {
    console.error(`[REGENERATE] ❌ OPENAI_API_KEY が未設定のため、再生成できません`);
    return;
  }

  let updatedCount = 0;

  for (const facility of facilityData) {
    const facilityId = parseInt(facility.id);

    if (facilityId < startId || facilityId > endId) {
      continue;
    }

    console.log(`\n[REGENERATE] [${facilityId}/${endId}] ${facility.name}`);

    try {
      const imageUrl = await generateFacilityImage(
        facility.id,
        facility.name,
        facility.description
      );

      if (imageUrl) {
        facility.thumbnail = imageUrl;
        updatedCount++;
        console.log(`[REGENERATE] ✅ 更新: ${facility.name}`);

        // API制限回避のため待機
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    } catch (error) {
      console.warn(`[REGENERATE] ⚠️ ${facility.name}: ${error.message}`);
    }
  }

  console.log(`\n[REGENERATE] ✅ 完了: ${updatedCount}件の画像を再生成`);
  return updatedCount;
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
日本の縄文時代における遺跡・博物館の専門家になってください。
「すでに登録済みの施設リスト」に含まれていない、日本国内の重要な縄文時代の遺跡・博物館・考古館を3件ピックアップしてください。

【既存リスト（これらは除外）】
${existingNames}

【条件】
- ターゲット地方: ${randomRegion}地方
- 縄文時代のみ
- 公立博物館または国指定史跡

【出力】

JSON配列のみを返してください。改行や説明は一切不要です。

各施設は以下のフォーマットで記載：
- id: 英数字ハイフン
- name: 施設の正式名称
- prefecture: 都道府県名
- address: 住所
- description: 100文字以内（改行禁止）
- region: Hokkaido / Tohoku / Kanto / Chubu / Kinki / Chugoku / Shikoku / Kyushu
- url: 最もシンプルな自治体URL（施設名をローマ字化して https://www.pref.xx.lg.jp/xxxx の形）
- candidates: 5個以上のURL（https://から始まる完全なURL、改行禁止）
- tags: 最大2個
- lat: 緯度
- lng: 経度
- access: train, bus, car, rank
- copy: 14文字以内
- その他: name_en, description_en など

【重要】
- JSON配列だけを出力
- 説明は絶対に含めない
- descriptonは1行（改行なし）
- *** などの特殊文字は使わない
- URL候補には https:// で始まる完全なURLのみ
`;


  try {
    console.log(`[CRAWLER] Gemini API にリクエスト (地方: ${randomRegion})...`);

    const responseText = await callGeminiAPI(prompt);
    console.log(`[CRAWLER] API レスポンス受信（長さ: ${responseText.length}文字）`);

    // JSON 抽出・パース（クリーニング + 自動修復 + リトライ対応）
    console.log(`[CRAWLER] API レスポンス長: ${responseText.length}文字`);

    const candidates = await parseJsonWithFallback(responseText, '新規施設', true, 0);

    if (!candidates || !Array.isArray(candidates) || candidates.length === 0) {
      console.log('[CRAWLER] ❌ 有効な候補がありません');
      console.log(`[RESULT] 既存 ${existingData.length} 件を維持`);
      return;
    }

    console.log(`[CRAWLER] ✅ AI が ${candidates.length} 件の候補を返却`);

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

      // 【v4.0 新機能】【要確認】ラベルの自動付与（ドメインスコア < 100点）
      const domainScore = urlValidation.domainScore || 0;
      if (domainScore < 100) {
        candidate.name = `【要確認】${candidate.name}`;
        candidate.needsCheck = true;
        console.warn(`[NEEDS_CHECK] ⚠️ ドメインスコア ${domainScore}点 < 100点 → 【要確認】ラベル付与`);
      } else {
        candidate.needsCheck = false;
      }

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

// 環境変数で実行モードを指定
const REGENERATE_MODE = process.env.REGENERATE_IMAGES === 'true';
const REGENERATE_START = parseInt(process.env.REGENERATE_START || '52');
const REGENERATE_END = parseInt(process.env.REGENERATE_END || '67');

if (REGENERATE_MODE) {
  // 画像再生成モード
  (async () => {
    const filePath = path.join(__dirname, '../app/data/facilities.json');

    try {
      console.log(`\n[REGENERATE_MODE] 画像一括再生成モード起動`);

      let facilityData = [];
      if (fs.existsSync(filePath)) {
        const raw = fs.readFileSync(filePath, 'utf-8');
        facilityData = JSON.parse(raw);
        console.log(`[REGENERATE_MODE] 既存データ読み込み: ${facilityData.length} 件`);
      }

      const updatedCount = await regenerateImages(facilityData, REGENERATE_START, REGENERATE_END);

      // JSON保存
      fs.writeFileSync(filePath, JSON.stringify(facilityData, null, 2), 'utf-8');
      console.log(`\n[REGENERATE_MODE] ✅ JSON更新完了: ${updatedCount}件の画像を再生成・保存`);
      process.exit(0);
    } catch (error) {
      console.error(`[REGENERATE_MODE] ❌ エラー: ${error.message}`);
      process.exit(1);
    }
  })();
} else {
  // 通常モード
  main().catch(error => {
    console.error(`[ERROR] ${error.message}`);
    process.exit(1);
  });
}
