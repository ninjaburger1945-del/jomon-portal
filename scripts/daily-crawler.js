const fs = require('fs');
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// APIキーのチェック
if (!process.env.GEMINI_API_KEY) {
    console.error("CRITICAL: GEMINI_API_KEY is not set.");
    process.exit(1);
}

// 窓口(v1)を明示的に指定して初期化
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const facilitiesPath = path.join(__dirname, '../app/data/facilities.json');

async function crawlAndGenerate() {
    console.log('--- Daily Auto-Update: Jomon Facility Explorer ---');
    let data = [];
    try {
        data = JSON.parse(fs.readFileSync(facilitiesPath, 'utf-8'));
    } catch (e) {
        console.log("Starting fresh database.");
    }

    const existingNames = data.map(f => f.name).join(', ');

    const prompt = `
あなたは縄文時代の専門リサーチャーです。
以下のリストにない、日本国内の重要な縄文遺跡・博物館を新たに5件、JSON形式で出力してください。
【既存リスト】
${existingNames}

【出力要件】
1. 純粋なJSON配列のみ出力（バッククォート不要）。
2. id, name, prefecture, address, description, url, thumbnail, tags, lat, lng, access (info, rank, advice) を含めること。
`;

    try {
        console.log("Requesting 5 new facilities from Gemini AI (Model: gemini-1.5-flash)...");
        
        // 【最重要】v1窓口を使い、フルパスでモデルを指定する「最強の呼び出し」
        const model = genAI.getGenerativeModel(
            { model: "gemini-1.5-flash" }, 
            { apiVersion: "v1" }
        );

        const result = await model.generateContent(prompt);
        const responseText = result.response.text();

        let jsonStr = responseText.trim();
        if (jsonStr.startsWith('```json')) jsonStr = jsonStr.substring(7);
        if (jsonStr.startsWith('```')) jsonStr = jsonStr.substring(3);
        if (jsonStr.endsWith('```')) jsonStr = jsonStr.substring(0, jsonStr.length - 3);
        jsonStr = jsonStr.trim();

        const newFacilities = JSON.parse(jsonStr);

        newFacilities.forEach(nf => {
            const exists = data.find(f => f.id === nf.id || f.name === nf.name);
            if (!exists) data.push(nf);
        });

        fs.writeFileSync(facilitiesPath, JSON.stringify(data, null, 2));
        console.log(`Successfully added ${newFacilities.length} facilities.`);
        console.log('Finished crawler.');
    } catch (error) {
        console.error("Failed to generate AI content:", error.message);
        process.exit(1);
    }
}

crawlAndGenerate();
