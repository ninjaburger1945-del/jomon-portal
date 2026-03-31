const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

/**
 * REST API形式で Google Gemini API (v1beta) を直接叩く
 * 3月16日の Paid Tier/Spend Caps ルール対応版
 * モデル: gemini-2.5-pro (最新・最高性能)
 */

const API_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent";
const API_KEY = process.env.GEMINI_API_KEY20261336;

if (!API_KEY) {
  console.error("[FATAL] GEMINI_API_KEY20261336 環境変数が設定されていません");
  process.exit(1);
}

console.log(`[INIT] API_KEY configured (${API_KEY.length} chars)`);

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

        // 400, 401, 403, 404 は永続的エラー（リトライしない）
        if ([400, 401, 403, 404].includes(response.status)) {
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
 * ページ内容取得 - HTMLを実際に取得
 */
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
      console.log(`[FETCH_OK] ${url} (${html.length} bytes)`);
      return { success: true, content: html, statusCode: res.status };
    }

    console.warn(`[FETCH_FAIL] ${url} → HTTP ${res.status}`);
    return { success: false, content: '', statusCode: res.status };

  } catch (e) {
    console.warn(`[FETCH_ERROR] ${url} → ${e.message}`);
    return { success: false, content: '', statusCode: 0 };
  }
}

/**
 * URL検証＆コンテンツ検証 - ページ内容からキーワードと住所を確認
 * スコア方式で詳細度を評価
 */
async function validateUrlWithContent(url, facilityName, address, description) {
  if (!url || !url.startsWith('http')) {
    console.log(`[URL_INVALID_FORMAT] ${url}`);
    return { valid: false, score: 0, reason: 'Invalid URL format' };
  }

  // ページ内容取得
  const pageResult = await fetchPageContent(url);
  if (!pageResult.success) {
    console.warn(`[PAGE_FETCH_FAILED] ${url}`);
    return { valid: false, score: 0, reason: 'Cannot fetch page' };
  }

  const html = pageResult.content;

  // テキスト抽出（スクリプトやスタイルを除去）
  const text = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .toLowerCase();

  // 404 検出（複数パターン）
  const notFoundPatterns = ['404', 'ページが見つかり', 'page not found', 'not found',
                            'お探しのページ', '存在しません', 'ページは削除されました'];
  const hasNotFoundMarker = notFoundPatterns.some(pattern => text.includes(pattern));

  if (hasNotFoundMarker) {
    console.warn(`[404_DETECTED] ${url} - 404または削除済みページ検出`);
    return { valid: false, score: 0, reason: `404 or removed page detected` };
  }

  let score = 0;

  // キーワード検証
  const keywords = ['縄文', '遺跡', '史跡', '文化財', '考古', '土器', '土偶', '貝塚'];
  const foundKeywords = keywords.filter(kw => text.includes(kw));

  if (foundKeywords.length === 0) {
    console.warn(`[KEYWORD_NOT_FOUND] ${url} - キーワード未検出`);
    return { valid: false, score: 0, reason: `No keywords found` };
  }

  // スコア計算：キーワード出現数
  foundKeywords.forEach(kw => {
    const count = (text.match(new RegExp(kw, 'g')) || []).length;
    score += Math.min(count, 5);  // 最大5点
  });

  // 最小テキスト長チェック（404ページのような短いページを除外）
  if (text.length < 300) {
    console.warn(`[CONTENT_TOO_SHORT] ${url} - コンテンツが短すぎます（${text.length}文字）。404またはスタブページの可能性`);
    return { valid: false, score: 0, reason: `Content too short (likely 404 or stub page)` };
  }

  // 最大テキスト長チェック（スパムやノイズを除外）
  if (text.length > 500) {
    console.log(`[CONTENT_TRUNCATED] ${url} - テキスト長: ${text.length}文字（検証のため最初の500文字で確認）`);
  }

  // 施設名の確認
  if (!text.includes(facilityName.toLowerCase())) {
    console.warn(`[NAME_MISMATCH] ${url} - 施設名が見つかりません: ${facilityName}`);
    return { valid: false, score: 0, reason: `Facility name not found` };
  }

  // スコア計算：施設名出現数
  const nameCount = (text.match(new RegExp(facilityName.toLowerCase(), 'g')) || []).length;
  score += Math.min(nameCount * 2, 10);  // 最大10点

  // 住所の確認
  let addressScore = 0;
  if (address && address.length > 5) {
    const addressParts = address.split(/[都道府県]/).filter(p => p.length > 2);
    addressParts.forEach(part => {
      if (text.includes(part.toLowerCase())) {
        const count = (text.match(new RegExp(part.toLowerCase(), 'g')) || []).length;
        addressScore += Math.min(count, 3);
      }
    });

    if (addressScore === 0) {
      console.warn(`[ADDRESS_MISMATCH] ${url} - 住所が見つかりません: ${address}`);
      return { valid: false, score: 0, reason: `Address not found` };
    }
  }
  score += Math.min(addressScore, 10);  // 最大10点

  // スコア計算：コンテンツの詳細度（テキスト長）
  const contentLength = text.length;
  score += Math.min(Math.floor(contentLength / 500), 15);  // 最大15点（500文字ごと）

  console.log(`[CONTENT_VERIFIED] ${url}`);
  console.log(`   スコア: ${score} | キーワード: ${foundKeywords.join(', ')} | 施設名出現: ${nameCount}回 | 住所スコア: ${addressScore} | テキスト長: ${contentLength}文字`);

  return { valid: true, score: score, reason: 'Content verified', keywords: foundKeywords };
}

