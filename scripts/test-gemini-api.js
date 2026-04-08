#!/usr/bin/env node

const API_KEY = process.env.GEMINI_API_KEY20261336 || process.env.GEMINI_API_KEY;

console.log(`[TEST] API_KEY20261336: ${process.env.GEMINI_API_KEY20261336 ? '✅ 設定済み' : '❌ 未設定'}`);
console.log(`[TEST] API_KEY: ${process.env.GEMINI_API_KEY ? '✅ 設定済み' : '❌ 未設定'}`);
console.log(`[TEST] 使用するキー: ${API_KEY ? '✅ 有効' : '❌ 未設定'}`);

if (!API_KEY) {
  console.error('[ERROR] どちらのGemini APIキーも設定されていません');
  process.exit(1);
}

const API_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent";

(async () => {
  console.log('\n[TEST] Gemini API への簡単なリクエストをテスト中...');

  try {
    const response = await fetch(
      `${API_ENDPOINT}?key=${API_KEY}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: "Say 'OK'" }]
          }],
          generationConfig: {
            maxOutputTokens: 10
          }
        }),
        timeout: 30000
      }
    );

    console.log(`[TEST] HTTP Status: ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[TEST] エラーレスポンス: ${errorText}`);

      if (response.status === 401) {
        console.error('[ERROR] ❌ API キーが無効です。有効期限切れか誤った形式の可能性があります。');
      } else if (response.status === 429) {
        console.error('[ERROR] ❌ レート制限に達しています。しばらく待機してから再試行してください。');
      } else if (response.status === 503) {
        console.error('[ERROR] ❌ Gemini API がダウンしています（503 Service Unavailable）');
      }

      process.exit(1);
    }

    const data = await response.json();
    console.log('[TEST] ✅ API リクエスト成功！');
    console.log('[TEST] レスポンス:', JSON.stringify(data.candidates?.[0]?.content?.parts?.[0]?.text).substring(0, 100));

  } catch (error) {
    console.error(`[ERROR] リクエスト失敗: ${error.message}`);
    process.exit(1);
  }
})();
