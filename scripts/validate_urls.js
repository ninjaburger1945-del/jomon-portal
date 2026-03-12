#!/usr/bin/env node
/**
 * validate_urls.js
 * facilities.json 内のプレースホルダーURLを検出し、問題があれば exit(1) で終了する。
 * git pre-push フックおよび CI から呼び出されることを想定。
 */

const fs = require('fs');
const path = require('path');

const FACILITIES_PATH = path.resolve(__dirname, '../app/data/facilities.json');

// 許可しないURLパターン（正規表現）
const PLACEHOLDER_PATTERNS = [
  { pattern: /google\.com\/search/i,       label: 'Google検索URL' },
  { pattern: /bing\.com\/search/i,          label: 'Bing検索URL' },
  { pattern: /search\.yahoo\.co\.jp/i,      label: 'Yahoo検索URL' },
  { pattern: /example\.com/i,               label: 'example.com（ダミー）' },
  { pattern: /localhost/i,                   label: 'localhost' },
  { pattern: /^#$/,                          label: 'ハッシュのみ（未設定）' },
];

const data = JSON.parse(fs.readFileSync(FACILITIES_PATH, 'utf-8'));

let errorCount = 0;
const errors = [];

for (const facility of data) {
  if (!facility.url || facility.url.trim() === '') {
    errors.push(`  [MISSING_URL] ${facility.id} (${facility.name})`);
    errorCount++;
    continue;
  }

  for (const { pattern, label } of PLACEHOLDER_PATTERNS) {
    if (pattern.test(facility.url)) {
      errors.push(`  [PLACEHOLDER:${label}] ${facility.id} (${facility.name})\n    URL: ${facility.url}`);
      errorCount++;
      break;
    }
  }
}

if (errorCount > 0) {
  console.error('\n❌ validate_urls: プレースホルダーURLが検出されました。push を中止します。\n');
  errors.forEach(e => console.error(e));
  console.error(`\n合計 ${errorCount} 件の問題があります。正式なURLに修正してから再度 push してください。\n`);
  process.exit(1);
} else {
  console.log(`✅ validate_urls: ${data.length} 件すべてのURLが正常です。`);
  process.exit(0);
}
