const fs = require('fs');
const path = require('path');
const axios = require('axios');
const cheerio = require('cheerio');
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

async function scrapeOfficialAccess(url) {
    if (!url || !url.startsWith('http')) return null;
    try {
        console.log(`Scraping official site: ${url}`);
        const response = await axios.get(url, {
            timeout: 10000,
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/100.0.4896.127 Safari/537.36' }
        });
        const $ = cheerio.load(response.data);

        // Remove noise
        $('script, style, nav, footer, img').remove();

        const bodyText = $('body').text().replace(/\s+/g, ' ');
        const keywords = ['アクセス', '交通', '徒歩', 'バス', '駅', '車', 'IC', '分'];

        // Simple search around keywords
        let extracted = "";
        for (const kw of keywords) {
            const index = bodyText.indexOf(kw);
            if (index !== -1) {
                // Take a 300 character window around a keyword
                const start = Math.max(0, index - 50);
                const end = Math.min(bodyText.length, index + 250);
                extracted += bodyText.substring(start, end) + " ... ";
            }
        }

        return extracted.length > 50 ? extracted : null;
    } catch (e) {
        console.warn(`Failed to scrape ${url}: ${e.message}`);
        return null;
    }
}

async function processFacility(facility, model) {
    const scrapedText = await scrapeOfficialAccess(facility.url);

    // Fallback info context
    const scrapeContext = scrapedText
        ? `【公式サイトからの抽出テキスト】\n${scrapedText}\n※もしここに「〇〇駅徒歩◯分」など具体的な情報があれば、最優先でそのまま info に採用してください。`
        : `【公式サイト情報】\n抽出できませんでした。`;

    const prompt = `
あなたは日本の縄文時代における遺跡・貝塚・環状列石などの専門リサーチャーであり、「遺跡マニアの先輩」です。
以下の施設へのアクセス情報（info）、難易度（rank）、先輩のアドバイス（advice）をJSON形式のみで出力してください。

【施設情報】
名前: ${facility.name}
住所: ${facility.address}
${scrapeContext}

【生成・判定ロジック】
1. 公式サイトからのテキストに具体的な公共交通ルート（駅名、バス停、徒歩時間）があれば、そのまま「info」に採用してください。
2. 公式テキストが無い、または「詳細はHPへ」のような曖昧な記述しかない場合は、あなたが現実の鉄道路線やバス路線を推測・算出し、「JR〇〇駅からバス〇〇線で15分、『〇〇』下車徒歩〇分」などの【具体的なルート】を作成・補完してください。
3. 確定した「info」を元に、アクセス難易度（rank）を判定します。
   - S: 駅から1km以内、徒歩圏内
   - A: 駅から1〜5km、バスやタクシー推奨
   - B: 駅から5km以上、または山間部。車・レンタカー必須
4. その「info」と「rank」に完全に矛盾しない内容で、遺跡少年からの「advice」を一言作成してください。（例: Sランクなら「歩いて行けるよ！」、Bランクなら「車じゃないと厳しい場所だよ」等）

【出力形式】
JSONのみ（マークダウン記法不要）
{
  "info": "具体的なルート情報",
  "rank": "S",
  "advice": "遺跡少年先輩からのアドバイス"
}
`;

    const result = await model.generateContent(prompt);
    let text = result.response.text().trim();
    if (text.startsWith('```json')) text = text.substring(7);
    if (text.startsWith('```')) text = text.substring(3);
    if (text.endsWith('```')) text = text.substring(0, text.length - 3);

    try {
        return JSON.parse(text.trim());
    } catch {
        console.error("Failed to parse AI output:", text);
        return null;
    }
}

async function runHybridUpdate() {
    console.log(`--- Starting Hybrid Access Update for ${data.length} Facilities ---`);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-pro" });

    let modified = 0;
    for (let i = 0; i < data.length; i++) {
        const facility = data[i];
        console.log(`[${i + 1}/${data.length}] Processing ${facility.name}...`);

        try {
            const accessObj = await processFacility(facility, model);
            if (accessObj) {
                facility.access = accessObj;
                console.log(`  -> Rank ${accessObj.rank} assigned. (Scraped info hybrid used)`);
                modified++;
            }

            // Periodically save
            if (i % 5 === 0) {
                fs.writeFileSync(facilitiesPath, JSON.stringify(data, null, 2));
            }
            await sleep(2000); // Rate limit
        } catch (err) {
            console.error(`  -> ERROR processing ${facility.name}:`, err.message);
        }
    }

    if (modified > 0) {
        fs.writeFileSync(facilitiesPath, JSON.stringify(data, null, 2));
        console.log(`--- Hybrid Access Update Complete (Modified ${modified} items) ---`);
    } else {
        console.log('--- No items modified ---');
    }
}

runHybridUpdate();
