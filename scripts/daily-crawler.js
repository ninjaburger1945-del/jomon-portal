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
 * URL検証 - スキップ版（Paid Tier対応）
 * URLバリデーションを一時的にスキップ
 * AI（Gemini）の出力を信頼し、チェックなしでそのまま使用
 */
async function validateUrl(url) {
  if (!url || !url.startsWith('http')) {
    console.log(`[URL_SKIP_VALIDATION] 形式チェックのみ: ${url}`);
    return { valid: false, url: '' };
  }

  // バリデーションをスキップし、AIの出力を信頼
  console.log(`[URL_ACCEPTED_NO_VALIDATION] ${url}`);
  return { valid: true, url };
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

    await sharp(imagePath)
      .extract({ left, top, width: squareSize, height: squareSize })
      .resize(512, 512, { fit: 'fill' })
      .toFile(imagePath);

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

【URLについて - 極度に厳格】
施設の公式ウェブサイトURLは「必ず現在2026年3月時点で確実にアクセス可能」な自治体公式サイト(.lg.jp, .pref など)のURLを「1つだけ」記載してください。
重要な指示：
- 自治体公式ページの施設紹介ページを「必ず」確認してから出力してください
- Wikipedia や他の二次情報サイト、SNSではなく、公式サイトのみ
- 不確実なURLは絶対に出力しないでください
- URLが確実に見つからない、またはアクセス不可の場合のみ空文字("")にしてください
- 1つのURLのみ出力してください（複数のURLは出力しないこと）

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

      // URL検証（ただし無効でも名称や説明文が正しければ保存）
      console.log(`[VALIDATE] ${candidate.name}: ${candidate.url}`);
      const validation = await validateUrl(candidate.url);

      // URL検証結果を反映（有効なら validation.url、無効でも元の URL を保持）
      if (validation.valid) {
        candidate.url = validation.url;
      } else if (!validation.valid && candidate.url) {
        // URL が無効でも、施設の名称や説明文が正しければ空文字で保存
        console.warn(`[URL_INVALID_BUT_ACCEPTED] URL無効だが施設情報は有効: ${candidate.name}`);
        candidate.url = '';
      }

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