/**
 * 複数URL候補を検証して、最初に有効なURLを返す（Google検索順を信頼）
 */
async function validateCandidateUrls(candidateUrls, facilityName, address) {
  for (const url of candidateUrls) {
    if (!url || url.trim() === '') continue;

    console.log(`[VALIDATE_CANDIDATE] ${url}`);
    const result = await validateUrlWithContent(url, facilityName, address, '');

    if (result.valid) {
      console.log(`[BEST_URL_SELECTED] ✅ ${url} (Google検索順位による採用)`);
      return { valid: true, url: url, reason: result.reason, score: result.score };
    } else {
      console.warn(`[CANDIDATE_REJECTED] ${url} - 理由: ${result.reason}`);
    }
  }

  console.warn(`[NO_VALID_URL] 候補URLの中に有効なものがありません`);
  return { valid: false, url: '', reason: 'No valid URLs in candidates' };
}

/**
 * 画像をリサイズして 1:1 正方形フォーマットに変換
 */
async function resizeImageToSquare(imagePath) {
  try {
    console.log(`[RESIZE] 開始: ${imagePath}`);

    // 画像メタデータを取得
    const metadata = await sharp(imagePath).metadata();
    const { width, height } = metadata;

    console.log(`[RESIZE] 元のサイズ: ${width}x${height}`);

    // 正方形のサイズを決定（小さい方の寸法を基準）
    const squareSize = Math.min(width, height);

    // センタークロップして正方形に
    const left = Math.floor((width - squareSize) / 2);
    const top = Math.floor((height - squareSize) / 2);

    // 一度テンポラリファイルに出力（同ファイル入出力エラー回避）
    const tempPath = imagePath + '.tmp';

    await sharp(imagePath)
      .extract({ left, top, width: squareSize, height: squareSize })
      .resize(512, 512, { fit: 'fill' })
      .toFile(tempPath);

    // テンポラリファイルを元のパスに上書き
    fs.renameSync(tempPath, imagePath);

    console.log(`[RESIZE] ✅ 完了: ${squareSize}x${squareSize} → 512x512`);
    return true;

  } catch (error) {
    console.error(`[RESIZE] ❌ リサイズ失敗: ${error.message}`);
    return false;
  }
}

