#!/usr/bin/env node

const API_KEY = process.env.GEMINI_API_KEY20261336 || process.env.GEMINI_API_KEY;

if (!API_KEY) {
  console.error('[ERROR] API_KEY が設定されていません');
  process.exit(1);
}

// 複数のエンドポイントをテスト（最新モデルを優先）
const endpoints = [
  // ✅ 最新・推奨
  {
    name: "v1beta/models/gemini-2.5-flash",
    url: "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent"
  },
  {
    name: "v1beta/models/gemini-2.0-flash-lite",
    url: "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent"
  },
  // 代替案
  {
    name: "v1beta/models/gemini-2.0-flash",
    url: "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent"
  },
  {
    name: "v1beta/models/gemini-1.5-pro",
    url: "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent"
  }
];

const minimalBody = {
  contents: [{
    parts: [{
      text: "Say OK"
    }]
  }],
  generationConfig: {
    maxOutputTokens: 10
  }
};

(async () => {
  console.log('[TEST] 最小構成でGemini API をテスト中...\n');

  for (const endpoint of endpoints) {
    console.log(`\n[TEST] テスト: ${endpoint.name}`);
    console.log(`URL: ${endpoint.url}?key=***`);

    try {
      const response = await fetch(`${endpoint.url}?key=${API_KEY}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(minimalBody),
        timeout: 15000
      });

      console.log(`[RESULT] HTTP ${response.status}`);

      if (response.status === 200) {
        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '(no text)';
        console.log(`✅ SUCCESS! レスポンス: ${text}`);
        console.log(`\n[VERDICT] 正しいエンドポイント: ${endpoint.name}`);
        process.exit(0);
      } else if (response.status === 404) {
        console.log(`❌ 404 Not Found - モデル名またはエンドポイントが間違っている`);
      } else if (response.status === 401) {
        console.log(`❌ 401 Unauthorized - API キーが無効`);
      } else {
        const errorText = await response.text();
        console.log(`❌ ${response.status} - ${errorText.substring(0, 100)}`);
      }
    } catch (error) {
      console.log(`❌ エラー: ${error.message}`);
    }
  }

  console.log('\n[ERROR] どのエンドポイントも成功しませんでした');
  process.exit(1);
})();
