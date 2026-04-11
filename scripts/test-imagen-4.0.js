#!/usr/bin/env node

/**
 * Imagen 4.0 API テストスクリプト
 * 現在も Imagen 4.0 が動作するか確認
 */

const https = require('https');

async function testImagenAPI() {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    console.error('❌ GEMINI_API_KEY 環境変数が設定されていません');
    console.error('例: export GEMINI_API_KEY="your-key-here"');
    process.exit(1);
  }

  const testPrompt = `Jomon period Japan settlement, 10000 years ago. Sunken-floor pithouses with smoke rising, hearth fires, cord-marked pottery visible, stone tools in use. Dense primitive forest. Archaeological documentary style. Cinematic lighting. 16:9 composition. No text, no logo. Realistic.`;

  const requestBody = {
    instances: [{ prompt: testPrompt }],
    parameters: {
      sampleCount: 1,
      aspectRatio: '16:9',
      outputMimeType: 'image/png'
    }
  };

  const url = `https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-generate-001:predict?key=${apiKey}`;

  console.log('🔍 Imagen 4.0 API テスト開始...');
  console.log(`📍 エンドポイント: ${url.split('?')[0]}`);
  console.log(`📝 プロンプト: ${testPrompt.substring(0, 50)}...`);
  console.log('');

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody),
      timeout: 120000
    });

    const responseText = await response.text();
    console.log(`📊 ステータス: ${response.status}`);
    console.log(`📏 レスポンスサイズ: ${responseText.length} 文字`);
    console.log('');

    if (!response.ok) {
      console.error(`❌ エラー`);
      console.error(`ステータス: ${response.status}`);
      console.error(`レスポンス:\n${responseText.substring(0, 500)}`);
      process.exit(1);
    }

    let data;
    try {
      data = JSON.parse(responseText);
    } catch (e) {
      console.error(`❌ JSON パースエラー: ${e.message}`);
      console.error(`レスポンス:\n${responseText.substring(0, 500)}`);
      process.exit(1);
    }

    // 成功チェック
    if (data.predictions && data.predictions.length > 0) {
      const prediction = data.predictions[0];

      if (prediction.bytesBase64Encoded) {
        console.log('✅ Imagen 4.0 API は正常に動作しています！');
        console.log(`   - 画像サイズ（Base64）: ${prediction.bytesBase64Encoded.length} 文字`);
        console.log(`   - 推定ファイルサイズ: 約 ${(prediction.bytesBase64Encoded.length * 0.75 / 1024).toFixed(1)} KB`);
        process.exit(0);
      } else {
        console.error('❌ 予期しないレスポンス形式');
        console.error(`受け取ったフィールド: ${Object.keys(prediction).join(', ')}`);
        console.error(`完全なレスポンス:\n${JSON.stringify(data, null, 2).substring(0, 500)}`);
        process.exit(1);
      }
    } else {
      console.error('❌ 予測結果が空です');
      console.error(`レスポンス: ${JSON.stringify(data, null, 2)}`);
      process.exit(1);
    }
  } catch (error) {
    console.error(`❌ リクエスト失敗: ${error.message}`);

    if (error.message.includes('401') || error.message.includes('permission')) {
      console.error('   → API キーが無効な可能性があります');
    } else if (error.message.includes('403')) {
      console.error('   → API キーに権限がない可能性があります');
    } else if (error.message.includes('404')) {
      console.error('   → エンドポイントが見つかりません（APIが廃止された可能性）');
    }

    process.exit(1);
  }
}

testImagenAPI();
