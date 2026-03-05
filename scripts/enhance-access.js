const fs = require('fs');
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');

if (!process.env.GEMINI_API_KEY) {
    console.error("CRITICAL: GEMINI_API_KEY is not set.");
    process.exit(1);
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const facilitiesPath = path.join(__dirname, '../app/data/facilities.json');
const data = JSON.parse(fs.readFileSync(facilitiesPath, 'utf-8'));

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function enhanceAll() {
    console.log(`--- Starting Enhancement of ${data.length} Facilities ---`);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-pro" });

    // バッチサイズで分割してAPI制限を避ける
    const BATCH_SIZE = 5;
    for (let i = 0; i < data.length; i += BATCH_SIZE) {
        const batch = data.slice(i, i + BATCH_SIZE);
        console.log(`Processing batch ${Math.floor(i / BATCH_SIZE) + 1} of ${Math.ceil(data.length / BATCH_SIZE)}...`);

        const prompt = `
あなたは日本の縄文時代における遺跡・貝塚・環状列石などの専門リサーチャーであり、同時に「遺跡マニアの先輩（ちょっと熱血で親切）」です。
以下の施設リストについて、正確なアクセス情報と難易度ランクを付与し、さらに先輩からの「各難易度エリアに合わせた親切なアドバイス」を添えてJSON配列のみを出力してください。

【施設情報】
${JSON.stringify(batch.map(f => ({ id: f.id, name: f.name, address: f.address })), null, 2)}

【出力要件】
1. 完全なJSON配列（\`[\{...\}]\`）のみを返し、マークダウンを含めない。
2. 以下の構造で各施設のオブジェクトを構成すること:
{
  "id": "施設ID（入力と一致させること）",
  "access": {
    "info": "最寄り駅からの詳細なルート（例：JR東京駅からバスで15分、「〇〇」下車徒歩5分）",
    "rank": "S", // S: 駅から1km以内（徒歩圏内）, A: 駅から1〜5km（バス・タクシー推奨）, B: 駅から5km以上、または山間部（車・レンタカー必須）
    "advice": "遺跡少年先輩からのアドバイス（例：ここは駅から歩けるからお散歩に最高！駅前の〇〇でご飯も食べられるよ！）"
  }
}
3. 存在する鉄道やバス路線の現実の情報を元にできるだけ正確に記述すること。
`;

        try {
            const result = await model.generateContent(prompt);
            let responseText = result.response.text().trim();
            if (responseText.startsWith('```json')) responseText = responseText.substring(7);
            if (responseText.startsWith('```')) responseText = responseText.substring(3);
            if (responseText.endsWith('```')) responseText = responseText.substring(0, responseText.length - 3);
            responseText = responseText.trim();

            const enhancements = JSON.parse(responseText);

            enhancements.forEach(enh => {
                const target = data.find(f => f.id === enh.id);
                if (target) {
                    target.access = enh.access;
                    console.log(`[SUCCESS] Augmented data for ${target.name} (Rank: ${target.access.rank})`);
                }
            });

            // Save continuously in case of crash
            fs.writeFileSync(facilitiesPath, JSON.stringify(data, null, 2));

            // Limit rate slightly
            await sleep(2000);
        } catch (err) {
            console.error(`[ERROR] Failed to fetch data for batch starting at index ${i}:`, err.message);
        }
    }

    console.log('--- Enhancement Complete ---');
}

enhanceAll();
