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

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_API_ENDPOINT = "https://api.openai.com/v1/images/generations";

// ========== 初期化 ==========
console.log(`\n[REGENERATE] ========== 画像再生成スクリプト v1.0 (DALL-E 3) ==========`);
console.log(`[REGENERATE] OPENAI_API_KEY: ${OPENAI_API_KEY ? '✅ 存在' : '❌ 未設定'}`);

if (!OPENAI_API_KEY) {
  console.error("[FATAL] ❌ OPENAI_API_KEY が設定されていません");
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
    const prompt = `CRITICAL: Full-bleed edge-to-edge composition filling entire frame. ABSOLUTELY NO TEXT, LETTERS, LOGOS, CAPTIONS, OR JAPANESE CHARACTERS. NO SIGNAGE. NO PADDING OR WHITE BORDERS.

Ancient Jomon archaeological site in natural earth. Weathered clay soil with pottery fragments, shell middens, and stone arrangements. National Geographic raw documentary style with authentic weathered textures and film grain. Natural daylight with soft shadows. Ground-level perspective showing real excavated artifacts naturally embedded in earth. Earthy palette of browns, ochres, rust, and burnt sienna. Archaeological realism. NO MODERN ELEMENTS. NO TEXT ANYWHERE.`;

    console.log(`[IMAGE] [${facilityId}] DALL-E 3 リクエスト中...`);

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
        size: '1792x1024',
        quality: 'hd',
        style: 'natural'
      }),
      timeout: 120000
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`HTTP ${response.status}: ${JSON.stringify(errorData)}`);
    }

    const data = await response.json();

    if (data.data && data.data.length > 0 && data.data[0].url) {
      const imageUrl = data.data[0].url;
      console.log(`[IMAGE] [${facilityId}] URL取得、ダウンロード中...`);

      const imageResponse = await fetch(imageUrl, { timeout: 30000 });
      if (!imageResponse.ok) {
        throw new Error(`ダウンロード失敗: HTTP ${imageResponse.status}`);
      }

      // arrayBuffer() を使用してバイナリデータを取得（node-fetch 最新仕様）
      const arrayBuffer = await imageResponse.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
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
