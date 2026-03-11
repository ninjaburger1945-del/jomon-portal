require('dotenv').config({ path: '.env.local' });
const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require("fs");
const path = require("path");

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function run() {
    if (!process.env.GEMINI_API_KEY) {
        console.error("No GEMINI_API_KEY found in .env.local or process environment.");
        process.exit(1);
    }
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    // Use gemini-2.5-flash since this is a simple text transformation task, it's faster and cheaper
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const filePath = path.join(__dirname, "../app/data/facilities.json");
    let data = JSON.parse(fs.readFileSync(filePath, "utf-8"));

    let updatedCount = 0;

    for (const facility of data) {
        if (!facility.access) continue;
        
        // Target only the old format which has [公共交通機関でのアクセス] or [AIによる補足] or mentions '難易度【x】です。'
        const hasOldFormatInfo = facility.access.info.includes('[公共交通機関でのアクセス]') || facility.access.info.includes('最も近い公共交通機関の駅から遠い');
        const hasOldFormatAdvice = facility.access.advice.includes('[AIによる補足]') || facility.access.advice.includes('難易度【');

        if (hasOldFormatInfo || hasOldFormatAdvice) {
            console.log(`Processing: ${facility.name} (${facility.id})`);
            
            const prompt = `
あなたは日本の縄文時代における遺跡・貝塚などをナビゲートする元気で頼もしい「遺跡少年」です。
以下の硬い形式で書かれたアクセス情報とアドバイスを、サイトの雰囲気に合わせた親しみやすい話し言葉のトーンに書き直してください。
ただし、必要な事実（最寄り駅、バス停、徒歩時間、難易度が高いか低いか、注意点など）は絶対に落とさずに含めること。
見出し「[公共交通機関でのアクセス]」や「[AIによる補足]」といった機械的な表現は削除してください。
アクセス情報は淡白すぎず、アドバイスは「遺跡少年」として元気な口調でお願いします。

--- 元データ ---
施設名: ${facility.name}
元のアクセス情報(info):
${facility.access.info}

元のアドバイス(advice):
${facility.access.advice}
----------------

出力は以下のJSON形式の配列を必ず守り、マークダウンブロック(\`\`\`json など)は付けずに直接テキストで出力してください。
[
  "書き直したアクセス情報(info)",
  "書き直した遺跡少年のアドバイス(advice)"
]
`;

            let success = false;
            let attempts = 0;
            while (!success && attempts < 3) {
                try {
                    const result = await model.generateContent(prompt);
                    let respText = result.response.text();
                    respText = respText.replace(/```json/g, '').replace(/```/g, '').trim();
                    const parsed = JSON.parse(respText);
                    
                    if (Array.isArray(parsed) && parsed.length === 2) {
                        facility.access.info = parsed[0];
                        facility.access.advice = parsed[1];
                        console.log(`  -> info: ${facility.access.info.substring(0, 30)}...`);
                        console.log(`  -> advice: ${facility.access.advice.substring(0, 30)}...`);
                        updatedCount++;
                        success = true;
                    } else {
                        console.warn('  Invalid JSON array format returned. Retrying...');
                    }
                } catch (e) {
                    console.error('  Error processing:', e.message);
                }
                attempts++;
                await sleep(1500); // Prevent hitting simple Gemini rate limits
            }
        }
    }

    if (updatedCount > 0) {
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
        console.log(`Successfully rewrote access text for ${updatedCount} facilities.`);
    } else {
        console.log("No old-format access info found.");
    }
}

run();
