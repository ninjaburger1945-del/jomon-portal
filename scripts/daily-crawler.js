#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { GoogleGenerativeAI } = require("@google/generative-ai");

// ========== 設定 ==========
const API_KEY = process.env.GEMINI_API_KEY20261336;
const MODEL_NAME = "gemini-2.5-flash";  // 推奨モデル
const FACILITIES_PATH = path.join(__dirname, "../app/data/facilities.json");

// ========== 地域リスト ==========
const regions = ["北海道", "東北", "関東", "中部", "近畿", "中国", "四国", "九州"];

// ========== 初期化 ==========
console.log(`\n[INIT] ========== Jomon Portal Crawler v6.0 (シンプル版) ==========`);
console.log(`[INIT] GEMINI_API_KEY: ${API_KEY ? "✅" : "❌"}`);
console.log(`[INIT] モデル: ${MODEL_NAME}`);
console.log(`[INIT] ✅ 初期化完了\n`);

if (!API_KEY) {
  console.error("[FATAL] GEMINI_API_KEY が設定されていません");
  process.exit(1);
}

// ========== メイン処理 ==========
async function main() {
  try {
    console.log(`[CRAWLER] ========== クローラー開始 ==========`);

    // 既存データ読み込み
    const existingData = JSON.parse(fs.readFileSync(FACILITIES_PATH, "utf-8"));
    console.log(`[CRAWLER] 既存データ: ${existingData.length} 件`);

    // 既存施設名リスト
    const existingNames = existingData
      .map((f) => f.name.replace(/【.*?】/g, "").trim())
      .join("\n");

    // ランダムに地域選択
    const randomRegion = regions[Math.floor(Math.random() * regions.length)];
    console.log(`[CRAWLER] ターゲット地域: ${randomRegion}`);

    // Gemini API呼び出し
    const genAI = new GoogleGenerativeAI(API_KEY);
    const model = genAI.getGenerativeModel({ model: MODEL_NAME });

    const prompt = `
日本の縄文時代における遺跡・博物館の専門家になってください。
「すでに登録済みの施設リスト」に含まれていない、${randomRegion}地方の重要な縄文時代の遺跡・博物館・考古館を最大3件ピックアップしてください。

【既存リスト（除外）】
${existingNames}

【必須】
- 縄文時代のみ
- 実在する施設
- 日本語で記述

【JSON形式（配列）】
[{
  "id": "001-999の数字",
  "name": "施設名",
  "prefecture": "都道府県",
  "address": "住所",
  "description": "説明（200字程度、詳しく記述）",
  "region": "${randomRegion}",
  "url": "公式URL またはWikipedia",
  "tags": ["tag1", "tag2"],
  "lat": 緯度,
  "lng": 経度,
  "access": {
    "train": "電車アクセス",
    "bus": "バスアクセス",
    "car": "車アクセス",
    "rank": "ランク（S/A/B）"
  },
  "copy": "キャッチコピー"
}]

JSON配列のみ出力。説明や注釈は不要。`;

    console.log(`[CRAWLER] Gemini API にリクエスト...`);

    // リトライロジック（503対策）
    let result;
    let lastError;
    for (let attempt = 1; attempt <= 5; attempt++) {
      try {
        result = await model.generateContent({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 1,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 8192,
          },
          tools: [], // グラウンディング無効
        });
        break; // 成功したらループ抜ける
      } catch (err) {
        lastError = err;
        if (err.message.includes("503") && attempt < 5) {
          const waitTime = 3000 * attempt; // 3s, 6s, 9s, 12s, 15s
          console.log(`[RETRY] 503エラー。${waitTime}ms 待機後にリトライ... (${attempt}/5)`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        } else {
          throw err;
        }
      }
    }

    if (!result) throw lastError;

    const responseText = result.response.text();
    console.log(`[CRAWLER] API レスポンス受信（${responseText.length}文字）`);

    // JSON抽出
    const jsonMatch = responseText.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      console.log("[CRAWLER] ❌ JSON配列が見つかりません");
      console.log(`[RESULT] 既存 ${existingData.length} 件を維持`);
      return;
    }

    let candidates;
    try {
      candidates = JSON.parse(jsonMatch[0]);
    } catch (parseErr) {
      console.log(`[CRAWLER] ❌ JSON パース失敗: ${parseErr.message}`);
      console.log(`[RESULT] 既存 ${existingData.length} 件を維持`);
      return;
    }

    if (!Array.isArray(candidates) || candidates.length === 0) {
      console.log("[CRAWLER] ❌ 有効な候補がありません");
      console.log(`[RESULT] 既存 ${existingData.length} 件を維持`);
      return;
    }

    console.log(`[CRAWLER] ✅ ${candidates.length}件の候補を取得`);

    // 既存データに追加
    let addedCount = 0;
    for (const candidate of candidates) {
      if (addedCount >= 3) break; // 最大3件まで

      // 重複チェック
      const isDuplicate = existingData.some((f) => {
        const existingName = f.name.replace(/【.*?】/g, "").trim();
        return existingName === candidate.name.trim();
      });

      if (isDuplicate) {
        console.log(`[SKIP] 重複: ${candidate.name}`);
        continue;
      }

      // 次のID計算
      const nextId = String(Math.max(...existingData.map((f) => parseInt(f.id) || 0)) + 1).padStart(3, "0");
      candidate.id = nextId;

      // デフォルト値補完
      if (!candidate.access) candidate.access = { train: "なし", bus: "なし", car: "なし", rank: "C" };
      if (!candidate.lat) candidate.lat = 0;
      if (!candidate.lng) candidate.lng = 0;
      if (!candidate.tags) candidate.tags = [];

      existingData.push(candidate);
      addedCount++;
      console.log(`[ADD] ✅ ${candidate.name} (ID: ${candidate.id})`);
    }

    if (addedCount > 0) {
      fs.writeFileSync(FACILITIES_PATH, JSON.stringify(existingData, null, 2), "utf-8");
      console.log(`[RESULT] ${addedCount}件を追加しました。合計: ${existingData.length}件`);

      // イラスト生成
      console.log(`\n[IMAGE] ========== イラスト生成開始 ==========`);
      for (const facility of candidates.slice(0, addedCount)) {
        try {
          await generateFacilityImage(facility.id, facility.name, facility.description);
        } catch (err) {
          console.warn(`[IMAGE] ⚠️ ${facility.name} のイラスト生成失敗: ${err.message}`);
        }
      }
    } else {
      console.log(`[RESULT] 既存 ${existingData.length} 件を維持`);
    }
  } catch (error) {
    console.error("[FATAL] エラー:", error.message);
    process.exit(1);
  }
}

// ========== イラスト生成（Pollinations AI） ==========
async function generateFacilityImage(facilityId, facilityName, description) {
  const imagesDir = path.join(__dirname, '../public/images/facilities');
  if (!fs.existsSync(imagesDir)) {
    fs.mkdirSync(imagesDir, { recursive: true });
  }

  const outputPath = path.join(imagesDir, `${facilityId}_ai.png`);

  // プロンプト生成
  const prompt = `Archaeological site: ${facilityName}. Jomon period Japan. ${description.slice(0, 100)}. Professional photograph, documentary style, historical accuracy.`;

  console.log(`[IMAGE] [${facilityId}] ${facilityName} のイラスト生成中...`);

  try {
    const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=1792&height=1024&nologo=true`;
    const response = await fetch(imageUrl, { timeout: 60000 });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    fs.writeFileSync(outputPath, buffer);

    console.log(`[IMAGE] ✅ [${facilityId}] 生成完了`);
    return `/images/facilities/${facilityId}_ai.png`;
  } catch (error) {
    console.warn(`[IMAGE] ⚠️ [${facilityId}] イラスト生成失敗: ${error.message}`);
    return '';
  }
}

main();
