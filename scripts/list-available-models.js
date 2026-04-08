#!/usr/bin/env node

const API_KEY = process.env.GEMINI_API_KEY20261336 || process.env.GEMINI_API_KEY;

if (!API_KEY) {
  console.error('[ERROR] API_KEY が設定されていません');
  process.exit(1);
}

(async () => {
  console.log('[MODELS] Google Gemini API で利用可能なモデル一覧を取得中...\n');

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${API_KEY}`,
      { method: 'GET' }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[ERROR] HTTP ${response.status}`);
      console.error(`[ERROR] レスポンス: ${errorText}`);
      process.exit(1);
    }

    const data = await response.json();
    const models = data.models || [];

    console.log(`[MODELS] 利用可能なモデル: ${models.length}件\n`);

    models.forEach((model, index) => {
      const name = model.name.split('/').pop();  // "models/gemini-pro" → "gemini-pro"
      const displayName = model.displayName || name;
      const version = model.version || 'unknown';

      console.log(`${index + 1}. ${name}`);
      console.log(`   Display Name: ${displayName}`);
      console.log(`   Version: ${version}`);
      console.log(`   Supported Methods: ${model.supportedGenerationMethods?.join(', ') || 'unknown'}`);
      console.log('');
    });

    // generateContent をサポートしているモデルをフィルタ
    const supportedModels = models
      .filter(m => m.supportedGenerationMethods?.includes('generateContent'))
      .map(m => m.name.split('/').pop());

    console.log(`\n[RECOMMENDED] generateContent をサポートするモデル:`);
    supportedModels.forEach(name => console.log(`  - ${name}`));

    if (supportedModels.length > 0) {
      console.log(`\n[VERDICT] おすすめのモデル: ${supportedModels[0]}`);
      console.log(`実際に daily-crawler.js で使用してください。`);
    }

  } catch (error) {
    console.error(`[ERROR] リクエスト失敗: ${error.message}`);
    process.exit(1);
  }
})();
