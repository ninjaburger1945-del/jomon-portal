const fs = require('fs');
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// APIキーのチェック
if (!process.env.GEMINI_API_KEY) {
    console.error("CRITICAL: GEMINI_API_KEY is not set. Check GitHub Secrets.");
    process.exit(1);
}

// 窓口の初期化
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const facilitiesPath = path.join(__dirname, '../app/data/facilities.json');

async function crawlAndGenerate() {
    console.log('--- Daily Auto-Update: Jomon Facility Explorer ---');
    let data = [];
    try {
        data = JSON.parse(fs.readFileSync(facilitiesPath, 'utf-8'));
    } catch (e) {
        console.log("Starting with an empty database.");
    }

    const existingNames = data.map(f => f.name).join(', ');

    const prompt = `
あなたは縄文時代の専門リサーチャーです。
以下のリストにない、日本国内の重要な縄文遺跡・博物館を新たに5件、JSON形式で出力してください。
【既存リスト】
${existingNames}

【出力要件】
1. 純粋なJSON配列のみ出力（\`[\{...\}]\`）。
2. id, name, prefecture, address, description, url, thumbnail, tags, lat, lng, access (info, rank, advice) を含めること。
`;

    try {
        console.log("Requesting 5 new facilities from Gemini AI...");
        
        // 【決定打】モデル名の前に 'models/' を付与し、apiVersion を 'v1' に固定
        // これが Google API における「最も厳格で確実な」呼び出し方です。
        const model = genAI.getGenerativeModel(
            { model: "models/gemini-1.5-flash" }, 
            { apiVersion: "v1" }
        );

        const result = await model.generateContent(prompt);
        const responseText = result.response.text();

        // マークダウンのゴミを除去
        let jsonStr = responseText.trim();
        if (jsonStr.startsWith('```')) {
            jsonStr = jsonStr.replace(/^```json\s*|```$/g, '');
        }
        jsonStr = jsonStr.trim();

        const newFacilities = JSON.parse(jsonStr);

        if (!Array.isArray(newFacilities)) {
            throw new Error("AI output is not an array");
        }

        // 既存データとのマージ（重複除外）
        newFacilities.forEach(nf => {
            const exists = data.find(f => f.id === nf.id || f.name === nf.name);
            if (!exists) {
                data.push(nf);
            }
        });

        // 保存
        fs.writeFileSync(facilitiesPath, JSON.stringify(data, null, 2));
        console.log(`Successfully added ${newFacilities.length} new facilities.`);
        console.log('Finished crawler successfully.');

    } catch (error) {
        // エラー内容を詳しく出力
        console.error("--- ERROR DETAILS ---");
        console.error("Message:", error.message);
        if (error.stack) console.error("Stack:", error.stack);
        process.exit(1);
    }
}

crawlAndGenerate();
