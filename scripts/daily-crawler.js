const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require("fs");
const path = require("path");

async function validateUrl(url, facilityName) {
    if (!url || !url.startsWith("http")) return `https://www.google.com/search?q=${encodeURIComponent(facilityName)}`;
    try {
        const headers = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36' };
        const headRes = await fetch(url, { method: 'HEAD', headers });
        if (headRes.ok || headRes.status === 403 || headRes.status === 405) return url;
        const getRes = await fetch(url, { method: 'GET', headers });
        if (getRes.ok || getRes.status === 403 || getRes.status === 405) return url;
    } catch(e) {}
    console.warn(`[WARN] URL ${url} is dead or invalid. Using fallback search link.`);
    return `https://www.google.com/search?q=${encodeURIComponent(facilityName)}`;
}

async function run() {
  try {
    if (!process.env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is missing");

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    // Google Search Groundingを利用して現実の正しいURLを取得させる
    const model = genAI.getGenerativeModel({ 
        model: "gemini-2.5-pro",
        tools: [{ googleSearch: {} }] 
    });

    const filePath = path.join(__dirname, "../app/data/facilities.json");
    
    let existingData = [];
    if (fs.existsSync(filePath)) {
      const fileContent = fs.readFileSync(filePath, "utf-8");
      existingData = JSON.parse(fileContent || "[]");
    }

    const existingNames = existingData.map(d => d.name).join(", ");
    
    const regions = ["関東", "中部", "近畿", "中国", "四国", "九州"]; 
    const randomRegion = regions[Math.floor(Math.random() * regions.length)];

    const prompt = `
あなたは日本の縄文時代における遺跡・貝塚・環状列石などの専門リサーチャーです。
以下の「すでに登録済みの施設リスト」に含まれていない、**日本国内の重要な縄文時代の遺跡・博物館・資料館**を新たに **1件** ピックアップし、JSON形式で出力してください。

【既存リスト（これらは除外してください）】
${existingNames}

【条件】
ターゲット地方: 【${randomRegion}地方】
世界遺産ではない、その土地ならではの遺跡を探してください。

【出力要件】
1. 完全なJSON配列（\`[\{...\}]\`）のみを出力してください。マークダウンのバッククォート不要です。
2. データ構造は以下の通りにしてください：
{
  "id": "英数字のハイフン繋ぎ（例: uenohara-jomon）",
  "name": "施設の正式名称",
  "region": "Chubu", 
  "prefecture": "都道府県名",
  "address": "住所",
  "description": "200文字程度の魅力的な紹介文",
  "url": "Google検索機能を用いて必ず正しい公式ウェブサイトのURLを取得し設定してください（lg.jp, go.jp, or.jp等の公的機関や観光協会など。Googleの検索結果URLは絶対に不可です。どうしても見つからない場合は空文字にして下さい）",
  "thumbnail": "",
  "tags": ["史跡", "博物館", "貝塚", "環状列石"などから1〜2個],
  "lat": 緯度(数値),
  "lng": 経度(数値),
    "access": {
      "info": "最寄り駅やバス停からのルート案内（機械的な見出しや記号は付けず、自然な文章で『〇〇駅から徒歩X分』のように）",
      "advice": "遺跡少年からのアドバイス（『駅からちょっと歩くよ！車で行くのがおすすめ！』など、元気で親しみやすい話し言葉のトーンで）"
    }
  }
}
3. urlは必ず 'http' から始まる有効なURL形式にしてください。
4. thumbnail は空文字（""）にしておいてください。
`;

    console.log("Requesting 1 new facilities from Gemini AI...");
    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    let jsonStr = responseText.trim();
    if (jsonStr.startsWith('```json')) jsonStr = jsonStr.substring(7);
    if (jsonStr.startsWith('```')) jsonStr = jsonStr.substring(3);
    if (jsonStr.endsWith('```')) jsonStr = jsonStr.substring(0, jsonStr.length - 3);
    jsonStr = jsonStr.trim();

    const newFacilities = JSON.parse(jsonStr);

    if (!Array.isArray(newFacilities) || newFacilities.length === 0) {
        throw new Error("AI did not return a valid array of facilities.");
    }

    console.log(`Successfully generated ${newFacilities.length} new facilities.`);

    for (const nf of newFacilities) {
        const isDuplicate = existingData.some(f => f.id === nf.id || f.name.includes(nf.name) || nf.name.includes(f.name));
        if (!isDuplicate) {
            console.log(`Validating URL for ${nf.name}: ${nf.url}`);
            nf.url = await validateUrl(nf.url, nf.name);

            // Pollinations AI will crash with an Internal Server Error if you pass raw Japanese or URL-encoded Japanese that it doesn't like.
            // Sending a purely English string using its ID is much safer.
            const safeName = nf.id.replace(/-/g, ' ');
            const aiPrompt = encodeURIComponent(safeName + " Jomon period historical site in Japan, photorealistic, cinematic lighting");
            const imageUrl = `https://image.pollinations.ai/prompt/${aiPrompt}?width=640&height=640&nologo=true`;
            
            try {
                console.log(`Downloading AI image for ${nf.name} from Pollinations AI...`);
                let success = false;
                for (let attempt = 1; attempt <= 10; attempt++) {
                    const imgRes = await fetch(imageUrl);
                    if (imgRes.ok) {
                        const arrayBuffer = await imgRes.arrayBuffer();
                        const imagePath = path.join(__dirname, '../public/images/facilities', `${nf.id}_ai.png`);
                        fs.writeFileSync(imagePath, Buffer.from(arrayBuffer));
                        console.log(`Successfully saved image to ${imagePath}`);
                        nf.thumbnail = `/images/facilities/${nf.id}_ai.png`;
                        success = true;
                        break;
                    } else if (imgRes.status === 429 || imgRes.status >= 500) {
                        console.warn(`[WARN] HTTP ${imgRes.status} on attempt ${attempt}. Waiting 15s...`);
                        await new Promise(r => setTimeout(r, 15000));
                    } else {
                        throw new Error(`HTTP Error ${imgRes.status}: ${imgRes.statusText}`);
                    }
                }
                if (!success && !nf.thumbnail) {
                    nf.thumbnail = ""; // Leave blank if all attempts failed
                }
            } catch (imgErr) {
                console.error(`Failed to download image for ${nf.name}:`, imgErr);
                nf.thumbnail = "";
            }

            existingData.push(nf);
            console.log(`Added: ${nf.name}`);
        } else {
            console.log(`[PROTECTED] Skipped duplicate facility: ${nf.name}`);
        }
    }
    
    fs.writeFileSync(filePath, JSON.stringify(existingData, null, 2));
    console.log(`Total count: ${existingData.length}`);
    console.log('Finished crawler.');
  } catch (error) {
      console.error("Error:", error.message);
      process.exit(1);
  }
}

run();
