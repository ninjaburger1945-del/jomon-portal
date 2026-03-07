const fs = require('fs');
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// 1. APIキーのチェック
if (!process.env.GEMINI_API_KEY) {
    console.error("CRITICAL: GEMINI_API_KEY is not set.");
    process.exit(1);
}

// 2. 初期化（apiVersionをあえて指定せず、SDKのデフォルトに任せます）
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
1. 純粋なJSON配列のみ出力（バッククォート不要）。
2. id, name, prefecture, address, description, url, thumbnail, tags, lat, lng, access (info, rank, advice) を含めること。
`;

    try {
        console.log("Requesting 5 new facilities from Gemini AI (Model: gemini-1.5-flash)...");
        
        // 3. 最もシンプルで「通る」指定方法
        // YAML側の @latest インストールと組み合わせることで、これが最強の1行になります。
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        const result = await model.generateContent(prompt);
        const responseText = result.response.text();

        // 4. JSON抽出のガード処理
        let jsonStr = responseText.trim();
        if (jsonStr.startsWith('```')) {
            jsonStr = jsonStr.replace(/^```json\s*|```$/g, '');
        }
        jsonStr
