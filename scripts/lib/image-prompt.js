/**
 * 遺跡固有情報連動プロンプトエンジン
 *
 * 機能：
 * - Gemini API でdescriptionから特徴的なキーワードを3つ抽出
 * - 抽出したキーワードを含むプロンプトを動的に生成
 * - Gemini未設定時は従来プロンプトにfallback
 */

const API_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent";
const API_KEY = process.env.GEMINI_API_KEY20261336;

/**
 * Gemini API でキーワードを抽出
 * @param {string} facilityName - 遺跡名
 * @param {string} description - 遺跡の解説文
 * @returns {Promise<string[]|null>} - [keyword1, keyword2, keyword3] または null
 */
async function extractKeywords(facilityName, description) {
  // Gemini API キーが未設定なら即座にnullを返す
  if (!API_KEY) {
    console.log(`[PROMPT] ⚠️ GEMINI_API_KEY が未設定のため、キーワード抽出をスキップします`);
    return null;
  }

  try {
    const systemPrompt = `以下の遺跡解説文から、画像化した際に最も特徴的になる具体的なキーワードを3つだけ抽出してください。
優先順位：
  ①具体的な遺物（土器名、装飾品、石器など）
  ②地質的特徴（地形、地層、海岸線など）
  ③建築形態（竪穴住居、柱穴、祭祀遺構など）

出力形式：keyword1, keyword2, keyword3（英語で、カンマ区切り、説明不要、キーワードのみ）
例："Dogū figurine, shell midden, pit dwelling"`;

    const userPrompt = `遺跡名: ${facilityName}\n\n解説文:\n${description}`;

    const response = await fetch(API_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: systemPrompt },
              { text: userPrompt }
            ]
          }
        ]
      })
    }).then(res => {
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      return res.json();
    });

    // Gemini のレスポンスパース
    const textContent = response?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!textContent) {
      console.warn(`[PROMPT] ⚠️ Gemini レスポンスが空です`);
      return null;
    }

    // "keyword1, keyword2, keyword3" をパース
    const keywords = textContent
      .split(',')
      .map(kw => kw.trim())
      .filter(kw => kw.length > 0);

    if (keywords.length === 3) {
      console.log(`[PROMPT] ✅ キーワード抽出成功: ${keywords.join(', ')}`);
      return keywords;
    } else {
      console.warn(`[PROMPT] ⚠️ キーワードが3つ抽出できませんでした（${keywords.length}個）: ${textContent}`);
      return null;
    }

  } catch (error) {
    console.warn(`[PROMPT] ⚠️ キーワード抽出失敗（${error.message}）。従来プロンプトを使用します`);
    return null;
  }
}

/**
 * 抽出したキーワードを含むプロンプトを生成
 * @param {string} facilityName - 遺跡名
 * @param {string} description - 遺跡の解説文（fallback用）
 * @param {string[]|null} keywords - [kw1, kw2, kw3] または null
 * @returns {string} - 画像生成APIに渡すプロンプト文字列
 */
function buildPrompt(facilityName, description, keywords) {
  if (keywords && keywords.length === 3) {
    // 【新型プロンプト】遺跡固有キーワード連動版
    return `A realistic, high-definition documentary photograph of ${facilityName}. `
         + `The composition focuses strictly on the specific historical details mentioned in the text: `
         + `${keywords[0]}, ${keywords[1]}, and ${keywords[2]}. `
         + `The scene captures the unique atmosphere of the site, whether it be sunny, misty, or raw, depending on its location. `
         + `Shot on a professional camera with natural lighting. `
         + `The image must be borderless and contain no text.`;
  }

  // 【Fallback プロンプト】Gemini 未設定 or 抽出失敗時
  return `Jomon period archaeological site: ${facilityName}. ${description.substring(0, 150)}. `
       + `Ancient pottery, shell middens, stone circles, warm earthy tones, `
       + `educational value, photorealistic, National Geographic documentary style`;
}

/**
 * 遺跡用プロンプトを生成（キーワード抽出 + プロンプト合成）
 * @param {string} facilityName - 遺跡名
 * @param {string} description - 遺跡の解説文
 * @returns {Promise<string>} - 画像生成APIに渡すプロンプト文字列
 */
async function generatePrompt(facilityName, description) {
  const keywords = await extractKeywords(facilityName, description);
  return buildPrompt(facilityName, description, keywords);
}

module.exports = { generatePrompt };
