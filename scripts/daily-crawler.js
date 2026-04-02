const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

/**
 * REST API形式で Google Gemini API (v1beta) + Google Custom Search API
 * 改造版: GitHub Secrets 対応・URL全滅エラー回避仕様
 */

const API_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent";
const API_KEY = process.env.GEMINI_API_KEY20261336;

// ✅ 【最重要】GitHub Secrets から API キーを読み込み
console.log(`\n[INIT_SECRETS] ========== GitHub Secrets 環境変数の確認 ==========`);

console.log(`[INIT_SECRETS] process.env.GoogleSearch_API_KEY: ${process.env.GoogleSearch_API_KEY ? '存在' : '❌ 未設定'}`);
console.log(`[INIT_SECRETS] process.env.GoogleSearch_CX: ${process.env.GoogleSearch_CX ? '存在' : '❌ 未設定'}`);
console.log(`[INIT_SECRETS] process.env.GoogleSearch_SERVICE_ACCOUNT: ${process.env.GoogleSearch_SERVICE_ACCOUNT ? '存在' : '❌ 未設定'}`);
console.log(`[INIT_SECRETS] process.env.GEMINI_API_KEY20261336: ${process.env.GEMINI_API_KEY20261336 ? '存在' : '❌ 未設定'}`);

const GOOGLE_SEARCH_API_KEY = process.env.GoogleSearch_API_KEY;
const GOOGLE_SEARCH_CX = process.env.GoogleSearch_CX;

let GOOGLE_SEARCH_SERVICE_ACCOUNT_JSON = null;
if (process.env.GoogleSearch_SERVICE_ACCOUNT) {
  try {
    let serviceAccountStr = process.env.GoogleSearch_SERVICE_ACCOUNT;
    if (!serviceAccountStr.includes('{')) {
      serviceAccountStr = Buffer.from(serviceAccountStr, 'base64').toString('utf-8');
    }
    GOOGLE_SEARCH_SERVICE_ACCOUNT_JSON = JSON.parse(serviceAccountStr);
    console.log(`[INIT_SECRETS] GoogleSearch_SERVICE_ACCOUNT: ✅ JSON パース成功`);
  } catch (e) {
    console.error(`[INIT_SECRETS] ❌ GoogleSearch_SERVICE_ACCOUNT のパース失敗: ${e.message}`);
  }
}

const GOOGLE_SEARCH_ENDPOINT = "https://www.googleapis.com/customsearch/v1";

if (!API_KEY) {
  console.error("[FATAL] ❌ GEMINI_API_KEY20261336 環境変数が設定されていません");
  process.exit(1);
}

console.log(`[INIT] Gemini API_KEY configured (${API_KEY.length} chars)`);
console.log(`\n[SEARCH_API] ========== Google Custom Search API 検証 ==========`);

