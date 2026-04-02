const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

/**
 * Jomon Portal クローラー (リクさん専用・Secrets名完全一致版)
 * 2026/04/02 最終修正
 */

const API_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent";

// ✅ 【最重要】リクさんの GitHub Secrets 名（アンダースコアなし）に完全に合わせました
const GEMINI_API_KEY = process.env.GEMINI_API_KEY20261336; 
const GOOGLE_API_KEY = process.env.GOOGLESEARCH_SERVICE_ACCOUNT; // ここにAPIキーが入っている前提
const GOOGLE_CX = process.env.GOOGLESEARCH_CX;

console.log(`\n[INIT_SECRETS] ========== GitHub Secrets 環境変数の確認 ==========`);
// リクさんの登録名を表示し、その中身をチェックします
console.log(`[INIT_SECRETS] GOOGLESEARCH_SERVICE_ACCOUNT: ${GOOGLE_API_KEY ? '✅ 存在' : '❌ 未設定'}`);
console.log(`[INIT_SECRETS] GOOGLESEARCH_CX: ${GOOGLE_CX ? '✅ 存在' : '❌ 未設定'}`);
console.log(`[INIT_SECRETS] GEMINI_API_KEY20261336: ${GEMINI_API_KEY ? '✅ 存在' : '❌ 未設定'}`);

const GOOGLE_SEARCH_ENDPOINT = "https://www.googleapis.com/customsearch/v1";

// 🔴 起動前チェック
if (!GOOGLE_API_KEY || !GOOGLE_CX) {
  console.error(`\n[SEARCH_API] 🔴 FATAL ERROR: Google検索の設定が不足しています！`);
  console.error(`[SEARCH_API] Secretsの名前をリクさんの設定通り 'GOOGLESEARCH_SERVICE_ACCOUNT' と 'GOOGLESEARCH_CX' で探していますが見つかりません。`);
  process.exit(1); 
}

console.log(`[SEARCH_API] ✅ Google検索APIは有効です（最優先で使用）\n`);

// --- 以降、Google検索を実行する関数の引数などもこれに合わせて修正 ---

async function searchUrlsViaGoogleCustomSearch(facilityName, prefectureName) {
  try {
    const searchQuery = `${facilityName} ${prefectureName} 縄文 遺跡 公式`;
    console.log(`\n[SEARCH_API] ========== 🔴 Google検索実行 ==========`);
    // 変数名をリクさんの設定（GOOGLE_API_KEY / GOOGLE_CX）に変更済み
    const params = new URLSearchParams({ key: GOOGLE_API_KEY, cx: GOOGLE_CX, q: searchQuery, num: 10 });
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

// ... (以下、validateCandidateUrls や main 関数などは前の統合版と同じロジック)
