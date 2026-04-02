const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

/**
 * Jomon Portal クローラー完全版 (2026/04/02 最終修正)
 * - GitHub Secrets (全部大文字) 対応
 * - Google Custom Search API 最優先ロジック
 * - 404自動修復機能搭載
 */

const API_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent";
const GEMINI_API_KEY = process.env.GEMINI_API_KEY20261336;

// ✅ 【最重要】GitHub Secrets から「全部大文字」で読み込み
const GOOGLE_SEARCH_API_KEY = process.env.GOOGLE_SEARCH_API_KEY;
const GOOGLE_SEARCH_CX = process.env.GOOGLE_SEARCH_CX;

console.log(`\n[INIT_SECRETS] ========== GitHub Secrets 環境変数の確認 ==========`);
console.log(`[INIT_SECRETS] GOOGLE_SEARCH_API_KEY: ${GOOGLE_SEARCH_API_KEY ? '✅ 存在' : '❌ 未設定'}`);
console.log(`[INIT_SECRETS] GOOGLE_SEARCH_CX: ${GOOGLE_SEARCH_CX ? '✅ 存在' : '❌ 未設定'}`);
console.log(`[INIT_SECRETS] GEMINI_API_KEY20261336: ${GEMINI_API_KEY ? '✅ 存在' : '❌ 未設定'}`);

const GOOGLE_SEARCH_ENDPOINT = "https://www.googleapis.com/customsearch/v1";

// 🔴 起動前チェック：Google検索設定がない場合は即座にエラーで止める
if (!GOOGLE_SEARCH_API_KEY || !GOOGLE_SEARCH_CX) {
  console.error(`\n[SEARCH_API] 🔴 FATAL ERROR: Google検索の設定が不足しています！`);
  console.error(`[SEARCH_API] GitHub Secrets の名前を 'GOOGLE_SEARCH_API_KEY' と 'GOOGLE_SEARCH_CX' にしてください。`);
  process.exit(1); 
}

console.log(`[SEARCH_API] ✅ Google Custom Search API は有効です（最優先で使用）\n`);

async function fetchWithRetry(url, options, maxRetries = 5) {
  let lastError;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[ATTEMPT ${attempt}/${maxRetries}] API呼び出し開始...`);
      const response = await fetch(url, options);
      if (!response.ok) {
        const errorText = await response.text();
        if ([400, 401, 403, 404].includes(response.status)) throw new Error(`[PERMANENT] HTTP ${response.status}`);
        throw new Error(`[TEMPORARY] HTTP ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      lastError = error;
      if (error.message.includes('[PERMANENT]')) throw error;
      if (attempt < maxRetries) await new Promise(r => setTimeout(r, 2000 * Math.pow(2, attempt - 1)));
    }
  }
  throw lastError;
}

