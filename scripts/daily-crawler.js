#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { GoogleGenerativeAI } = require("@google/generative-ai");

/**
 * Gemini レスポンスから JSON を抽出・パース
 * マークダウンフェンス、トランケーション、制御文字に対応
 */
function extractAndParseJSON(responseText, context = '', prefix = '[CRAWLER]') {
  // マークダウンフェンスを削除（```json ... ``` または ``` ... ```）
  let cleaned = responseText.replace(/```(?:json)?\s*/g, '').replace(/```\s*$/g, '');

  // 制御文字を削除
  cleaned = cleaned.replace(/[\x00-\x1F\x7F]/g, ' ');

  // JSON 配列を抽出（トランケーション対応）
  let jsonMatch = cleaned.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    console.warn(`${prefix} JSON not found in response (context: ${context})`);
    return '[]';
  }

  let jsonText = jsonMatch[0];

  // トランケートされた JSON の修復試行
  try {
    // まず素のまま parse を試みる
    JSON.parse(jsonText);
    return jsonText;
  } catch (e) {
    // parse 失敗時の修復処理
    console.warn(`${prefix} First JSON parse failed, attempting repair (context: ${context}): ${e.message}`);

    // 最後が不完全な場合は補完
    let depth = 0;
    let inString = false;
    let escapeNext = false;

    for (let i = 0; i < jsonText.length; i++) {
      const char = jsonText[i];

      if (escapeNext) {
        escapeNext = false;
        continue;
      }

      if (char === '\\') {
        escapeNext = true;
        continue;
      }

      if (char === '"' && !escapeNext) {
        inString = !inString;
      }

      if (!inString) {
        if (char === '[' || char === '{') {
          depth++;
        } else if (char === ']' || char === '}') {
          depth--;
        }
      }
    }

    // 開きブラケットが閉じられていない場合は補完
    while (depth > 0) {
      jsonText += ']';
      depth--;
    }

    // 修復後の parse を試みる
    try {
      JSON.parse(jsonText);
      console.log(`${prefix} JSON repair successful (context: ${context})`);
      return jsonText;
    } catch (repairErr) {
      console.warn(`${prefix} JSON repair failed: ${repairErr.message} (context: ${context})`);
      return '[]';
    }
  }
}

// ========== 設定 ==========
const API_KEY = process.env.GEMINI_API_KEY20261336;
const MODEL_NAME = "gemini-flash-latest";  // 最新版フラッシュモデル
const FACILITIES_PATH = path.join(__dirname, "../app/data/facilities.json");

// ========== 許可されたタグ（ホワイトリスト） ==========
const ALLOWED_TAGS = [
  '世界遺産',
  '国宝',
  '環状列石',
  '貝塚',
  '土偶',
  '土器',
  '遺跡公園',
  '体験',
  '博物館'
];

// ========== 地域リスト ==========
const regions = ["北海道", "東北", "関東", "中部", "近畿", "中国・四国", "九州・沖縄"];

// 地域マッピング（日本語 → 英語キー）
const regionMapping = {
  "北海道": "Hokkaido",
  "東北": "Tohoku",
  "関東": "Kanto",
  "中部": "Chubu",
  "近畿": "Kinki",
  "中国・四国": "ChugokuShikoku",
  "九州・沖縄": "KyushuOkinawa"
};

// ========== 初期化 ==========
console.log(`\n[INIT] ========== Jomon Portal Crawler v6.0 (シンプル版) ==========`);
console.log(`[INIT] GEMINI_API_KEY: ${API_KEY ? "✅" : "❌"}`);
console.log(`[INIT] モデル: ${MODEL_NAME}`);
console.log(`[INIT] ✅ 初期化完了\n`);

if (!API_KEY) {
  console.error("[FATAL] GEMINI_API_KEY が設定されていません");
  process.exit(1);
}