/**
 * Imagen API で画像生成（Paid Tier対応）
 * 遺跡の特徴に合わせたAIイラストを生成
 */
async function generateFacilityImage(facilityId, facilityName, description) {
  const imagesDir = path.join(__dirname, '../public/images/facilities');

  // ディレクトリが存在しない場合は作成
  if (!fs.existsSync(imagesDir)) {
    fs.mkdirSync(imagesDir, { recursive: true });
    console.log(`[IMAGE] ディレクトリ作成: ${imagesDir}`);
  }

  const outputPath = path.join(imagesDir, `${facilityId}_ai.png`);

  // 429エラー回避：生成前に10秒待機
  console.log(`[IMAGE] 10秒待機中（レート制限回避）...`);
  await new Promise(resolve => setTimeout(resolve, 10000));

  try {
    console.log(`[IMAGE] 生成開始: ${facilityName}`);

    // 説明文から画像生成プロンプトを作成
    const prompt = `日本の縄文時代の遺跡「${facilityName}」のAIイラストを生成してください。

特徴：${description.substring(0, 200)}...

要件：
- 縄文時代の遺跡の雰囲気を反映した学術的イラスト
- 土器、貝塚、環状列石など遺跡の典型的な要素を含める
- 古代日本の自然環境を背景に
- 高品質で教育的価値のある画像
- 暖色系で歴史的な重厚感`;

    const requestBody = {
      instances: [
        {
          prompt: prompt
        }
      ],
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
      3  // リトライ回数を3回に制限（画像生成は時間がかかるため）
    );

    // 生成結果の処理
    if (response.predictions && response.predictions.length > 0) {
      const imageData = response.predictions[0];

      // Base64 画像データを PNG ファイルとして保存
      if (imageData.bytesBase64Encoded) {
        const imageBuffer = Buffer.from(imageData.bytesBase64Encoded, 'base64');
        fs.writeFileSync(outputPath, imageBuffer);
        console.log(`[IMAGE] ✅ 生成成功: ${facilityId}_ai.png`);

        // 画像をリサイズして正方形フォーマットに変換
        await resizeImageToSquare(outputPath);

        return `/images/facilities/${facilityId}_ai.png`;
      }
    }

    console.warn(`[IMAGE] ⚠️ 画像データが取得できません`);
    return '';

  } catch (error) {
    console.warn(`[IMAGE] ❌ 生成失敗: ${error.message}`);

    // 失敗時のフォールバック：既存の画像をコピー
    try {
      const files = fs.readdirSync(imagesDir);
      const aiImages = files.filter(f => f.endsWith('_ai.png'));
      if (aiImages.length > 0) {
        const randomImage = aiImages[Math.floor(Math.random() * aiImages.length)];
        fs.copyFileSync(path.join(imagesDir, randomImage), outputPath);
        console.log(`[IMAGE] フォールバック: ${randomImage} → ${facilityId}_ai.png`);
        return `/images/facilities/${facilityId}_ai.png`;
      }
    } catch (fallbackErr) {
      console.error(`[IMAGE] フォールバック失敗: ${fallbackErr.message}`);
    }

    return '';
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

【🔍 重要：Google検索で実際に上位に出てくるサイトを推定してください】
あなたのタスク：
1. 施設名で Google 検索した場合、「実際に上位（1～5位）に出現するであろう」サイトを推定
2. 複数のURL候補を「candidates」フィールドに上位順に列挙（信頼性の高い順）
3. 最初の候補が最も正確で詳細な施設情報ページであることを確認してから記載
4. ハルシネーション（存在しないURL）は絶対に避ける

【URLについて - 優先順位付き】
以下の優先順位で探してください：

【優先度1（最優先）】施設専用ドメイン
例：sannaimaruyama.pref.aomori.jp, jomon-no-mori.jp, komakinosite.jp など

【優先度2】自治体公式サイト
例：city.chino.lg.jp/site/togariishi/, www.city.chiba.jp/kasori/

【優先度3】公式な文化財・遺跡情報サイト
例：sitereports.nabunken.go.jp, jomon-japan.jp, bunka.nii.ac.jp, kunishitei.bunka.go.jp

【優先度4】自治体観光ポータル
例：visithachinohe.com, tokimeguri.jp など

【優先度5】ISPサイト・地元情報サイト
例：alles.or.jp, comlink.ne.jp など

【絶対禁止】
- Wikipedia, SNS（X/Twitter等）
- 404/5xxエラーが返されるURL
- ハルシネーション（存在しないURL）

【出力要件】
完全なJSON配列のみを出力。candidatesは必ず上位順に記載：
[{
  "id": "英数字のハイフン繋ぎ",
  "name": "施設の正式名称",
  "region": "Hokkaido / Tohoku / Kanto / Chubu / Kinki / Chugoku / Shikoku / Kyushu",
  "prefecture": "都道府県名",
  "address": "住所",
  "description": "200〜400文字の紹介文",
  "url": "Google検索で1位に出そうなURL（最も詳細で信頼性の高い）",
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
    console.log(`[CRAWLER] エンドポイント: ${API_ENDPOINT}`);

    const responseText = await callGeminiAPI(prompt);

    // JSON抽出（より堅牢）
    let jsonStr = responseText.trim();

    // マークダウン形式を除去
    if (jsonStr.startsWith('```json')) jsonStr = jsonStr.slice(7);
    else if (jsonStr.startsWith('```')) jsonStr = jsonStr.slice(3);

    // 最初の [ と最後の ] を見つけて抽出
    const jsonStart = jsonStr.indexOf('[');
    const jsonEnd = jsonStr.lastIndexOf(']');

    if (jsonStart === -1 || jsonEnd === -1 || jsonStart > jsonEnd) {
      throw new Error('JSON array not found in response');
    }

    jsonStr = jsonStr.substring(jsonStart, jsonEnd + 1).trim();

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

      // ✅ 【改造】複数URL候補を検証
      console.log(`[PROCESS] ${candidate.name} - URL候補を検証中...`);
      const candidateUrls = candidate.candidates || (candidate.url ? [candidate.url] : []);

      if (candidateUrls.length === 0) {
        console.warn(`[NO_URL_CANDIDATES] ${candidate.name} - URL候補がありません`);
        continue;
      }

      const urlValidation = await validateCandidateUrls(candidateUrls, candidate.name, candidate.address);
      if (!urlValidation.valid) {
        console.warn(`[URL_VALIDATION_FAILED] ${candidate.name} - 候補URL全てが検証失敗`);
        continue;
      }

      candidate.url = urlValidation.url;
      delete candidate.candidates;  // ✅ 候補フィールドはDB保存時に削除

      console.log(`[URL_CONFIRMED] ✅ ${candidate.name} → ${candidate.url}`);

      // アクセス情報チェック（必須）
      if (!candidate.access || !candidate.access.train || !candidate.access.bus || !candidate.access.car) {
        console.warn(`[ACCESS_INCOMPLETE] ${candidate.name} - アクセス情報が不完全`);
        continue;
      }

      // ID生成：連番形式（001, 002, ..., 052）に統一
      const nextId = String(existingData.length + 1).padStart(3, '0');
      candidate.id = nextId;
      console.log(`[ID_GENERATED] ${candidate.name} → ${nextId}`);

      // 画像生成（Paid Tier対応版 - Imagen API 実装済み）
      const imageUrl = await generateFacilityImage(nextId, candidate.name, candidate.description);
      candidate.thumbnail = imageUrl || '';

      if (imageUrl) {
        console.log(`[IMAGE] ✅ 画像生成成功: ${imageUrl}`);
      } else {
        console.warn(`[IMAGE] ⚠️ 画像生成スキップ: ${candidate.name}`);
      }

      existingData.push(candidate);
      addedCount++;
      console.log(`[ADDED] ✓ ${nextId} - ${candidate.name}`);
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