async function callGeminiAPI(prompt) {
  const requestBody = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { temperature: 1, topK: 40, topP: 0.95, maxOutputTokens: 8192 }
  };
  const response = await fetchWithRetry(`${API_ENDPOINT}?key=${GEMINI_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody)
  });
  return response.candidates[0].content.parts[0].text;
}

async function searchUrlsViaGoogleCustomSearch(facilityName, prefectureName) {
  try {
    const searchQuery = `${facilityName} ${prefectureName} 縄文 遺跡 公式`;
    console.log(`\n[SEARCH_API] ========== 🔴 Google Custom Search API 実行 ==========`);
    console.log(`[SEARCH_API] 検索ワード: "${searchQuery}"`);
    const params = new URLSearchParams({ key: GOOGLE_SEARCH_API_KEY, cx: GOOGLE_SEARCH_CX, q: searchQuery, num: 10 });
    const response = await fetch(`${GOOGLE_SEARCH_ENDPOINT}?${params}`);
    if (!response.ok) {
        console.error(`[SEARCH_API] APIエラー: ${response.status}`);
        return [];
    }
    const data = await response.json();
    if (!data.items) return [];
    
    return data.items.map(item => item.link).sort((a, b) => {
      if (a.includes('.lg.jp') && !b.includes('.lg.jp')) return -1;
      if (!a.includes('.lg.jp') && b.includes('.lg.jp')) return 1;
      return 0;
    });
  } catch (error) {
    console.error(`[SEARCH_API] ❌ エラー: ${error.message}`);
    return [];
  }
}

async function fetchPageContent(url) {
  try {
    const res = await fetch(url, { method: 'GET', headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(10000) });
    if (res.ok) return { success: true, content: await res.text(), statusCode: res.status };
    return { success: false, content: '', statusCode: res.status };
  } catch (e) {
    return { success: false, content: '', statusCode: 0 };
  }
}

async function validateUrlWithContent(url, facilityName) {
  const pageResult = await fetchPageContent(url);
  if (!pageResult.success) return { valid: false };
  const text = pageResult.content.toLowerCase();
  const cleanName = facilityName.replace(/国指定史跡|史跡/g, '').trim().toLowerCase();
  
  if (text.includes(cleanName) || text.includes('縄文') || text.includes('遺跡')) {
    console.log(`[CONTENT_VERIFIED] ✅ ${url} は信頼できるページです`);
    return { valid: true };
  }
  return { valid: false };
}

async function validateCandidateUrls(geminiUrls, facilityName, prefecture) {
  console.log(`[PRIORITY_FLOW] 🚀 ${facilityName} の検証開始`);

  // フェーズ1: Google検索 (絶対最優先)
  const googleSearchUrls = await searchUrlsViaGoogleCustomSearch(facilityName, prefecture);
  for (const url of googleSearchUrls) {
    const result = await validateUrlWithContent(url, facilityName);
    if (result.valid) return { valid: true, url: url, source: 'Google Search API' };
  }

  // フェーズ2: Geminiが提案したURL
  console.log(`[PRIORITY_FLOW] フェーズ2: Gemini 候補 URL を検証`);
  for (const url of geminiUrls) {
    const result = await validateUrlWithContent(url, facilityName);
    if (result.valid) return { valid: true, url: url, source: 'Gemini' };
  }

  return { valid: false };
}

async function resizeImageToSquare(imagePath) {
  try {
    const metadata = await sharp(imagePath).metadata();
    const size = Math.min(metadata.width, metadata.height);
    const tempPath = imagePath + '.tmp';
    await sharp(imagePath)
      .extract({ left: Math.floor((metadata.width - size) / 2), top: Math.floor((metadata.height - size) / 2), width: size, height: size })
      .resize(512, 512).toFile(tempPath);
    fs.renameSync(tempPath, imagePath);
    return true;
  } catch (e) { return false; }
}

async function generateFacilityImage(facilityId, facilityName) {
  const imagesDir = path.join(__dirname, '../public/images/facilities');
  if (!fs.existsSync(imagesDir)) fs.mkdirSync(imagesDir, { recursive: true });
  const outputPath = path.join(imagesDir, `${facilityId}_ai.png`);
  
  console.log(`[IMAGE] 生成中... (10秒待機)`);
  await new Promise(r => setTimeout(r, 10000));
  
  try {
    const requestBody = { instances: [{ prompt: `縄文時代の遺跡「${facilityName}」の学術的な復元イラスト、高品質、教育的` }], parameters: { sampleCount: 1, aspectRatio: "1:1", outputMimeType: "image/png" } };
    const response = await fetchWithRetry(`https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-generate-001:predict?key=${GEMINI_API_KEY}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(requestBody) });
    
    if (response.predictions?.[0]?.bytesBase64Encoded) {
      fs.writeFileSync(outputPath, Buffer.from(response.predictions[0].bytesBase64Encoded, 'base64'));
      await resizeImageToSquare(outputPath);
      return `/images/facilities/${facilityId}_ai.png`;
    }
    return '';
  } catch (e) { console.error(`[IMAGE_ERROR] ${e.message}`); return ''; }
}

async function main() {
  const filePath = path.join(__dirname, '../app/data/facilities.json');
  let existingData = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  
  const regions = ['北海道', '東北', '関東', '中部', '近畿', '中国', '四国', '九州'];
  const region = regions[Math.floor(Math.random() * regions.length)];

  console.log(`[CRAWLER] ターゲット地方: ${region}`);
  const prompt = `縄文時代の重要な遺跡・博物館を3件JSON形式で提案してください。地方: ${region}。既存リスト: ${existingData.map(f=>f.name).slice(-10).join(', ')}。
  出力は [{ "name": "...", "prefecture": "...", "address": "...", "description": "...", "url": "...", "candidates": ["...", "..."], "tags": ["..."] }] の配列のみにしてください。`;
  
  try {
    const responseText = await callGeminiAPI(prompt);
    const jsonStart = responseText.indexOf('[');
    const jsonEnd = responseText.lastIndexOf(']') + 1;
    const candidates = JSON.parse(responseText.substring(jsonStart, jsonEnd));
    
    for (const candidate of candidates) {
      console.log(`\n[PROCESS] ${candidate.name} を処理中...`);
      const urlResult = await validateCandidateUrls(candidate.candidates || [candidate.url], candidate.name, candidate.prefecture);
      
      if (urlResult.valid) {
        candidate.url = urlResult.url;
        candidate.id = String(existingData.length + 1).padStart(3, '0');
        candidate.thumbnail = await generateFacilityImage(candidate.id, candidate.name);
        
        // 不要なフィールドを整理して保存
        delete candidate.candidates;
        candidate.region = region; 
        
        existingData.push(candidate);
        fs.writeFileSync(filePath, JSON.stringify(existingData, null, 2), 'utf-8');
        console.log(`[ADDED] ✅ ${candidate.id}: ${candidate.name} を追加しました！`);
        break; // 1回の実行につき1件追加
      }
    }
  } catch (e) { console.error(`[CRAWLER_ERROR] ${e.message}`); }
}

main().catch(e => { console.error(e); process.exit(1); });