if (!GOOGLE_SEARCH_API_KEY || !GOOGLE_SEARCH_CX) {
  console.error(`[SEARCH_API] 🔴 FATAL ERROR: Google検索の設定が不足しています！`);
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
      const data = await response.json();
      console.log(`[SUCCESS] 試行 ${attempt} で成功`);
      return data;
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
  const response = await fetchWithRetry(`${API_ENDPOINT}?key=${API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody)
  });
  return response.candidates[0].content.parts[0].text;
}

async function searchUrlsViaGoogleCustomSearch(facilityName, prefectureName) {
  try {
    const searchQuery = `${facilityName} ${prefectureName} 遺跡 公式`;
    console.log(`\n[SEARCH_API] ========== 🔴 Google Custom Search API 実行 ==========`);
    const params = new URLSearchParams({ key: GOOGLE_SEARCH_API_KEY, cx: GOOGLE_SEARCH_CX, q: searchQuery, num: 10 });
    const response = await fetch(`${GOOGLE_SEARCH_ENDPOINT}?${params}`);
    if (!response.ok) return [];
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

async function validateUrlWithContent(url, facilityName, address) {
  const pageResult = await fetchPageContent(url);
  if (!pageResult.success) return { valid: false };
  const text = pageResult.content.toLowerCase();
  const cleanName = facilityName.replace(/国指定史跡|史跡/g, '').trim().toLowerCase();
  
  if (text.includes(cleanName) || text.includes('縄文') || text.includes('遺跡')) {
    console.log(`[CONTENT_VERIFIED] ✅ ${url}`);
    return { valid: true, score: 100 };
  }
  return { valid: false };
}

async function validateCandidateUrls(candidateUrls, facilityName, address, prefecture) {
  console.log(`[PRIORITY_FLOW] 🔴 フェーズ1: Google Custom Search API を絶対最優先`);
  const googleSearchUrls = await searchUrlsViaGoogleCustomSearch(facilityName, prefecture);
  for (const url of googleSearchUrls) {
    const result = await validateUrlWithContent(url, facilityName, address);
    if (result.valid) return { valid: true, url: url, source: 'Google Search API' };
  }

  console.log(`[PRIORITY_FLOW] フェーズ2: Gemini 候補 URL を検証`);
  for (const url of candidateUrls) {
    const result = await validateUrlWithContent(url, facilityName, address);
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

async function generateFacilityImage(facilityId, facilityName, description) {
  const imagesDir = path.join(__dirname, '../public/images/facilities');
  if (!fs.existsSync(imagesDir)) fs.mkdirSync(imagesDir, { recursive: true });
  const outputPath = path.join(imagesDir, `${facilityId}_ai.png`);
  await new Promise(r => setTimeout(r, 10000));
  try {
    const requestBody = { instances: [{ prompt: `縄文時代の遺跡「${facilityName}」の学術的イラスト` }], parameters: { sampleCount: 1, aspectRatio: "1:1", outputMimeType: "image/png" } };
    const response = await fetchWithRetry(`https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-generate-001:predict?key=${API_KEY}`, { method: 'POST', body: JSON.stringify(requestBody) });
    if (response.predictions?.[0]?.bytesBase64Encoded) {
      fs.writeFileSync(outputPath, Buffer.from(response.predictions[0].bytesBase64Encoded, 'base64'));
      await resizeImageToSquare(outputPath);
      return `/images/facilities/${facilityId}_ai.png`;
    }
    return '';
  } catch (e) { return ''; }
}

async function main() {
  const filePath = path.join(__dirname, '../app/data/facilities.json');
  let existingData = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  const regions = ['北海道', '東北', '関東', '中部', '近畿', '中国', '四国', '九州'];
  const randomRegion = regions[Math.floor(Math.random() * regions.length)];

  console.log(`[CRAWLER] ターゲット: ${randomRegion}`);
  const prompt = `縄文遺跡を3件JSONで提案して。地方:${randomRegion}。既存:${existingData.map(f=>f.name).join(',')}`;
  
  try {
    const responseText = await callGeminiAPI(prompt);
    const candidates = JSON.parse(responseText.substring(responseText.indexOf('['), responseText.lastIndexOf(']') + 1));
    
    for (const candidate of candidates) {
      const urlValidation = await validateCandidateUrls(candidate.candidates || [candidate.url], candidate.name, candidate.address, candidate.prefecture);
      if (urlValidation.valid) {
        candidate.url = urlValidation.url;
        candidate.id = String(existingData.length + 1).padStart(3, '0');
        candidate.thumbnail = await generateFacilityImage(candidate.id, candidate.name, candidate.description);
        existingData.push(candidate);
        fs.writeFileSync(filePath, JSON.stringify(existingData, null, 2), 'utf-8');
        console.log(`[ADDED] ✅ ${candidate.name}`);
        break; 
      }
    }
  } catch (e) { console.error(e); }
}

main().catch(e => { console.error(e); process.exit(1); });
