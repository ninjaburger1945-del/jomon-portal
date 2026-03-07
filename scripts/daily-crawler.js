const fs = require('fs');
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');


// Check for API Key
if (!process.env.GEMINI_API_KEY) {
    console.error("CRITICAL: GEMINI_API_KEY is not set. Cannot run AI crawler.");
    process.exit(1);
}




const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const facilitiesPath = path.join(__dirname, '../app/data/facilities.json');

async function crawlAndGenerate() {
    console.log('--- Daily Auto-Update: Jomon Facility Explorer ---');
    let data = [];
    try {
        data = JSON.parse(fs.readFileSync(facilitiesPath, 'utf-8'));
    } catch (e) {
        console.log("Could not read existing facilities, starting fresh.");
    }

    const existingNames = data.map(f => f.name).join(', ');

    const prompt = `
あなたは日本の縄文時代における遺跡・貝塚・環状列石などの専門リサーチャーです。
以下の「すでに登録済みの施設リスト」に含まれていない、**日本国内の重要な縄文時代の遺跡・博物館・資料館**を新たに **5件** ピックアップし、JSON形式で出力してください。

【既存リスト（これらは除外してください）】
${existingNames}

【出力要件】
1. 完全なJSON配列（\`[\{...\}]\`）のみを出力してください。マークダウンのバッククォート不要です。
2. データ構造は以下の通りにしてください：
{
  "id": "英数字のハイフン繋ぎ（例: uenohara-jomon）",
  "name": "施設の正式名称",
  "prefecture": "都道府県名",
  "address": "住所",
  "description": "200文字程度の魅力的な紹介文",
  "url": "公式ウェブサイトのURL（絶対にlg.jp, go.jp, or.jp, ed.jpなどの信頼できる公的ドメインや、第三セクター・観光協会のURLを推測・検索して設定すること）",
  "thumbnail": "",
  "tags": ["史跡", "博物館", "貝塚", "環状列石"などから1〜2個],
  "lat": 緯度(数値),
  "lng": 経度(数値),
  "access": {
    "info": "最寄り駅からの詳細なルート（例：JR東京駅からバスで15分、「〇〇」下車徒歩5分）。情報が曖昧な場合は自身で現実の路線から「具体的なルート・駅名・時間」を算出・補完すること。絶対に「公式サイト参照」などにしないこと。",
    "rank": "S", // S: 駅から1km以内（徒歩圏内）, A: 駅から1〜5km（バス・タクシー推奨）, B: 駅から5km以上、または山間部（車・レンタカー必須）
    "advice": "遺跡少年からのアドバイス。上記のルートと難易度に完全に一致したアドバイスにすること。（例: Sなら駅近を褒める、Bならレンタカー予約を促す）"
  }
}
3. urlは必ず 'http' から始まる有効なURL形式にしてください。
4. thumbnail は空文字（""）にしておいてください。
`;

    try {
        console.log("Requesting 5 new facilities from Gemini AI...");
        // 「gemini-」をあえて外したこの名前を試してください
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const result = await model.generateContent(prompt);
        const responseText = result.response.text();

        // Clean up potential markdown formatting
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

        // Merge new facilities with explicit protection for existing data (Data Protection / Holy Grounding)
        newFacilities.forEach(nf => {
            const exists = data.find(f => f.id === nf.id || f.name === nf.name);
            if (!exists) {
                data.push(nf);
            } else {
                console.log(`[PROTECTED] Skipped AI modification for existing facility to protect its URL/imageUrl: ${nf.name}`);
            }
        });
        fs.writeFileSync(facilitiesPath, JSON.stringify(data, null, 2));

        console.log('--- Added the following facilities ---');
        newFacilities.forEach(f => {
            console.log(`- ${f.name} (${f.url})`);
        });

        console.log('Finished crawler.');
    } catch (error) {
        console.error("Failed to generate or parse AI content:", error.message);
        process.exit(1);
    }
}

crawlAndGenerate();
