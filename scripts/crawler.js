const fs = require('fs');
const path = require('path');
const axios = require('axios');
const cheerio = require('cheerio');

// 情報収集対象の施設URLリスト
const TARGETS = [
    {
        id: 'sannaimaruyama',
        name: '特別史跡 三内丸山遺跡',
        url: 'https://sannaimaruyama.pref.aomori.jp/',
        // セレクターは公式サイトの構造に合わせて調整（プロトタイプ用の仮設定）
        selector: '.news-list li',
    }
];

// データを保存するパス
const OUTPUT_PATH = path.join(__dirname, '../app/data/news.json');

async function crawl() {
    console.log('--- クローリング開始 ---');
    const allNews = [];

    for (const target of TARGETS) {
        try {
            console.log(`[取得中] ${target.name} (${target.url})`);

            // AxiosでHTMLを取得
            const response = await axios.get(target.url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' // Bot弾きを回避するためのおまじない
                }
            });

            // CheerioでHTMLをパース
            const $ = cheerio.load(response.data);
            const newsItems = [];

            // 指定されたセレクターに従って情報を抽出（最初の5件）
            $(target.selector).slice(0, 5).each((i, el) => {
                // ※ 実際のサイトの構造（aタグ、spanタグ等）に合わせて取得ロジックは微調整が必要です
                const date = $(el).find('time, .date, span').first().text().trim() || new Date().toISOString().split('T')[0];
                const title = $(el).find('a').text().trim() || $(el).text().trim();
                const rawLink = $(el).find('a').attr('href');

                // 相対パスの場合は絶対URLに変換
                let link = rawLink;
                if (link && link.startsWith('/')) {
                    const urlObj = new URL(target.url);
                    link = `${urlObj.protocol}//${urlObj.host}${link}`;
                }

                if (title) {
                    newsItems.push({
                        facilityId: target.id,
                        facilityName: target.name,
                        date,
                        title,
                        link: link || target.url
                    });
                }
            });

            console.log(`=> ${newsItems.length}件のニュースを取得しました。`);
            allNews.push(...newsItems);

        } catch (error) {
            console.error(`[エラー] ${target.name}の取得に失敗しました:`, error.message);
        }
    }

    // 取得結果をJSONファイルとして保存
    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(allNews, null, 2), 'utf-8');
    console.log(`\n--- クローリング完了 ---`);
    console.log(`最新データを ${OUTPUT_PATH} に保存しました。`);
}

crawl();
