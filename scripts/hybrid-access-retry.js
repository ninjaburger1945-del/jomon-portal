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
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
        });
        const $ = cheerio.load(response.data);
        $('script, style, nav, footer, img').remove();
        const bodyText = $('body').text().replace(/\s+/g, ' ');
        const keywords = ['アクセス', '交通', '徒歩', 'バス', '駅', '車', 'IC', '分'];

        let extracted = "";
        for (const kw of keywords) {
            const index = bodyText.indexOf(kw);
            if (index !== -1) {
                const start = Math.max(0, index - 50);
                const end = Math.min(bodyText.length, index + 250);
                extracted += bodyText.substring(start, end) + " ... ";
            }
        }
        return extracted.length > 50 ? extracted : null;
    } catch (e) {
        console.warn(`[WARN] Failed to scrape ${url}: ${e.message}`);
        return null;
    }
}

async function processFacility(facility, model) {
    const scrapedText = await scrapeOfficialAccess(facility.url);
    const scrapeContext = scrapedText
        ? `【公式サイトからの抽出テキスト】\n${scrapedText}\n※もしここに「〇〇駅徒歩◯分」など具体的な情報があれば、最優先でそのまま info に採用してください。`
        : `【公式サイト情報】\n抽出できませんでした。`;

    const prompt = `あなたは「遺跡マニアの先輩」です。以下の施設へのアクセス情報（info）、難易度（rank）、先輩のアドバイス（advice）をJSON形式のみで出力してください。

【施設】
名前: ${facility.name}住所: ${facility.address}
${scrapeContext}

【生成ルール】
1. 公式テキストにある具体的なルート情報を最優先し整理して info とする。
2. 情報が不足している場合は現実の地図路線に基づき具体的なルート(駅名,バス・徒歩の時間)を算出補完。
3. rankはS(徒歩圏) A(バス) B(車必須)のいずれか。
4. adviceはinfo/rankに合致する親切な一言アドバイス。

【出力】
{"info": "...", "rank": "S", "advice": "..."}
`;

    let retries = 3;
    while (retries > 0) {
        try {
            const result = await model.generateContent({
              contents: [{ role: 'user', parts: [{ text: prompt }] }],
              tools: [],
              generationConfig: {
                temperature: 0.1,
                maxOutputTokens: 2048
              }
            });
            let text = result.response.text().trim();
            if (text.startsWith('```json')) text = text.substring(7);
            if (text.startsWith('```')) text = text.substring(3);
            if (text.endsWith('```')) text = text.substring(0, text.length - 3);

            return JSON.parse(text.trim());
        } catch (e) {
            if (e.message.includes('429')) {
                console.warn("Rate limited! Sleeping for 60 seconds...");
                await sleep(60000);
                retries--;
            } else {
                console.error("AI Generation failed:", e.message);
                return null;
            }
        }
    }
    return null;
}

async function runHybridUpdate() {
    console.log(`--- Starting Hybrid Access Update (with rate limit handling) ---`);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" }); // using flash to hit limits less

    let modified = 0;
    for (let i = 0; i < data.length; i++) {
        const facility = data[i];
        console.log(`[${i + 1}/${data.length}] Processing ${facility.name}...`);

        try {
            const accessObj = await processFacility(facility, model);
            if (accessObj) {
                facility.access = accessObj;
                console.log(`  -> Rank ${accessObj.rank} (AI Success)`);
                modified++;
            }
            fs.writeFileSync(facilitiesPath, JSON.stringify(data, null, 2));
            await sleep(4000); // Strict 4s delay between each to bypass limits
        } catch (err) {
            console.error(`  -> ERROR:`, err.message);
        }
    }

    console.log(`--- Hybrid Access Update Complete (Modified ${modified} items) ---`);
}

runHybridUpdate();