// ========== Copy自動生成関数 ==========
async function generateCopy(description, model) {
  try {
    const prompt = `以下の遺跡説明文から、14文字以下の意味のあるキャッチコピーを日本語で生成してください。

【要件】
- 14文字以内（句読点を含む）
- 説明文の最も重要な特徴を表現
- 日本語として成立する文章
- 断ち切られた形にならないこと

【返却形式】
{"copy": "キャッチコピー"}

【説明文】
${description}`;

    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 512,  // copy が長く応答する場合に対応
      },
    });

    const responseText = result.response.text();

    // JSON オブジェクトを抽出（{...}形式）
    let jsonText = responseText.replace(/```(?:json)?\s*/g, '').replace(/```\s*$/g, '');
    jsonText = jsonText.replace(/[\x00-\x1F\x7F]/g, ' ');

    let jsonMatch = jsonText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.warn(`[COPY] JSON object not found in response`);
      return null;
    }

    try {
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed.copy && typeof parsed.copy === 'string') {
        const copy = parsed.copy.substring(0, 14); // 念のため14文字でトリム
        console.log(`[COPY] 生成: "${copy}" (${copy.length}字)`);
        return copy;
      } else {
        console.warn(`[COPY] 'copy' field not found or invalid type`);
      }
    } catch (parseErr) {
      console.warn(`[COPY] JSON parse failed: ${parseErr.message}`);
    }
  } catch (err) {
    console.warn(`[COPY] 生成失敗: ${err.message}`);
  }

  return null; // 生成失敗時は null
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
    const englishRegion = regionMapping[randomRegion];
    console.log(`[CRAWLER] ターゲット地域: ${randomRegion} (${englishRegion})`);

    // Gemini API呼び出し
    const genAI = new GoogleGenerativeAI(API_KEY);
    const model = genAI.getGenerativeModel({ model: MODEL_NAME });

    const prompt = `
日本の縄文時代における遺跡・博物館の専門家になってください。
「すでに登録済みの施設リスト」に含まれていない、${randomRegion}地方の重要な縄文時代の遺跡・博物館・考古館を1件のみピックアップしてください。

【既存リスト（除外）】
${existingNames}

【必須】
- 縄文時代のみ
- 実在する施設
- 日本語で記述

【タグ（必ず以下から選択してください。最大2個）】
- 世界遺産: 北海道・北東北縄文遺跡群の構成資産
- 国宝: 国宝指定の遺物を展示する施設
- 環状列石: 環状列石・配石遺跡
- 貝塚: 貝塚遺跡・貝塚出土品主軸の施設
- 土偶: 土偶展示が主要な施設
- 土器: 特徴的な土器を主軸展示する施設
- 遺跡公園: 復元集落・野外展示・公園整備施設
- 体験: 体験学習・ワークショップが主要な施設
- 博物館: 遺物展示を主目的とする常設展示施設

【JSON形式（配列）】
[{
  "id": "001-999の数字",
  "name": "施設名",
  "prefecture": "都道府県",
  "address": "住所",
  "description": "説明（200字程度、詳しく記述）",
  "region": "${englishRegion}",
  "url": "公式URL またはWikipedia",
  "tags": ["世界遺産", "博物館"],
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

    // JSON抽出・パース（堅牢化版）
    const jsonText = extractAndParseJSON(responseText, 'facility-data', '[CRAWLER]');

    let candidates;
    try {
      candidates = JSON.parse(jsonText);
      if (!Array.isArray(candidates)) {
        console.log("[CRAWLER] ❌ JSON is not an array");
        console.log(`[RESULT] 既存 ${existingData.length} 件を維持`);
        return;
      }
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

    // region を英語に統一
    for (const candidate of candidates) {
      if (candidate.region && regionMapping[candidate.region]) {
        candidate.region = regionMapping[candidate.region];
      } else if (!candidate.region) {
        // region がない場合は、現在選択されている地域を使用
        candidate.region = englishRegion;
      }
      // copy が14文字を超える場合はトリム
      if (candidate.copy && candidate.copy.length > 14) {
        candidate.copy = candidate.copy.substring(0, 14);
      }
    }

    console.log(`[CRAWLER] ✅ ${candidates.length}件の候補を取得`);

    // 既存データに追加
    let addedCount = 0;
    for (const candidate of candidates) {
      if (addedCount >= 1) break; // 1件のみ追加

      // 重複チェック
      const isDuplicate = existingData.some((f) => {
        const existingName = f.name.replace(/【.*?】/g, "").trim();
        return existingName === candidate.name.trim();
      });

      if (isDuplicate) {
        console.log(`[SKIP] 重複: ${candidate.name}`);
        continue;
      }

      // タグバリデーション（ホワイトリスト確認）
      if (!Array.isArray(candidate.tags) || candidate.tags.length === 0) {
        console.log(`[SKIP] タグなし: ${candidate.name}`);
        continue;
      }

      const validTags = candidate.tags.filter(tag => ALLOWED_TAGS.includes(tag)).slice(0, 2);
      if (validTags.length === 0) {
        console.log(`[SKIP] 無効なタグ: ${candidate.name} (${candidate.tags.join(', ')})`);
        continue;
      }

      candidate.tags = validTags;
      if (validTags.length < candidate.tags.length) {
        console.log(`[WARN] 無効なタグを削除: ${candidate.name}`);
      }

      // 次のID計算
      const nextId = String(Math.max(...existingData.map((f) => parseInt(f.id) || 0)) + 1).padStart(3, "0");
      candidate.id = nextId;

      // デフォルト値補完
      if (!candidate.access) candidate.access = { train: "なし", bus: "なし", car: "なし", rank: "C" };
      if (!candidate.lat) candidate.lat = 0;
      if (!candidate.lng) candidate.lng = 0;
      if (!candidate.tags) candidate.tags = [];

      // Copy自動生成（ない場合またはバリデーション失敗時）
      if (!candidate.copy || candidate.copy.length > 14 || !candidate.copy.trim()) {
        console.log(`[COPY] ${candidate.name} の copy を自動生成中...`);
        const generatedCopy = await generateCopy(candidate.description, model);
        if (generatedCopy) {
          candidate.copy = generatedCopy;
        } else {
          // 生成失敗時のフォールバック（説明の最初の14文字）
          candidate.copy = candidate.description.substring(0, 14);
          console.log(`[COPY] フォールバック: "${candidate.copy}"`);
        }
      }

      existingData.push(candidate);
      addedCount++;
      console.log(`[ADD] ✅ ${candidate.name} (ID: ${candidate.id}, copy: "${candidate.copy}")`);
    }

    if (addedCount > 0) {
      fs.writeFileSync(FACILITIES_PATH, JSON.stringify(existingData, null, 2), "utf-8");
      console.log(`[RESULT] ${addedCount}件を追加しました。合計: ${existingData.length}件`);

      // イラスト生成
      console.log(`\n[IMAGE] ========== イラスト生成開始 ==========`);
      for (const facility of candidates.slice(0, addedCount)) {
        try {
          const imageUrl = await generateFacilityImage(facility.id, facility.name, facility.description);
          // existingData 内の該当施設に thumbnail を設定
          const facilityInData = existingData.find(f => f.id === facility.id);
          if (facilityInData && imageUrl) {
            facilityInData.thumbnail = imageUrl;
          }
        } catch (err) {
          console.warn(`[IMAGE] ⚠️ ${facility.name} のイラスト生成失敗: ${err.message}`);
        }
      }
      // 更新を保存（イラスト生成完了後の最終保存）
      fs.writeFileSync(FACILITIES_PATH, JSON.stringify(existingData, null, 2), "utf-8");

      // イラスト生成完了後、まとめてGitコマンドでコミット＆プッシュ
      console.log(`\n[GIT] ========== Git操作開始 ==========`);
      try {
        const { exec } = require('child_process');
        const util = require('util');
        const execPromise = util.promisify(exec);

        // Git 設定が未設定の場合は初期化（GitHub Actions環境対応）
        try {
          await execPromise('git config user.email');
        } catch {
          console.log('[GIT] Setting git user config...');
          await execPromise('git config user.email "action@github.com"');
          await execPromise('git config user.name "GitHub Action"');
        }

        // コミットメッセージ（[skip ci]を付与して不要なビルドをスキップ）
        const skipCi = process.env.SKIP_CI === 'true' ? ' [skip ci]' : '';
        const commitMessage = `chore(crawler): add ${candidates[0].name} [${candidates[0].region}] ${skipCi}`.trim();

        // facilities.json をステージング
        console.log('[GIT] Staging facilities.json...');
        await execPromise('git add app/data/facilities.json public/facilities.json');

        // 変更があるかチェック
        const { stdout: diffOutput } = await execPromise('git diff --cached --quiet app/data/facilities.json public/facilities.json', { timeout: 5000 }).catch(() => ({ stdout: '' }));

        // コミット実行
        console.log('[GIT] Committing changes...');
        await execPromise(`git commit -m "${commitMessage}"`);

        // プッシュ実行（リベースで競合対応）
        console.log('[GIT] Pushing to GitHub...');
        await execPromise('git pull --rebase --autostash origin main');
        await execPromise('git push origin main');

        console.log('[GIT] ✅ Successfully committed and pushed to GitHub');
      } catch (gitErr) {
        // git push 失敗時もスクリプト失敗とはしない（ローカル変更は保持）
        console.warn('[GIT] ⚠️ Git operation failed:', gitErr.message);
        console.log('[GIT] Facilities data was saved locally. Manual push may be needed.');
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

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=1792&height=1024&nologo=true`;
      console.log(`[IMAGE] [${facilityId}] URL: ${imageUrl.slice(0, 80)}...`);

      const response = await fetch(imageUrl, { timeout: 60000 });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      if (buffer.length === 0) {
        throw new Error('Empty response');
      }

      fs.writeFileSync(outputPath, buffer);

      console.log(`[IMAGE] ✅ [${facilityId}] 生成完了 (${buffer.length} bytes)`);
      return `/images/facilities/${facilityId}_ai.png`;
    } catch (error) {
      if (attempt < 3) {
        console.warn(`[IMAGE] ⚠️ [${facilityId}] 試行${attempt}失敗: ${error.message}. リトライします...`);
        await new Promise(r => setTimeout(r, 5000 * attempt));
      } else {
        console.warn(`[IMAGE] ❌ [${facilityId}] イラスト生成失敗 (${attempt}回試行): ${error.message}`);
      }
    }
  }
  return '';
}

main();
