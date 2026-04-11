#!/usr/bin/env node

/**
 * 縄文ポータル - タグ整理スクリプト
 *
 * 20種類の無秩序なタグを9種類に統廃合する
 * 用途: node scripts/reorganize-tags.js [--apply]
 *
 * オプション:
 *   (なし)   : dry-run（差分表示のみ）
 *   --apply  : facilities.json を上書き保存
 */

const fs = require('fs');
const path = require('path');

const ALLOWED_TAGS = [
  '世界遺産',
  '国宝',
  '環状列石',
  '貝塚',
  '土偶',
  '土器',
  '遺跡公園',
  '体験',
  '博物館'
];

// 自動ルールを上書きする確定割り当て
const MANUAL_OVERRIDE = {
  '004': ['国宝', '土偶'],
  '018': ['世界遺産', '遺跡公園'],
  '031': ['国宝', '土偶'],
  '032': ['遺跡公園', '博物館'],
  '047': ['土器', '博物館'],
  '049': ['国宝', '土偶'],
  '056': ['国宝', '貝塚'],
  '074': ['博物館'],
  '075': ['世界遺産', '体験'],
  '076': ['世界遺産', '博物館'],
  '077': ['貝塚', '遺跡公園'],
  '078': ['土偶', '博物館'],
  '079': ['遺跡公園', '博物館'],
  '080': ['土器', '博物館'],
};

/**
 * 自動判定ルール（優先度順）
 * 優先度: 世界遺産 > 国宝 > 環状列石 > 貝塚 > 土偶 > 土器 > 遺跡公園 > 体験 > 博物館
 */
function autoAssignTags(facility) {
  const d = (facility.description || '').toLowerCase();
  const n = (facility.name || '').toLowerCase();
  const oldTags = facility.tags || [];

  // 優先度順のチェック
  const checks = [
    [
      '世界遺産',
      oldTags.some(t => t.includes('世界遺産'))
    ],
    [
      '国宝',
      oldTags.includes('国宝') || d.includes('国宝')
    ],
    [
      '環状列石',
      oldTags.includes('環状列石') || d.includes('環状列石')
    ],
    [
      '貝塚',
      oldTags.includes('貝塚') || n.includes('貝塚')
    ],
    [
      '土偶',
      oldTags.includes('土偶') || d.includes('土偶')
    ],
    [
      '土器',
      oldTags.includes('土器')
    ],
    [
      '遺跡公園',
      n.includes('公園') || n.includes('の森') || n.includes('パーク') ||
      (d.includes('復元') && d.includes('体験'))
    ],
    [
      '体験',
      d.includes('体験学習') || d.includes('体験できます') || d.includes('体験が充実')
    ],
    [
      '博物館',
      oldTags.includes('博物館') ||
      /博物館|考古館|資料館|縄文館|ミュージアム|センター/.test(n)
    ],
  ];

  // 優先度順に該当したタグを取得（最大2個）
  const matched = checks
    .filter(([, hit]) => hit)
    .map(([tag]) => tag)
    .slice(0, 2);

  return matched;
}

// メイン処理
async function main() {
  const filePath = path.join(__dirname, '../app/data/facilities.json');
  const isDryRun = !process.argv.includes('--apply');

  console.log('\n🏺 縄文ポータル - タグ整理スクリプト');
  console.log(`📄 ファイル: ${filePath}`);
  console.log(`${isDryRun ? '🔍 [DRY RUN]' : '✏️  [APPLY MODE]'}\n`);

  let facilities;
  try {
    facilities = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch (err) {
    console.error(`❌ ファイル読み込みエラー: ${err.message}`);
    process.exit(1);
  }

  console.log(`📊 対象施設数: ${facilities.length}\n`);

  // タグ更新
  let changedCount = 0;
  const changeLog = [];

  facilities.forEach((facility) => {
    const newTags = MANUAL_OVERRIDE[facility.id] ?? autoAssignTags(facility);

    // JSON化して順序を無視して比較
    const oldJSON = JSON.stringify((facility.tags || []).sort());
    const newJSON = JSON.stringify([...newTags].sort());

    if (oldJSON !== newJSON) {
      changedCount++;
      changeLog.push({
        id: facility.id,
        name: facility.name,
        oldTags: facility.tags || [],
        newTags: newTags,
        manual: MANUAL_OVERRIDE[facility.id] ? '✓ 手動確定' : '〇 自動判定'
      });

      // 変更を実際に適用
      facility.tags = newTags;
    }
  });

  // 結果表示
  if (changeLog.length === 0) {
    console.log('✅ 変更対象の施設はありません。\n');
    process.exit(0);
  }

  console.log(`📝 変更対象: ${changedCount}件\n`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  changeLog.forEach((change) => {
    console.log(`[${change.id}] ${change.name} ${change.manual}`);
    console.log(`  旧: ${JSON.stringify(change.oldTags)}`);
    console.log(`  新: ${JSON.stringify(change.newTags)}`);
    console.log('');
  });

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // 新タグ分布
  const tagDistribution = {};
  facilities.forEach((f) => {
    (f.tags || []).forEach((tag) => {
      tagDistribution[tag] = (tagDistribution[tag] || 0) + 1;
    });
  });

  console.log('📊 新タグ分布:');
  Object.entries(tagDistribution)
    .sort((a, b) => b[1] - a[1])
    .forEach(([tag, count]) => {
      console.log(`  ${tag}: ${count}件`);
    });
  console.log('');

  if (isDryRun) {
    console.log('⚠️  [DRY RUN] ファイルは変更されていません。');
    console.log('適用するには以下を実行してください:\n');
    console.log('  node scripts/reorganize-tags.js --apply\n');
    process.exit(0);
  }

  // 実際に保存
  try {
    fs.writeFileSync(filePath, JSON.stringify(facilities, null, 2) + '\n', 'utf-8');
    console.log(`✅ facilities.json を更新しました。(${changedCount}件)\n`);
  } catch (err) {
    console.error(`❌ ファイル保存エラー: ${err.message}\n`);
    process.exit(1);
  }
}

main();
