// --- 1. 初期化と環境変数の強制チェック ---
const GOOGLE_SEARCH_API_KEY = process.env.GoogleSearch_API_KEY || process.env.GOOGLE_SEARCH_API_KEY;
const GOOGLE_SEARCH_CX = process.env.GoogleSearch_CX || process.env.GOOGLE_SEARCH_CX;

console.log(`\n[INIT_SECRETS] ========== GitHub Secrets 環境変数の確認 ==========`);
if (!GOOGLE_SEARCH_API_KEY || !GOOGLE_SEARCH_CX) {
  console.error(`[SEARCH_API] 🔴 FATAL ERROR: Google検索の設定（API_KEY または CX）が空です！`);
  console.error(`[SEARCH_API] GitHub Secrets の名前が一文字でも違うと読み込めません。`);
  process.exit(1); // 起動させない（古い機能に逃げ込ませない）
}
console.log(`[SEARCH_API] ✅ Google Custom Search API は有効です（最優先で使用）`);

// --- 2. Google検索を実行する関数 ---
async function searchUrlsViaGoogleCustomSearch(facilityName, prefecture) {
  console.log(`[SEARCH_API] ========== 🔴 Google Custom Search API 実行 ==========`);
  const query = `"${facilityName}" ${prefecture} 縄文 遺跡 公式サイト`;
  const url = `https://www.googleapis.com/customsearch/v1?key=${GOOGLE_SEARCH_API_KEY}&cx=${GOOGLE_SEARCH_CX}&q=${encodeURIComponent(query)}`;

  try {
    const response = await fetch(url);
    const data = await response.json();
    
    if (!data.items) return [];

    // .lg.jp（自治体）を最優先にする並び替え
    return data.items.map(item => item.link).sort((a, b) => {
      if (a.includes('.lg.jp') && !b.includes('.lg.jp')) return -1;
      if (!a.includes('.lg.jp') && b.includes('.lg.jp')) return 1;
      return 0;
    });
  } catch (error) {
    console.error(`[SEARCH_API] ❌ 検索エラー: ${error.message}`);
    return [];
  }
}

// --- 3. URL検証の優先順位を入れ替えたメイン関数 ---
async function validateCandidateUrls(facilityName, prefecture, initialUrls) {
  console.log(`[PRIORITY_FLOW] 🚀 ${facilityName} のURL検証を開始`);

  // 【フェーズ1】Google検索を「絶対最優先」で実行
  const googleUrls = await searchUrlsViaGoogleCustomSearch(facilityName, prefecture);
  for (const url of googleUrls) {
    const result = await verifyUrl(url, facilityName);
    if (result.isValid) return { isValid: true, url: url };
  }

  // 【フェーズ2】Geminiが持っていた古いURL（404の可能性あり）を検証
  for (const url of initialUrls) {
    const result = await verifyUrl(url, facilityName);
    if (result.isValid) return { isValid: true, url: url };
  }

  return { isValid: false };
}
