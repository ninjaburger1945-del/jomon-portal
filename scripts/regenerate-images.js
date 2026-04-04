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
const { generatePrompt } = require('./lib/image-prompt');

// ========== 初期化 ==========
console.log(`\n[REGENERATE] ========== 画像再生成スクリプト v1.3 (Pollinations AI) ==========`);

// ========== 画像生成関数（リトライ付き） ==========
async function generateFacilityImage(facilityId, facilityName, description) {
  const imagesDir = path.join(__dirname, '../public/images/facilities');

  if (!fs.existsSync(imagesDir)) {
    fs.mkdirSync(imagesDir, { recursive: true });
  }

  const outputPath = path.join(imagesDir, `${facilityId}_ai.png`);

  const prompt = await generatePrompt(facilityName, description);

  // リトライ最大5回（成功率重視）
  const MAX_RETRIES = 5;
  const getWaitTime = (attempt) => {
    // 試行ごとの待機時間：15秒、30秒、30秒、30秒、30秒
    const waitTimes = [15000, 30000, 30000, 30000, 30000];
    return waitTimes[attempt - 1] || 30000;
  };

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log(`[IMAGE] [${facilityId}] Pollinations AI にリクエスト中... (試行 ${attempt}/${MAX_RETRIES})`);

      const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=1792&height=1024&nologo=true`;

      const response = await fetch(imageUrl, { timeout: 60000 });

      if (response.ok) {
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        fs.writeFileSync(outputPath, buffer);

        console.log(`[IMAGE] ✅ [${facilityId}] 生成・保存成功 (${buffer.length} bytes)`);
        return `/images/facilities/${facilityId}_ai.png`;
      }

      // 502, 429 などの一時エラーの場合はリトライ
      if ((response.status === 502 || response.status === 429) && attempt < MAX_RETRIES) {
        const waitTime = getWaitTime(attempt);
        console.warn(`[IMAGE] ⚠️ [${facilityId}] HTTP ${response.status}. ${waitTime}ms 待機後にリトライします... (${attempt + 1}/${MAX_RETRIES}へ)`);
        await new Promise(r => setTimeout(r, waitTime));
        continue;
      }

      throw new Error(`HTTP ${response.status}`);
    } catch (error) {
      if (attempt === MAX_RETRIES) {
        console.warn(`[IMAGE] ❌ [${facilityId}] ${MAX_RETRIES}回失敗: ${error.message}`);
        return '';
      }
      const waitTime = getWaitTime(attempt);
      console.warn(`[IMAGE] ⚠️ [${facilityId}] 試行${attempt}失敗: ${error.message}. ${waitTime}ms 待機後にリトライ...`);
      await new Promise(r => setTimeout(r, waitTime));
    }
  }

  return '';
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
