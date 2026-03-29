/**
 * 利用可能なモデル一覧を確認
 */
const API_KEY = process.env.GEMINI_API_KEY20261336;

if (!API_KEY) {
  console.error('GEMINI_API_KEY20261336 is required');
  process.exit(1);
}

async function listModels() {
  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${API_KEY}`;

  try {
    console.log('[DEBUG] Fetching available models...');
    const response = await fetch(url);

    if (!response.ok) {
      const error = await response.text();
      console.error(`[ERROR] HTTP ${response.status}:`);
      console.error(error);
      return;
    }

    const data = await response.json();

    console.log('\n✅ Available Models:');
    console.log('=====================================');

    if (data.models && data.models.length > 0) {
      data.models.forEach(model => {
        const name = model.name.split('/').pop(); // Extract model ID
        const displayName = model.displayName || name;
        const supportedMethods = model.supportedGenerationMethods || [];

        console.log(`\n📌 ${displayName}`);
        console.log(`   ID: ${name}`);
        console.log(`   Methods: ${supportedMethods.join(', ')}`);

        if (supportedMethods.includes('generateContent')) {
          console.log(`   ✓ Supports generateContent`);
        }
      });
    } else {
      console.log('No models found');
    }

  } catch (error) {
    console.error('[FATAL]', error.message);
  }
}

listModels();
