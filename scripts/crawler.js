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
        selector: '#top_cont_news li',
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
            require('fs').writeFileSync('sannai.html', response.data);
            const $ = cheerio.load(response.data);
            const newsItems = [];

            // 汎用的なセレクターでニュースアイテム候補を取得
            const selectors = [
                target.selector,
                '.news-list li', '.info-list li', 'ul.news li', 'dl.news', '.topics li', 'article', '.list-news li',
                '.top-news li', '.information li', '#news li', '#topics li', 'ul.whatsnew li', 'ul.info li',
                '.p-top-news__item'
            ].filter(Boolean);

            let elements = null;
            for (const sel of selectors) {
                const els = $(sel);
                if (els.length > 0) {
                    elements = els;
                    console.log(`セレクター '${sel}' で ${els.length} 件の要素を見つけました。`);
                    break;
                }
            }

            if (elements) {
                elements.slice(0, 5).each((i, el) => {
                    // 日付の取得: time, .date, span などから
                    let dateStr = $(el).find('time, .date, .day, span').first().text().trim();
                    // 日付っぽい文字列がない場合のフォールバック（YYYY.MM.DD や YYYY/MM/DD などを探す）
                    if (!dateStr || !/\d{4}[年./-]?\d{1,2}[月./-]?\d{1,2}/.test(dateStr)) {
                        const text = $(el).text();
                        const match = text.match(/\d{4}[年./-]?\d{1,2}[月./-]?\d{1,2}/);
                        if (match) {
                            dateStr = match[0];
                        } else {
                            dateStr = new Date().toISOString().split('T')[0];
                        }
                    } else {
                        // 余計な改行などを除去
                        dateStr = dateStr.replace(/\s+/g, ' ');
                    }

                    // タイトルの取得: aタグのテキスト、なければ要素全体のテキスト
                    let title = $(el).find('a').text().trim();
                    if (!title) {
                        title = $(el).text().trim().replace(/\s+/g, ' ');
                        // 日付部分が含まれていたら除去してみる
                        if (title.includes(dateStr)) {
                            title = title.replace(dateStr, '').trim();
                        }
                    }

                    // リンクの取得
                    const rawLink = $(el).find('a').attr('href');

                    // 相対パスの場合は絶対URLに変換
                    let link = rawLink;
                    if (link && !link.startsWith('http')) {
                        try {
                            const urlObj = new URL(target.url);
                            if (link.startsWith('/')) {
                                link = `${urlObj.protocol}//${urlObj.host}${link}`;
                            } else {
                                link = `${urlObj.href.replace(/\/+$/, '')}/${link}`;
                            }
                        } catch (e) {
                            // パースエラー時は元のURLにする
                            link = target.url;
                        }
                    }

                    if (title && title.length > 0 && title !== dateStr) {
                        newsItems.push({
                            facilityId: target.id,
                            facilityName: target.name,
                            date: dateStr,
                            title,
                            link: link || target.url
                        });
                    }
                });
            }

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
