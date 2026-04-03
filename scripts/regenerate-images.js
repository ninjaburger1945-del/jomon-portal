#!/usr/bin/env node

/**
 * 画像再生成スクリプト v1.0 (DALL-E 3)
 *
 * 用途：既存施設の画像を DALL-E 3 で一括再生成
 * 使用方法：
 *   node scripts/regenerate-images.js [startId] [endId]
 *   例：node scripts/regenerate-images.js 52 67
 */

const fs = require("fs");
const path = require("path");

const API_KEY = process.env.GEMINI_API_KEY20261336;
const IMAGEN_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate:generateImage";

// ========== 初期化 ==========
console.log(`\n[REGENERATE] ========== 画像再生成スクリプト v1.1 (Imagen 4.0) ==========`);
console.log(`[REGENERATE] GEMINI_API_KEY20261336: ${API_KEY ? '✅ 存在' : '❌ 未設定'}`);

if (!API_KEY) {
  console.error("[FATAL] ❌ GEMINI_API_KEY20261336 が設定されていません");
  process.exit(1);
}

// ========== 画像生成関数 ==========
async function generateFacilityImage(facilityId, facilityName, description) {
  const imagesDir = path.join(__dirname, '../public/images/facilities');

  if (!fs.existsSync(imagesDir)) {
    fs.mkdirSync(imagesDir, { recursive: true });
  }

  const outputPath = path.join(imagesDir, `${facilityId}_ai.png`);

  try {
    const prompt = `縄文時代の遺跡。ナショナルジオグラフィック風、学術的なドキュメンタリー撮影。自然な大地、風化した粘土、土器の破片、貝塚、石の配置。リアルな質感で、全面構成で余白なし。余白禁止。文字なし。ロゴなし。装飾なし。シンプル。アーストーン、褐色、焦げ茶、赤褐色。実在的。レンズは地表レベルから。掘られた遺跡の状態。考古学的なリアリズム。`;

    console.log(`[IMAGE] [${facilityId}] Imagen にリクエスト中...`);

    const response = await fetch(IMAGEN_ENDPOINT, {
      method: 'POST',
      headers: {
        'x-goog-api-key': API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        instances: [
          {
            prompt: prompt
          }
        ],
        parameters: {
          sampleCount: 1,
          aspectRatio: '16:9',
          outputMimeType: 'image/png'
        }
      }),
      timeout: 120000
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`HTTP ${response.status}: ${JSON.stringify(errorData)}`);
    }

    const data = await response.json();

    if (data.predictions && data.predictions.length > 0 && data.predictions[0].imageBase64) {
      const imageBase64 = data.predictions[0].imageBase64;
      console.log(`[IMAGE] [${facilityId}] 生成完了、保存中...`);

      const buffer = Buffer.from(imageBase64, 'base64');
      fs.writeFileSync(outputPath, buffer);
      console.log(`[IMAGE] ✅ [${facilityId}] 生成・保存成功`);
      return `/images/facilities/${facilityId}_ai.png`;
    }

    throw new Error(`無効なレスポンス`);

  } catch (error) {
    console.warn(`[IMAGE] ❌ [${facilityId}] 失敗: ${error.message}`);
    return '';
  }
}

// ========== メイン処理 ==========
async function main() {
  const filePath = path.join(__dirname, '../app/data/facilities.json');

  // コマンドライン引数から ID 範囲を取得
  const startId = parseInt(process.argv[2] || '52');
  const endId = parseInt(process.argv[3] || '69');

  console.log(`[REGENERATE] 対象ID: ${startId} - ${endId}`);
  console.log(`[REGENERATE] facilities.json 読み込み中...`);

  try {
    if (!fs.existsSync(filePath)) {
      throw new Error(`facilities.json が見つかりません: ${filePath}`);
    }

    const raw = fs.readFileSync(filePath, 'utf-8');
    const facilities = JSON.parse(raw);
    console.log(`[REGENERATE] ✅ 読み込み完了: ${facilities.length} 件`);

    let updatedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const facility of facilities) {
      const facilityId = parseInt(facility.id);

      if (facilityId < startId || facilityId > endId) {
        skippedCount++;
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
        } else {
          errorCount++;
          console.warn(`[REGENERATE] ⚠️ ${facility.name}: 画像生成失敗`);
        }

        // API レート制限回避のため待機
        await new Promise(resolve => setTimeout(resolve, 3000));
      } catch (error) {
        errorCount++;
        console.warn(`[REGENERATE] ❌ ${facility.name}: ${error.message}`);
      }
    }

    // JSON 保存
    fs.writeFileSync(filePath, JSON.stringify(facilities, null, 2), 'utf-8');

    console.log(`\n[REGENERATE] ========== 完了 ==========`);
    console.log(`[REGENERATE] 更新: ${updatedCount}件`);
    console.log(`[REGENERATE] エラー: ${errorCount}件`);
    console.log(`[REGENERATE] スキップ: ${skippedCount}件`);
    console.log(`[REGENERATE] ✅ facilities.json を保存しました`);

    process.exit(0);
  } catch (error) {
    console.error(`[FATAL] ${error.message}`);
    process.exit(1);
  }
}

main();
