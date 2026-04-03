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

// ========== 初期化 ==========
console.log(`\n[REGENERATE] ========== 画像再生成スクリプト v1.2 (Imagen 4.0) ==========`);
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
    const prompt = `日本の縄文時代の遺跡「${facilityName}」のAIイラストを生成してください。
特徴：${description.substring(0, 200)}...
要件：縄文時代の雰囲気、土器・貝塚・環状列石などを含める、暖色系、教育的価値`;

    console.log(`[IMAGE] [${facilityId}] Imagen にリクエスト中...`);

    const requestBody = {
      instances: [{ prompt: prompt }],
      parameters: {
        sampleCount: 1,
        aspectRatio: "16:9",
        outputMimeType: "image/png"
      }
    };

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-generate-001:predict?key=${API_KEY}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody),
        timeout: 120000
      }
    );

    const responseText = await response.text();
    console.log(`[IMAGE] [${facilityId}] レスポンス状態: ${response.status}`);
    console.log(`[IMAGE] [${facilityId}] レスポンス長: ${responseText.length} 文字`);
    console.log(`[IMAGE] [${facilityId}] レスポンス先頭: ${responseText.substring(0, 300)}`);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${responseText}`);
    }

    let data;
    try {
      data = JSON.parse(responseText);
    } catch (jsonErr) {
      throw new Error(`JSON Parse Error: ${jsonErr.message}. Response: ${responseText.substring(0, 500)}`);
    }

    if (data.predictions && data.predictions.length > 0 && data.predictions[0].bytesBase64Encoded) {
      const imageBase64 = data.predictions[0].bytesBase64Encoded;
      console.log(`[IMAGE] [${facilityId}] 生成完了、保存中...`);

      const buffer = Buffer.from(imageBase64, 'base64');
      fs.writeFileSync(outputPath, buffer);
      console.log(`[IMAGE] ✅ [${facilityId}] 生成・保存成功`);
      return `/images/facilities/${facilityId}_ai.png`;
    }

    throw new Error(`無効なレスポンス: ${JSON.stringify(data)}`);

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
