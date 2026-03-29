/**
 * 既存遺跡の画像を生成するスタンドアロンスクリプト
 * 特に 052番（東名遺跡）など、画像が不足している施設の画像を生成
 */

const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const API_KEY = process.env.GEMINI_API_KEY20261336;

if (!API_KEY) {
  console.error("[FATAL] GEMINI_API_KEY20261336 が設定されていません");
  process.exit(1);
}

console.log("[DEBUG] API_KEY: 長さ" + API_KEY.length);

// リトライ機能付き fetch
async function fetchWithRetry(url, options, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[ATTEMPT ${attempt}/${maxRetries}] API呼び出し開始...`);
      const response = await fetch(url, options);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[HTTP_ERROR] ステータス: ${response.status}`);
        console.error(`[RESPONSE] ${errorText.substring(0, 200)}`);

        if ([400, 401, 403].includes(response.status)) {
          throw new Error(`[PERMANENT] HTTP ${response.status}`);
        }

        if ([429, 500, 503].includes(response.status)) {
          throw new Error(`[TEMPORARY] HTTP ${response.status}`);
        }

        throw new Error(`[UNKNOWN] HTTP ${response.status}`);
      }

      const data = await response.json();
      console.log(`[SUCCESS] 試行 ${attempt} で成功`);
      return data;

    } catch (error) {
      console.error(`[FAIL ${attempt}/${maxRetries}] ${error.message}`);

      if (error.message.includes("[PERMANENT]")) {
        throw error;
      }

      if (attempt < maxRetries) {
        const delayMs = 2000 * Math.pow(2, attempt - 1);
        console.warn(`[BACKOFF] ${delayMs}ms 待機...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
  }
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
 * Imagen API で画像生成
 */
async function generateImage(facilityId, facilityName, description) {
  const imagesDir = path.join(__dirname, "../public/images/facilities");

  if (!fs.existsSync(imagesDir)) {
    fs.mkdirSync(imagesDir, { recursive: true });
    console.log(`[IMAGE] ディレクトリ作成: ${imagesDir}`);
  }

  const outputPath = path.join(imagesDir, `${facilityId}_ai.png`);

  // 既に存在する場合はスキップ
  if (fs.existsSync(outputPath)) {
    console.log(`[IMAGE] スキップ（既存）: ${facilityId}_ai.png`);
    return outputPath;
  }

  // 10秒待機（レート制限回避）
  console.log(`[IMAGE] 10秒待機中（レート制限回避）...`);
  await new Promise(resolve => setTimeout(resolve, 10000));

  try {
    console.log(`[IMAGE] 生成開始: ${facilityName}`);

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
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "Mozilla/5.0 (compatible; JomonPortal/1.0)"
        },
        body: JSON.stringify(requestBody),
        timeout: 60000
      },
      3
    );

    if (response.predictions && response.predictions.length > 0) {
      const imageData = response.predictions[0];

      if (imageData.bytesBase64Encoded) {
        const imageBuffer = Buffer.from(imageData.bytesBase64Encoded, "base64");
        fs.writeFileSync(outputPath, imageBuffer);
        console.log(`[IMAGE] ✅ 生成成功: ${facilityId}_ai.png (${imageBuffer.length} bytes)`);

        // 画像をリサイズして正方形フォーマットに変換
        await resizeImageToSquare(outputPath);

        return outputPath;
      }
    }

    console.warn(`[IMAGE] ⚠️ 画像データが取得できません`);
    return null;

  } catch (error) {
    console.error(`[IMAGE] ❌ 生成失敗: ${error.message}`);
    return null;
  }
}

/**
 * 複数の施設画像を一括生成
 */
async function generateMissingImages(facilityIds) {
  const filePath = path.join(__dirname, "../app/data/facilities.json");
  const facilities = JSON.parse(fs.readFileSync(filePath, "utf-8"));

  for (const id of facilityIds) {
    const facility = facilities.find(f => f.id === id);

    if (!facility) {
      console.warn(`[SKIP] 施設 ${id} が見つかりません`);
      continue;
    }

    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`【施設】${id} - ${facility.name}`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

    const imagePath = await generateImage(id, facility.name, facility.description);

    if (imagePath) {
      facility.thumbnail = `/images/facilities/${id}_ai.png`;
      console.log(`[UPDATE] facilities.json を更新: ${id}`);
    }
  }

  // facilities.json を更新
  fs.writeFileSync(filePath, JSON.stringify(facilities, null, 2), "utf-8");
  console.log(`\n[DONE] facilities.json を保存しました`);
}

// メイン実行
const targetIds = process.argv.slice(2);

if (targetIds.length === 0) {
  console.error("[ERROR] 使用法: node generate-missing-images.js 052 053 054");
  console.error("[ERROR] 例: node generate-missing-images.js 052");
  process.exit(1);
}

generateMissingImages(targetIds).catch(error => {
  console.error(`[FATAL] ${error.message}`);
  process.exit(1);
});
